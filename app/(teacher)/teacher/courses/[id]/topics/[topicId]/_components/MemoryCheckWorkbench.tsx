"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Brain, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addMemoryCheckQuestion,
  deleteExercise,
  deleteQuestion,
  getMemoryCheckByTopicId,
  updateQuestion,
} from "@/app/actions/exercise";
import {
  memoryCheckQuestionSchema,
  type FullExerciseQuestion,
  type MemoryCheck,
} from "@/lib/schemas/exercise";
import {
  PUBLISHED_DELETE_IMPACT,
  describeAnswerImpact,
  describeAnswerImpactTitle,
  getQuestionAnswerImpact,
  hasAnswerImpact,
} from "@/lib/course-authoring/published-edit-impact";
import {
  PublishedImpactNotice,
  usePublishedEditWarning,
} from "@/app/(teacher)/teacher/courses/[id]/_components/PublishedEditWarning";
import AuthoringWorkbench, { LIST_HEADER_CLASS, ListSearchField } from "./AuthoringWorkbench";
import EditorFrame, { EmptyEditorPanel, FieldError } from "./EditorFrame";
import { QuestionPreview } from "./LearnerPreview";
import { OptionListEditor, buildEmptyOptions, getOptionProblem, type DraftOption } from "./authoring-options";
import { useAuthoringGuard, useRegisterAuthoringEditor, useSingleFlightSave } from "./authoring-guard";
import { matchesSearch } from "./authoring-search";

interface MemoryCheckWorkbenchProps {
  topicId: string;
  isActive?: boolean;
  readOnly?: boolean;
  isPublished?: boolean;
  onMutationSuccess?: () => void;
}

type Selection = { mode: "new" } | { mode: "edit"; questionId: string };

type Draft = { content: string; explanation: string; options: DraftOption[] };

const emptyDraft = (): Draft => ({ content: "", explanation: "", options: buildEmptyOptions(3) });

function toDraft(question: FullExerciseQuestion): Draft {
  return {
    content: question.content,
    explanation: question.explanation ?? "",
    options: question.options.map((option) => ({
      id: option.id,
      content: option.content,
      is_correct: option.is_correct,
    })),
  };
}

const snapshot = (draft: Draft) => JSON.stringify(draft);

