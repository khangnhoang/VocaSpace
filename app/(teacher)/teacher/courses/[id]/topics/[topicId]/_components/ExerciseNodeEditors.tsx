"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteQuestionGroupMedia,
  updateExerciseBasic,
  updateQuestion,
  updateQuestionGroup,
} from "@/app/actions/exercise";
import {
  getToeicVisibleGroupContextFields,
  questionGroupAudioUrlSchema,
  questionGroupImageUrlSchema,
  validateQuestionGroupToeicContext,
  type FullExercise,
  type FullExerciseGroup,
  type FullExerciseQuestion,
} from "@/lib/schemas/exercise";
import {
  describeAnswerImpact,
  describeAnswerImpactTitle,
  getQuestionAnswerImpact,
  hasAnswerImpact,
} from "@/lib/course-authoring/published-edit-impact";
import { usePublishedEditWarning } from "@/app/(teacher)/teacher/courses/[id]/_components/PublishedEditWarning";
import type { CourseAuthoringSuccessEvent } from "@/lib/course-authoring/issue-success";
import EditorFrame, { FieldError } from "./EditorFrame";
import { WorkbenchPreview } from "./AuthoringWorkbench";
import { GroupContextPreview, QuestionPreview } from "./LearnerPreview";
import QuestionGroupMediaField, { type UploadedQuestionGroupMedia } from "./QuestionGroupMediaField";
import { OptionListEditor, type DraftOption } from "./authoring-options";
import { useRegisterAuthoringEditor, useSingleFlightSave } from "./authoring-guard";
import { TOEIC_PART_LABELS } from "./exercise-outline";

interface CommonEditorProps {
  readOnly: boolean;
  onSaved: () => void;
  onAuthoringSuccess?: (event: CourseAuthoringSuccessEvent) => boolean;
  dashboardBadge?: boolean;
}

function DashboardBadge() {
  return (
    <span className="rounded-md border border-route-line bg-route-quiet px-2 py-0.5 text-xs font-semibold text-route">
      Được dashboard đánh dấu
    </span>
  );
}

