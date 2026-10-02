import React, { useEffect, useState, useTransition } from "react";
import { Brain, CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { confirmPublishedTopicMutation } from "@/lib/course-authoring/topic-workflow";

interface MemoryCheckSectionProps {
  topicId: string;
  readOnly?: boolean;
  isPublished?: boolean;
  onMutationSuccess?: () => void;
}

type DraftOption = { id?: string; content: string; is_correct: boolean };
type QuestionDraft = {
  questionId: string | null;
  content: string;
  explanation: string;
  options: DraftOption[];
};

const EMPTY_DRAFT: QuestionDraft = {
  questionId: null,
  content: "",
  explanation: "",
  options: [
    { content: "", is_correct: true },
    { content: "", is_correct: false },
    { content: "", is_correct: false },
  ],
};

function optionLabel(index: number) {
  let label = "";
  let cursor = index;
  do {
    label = String.fromCharCode(65 + (cursor % 26)) + label;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);
  return label;
}

// D3: memory check là stage tùy chọn trước bài tập. Learner phải trả lời đúng hết mới
// mở bài tập; bộ rỗng nghĩa là bài học bỏ qua bước này (Decision 15 sửa đổi).
export default function MemoryCheckSection({
  topicId,
  readOnly = false,
  isPublished = false,
  onMutationSuccess,
}: MemoryCheckSectionProps) {
  const [memoryCheck, setMemoryCheck] = useState<MemoryCheck | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FullExerciseQuestion | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      const res = await getMemoryCheckByTopicId(topicId);
      if (!isMounted) return;
      if (res.error) setLoadError(res.error);
      else {
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
  const isLastQuestion = questions.length === 1;

  const afterMutation = (message?: string) => {
    if (message) toast.success(message);
    setRefreshKey((key) => key + 1);
    onMutationSuccess?.();
  };

  const openAdd = () => {
    if (readOnly) return;
    setDraftError(null);
    setDraft({ ...EMPTY_DRAFT, options: EMPTY_DRAFT.options.map((option) => ({ ...option })) });
  };

  const openEdit = (question: FullExerciseQuestion) => {
    if (readOnly) return;
    setDraftError(null);
    setDraft({
      questionId: question.id,
      content: question.content,
      explanation: question.explanation ?? "",
      options: question.options.map((option) => ({
        id: option.id,
        content: option.content,
        is_correct: option.is_correct,
      })),
    });
  };

  const updateOption = (index: number, patch: Partial<DraftOption>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            options: current.options.map((option, i) => {
              if (patch.is_correct) return { ...option, is_correct: i === index };
              return i === index ? { ...option, ...patch } : option;
            }),
          }
        : current,
    );
  };

  const removeOption = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      const options = current.options.filter((_, i) => i !== index);
      if (!options.some((option) => option.is_correct)) {
        options[0] = { ...options[0], is_correct: true };
      }
      return { ...current, options };
    });
  };

  const handleSave = () => {
    if (!draft || readOnly) return;
    const payload = {
      content: draft.content,
      explanation: draft.explanation.trim() || undefined,
      options: draft.options,
    };
    const parsed = memoryCheckQuestionSchema.safeParse(payload);
    if (!parsed.success) {
      // Giữ nguyên dialog và dữ liệu đã nhập để teacher sửa tiếp.
      setDraftError(parsed.error.issues[0].message);
      return;
    }

    const confirmPublished = isPublished
      ? confirmPublishedTopicMutation(draft.questionId ? "Việc sửa câu memory check" : "Việc thêm câu memory check")
      : false;
    if (isPublished && !confirmPublished) return;

    startTransition(async () => {
      const res = draft.questionId
        ? await updateQuestion(
            draft.questionId,
            parsed.data.content,
            parsed.data.explanation ?? null,
            draft.options,
            confirmPublished,
          )
        : await addMemoryCheckQuestion(topicId, parsed.data, confirmPublished);

      if (res.error) {
        setDraftError(res.error);
        return;
      }
      setDraft(null);
      afterMutation(res.message);
    });
  };

  const handleDelete = () => {
    if (!deleting || readOnly) return;
    const confirmPublished = isPublished
      ? confirmPublishedTopicMutation(isLastQuestion ? "Việc gỡ memory check" : "Việc xóa câu memory check")
      : false;
    if (isPublished && !confirmPublished) return;

    startTransition(async () => {
      // Câu cuối không xóa lẻ được (bộ phải có ít nhất một câu), nên gỡ cả bộ memory check.
      const res = isLastQuestion && memoryCheck
        ? await deleteExercise(memoryCheck.id, confirmPublished)
        : await deleteQuestion(deleting.id, confirmPublished);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setDeleting(null);
      afterMutation(isLastQuestion ? "Đã gỡ memory check khỏi bài học." : res.message);
    });
  };

  return (
    <section
      aria-labelledby="memory-check-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="memory-check-heading" className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Brain className="text-violet-600" aria-hidden="true" /> Memory check
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Tùy chọn</span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Câu hỏi nhanh học viên phải trả lời đúng hết trước khi mở bài tập. Câu sai sẽ quay lại cho tới khi đúng.
          </p>
        </div>
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 md:hidden">
          Tính năng soạn nội dung học phù hợp hơn trên màn hình lớn. Vui lòng dùng máy tính để thêm hoặc chỉnh sửa memory check.
        </p>
        <Button
          onClick={openAdd}
          disabled={readOnly || isLoading || !!loadError}
          className="hidden rounded-[8px] bg-violet-600 px-5 text-white shadow-sm hover:bg-violet-700 md:inline-flex"
        >
          <Plus size={18} className="mr-2" aria-hidden="true" /> Thêm câu memory check
        </Button>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" aria-label="Đang tải memory check" />
          </div>
        ) : loadError ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {loadError}
          </p>
        ) : questions.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center">
            <p className="font-bold text-slate-700">Bài học chưa có memory check</p>
            <p className="mt-1 text-sm text-slate-500">
              Học viên sẽ đi thẳng từ flashcard sang bài tập. Thêm câu đầu tiên nếu muốn kiểm tra ghi nhớ trước.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {questions.map((question, index) => (
              <li key={question.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-slate-800">
                    <span className="mr-2 text-slate-400">Câu {index + 1}.</span>
                    {question.content}
                  </p>
                  {!readOnly ? (
                    <div className="hidden shrink-0 gap-1 md:flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Sửa câu memory check ${index + 1}`}
                        className="h-9 w-9 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => openEdit(question)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa câu memory check ${index + 1}`}
                        className="h-9 w-9 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => setDeleting(question)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <li
                      key={option.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        option.is_correct
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <span className="font-bold">{option.label || optionLabel(optionIndex)}.</span>
                      <span className="flex-1">{option.content}</span>
                      {option.is_correct ? (
                        <span className="flex items-center gap-1 text-xs font-bold">
                          <CheckCircle2 size={14} aria-hidden="true" /> Đúng
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {question.explanation ? (
                  <p className="mt-3 text-sm text-slate-500">Giải thích: {question.explanation}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <Dialog open={!!draft && !readOnly} onOpenChange={(open) => !open && !isPending && setDraft(null)}>
        <DialogContent className="bg-white sm:max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {draft?.questionId ? "Sửa câu memory check" : "Thêm câu memory check"}
            </DialogTitle>
            <DialogDescription>Cần ít nhất 2 đáp án và chọn 1 đáp án đúng.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto py-2 pr-1">
              <div>
                <label htmlFor="memory-question-content" className="mb-2 block text-xs font-bold uppercase text-slate-500">
                  Nội dung câu hỏi
                </label>
                <Input
                  id="memory-question-content"
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  className="h-12 rounded-lg font-bold"
                />
              </div>
              <div>
                <label htmlFor="memory-question-explanation" className="mb-2 block text-xs font-bold uppercase text-slate-500">
                  Giải thích (tùy chọn)
                </label>
                <Textarea
                  id="memory-question-explanation"
                  value={draft.explanation}
                  onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                  className="min-h-20 resize-none rounded-lg"
                  placeholder="Hiện cho học viên khi trả lời sai"
                />
              </div>
              <fieldset>
                <legend className="mb-3 block text-xs font-bold uppercase text-slate-500">
                  Các đáp án (chọn đáp án đúng)
                </legend>
                <div className="space-y-3">
                  {draft.options.map((option, index) => (
                    <div key={option.id || index} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-2">
                      <input
                        type="radio"
                        name="memory_correct_option"
                        aria-label={`Đáp án ${optionLabel(index)} là đáp án đúng`}
                        className="ml-2 h-5 w-5"
                        checked={option.is_correct}
                        onChange={() => updateOption(index, { is_correct: true })}
                      />
                      <span className="w-6 text-center text-sm font-bold text-slate-500">{optionLabel(index)}</span>
                      <Input
                        aria-label={`Nội dung đáp án ${optionLabel(index)}`}
                        value={option.content}
                        onChange={(e) => updateOption(index, { content: e.target.value })}
                        className="h-10 flex-1 rounded-lg bg-white"
                      />
                      {draft.options.length > 2 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Bỏ đáp án ${optionLabel(index)}`}
                          className="h-9 w-9 text-slate-400 hover:text-rose-600"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDraft({ ...draft, options: [...draft.options, { content: "", is_correct: false }] })
                    }
                    className="w-full rounded-[8px] border-dashed font-bold text-violet-700 hover:bg-violet-50"
                  >
                    <Plus size={16} className="mr-2" aria-hidden="true" /> Thêm đáp án {optionLabel(draft.options.length)}
                  </Button>
                </div>
              </fieldset>
              {draftError ? (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {draftError}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-2 flex justify-end gap-3">
            <Button variant="outline" disabled={isPending} onClick={() => setDraft(null)} className="rounded-[8px]">
              Hủy
            </Button>
            <Button
              disabled={isPending}
              onClick={handleSave}
              className="rounded-[8px] bg-violet-600 text-white hover:bg-violet-700"
            >
              {isPending ? <Loader2 className="animate-spin" size={18} aria-label="Đang lưu" /> : "Lưu câu hỏi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting && !readOnly} onOpenChange={(open) => !open && !isPending && setDeleting(null)}>
        <DialogContent className="bg-white sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>{isLastQuestion ? "Gỡ memory check" : "Xóa câu memory check"}</DialogTitle>
            <DialogDescription>
              {isLastQuestion
                ? "Đây là câu cuối cùng. Xóa câu này sẽ gỡ memory check khỏi bài học và học viên sẽ đi thẳng sang bài tập."
                : "Xóa câu hỏi và các đáp án của câu này khỏi memory check."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" disabled={isPending} onClick={() => setDeleting(null)}>
              Hủy
            </Button>
            <Button
              disabled={isPending}
              onClick={handleDelete}
              className="rounded-[8px] bg-rose-600 text-white hover:bg-rose-700"
            >
              {isPending ? <Loader2 className="animate-spin" size={18} aria-label="Đang xóa" /> : isLastQuestion ? "Gỡ memory check" : "Xóa câu hỏi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