// D3: memory check là stage tùy chọn trước bài tập. Học viên phải trả lời đúng hết mới mở
// bài tập; bộ rỗng nghĩa là bài học bỏ qua bước này.
export default function MemoryCheckWorkbench({
  topicId,
  isActive = true,
  readOnly = false,
  isPublished = false,
  onMutationSuccess,
}: MemoryCheckWorkbenchProps) {
  const guard = useAuthoringGuard();
  const idPrefix = useId();
  const publishedWarning = usePublishedEditWarning();
  const [memoryCheck, setMemoryCheck] = useState<MemoryCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [baseline, setBaseline] = useState(() => snapshot(emptyDraft()));
  const [fieldErrors, setFieldErrors] = useState<{ content?: string; options?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSignal, setSavedSignal] = useState(0);
  const [deleting, setDeleting] = useState<FullExerciseQuestion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLInputElement | null>(null);
  const saveFlight = useSingleFlightSave();
  const draftRef = useRef(draft);
  const baselineRef = useRef(baseline);
  useEffect(() => {
    draftRef.current = draft;
    baselineRef.current = baseline;
  });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const res = await getMemoryCheckByTopicId(topicId);
      if (!isMounted) return;
      if (res.error) {
        setLoadError(res.error);
      } else {
        setLoadError(null);
        setMemoryCheck(res.data ?? null);
      }
      setIsLoading(false);
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [topicId, refreshKey]);

  const questions = memoryCheck?.questions ?? [];
  const isDirty = snapshot(draft) !== baseline;
  const selectedIndex =
    selection?.mode === "edit" ? questions.findIndex((question) => question.id === selection.questionId) : -1;
  const selectedQuestion = selectedIndex >= 0 ? questions[selectedIndex] : null;
  const isLastQuestion = questions.length === 1;

  const loadDraft = (next: Draft) => {
    setDraft(next);
    setBaseline(snapshot(next));
    setFieldErrors({});
    setSaveError(null);
  };

  const openSelection = (next: Selection | null) => {
    setSavedSignal(0);
    setSelection(next);
    if (next?.mode === "edit") {
      const question = questions.find((item) => item.id === next.questionId);
      loadDraft(question ? toDraft(question) : emptyDraft());
    } else {
      loadDraft(emptyDraft());
    }
    if (next && !readOnly) requestAnimationFrame(() => contentRef.current?.focus());
  };

  const requestSelection = async (next: Selection | null) => {
    if (selection?.mode === "edit" && next?.mode === "edit" && selection.questionId === next.questionId) return true;
    if (guard.hasDirtyEditor() && !(await guard.confirmLeave())) return false;
    openSelection(next);
    return true;
  };

  const save = async (after: "stay" | "next"): Promise<boolean> => {
    if (readOnly || !selection) return false;
    const current = draftRef.current;
    const parsed = memoryCheckQuestionSchema.safeParse({
      content: current.content,
      explanation: current.explanation.trim() || undefined,
      options: current.options,
    });
    if (!parsed.success) {
      const errors: { content?: string; options?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "content" ? "content" : "options";
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      if (errors.content) contentRef.current?.focus();
      return false;
    }
    setFieldErrors({});

    // Chỉ sửa câu đã lưu mới có thể bỏ đáp án hoặc đổi đáp án đúng. Hỏi trước khi gọi server:
    // hủy thì không có request nào và dữ liệu đang nhập được giữ nguyên.
    const savedQuestion =
      selection.mode === "edit" ? questions.find((question) => question.id === selection.questionId) : undefined;
    if (isPublished && savedQuestion) {
      const impact = getQuestionAnswerImpact(savedQuestion.options, current.options);
      if (hasAnswerImpact(impact)) {
        const confirmed = await publishedWarning.confirm({
          title: describeAnswerImpactTitle(impact),
          description: describeAnswerImpact(impact),
          confirmText: "Vẫn lưu thay đổi",
        });
        if (!confirmed) return false;
      }
    }

    setIsSaving(true);
    setSaveError(null);
    const res =
      selection.mode === "edit"
        ? await updateQuestion(
            selection.questionId,
            parsed.data.content,
            parsed.data.explanation ?? null,
            current.options,
          )
        : await addMemoryCheckQuestion(topicId, parsed.data);
    setIsSaving(false);
    if (res.error) {
      setSaveError(res.error);
      return false;
    }

    toast.success(res.message);
    onMutationSuccess?.();
    setRefreshKey((key) => key + 1);
    if (after === "next") {
      openSelection({ mode: "new" });
    } else if (selection.mode === "new") {
      openSelection(null);
    } else {
      setBaseline(snapshot(current));
      setSavedSignal((signal) => signal + 1);
    }
    return true;
  };

  useRegisterAuthoringEditor(
    selection && !readOnly
      ? {
          isDirty: () => snapshot(draftRef.current) !== baselineRef.current,
          save: () => saveFlight.run(() => save("stay")),
          pendingSave: saveFlight.pending,
          discard: () => {
            setDraft(JSON.parse(baselineRef.current) as Draft);
            setFieldErrors({});
            setSaveError(null);
          },
          label: "Câu memory check đang sửa",
        }
      : null,
  );

  const confirmDelete = async () => {
    if (!deleting || readOnly) return;
    setIsDeleting(true);
    // Câu cuối không xóa lẻ được (bộ phải có ít nhất một câu), nên gỡ cả bộ memory check.
    const res =
      isLastQuestion && memoryCheck ? await deleteExercise(memoryCheck.id) : await deleteQuestion(deleting.id);
    setIsDeleting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(isLastQuestion ? "Đã gỡ memory check khỏi bài học." : res.message);
    if (selection?.mode === "edit" && selection.questionId === deleting.id) {
      setSelection(null);
      loadDraft(emptyDraft());
    }
    setDeleting(null);
    setRefreshKey((key) => key + 1);
    onMutationSuccess?.();
  };

  const editorTitle =
    selection?.mode === "edit" ? `Câu ${selectedIndex + 1}` : "Câu memory check mới";

  const matchesQuery = (question: FullExerciseQuestion) =>
    matchesSearch(query, [question.content, ...question.options.map((option) => option.content)]);

  const list = (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white">
      <div className={LIST_HEADER_CLASS}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Câu memory check</h2>
            <p className="text-xs font-medium text-slate-600">
              {isLoading ? "Đang tải…" : questions.length === 0 ? "Tùy chọn · chưa có câu nào" : `Tùy chọn · ${questions.length} câu`}
            </p>
          </div>
          {!readOnly ? (
            <Button
              type="button"
              onClick={() => void requestSelection({ mode: "new" })}
              disabled={isLoading || !!loadError}
              className="min-h-11 lg:min-h-9"
            >
              <Plus aria-hidden="true" /> Thêm câu
            </Button>
          ) : null}
        </div>
        {questions.length > 0 ? (
          <ListSearchField
            id={`${idPrefix}-search`}
            label="Tìm câu memory check"
            placeholder="Tìm theo câu hỏi hoặc đáp án"
            value={query}
            onChange={setQuery}
          />
        ) : null}
      </div>
      <p className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-6 text-slate-600">
        Học viên phải trả lời đúng hết các câu này trước khi mở bài tập. Câu sai sẽ quay lại cho tới khi đúng.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600" role="status">
          <Loader2 className="size-5 animate-spin text-route" aria-hidden="true" /> Đang tải memory check…
        </div>
      ) : loadError ? (
        <div className="space-y-3 px-4 py-6" role="alert">
          <p className="text-sm font-medium text-correction">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>
            Tải lại
          </Button>
        </div>
      ) : questions.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Brain className="mx-auto size-8 text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-slate-900">Bài học chưa có memory check</p>
          <p className="mt-1 text-sm text-slate-600">
            Học viên sẽ đi thẳng từ flashcard sang bài tập.
            {readOnly ? "" : " Thêm câu đầu tiên nếu muốn kiểm tra ghi nhớ trước."}
          </p>
        </div>
      ) : !questions.some(matchesQuery) ? (
        <p className="px-4 py-8 text-center text-sm text-slate-600">Không có câu nào khớp “{query.trim()}”.</p>
      ) : (
        <ol className="divide-y divide-slate-100 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto">
          {questions.map((question, index) => {
            // Lọc tại đây để giữ số thứ tự thật của câu trong bộ câu hỏi.
            if (!matchesQuery(question)) return null;
            const isSelected = selection?.mode === "edit" && selection.questionId === question.id;
            const problem = getOptionProblem(question.options);
            return (
              <li key={question.id}>
                <button
                  type="button"
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => void requestSelection({ mode: "edit", questionId: question.id })}
                  className={`relative flex min-h-14 w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left outline-none narrow-tall:scroll-mt-48 transition-colors duration-[120ms] focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-inset motion-reduce:transition-none ${
                    isSelected ? "bg-route-quiet" : "hover:bg-slate-50"
                  }`}
                >
                  {isSelected ? (
                    <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-route" aria-hidden="true" />
                  ) : null}
                  <span className={`text-xs font-bold ${isSelected ? "text-route" : "text-slate-600"}`}>
                    Câu {index + 1} · {question.options.length} đáp án
                  </span>
                  <span className="line-clamp-2 text-sm font-medium text-slate-900">{question.content}</span>
                  {problem ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-attention">
                      <span className="size-1.5 rounded-full bg-attention" aria-hidden="true" /> {problem}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );

  const contentId = `${idPrefix}-content`;
  const explanationId = `${idPrefix}-explanation`;

  const editor = selection ? (
    <EditorFrame
      eyebrow={selection.mode === "edit" ? "Sửa câu memory check" : "Thêm câu memory check"}
      title={editorTitle}
      isDirty={isDirty}
      isSaving={isSaving}
      savedSignal={savedSignal}
      readOnly={readOnly}
      error={saveError}
      onSave={() => void saveFlight.run(() => save("stay"))}
      onSaveAndNext={() => void saveFlight.run(() => save("next"))}
      onDelete={selection.mode === "edit" && selectedQuestion ? () => setDeleting(selectedQuestion) : undefined}
      deleteLabel={isLastQuestion ? "Gỡ memory check" : "Xóa câu hỏi"}
    >
      <div>
        <label htmlFor={contentId} className="mb-1.5 block text-sm font-semibold text-slate-800">
          Nội dung câu hỏi <span className="text-correction" aria-hidden="true">*</span>
        </label>
        <Input
          id={contentId}
          ref={contentRef}
          value={draft.content}
          disabled={readOnly}
          aria-required
          aria-invalid={fieldErrors.content ? true : undefined}
          aria-describedby={fieldErrors.content ? `${contentId}-error` : undefined}
          onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
          className="h-11"
        />
        <FieldError id={`${contentId}-error`} message={fieldErrors.content} />
      </div>
      <OptionListEditor
        idPrefix={idPrefix}
        options={draft.options}
        disabled={readOnly}
        error={fieldErrors.options}
        onChange={(options) => setDraft((current) => ({ ...current, options }))}
      />
      <div>
        <label htmlFor={explanationId} className="mb-1.5 block text-sm font-semibold text-slate-800">
          Giải thích <span className="font-normal text-slate-600">(tùy chọn)</span>
        </label>
        <Textarea
          id={explanationId}
          value={draft.explanation}
          disabled={readOnly}
          placeholder="Hiện cho học viên khi trả lời sai"
          onChange={(event) => setDraft((current) => ({ ...current, explanation: event.target.value }))}
          className="min-h-20 resize-y"
        />
      </div>
    </EditorFrame>
  ) : null;

  return (
    <>
      <AuthoringWorkbench
        label="câu memory check"
        list={list}
        editor={editor}
        isActive={isActive}
        isEditorOpen={selection !== null}
        editorTitle={editorTitle}
        onRequestClose={() => requestSelection(null)}
        preview={
          selection ? (
            <QuestionPreview
              content={draft.content}
              options={draft.options}
              explanation={draft.explanation}
              numberLabel={selection.mode === "edit" ? `Câu ${selectedIndex + 1}.` : undefined}
            />
          ) : null
        }
        emptyEditor={
          <EmptyEditorPanel
            icon={<Brain aria-hidden="true" />}
            title={readOnly ? "Chọn một câu để xem" : "Chọn một câu để sửa"}
            description="Bản xem trước hiện câu hỏi đúng như học viên thấy, kèm đáp án đúng được đánh dấu."
            action={
              !readOnly && !isLoading && !loadError ? (
                <Button type="button" variant="outline" onClick={() => void requestSelection({ mode: "new" })}>
                  <Plus aria-hidden="true" /> Thêm câu
                </Button>
              ) : null
            }
          />
        }
      />

      <Dialog open={!!deleting && !readOnly} onOpenChange={(open) => !open && !isDeleting && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isLastQuestion ? "Gỡ memory check" : "Xóa câu memory check"}</DialogTitle>
            <DialogDescription>
              {isLastQuestion
                ? "Đây là câu cuối cùng. Xóa câu này sẽ gỡ memory check khỏi bài học và học viên sẽ đi thẳng sang bài tập."
                : "Xóa câu hỏi và các đáp án của câu này khỏi memory check."}
            </DialogDescription>
          </DialogHeader>
          {isPublished ? (
            <PublishedImpactNotice>
              {isLastQuestion ? PUBLISHED_DELETE_IMPACT.memory_check : PUBLISHED_DELETE_IMPACT.memory_check_question}
            </PublishedImpactNotice>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {isLastQuestion ? "Gỡ memory check" : "Xóa câu hỏi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {publishedWarning.dialog}
    </>
  );
}