// Giữ ref luôn trỏ tới giá trị mới nhất để guard đọc dirty/save ngoài vòng render.
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export function ExerciseBasicEditor({
  exercise,
  readOnly,
  onSaved,
  onDelete,
  dashboardBadge,
}: CommonEditorProps & { exercise: FullExercise; onDelete?: () => void }) {
  const id = useId();
  const [title, setTitle] = useState(exercise.title);
  const [baseline, setBaseline] = useState(exercise.title);
  const [titleError, setTitleError] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSignal, setSavedSignal] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDirty = title !== baseline;
  const groupCount = exercise.groups?.length ?? 0;
  const questionCount =
    (exercise.groups ?? []).reduce((total, group) => total + (group.questions?.length ?? 0), 0) +
    (exercise.questions?.length ?? 0);

  const save = async () => {
    if (readOnly) return false;
    if (title.trim().length < 4) {
      setTitleError("Tên bài tập phải dài hơn 3 ký tự.");
      inputRef.current?.focus();
      return false;
    }
    setIsSaving(true);
    setSaveError(null);
    const res = await updateExerciseBasic(exercise.id, title, exercise.part_type);
    setIsSaving(false);
    if (res.error) {
      if (res.error.includes("Tên bài tập")) {
        setTitleError(res.error);
        inputRef.current?.focus();
      } else {
        setSaveError(res.error);
      }
      return false;
    }
    toast.success(res.message);
    setBaseline(title);
    setSavedSignal((signal) => signal + 1);
    onSaved();
    return true;
  };

  const flight = useSingleFlightSave();
  const runSave = () => flight.run(save);
  const latest = useLatest({ isDirty, save: runSave });
  useRegisterAuthoringEditor(
    readOnly
      ? null
      : {
          isDirty: () => latest.current.isDirty,
          save: () => latest.current.save(),
          pendingSave: flight.pending,
          discard: () => {
            setTitle(baseline);
            setTitleError("");
            setSaveError(null);
          },
          label: "Thông tin bài tập",
        },
  );

  return (
    <EditorFrame
      eyebrow="Bài tập"
      title={exercise.title}
      badge={dashboardBadge ? <DashboardBadge /> : null}
      isDirty={isDirty}
      isSaving={isSaving}
      savedSignal={savedSignal}
      readOnly={readOnly}
      error={saveError}
      onSave={() => void runSave()}
      onDelete={onDelete}
      deleteLabel="Xóa bài tập"
    >
      <div>
        <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-semibold text-slate-800">
          Tên bài tập <span className="text-correction" aria-hidden="true">*</span>
        </label>
        <Input
          id={`${id}-title`}
          ref={inputRef}
          name="edit_exercise_title"
          value={title}
          disabled={readOnly}
          aria-required
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${id}-title-error` : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError("");
          }}
          className="h-11"
        />
        <FieldError id={`${id}-title-error`} message={titleError} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">Loại bài</p>
        <p className="mt-0.5 text-sm text-slate-900">
          {TOEIC_PART_LABELS[exercise.part_type]?.title ?? exercise.part_type}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Không đổi được loại bài sau khi tạo. Cần cấu trúc khác thì tạo bài tập mới.
        </p>
      </div>
      <p className="text-sm text-slate-600">
        {groupCount > 0 ? `${groupCount} nhóm · ` : ""}
        {questionCount} câu hỏi. Chọn nhóm hoặc câu trong danh sách để sửa nội dung.
      </p>
      <WorkbenchPreview>
        <div className="rounded-2xl border border-slate-300 bg-white p-4">
          <p className="text-xs font-semibold tracking-[0.04em] text-recall uppercase">
            {TOEIC_PART_LABELS[exercise.part_type]?.short ?? exercise.part_type}
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">
            {title.trim() || "Tên bài tập"}
          </p>
          <p className="mt-1 text-sm text-slate-600">{questionCount} câu hỏi</p>
        </div>
      </WorkbenchPreview>
    </EditorFrame>
  );
}

export function GroupEditor({
  topicId,
  exercise,
  group,
  groupIndex,
  readOnly,
  onSaved,
  onAuthoringSuccess,
  dashboardBadge,
}: CommonEditorProps & {
  topicId: string;
  exercise: FullExercise;
  group: FullExerciseGroup;
  groupIndex: number;
}) {
  const id = useId();
  const initial = {
    passage: group.passage_text || "",
    audio: group.audio_url || "",
    image: group.image_url || "",
  };
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [errors, setErrors] = useState<{ passage?: string; audio?: string; image?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSignal, setSavedSignal] = useState(0);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedQuestionGroupMedia[]>([]);
  const visibleFields = getToeicVisibleGroupContextFields(exercise.part_type);
  const isDirty =
    draft.passage !== baseline.passage || draft.audio !== baseline.audio || draft.image !== baseline.image;

  const focusField = (name: string) => {
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus();
    });
  };

  const cleanupUploads = async (mediaList: UploadedQuestionGroupMedia[]) => {
    if (mediaList.length === 0) return;
    const results = await Promise.allSettled(
      mediaList.map((media) => deleteQuestionGroupMedia(media.bucket, media.path)),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn("[QUESTION GROUP MEDIA EDIT CLEANUP REJECTED]:", result.reason);
      } else if ("error" in result.value) {
        console.warn("[QUESTION GROUP MEDIA EDIT CLEANUP ERROR]:", mediaList[index], result.value.error);
      }
    });
    setUploadedMedia((current) =>
      current.filter((item) => !mediaList.some((media) => media.bucket === item.bucket && media.path === item.path)),
    );
  };

  const save = async () => {
    if (readOnly) return false;
    const audio = questionGroupAudioUrlSchema.safeParse(draft.audio);
    const image = questionGroupImageUrlSchema.safeParse(draft.image);
    const nextErrors: typeof errors = {
      audio: audio.success ? undefined : audio.error.issues[0].message,
      image: image.success ? undefined : image.error.issues[0].message,
    };
    if (!audio.success || !image.success) {
      setErrors(nextErrors);
      focusField(!audio.success ? "edit_group_audio_url" : "edit_group_image_url");
      return false;
    }
    const context = validateQuestionGroupToeicContext(exercise.part_type, {
      passage_text: draft.passage,
      audio_url: audio.data,
      image_url: image.data,
    });
    if (!context.success) {
      const key = context.field === "passage_text" ? "passage" : context.field === "audio_url" ? "audio" : "image";
      setErrors({ [key]: context.message });
      focusField(`edit_group_${context.field}`);
      return false;
    }
    setErrors({});
    setIsSaving(true);
    setSaveError(null);
    const res = await updateQuestionGroup(group.id, draft.passage, draft.audio, draft.image);
    if (res.error) {
      // Tệp vừa tải lên cho lần sửa này không được lưu, nên dọn khỏi Storage và bỏ khỏi form.
      const mediaToCleanup = [...uploadedMedia];
      await cleanupUploads(mediaToCleanup);
      setDraft((current) => ({
        ...current,
        audio: mediaToCleanup.some((media) => media.reference === current.audio) ? "" : current.audio,
        image: mediaToCleanup.some((media) => media.reference === current.image) ? "" : current.image,
      }));
      setIsSaving(false);
      if (res.error.includes("âm thanh")) setErrors({ audio: res.error });
      else if (res.error.includes("hình ảnh")) setErrors({ image: res.error });
      else if (res.error.toLowerCase().includes("đoạn văn")) setErrors({ passage: res.error });
      setSaveError(res.error);
      return false;
    }
    setIsSaving(false);
    const handled = onAuthoringSuccess?.({ type: "question_group_updated", questionGroupId: group.id }) ?? false;
    if (!handled) toast.success(res.message);
    setUploadedMedia([]);
    setBaseline(draft);
    setSavedSignal((signal) => signal + 1);
    onSaved();
    return true;
  };

  const flight = useSingleFlightSave();
  const runSave = () => flight.run(save);
  const latest = useLatest({ isDirty, save: runSave, uploadedMedia, baseline });
  useRegisterAuthoringEditor(
    readOnly
      ? null
      : {
          isDirty: () => latest.current.isDirty,
          save: () => latest.current.save(),
          pendingSave: flight.pending,
          discard: () => {
            void cleanupUploads(latest.current.uploadedMedia);
            setDraft(latest.current.baseline);
            setErrors({});
            setSaveError(null);
          },
          label: `Nhóm ${groupIndex + 1}`,
        },
  );

  const trackUpload = (media: UploadedQuestionGroupMedia) =>
    setUploadedMedia((current) => [
      ...current.filter((item) => item.bucket !== media.bucket || item.path !== media.path),
      media,
    ]);
  const forgetUpload = (media: UploadedQuestionGroupMedia) =>
    setUploadedMedia((current) => current.filter((item) => item.bucket !== media.bucket || item.path !== media.path));

  return (
    <EditorFrame
      eyebrow={`${exercise.title} · Ngữ liệu`}
      title={`Nhóm ${groupIndex + 1}`}
      badge={dashboardBadge ? <DashboardBadge /> : null}
      isDirty={isDirty}
      isSaving={isSaving}
      savedSignal={savedSignal}
      readOnly={readOnly}
      error={saveError}
      onSave={() => void runSave()}
    >
      <p className="text-sm text-slate-600">{TOEIC_PART_LABELS[exercise.part_type]?.needs}</p>
      {visibleFields.includes("passage_text") ? (
        <div>
          <label htmlFor={`${id}-passage`} className="mb-1.5 block text-sm font-semibold text-slate-800">
            Đoạn văn
          </label>
          <Textarea
            id={`${id}-passage`}
            name="edit_group_passage_text"
            value={draft.passage}
            disabled={readOnly}
            aria-invalid={errors.passage ? true : undefined}
            aria-describedby={errors.passage ? `${id}-passage-error` : undefined}
            onChange={(event) => {
              setDraft((current) => ({ ...current, passage: event.target.value }));
              setErrors((current) => ({ ...current, passage: undefined }));
            }}
            className="min-h-40 resize-y"
            placeholder="Nhập đoạn văn cho nhóm câu hỏi…"
          />
          <FieldError id={`${id}-passage-error`} message={errors.passage} />
        </div>
      ) : null}
      {visibleFields.includes("audio_url") ? (
        <QuestionGroupMediaField
          topicId={topicId}
          groupId={group.id}
          type="audio"
          label="Audio"
          inputName="edit_group_audio_url"
          value={draft.audio}
          error={errors.audio}
          onChange={(value) => {
            setDraft((current) => ({ ...current, audio: value }));
            setErrors((current) => ({ ...current, audio: undefined }));
          }}
          onUploaded={trackUpload}
          onDeleted={forgetUpload}
          disabled={isSaving || readOnly}
        />
      ) : null}
      {visibleFields.includes("image_url") ? (
        <QuestionGroupMediaField
          topicId={topicId}
          groupId={group.id}
          type="image"
          label="Hình ảnh"
          inputName="edit_group_image_url"
          value={draft.image}
          error={errors.image}
          onChange={(value) => {
            setDraft((current) => ({ ...current, image: value }));
            setErrors((current) => ({ ...current, image: undefined }));
          }}
          onUploaded={trackUpload}
          onDeleted={forgetUpload}
          disabled={isSaving || readOnly}
        />
      ) : null}
      <WorkbenchPreview>
        <GroupContextPreview
          groupId={group.id}
          passage={draft.passage}
          audioUrl={draft.audio}
          imageUrl={draft.image}
          savedAudioUrl={group.audio_url}
          savedImageUrl={group.image_url}
        />
        {(group.questions ?? []).map((question, index) => (
          <QuestionPreview
            key={question.id}
            content={question.content}
            options={question.options}
            numberLabel={`Câu ${index + 1}.`}
          />
        ))}
      </WorkbenchPreview>
    </EditorFrame>
  );
}

function sortOptions(question: FullExerciseQuestion): DraftOption[] {
  return question.options
    .slice()
    .sort(
      (a, b) =>
        (a.order_index ?? Number.MAX_SAFE_INTEGER) - (b.order_index ?? Number.MAX_SAFE_INTEGER) ||
        (a.label || "").localeCompare(b.label || "") ||
        a.id.localeCompare(b.id),
    )
    .map((option) => ({ id: option.id, content: option.content, is_correct: option.is_correct }));
}

export function QuestionEditor({
  exercise,
  question,
  questionIndex,
  group,
  readOnly,
  isPublished,
  onSaved,
  onDelete,
  onAuthoringSuccess,
  dashboardBadge,
}: CommonEditorProps & {
  exercise: FullExercise;
  question: FullExerciseQuestion;
  questionIndex: number;
  group: FullExerciseGroup | null;
  isPublished: boolean;
  onDelete?: () => void;
}) {
  const id = useId();
  const publishedWarning = usePublishedEditWarning();
  const initial = {
    content: question.content,
    explanation: question.explanation || "",
    options: sortOptions(question),
  };
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<{ content?: string; options?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSignal, setSavedSignal] = useState(0);
  const contentRef = useRef<HTMLInputElement | null>(null);
  const isDirty = JSON.stringify(draft) !== baseline;

  const save = async () => {
    if (readOnly) return false;
    if (!draft.content.trim()) {
      setErrors({ content: "Vui lòng nhập nội dung câu hỏi." });
      contentRef.current?.focus();
      return false;
    }
    const cleanOptions = draft.options
      .map((option) => ({ id: option.id, content: option.content.trim(), is_correct: option.is_correct }))
      .filter((option) => option.content !== "");
    if (cleanOptions.length < 2) {
      setErrors({ options: "Câu hỏi phải có ít nhất 2 đáp án hợp lệ." });
      return false;
    }
    if (!cleanOptions.some((option) => option.is_correct)) {
      setErrors({ options: "Câu hỏi phải có ít nhất 1 đáp án đúng hợp lệ." });
      return false;
    }
    setErrors({});

    // Chỉ hỏi sau khi dữ liệu hợp lệ và trước khi gọi server: hủy thì không có request nào.
    if (isPublished) {
      const impact = getQuestionAnswerImpact(question.options, cleanOptions);
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
    const res = await updateQuestion(question.id, draft.content, draft.explanation || null, cleanOptions);
    setIsSaving(false);
    if (res.error) {
      setSaveError(res.error);
      return false;
    }
    const handled = onAuthoringSuccess?.({ type: "question_updated", questionId: question.id }) ?? false;
    if (!handled) toast.success(res.message);
    setBaseline(JSON.stringify(draft));
    setSavedSignal((signal) => signal + 1);
    onSaved();
    return true;
  };

  const flight = useSingleFlightSave();
  const runSave = () => flight.run(save);
  const latest = useLatest({ isDirty, save: runSave, baseline });
  useRegisterAuthoringEditor(
    readOnly
      ? null
      : {
          isDirty: () => latest.current.isDirty,
          save: () => latest.current.save(),
          pendingSave: flight.pending,
          discard: () => {
            setDraft(JSON.parse(latest.current.baseline));
            setErrors({});
            setSaveError(null);
          },
          label: `Câu ${questionIndex + 1}`,
        },
  );

  return (
    <EditorFrame
      eyebrow={group ? `${exercise.title} · Nhóm câu hỏi` : exercise.title}
      title={`Câu ${questionIndex + 1}`}
      badge={dashboardBadge ? <DashboardBadge /> : null}
      isDirty={isDirty}
      isSaving={isSaving}
      savedSignal={savedSignal}
      readOnly={readOnly}
      error={saveError}
      onSave={() => void runSave()}
      onDelete={onDelete}
      deleteLabel="Xóa câu hỏi"
    >
      <div>
        <label htmlFor={`${id}-content`} className="mb-1.5 block text-sm font-semibold text-slate-800">
          Nội dung câu hỏi <span className="text-correction" aria-hidden="true">*</span>
        </label>
        <Input
          id={`${id}-content`}
          ref={contentRef}
          value={draft.content}
          disabled={readOnly}
          aria-required
          aria-invalid={errors.content ? true : undefined}
          aria-describedby={errors.content ? `${id}-content-error` : undefined}
          onChange={(event) => {
            setDraft((current) => ({ ...current, content: event.target.value }));
            setErrors((current) => ({ ...current, content: undefined }));
          }}
          className="h-11"
        />
        <FieldError id={`${id}-content-error`} message={errors.content} />
      </div>
      <OptionListEditor
        idPrefix={id}
        options={draft.options}
        disabled={readOnly}
        error={errors.options}
        onChange={(options) => {
          setDraft((current) => ({ ...current, options }));
          setErrors((current) => ({ ...current, options: undefined }));
        }}
      />
      <div>
        <label htmlFor={`${id}-explanation`} className="mb-1.5 block text-sm font-semibold text-slate-800">
          Giải thích đáp án <span className="font-normal text-slate-600">(tùy chọn)</span>
        </label>
        <Textarea
          id={`${id}-explanation`}
          value={draft.explanation}
          disabled={readOnly}
          placeholder="Căn cứ để chọn đáp án đúng…"
          onChange={(event) => setDraft((current) => ({ ...current, explanation: event.target.value }))}
          className="min-h-20 resize-y"
        />
      </div>
      <WorkbenchPreview>
        {group ? (
          <GroupContextPreview
            groupId={group.id}
            passage={group.passage_text}
            audioUrl={group.audio_url}
            imageUrl={group.image_url}
            savedAudioUrl={group.audio_url}
            savedImageUrl={group.image_url}
          />
        ) : null}
        <QuestionPreview
          content={draft.content}
          options={draft.options}
          explanation={draft.explanation}
          numberLabel={`Câu ${questionIndex + 1}.`}
        />
      </WorkbenchPreview>
      {publishedWarning.dialog}
    </EditorFrame>
  );
}
