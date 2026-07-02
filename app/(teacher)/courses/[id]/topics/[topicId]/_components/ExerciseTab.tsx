// app/(teacher)/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx
import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  HelpCircle,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getExercisesByTopicId,
  deleteExercise,
  deleteQuestion,
  updateExerciseBasic,
  updateQuestionGroup,
  updateQuestion,
  deleteQuestionGroupMedia,
} from "@/app/actions/exercise";
import {
  FullExercise,
  FullExerciseQuestion,
  FullExerciseGroup,
  FullExerciseOption,
  getToeicVisibleGroupContextFields,
  questionGroupAudioUrlSchema,
  questionGroupImageUrlSchema,
  validateQuestionGroupToeicContext,
} from "@/lib/schemas/exercise";
import AddExerciseDialog from "./AddExerciseDialog";
import QuestionGroupMediaField, {
  QuestionGroupMediaPreview,
  type UploadedQuestionGroupMedia,
} from "./QuestionGroupMediaField";
import DashboardIssueNotice from "@/app/(teacher)/courses/[id]/_components/DashboardIssueNotice";
import type { TopicBuilderIssueContext } from "@/lib/course-authoring/issue-context";
import type { CourseAuthoringSuccessEvent } from "@/lib/course-authoring/issue-success";
import {
  resolveExerciseIssueGuidance,
  type DashboardIssueGuidance,
} from "@/lib/course-authoring/issue-guidance";

interface ExerciseTabProps {
  topicId: string;
  dashboardIssueContext?: TopicBuilderIssueContext | null;
  onDismissDashboardIssue?: () => void;
  staleTargetRedirectHref?: string;
  onAuthoringSuccess?: (event: CourseAuthoringSuccessEvent) => boolean;
}

function getDashboardTargetElementId(guidance: DashboardIssueGuidance | null) {
  if (!guidance) return null;

  if (guidance.targetQuestionId) {
    return `dashboard-question-${guidance.targetQuestionId}`;
  }

  if (guidance.targetGroupId) {
    return `dashboard-group-${guidance.targetGroupId}`;
  }

  if (guidance.targetExerciseId) {
    return `dashboard-exercise-${guidance.targetExerciseId}`;
  }

  return null;
}

export default function ExerciseTab({
  topicId,
  dashboardIssueContext = null,
  onDismissDashboardIssue,
  staleTargetRedirectHref,
  onAuthoringSuccess,
}: ExerciseTabProps) {
  const router = useRouter();
  const [exercises, setExercises] = useState<FullExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const scrolledTargetRef = useRef<string | null>(null);

  // STATES: XÓA
  const [deletingExercise, setDeletingExercise] = useState<FullExercise | null>(
    null,
  );
  const [deletingQuestion, setDeletingQuestion] =
    useState<FullExerciseQuestion | null>(null);

  // STATES: SỬA TẦNG 1 (EXERCISE)
  const [editingExercise, setEditingExercise] = useState<FullExercise | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [editTitleError, setEditTitleError] = useState("");
  const [editPart, setEditPart] = useState("");

  // STATES: SỬA TẦNG 2 (GROUP)
  const [editingGroup, setEditingGroup] = useState<FullExerciseGroup | null>(
    null,
  );
  const [editGroupPassage, setEditGroupPassage] = useState("");
  const [editGroupPassageError, setEditGroupPassageError] = useState("");
  const [editGroupAudio, setEditGroupAudio] = useState("");
  const [editGroupImage, setEditGroupImage] = useState("");
  const [editGroupAudioError, setEditGroupAudioError] = useState("");
  const [editGroupImageError, setEditGroupImageError] = useState("");
  const [editUploadedMedia, setEditUploadedMedia] = useState<UploadedQuestionGroupMedia[]>([]);

  // STATES: SỬA TẦNG 3 (QUESTION & OPTIONS)
  const [editingQuestion, setEditingQuestion] =
    useState<FullExerciseQuestion | null>(null);
  const [editQuestionContent, setEditQuestionContent] = useState("");
  const [editQuestionExplanation, setEditQuestionExplanation] = useState("");
  const [editQuestionOptions, setEditQuestionOptions] = useState<
    (Omit<FullExerciseOption, "id"> & { id?: string })[]
  >([]);

  const optionLabel = (index: number) => {
    let label = "";
    let cursor = index;

    do {
      label = String.fromCharCode(65 + (cursor % 26)) + label;
      cursor = Math.floor(cursor / 26) - 1;
    } while (cursor >= 0);

    return label;
  };

  const focusEditMediaField = (name: string) => {
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`,
      );
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus();
    });
  };

  const trackEditUploadedMedia = (media: UploadedQuestionGroupMedia) => {
    setEditUploadedMedia((current) => [
      ...current.filter(
        (item) => item.bucket !== media.bucket || item.path !== media.path,
      ),
      media,
    ]);
  };

  const forgetEditUploadedMedia = (media: UploadedQuestionGroupMedia) => {
    setEditUploadedMedia((current) =>
      current.filter(
        (item) => item.bucket !== media.bucket || item.path !== media.path,
      ),
    );
  };

  const cleanupEditUploadedMedia = async (
    mediaList: UploadedQuestionGroupMedia[],
  ) => {
    if (mediaList.length === 0) return;

    const results = await Promise.allSettled(
      mediaList.map((media) => deleteQuestionGroupMedia(media.bucket, media.path)),
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn("[QUESTION GROUP MEDIA EDIT CLEANUP REJECTED]:", result.reason);
        return;
      }

      if ("error" in result.value) {
        console.warn(
          "[QUESTION GROUP MEDIA EDIT CLEANUP ERROR]:",
          mediaList[index],
          result.value.error,
        );
      }
    });

    setEditUploadedMedia((current) =>
      current.filter(
        (item) =>
          !mediaList.some(
            (media) => media.bucket === item.bucket && media.path === item.path,
          ),
      ),
    );
  };

  // Tải danh sách bài tập
  useEffect(() => {
    let isMounted = true;
    const loadExercises = async () => {
      setIsLoading(true);
      const res = await getExercisesByTopicId(topicId);
      if (isMounted) {
        if (res.data) setExercises(res.data);
        setIsLoading(false);
      }
    };
    loadExercises();
    return () => {
      isMounted = false;
    };
  }, [topicId, refreshKey]);

  // ==================== HANDLERS: DELETE ====================
  const handleDeleteExercise = () => {
    if (!deletingExercise) return;
    startTransition(async () => {
      const res = await deleteExercise(deletingExercise.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setDeletingExercise(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  const handleDeleteQuestion = () => {
    if (!deletingQuestion) return;
    startTransition(async () => {
      const res = await deleteQuestion(deletingQuestion.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setDeletingQuestion(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  // ==================== HANDLERS: EDIT ====================
  const openEditExercise = (ex: FullExercise) => {
    setEditingExercise(ex);
    setEditTitle(ex.title);
    setEditTitleError("");
    setEditPart(ex.part_type);
  };
  const handleEditExerciseBasic = () => {
    if (!editingExercise) return;

    if (editTitle.trim().length < 4) {
      setEditTitleError("Tên bài tập phải dài hơn 3 ký tự.");
      toast.error("Vui lòng kiểm tra lại các trường chưa hợp lệ.");
      focusEditMediaField("edit_exercise_title");
      return;
    }

    startTransition(async () => {
      const res = await updateExerciseBasic(
        editingExercise.id,
        editTitle,
        editPart,
      );
      if (res.error) {
        if (res.error.includes("Tên bài tập")) {
          setEditTitleError(res.error);
          focusEditMediaField("edit_exercise_title");
        }
        toast.error(res.error);
      } else {
        toast.success(res.message);
        setEditTitleError("");
        setEditingExercise(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  const openEditGroup = (group: FullExerciseGroup) => {
    setEditingGroup(group);
    setEditGroupPassage(group.passage_text || "");
    setEditGroupPassageError("");
    setEditGroupAudio(group.audio_url || "");
    setEditGroupImage(group.image_url || "");
    setEditGroupAudioError("");
    setEditGroupImageError("");
    setEditUploadedMedia([]);
  };
  const handleEditGroup = () => {
    if (!editingGroup) return;

    const validatedAudioUrl = questionGroupAudioUrlSchema.safeParse(editGroupAudio);
    const validatedImageUrl = questionGroupImageUrlSchema.safeParse(editGroupImage);

    setEditGroupAudioError(
      validatedAudioUrl.success ? "" : validatedAudioUrl.error.issues[0].message,
    );
    setEditGroupImageError(
      validatedImageUrl.success ? "" : validatedImageUrl.error.issues[0].message,
    );
    setEditGroupPassageError("");

    if (!validatedAudioUrl.success || !validatedImageUrl.success) {
      toast.error("Vui lòng kiểm tra lại các trường chưa hợp lệ.");
      focusEditMediaField(
        !validatedAudioUrl.success ? "edit_group_audio_url" : "edit_group_image_url",
      );
      return;
    }

    const parentPartType =
      exercises.find((exercise) =>
        exercise.groups?.some((group) => group.id === editingGroup.id),
      )?.part_type || "";
    const contextValidation = validateQuestionGroupToeicContext(parentPartType, {
      passage_text: editGroupPassage,
      audio_url: validatedAudioUrl.data,
      image_url: validatedImageUrl.data,
    });

    if (!contextValidation.success) {
      if (contextValidation.field === "passage_text") {
        setEditGroupPassageError(contextValidation.message);
        focusEditMediaField("edit_group_passage_text");
      }

      if (contextValidation.field === "audio_url") {
        setEditGroupAudioError(contextValidation.message);
        focusEditMediaField("edit_group_audio_url");
      }

      if (contextValidation.field === "image_url") {
        setEditGroupImageError(contextValidation.message);
        focusEditMediaField("edit_group_image_url");
      }

      toast.error("Vui lòng kiểm tra lại các trường chưa hợp lệ.");
      return;
    }

    startTransition(async () => {
      const res = await updateQuestionGroup(
        editingGroup.id,
        editGroupPassage,
        editGroupAudio,
        editGroupImage,
      );
      if (res.error) {
        const mediaToCleanup = [...editUploadedMedia];
        await cleanupEditUploadedMedia(mediaToCleanup);

        mediaToCleanup.forEach((media) => {
          if (media.publicUrl === editGroupAudio) setEditGroupAudio("");
          if (media.publicUrl === editGroupImage) setEditGroupImage("");
        });

        if (res.error.includes("âm thanh")) {
          setEditGroupAudioError(res.error);
          focusEditMediaField("edit_group_audio_url");
        }

        if (res.error.includes("hình ảnh")) {
          setEditGroupImageError(res.error);
          focusEditMediaField("edit_group_image_url");
        }

        if (res.error.includes("đoạn văn") || res.error.includes("Đoạn văn")) {
          setEditGroupPassageError(res.error);
          focusEditMediaField("edit_group_passage_text");
        }

        toast.error(res.error);
      } else {
        const handledByDashboardFeedback =
          onAuthoringSuccess?.({
            type: "question_group_updated",
            questionGroupId: editingGroup.id,
          }) ?? false;

        if (!handledByDashboardFeedback) {
          toast.success(res.message);
        }

        setEditGroupPassageError("");
        setEditGroupAudioError("");
        setEditGroupImageError("");
        setEditUploadedMedia([]);
        setEditingGroup(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  const openEditQuestion = (q: FullExerciseQuestion) => {
    setEditingQuestion(q);
    setEditQuestionContent(q.content);
    setEditQuestionExplanation(q.explanation || "");
    setEditQuestionOptions(
      q.options
        .slice()
        .sort(
          (a, b) =>
            (a.order_index ?? Number.MAX_SAFE_INTEGER) -
              (b.order_index ?? Number.MAX_SAFE_INTEGER) ||
            (a.label || "").localeCompare(b.label || "") ||
            a.id.localeCompare(b.id),
        )
        .map((o) => ({ ...o })),
    );
  };
  const handleEditQuestion = () => {
    if (!editingQuestion) return;
    const cleanOptions = editQuestionOptions
      .map((option) => ({
        id: option.id,
        content: option.content.trim(),
        is_correct: option.is_correct,
      }))
      .filter((option) => option.content !== "");

    if (cleanOptions.length < 2) {
      toast.error("Câu hỏi phải có ít nhất 2 đáp án hợp lệ.");
      return;
    }

    if (!cleanOptions.some((option) => option.is_correct)) {
      toast.error("Câu hỏi phải có ít nhất 1 đáp án đúng hợp lệ.");
      return;
    }

    startTransition(async () => {
      const res = await updateQuestion(
        editingQuestion.id,
        editQuestionContent,
        editQuestionExplanation || null,
        cleanOptions,
      );
      if (res.error) toast.error(res.error);
      else {
        const handledByDashboardFeedback =
          onAuthoringSuccess?.({
            type: "question_updated",
            questionId: editingQuestion.id,
          }) ?? false;

        if (!handledByDashboardFeedback) {
          toast.success(res.message);
        }

        setEditingQuestion(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  const editingGroupPartType = editingGroup
    ? exercises.find((exercise) =>
        exercise.groups?.some((group) => group.id === editingGroup.id),
      )?.part_type || ""
    : "";
  const editVisibleGroupContextFields =
    getToeicVisibleGroupContextFields(editingGroupPartType);
  const showEditGroupPassage =
    editVisibleGroupContextFields.includes("passage_text");
  const showEditGroupAudio = editVisibleGroupContextFields.includes("audio_url");
  const showEditGroupImage = editVisibleGroupContextFields.includes("image_url");
  const dashboardIssueGuidance = useMemo(
    () =>
      !isLoading && dashboardIssueContext
        ? resolveExerciseIssueGuidance({
            exercises,
            context: dashboardIssueContext,
          })
        : null,
    [dashboardIssueContext, exercises, isLoading],
  );
  const dashboardTargetElementId = getDashboardTargetElementId(
    dashboardIssueGuidance,
  );

  useEffect(() => {
    if (
      dashboardIssueGuidance?.tone === "warning" &&
      staleTargetRedirectHref
    ) {
      // Chỉ sau khi đã tải bài tập mới biết target còn tồn tại hay không.
      // Nếu target đã cũ, quay về structure để giáo viên không sửa nhầm bài tập khác.
      router.replace(staleTargetRedirectHref, { scroll: false });
      return;
    }

    if (!dashboardTargetElementId) return;
    if (scrolledTargetRef.current === dashboardTargetElementId) return;

    scrolledTargetRef.current = dashboardTargetElementId;
    document
      .getElementById(dashboardTargetElementId)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [
    dashboardIssueGuidance?.tone,
    dashboardTargetElementId,
    router,
    staleTargetRedirectHref,
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Kho bài tập</h2>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập câu hỏi trắc nghiệm và cụm ngữ liệu thông minh
          </p>
        </div>
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 md:hidden">
          Tính năng soạn nội dung học phù hợp hơn trên màn hình lớn. Vui lòng dùng máy tính để thêm hoặc chỉnh sửa flashcard/bài tập.
        </p>
        <Button
          onClick={() => setIsAddOpen(true)}
          aria-label="Add TOEIC exercise"
          className="hidden rounded-lg bg-[#3B82F6] px-5 text-white shadow-sm hover:bg-[#2563EB] md:inline-flex"
        >
          <Plus size={18} className="mr-2" /> Thêm Bài tập
        </Button>
      </div>

      {dashboardIssueGuidance?.tone === "info" && onDismissDashboardIssue ? (
        <DashboardIssueNotice
          guidance={dashboardIssueGuidance}
          onDismiss={onDismissDashboardIssue}
        />
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-24 bg-white border-2 border-dashed border-slate-200 rounded-xl">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">
            Chưa có bài tập nào
          </h3>
            <p className="mt-2 hidden font-medium text-slate-500 md:block">
            Bấm &quot;Thêm Bài tập&quot; để tạo đề thi.
          </p>
        </div>
      ) : (
        exercises.map((ex) => (
          <div
            key={ex.id}
            id={`dashboard-exercise-${ex.id}`}
            className={`space-y-6 rounded-xl transition-all ${
              dashboardIssueGuidance?.targetExerciseId === ex.id &&
              !dashboardIssueGuidance.targetGroupId &&
              !dashboardIssueGuidance.targetQuestionId
                ? "border border-blue-300 bg-blue-50/40 p-4 ring-2 ring-blue-100"
                : ""
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-blue-600" /> {ex.title}
                <span className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full ml-3 uppercase font-semibold">
                  {ex.part_type}
                </span>
                {dashboardIssueGuidance?.targetExerciseId === ex.id &&
                !dashboardIssueGuidance.targetGroupId &&
                !dashboardIssueGuidance.targetQuestionId ? (
                  <span className="text-xs text-blue-700 bg-white border border-blue-200 px-2 py-1 rounded-full">
                    Được dashboard đánh dấu
                  </span>
                ) : null}
              </h2>
              <div className="hidden gap-2 md:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => openEditExercise(ex)}
                >
                  <Pencil size={16} className="mr-2" /> Sửa thông tin chung
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                  onClick={() => setDeletingExercise(ex)}
                >
                  <Trash2 size={16} className="mr-2" /> Xóa bài
                </Button>
              </div>
            </div>

            {/* NHÁNH CHÍNH 1: HIỂN THỊ CÂU HỎI THEO CỤM/GROUP (PART 1, 3, 7) */}
            {ex.groups?.map((group, gIndex) => (
              <div
                key={group.id}
                id={`dashboard-group-${group.id}`}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-6 rounded-xl border shadow-sm relative group/item ${
                  dashboardIssueGuidance?.targetGroupId === group.id &&
                  !dashboardIssueGuidance.targetQuestionId
                    ? "border-blue-400 ring-2 ring-blue-200"
                    : "border-slate-200"
                }`}
              >
                <div className="hidden justify-end gap-2 opacity-0 transition-opacity group-hover/item:opacity-100 md:flex lg:col-span-12">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-slate-500 hover:text-blue-600"
                    onClick={() => openEditGroup(group)}
                  >
                    <Pencil size={14} className="mr-2" /> Sửa nhóm ngữ liệu
                  </Button>
                </div>

                <div className="lg:col-span-5 space-y-4 border-r border-slate-100 pr-6 pt-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} /> Ngữ liệu (Nhóm {gIndex + 1})
                    {dashboardIssueGuidance?.targetGroupId === group.id &&
                    !dashboardIssueGuidance.targetQuestionId ? (
                      <span className="text-blue-700">
                        Được dashboard đánh dấu
                      </span>
                    ) : null}
                  </div>
                  {group.passage_text && (
                    <div className="bg-slate-50 p-5 rounded-lg text-slate-700 leading-relaxed text-sm italic border border-slate-100 whitespace-pre-wrap">
                      {group.passage_text}
                    </div>
                  )}
                  <div className="space-y-3">
                    {group.audio_url && (
                      <QuestionGroupMediaPreview
                        type="audio"
                        value={group.audio_url}
                        label="Âm thanh đã gắn"
                      />
                    )}
                    {group.image_url && (
                      <QuestionGroupMediaPreview
                        type="image"
                        value={group.image_url}
                        label="Hình ảnh đã gắn"
                      />
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-8 pt-2">
                  {group.questions?.map((q, idx) => (
                    <div
                      key={q.id}
                      id={`dashboard-question-${q.id}`}
                      className={`space-y-4 relative group/question rounded-lg ${
                        dashboardIssueGuidance?.targetQuestionId === q.id
                          ? "border border-blue-300 bg-blue-50/50 p-3 ring-2 ring-blue-100"
                          : ""
                      }`}
                    >
                      <div className="hidden justify-end gap-1 opacity-0 transition-opacity group-hover/question:opacity-100 md:flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-blue-600"
                          onClick={() => openEditQuestion(q)}
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-rose-600"
                          onClick={() => setDeletingQuestion(q)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>

                      <div className="font-bold text-slate-900 flex flex-col gap-1 pr-16">
                        <div className="flex gap-2">
                          <span className="text-blue-600">Q{idx + 1}.</span>{" "}
                          {q.content}
                          {dashboardIssueGuidance?.targetQuestionId === q.id ? (
                            <span className="ml-2 text-xs font-semibold text-blue-700">
                              Được dashboard đánh dấu
                            </span>
                          ) : null}
                        </div>
                        {q.explanation && (
                          <span className="text-xs font-normal text-slate-500 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic block">
                            <strong>Lời giải:</strong> {q.explanation}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((opt, optIndex) => (
                          <div
                            key={opt.id}
                            className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                              opt.is_correct
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200 font-bold"
                                : "bg-white border-slate-200 text-slate-600"
                            }`}
                          >
                            <span className="text-sm">
                              <span className="font-bold mr-2">
                                {opt.label || optionLabel(optIndex)}.
                              </span>
                              {opt.content}
                            </span>
                            {opt.is_correct && (
                              <CheckCircle2
                                size={16}
                                className="text-emerald-600"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* NHÁNH CHÍNH 2: HIỂN THỊ LUỒNG CÂU HỎI ĐỘC LẬP TẠI GỐC ROOT (PHÙ HỢP PART 5) */}
{ex.questions && ex.questions.length > 0 && (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
      <HelpCircle size={14} className="text-blue-500" /> Danh sách câu hỏi đơn độc lập
    </div>
    <div className="space-y-8">
      {/* Dữ liệu Part 5 nằm ở mảng questions gốc nên cần kiểu có ID để dùng chung luồng sửa câu hỏi. */}
      {(ex.questions as unknown as FullExerciseQuestion[]).map((q, idx) => (
        <div
          key={q.id}
          id={`dashboard-question-${q.id}`}
          className={`space-y-4 relative group/question rounded-lg ${
            dashboardIssueGuidance?.targetQuestionId === q.id
              ? "border border-blue-300 bg-blue-50/50 p-3 ring-2 ring-blue-100"
              : ""
          }`}
        >
          <div className="hidden justify-end gap-1 opacity-0 transition-opacity group-hover/question:opacity-100 md:flex">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-slate-400 hover:text-blue-600" 
              onClick={() => openEditQuestion(q)}
            >
              <Pencil size={12} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-rose-600" onClick={() => setDeletingQuestion(q)}>
              <Trash2 size={12} />
            </Button>
          </div>

          <div className="font-bold text-slate-900 flex flex-col gap-1 pr-16">
            <div className="flex gap-2">
              <span className="text-blue-600">Q{idx + 1}.</span> {q.content}
              {dashboardIssueGuidance?.targetQuestionId === q.id ? (
                <span className="ml-2 text-xs font-semibold text-blue-700">
                  Được dashboard đánh dấu
                </span>
              ) : null}
            </div>
            {q.explanation && (
              <span className="text-xs font-normal text-slate-500 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic block">
                <strong>Lời giải:</strong> {q.explanation}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {q.options?.map((opt, optIndex) => (
              <div
                key={opt.id}
                className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                  opt.is_correct
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200 font-bold"
                    : "bg-white border-slate-200 text-slate-600"
                }`}
              >
                <span className="text-sm">
                  <span className="font-bold mr-2">
                    {opt.label || optionLabel(optIndex)}.
                  </span>
                  {opt.content}
                </span>
                {opt.is_correct && <CheckCircle2 size={16} className="text-emerald-600" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
          </div>
        ))
      )}

      {/* ==================================================== */}
      {/* MODALS PHÂN TẦNG QUẢN LÝ DỮ LIỆU                     */}
      {/* ==================================================== */}

      <AddExerciseDialog
        isOpen={isAddOpen}
        setIsOpen={setIsAddOpen}
        topicId={topicId}
        onSuccess={() => setRefreshKey((p) => p + 1)}
        onCreateSuccess={() =>
          onAuthoringSuccess?.({
            type: "exercise_created",
            topicId,
          }) ?? false
        }
      />

      {/* MODAL SỬA BÀI TẬP TẦNG 1 */}
      <Dialog
        open={!!editingExercise}
        onOpenChange={(open) => !open && setEditingExercise(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Sửa thông tin chung
            </DialogTitle>
            <DialogDescription className="hidden">
              Sửa Tên và loại Part
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Tên bài tập
              </label>
              <Input
                name="edit_exercise_title"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  setEditTitleError("");
                }}
                className="h-12 rounded-lg"
                aria-invalid={!!editTitleError}
              />
              {editTitleError && (
                <p className="mt-2 text-xs font-medium text-rose-500">
                  {editTitleError}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Loại bài (Part)
              </label>
              <Select value={editPart} disabled>
                <SelectTrigger className="h-12 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-80">
                  <SelectItem value="part1">
                    Part 1: Photographs (Listening)
                  </SelectItem>
                  <SelectItem value="part2">
                    Part 2: Question-Response (Listening)
                  </SelectItem>
                  <SelectItem value="part3">
                    Part 3: Conversations (Listening)
                  </SelectItem>
                  <SelectItem value="part4">
                    Part 4: Talks (Listening)
                  </SelectItem>
                  <SelectItem value="part5">
                    Part 5: Incomplete Sentences (Reading)
                  </SelectItem>
                  <SelectItem value="part6">
                    Part 6: Text Completion
                  </SelectItem>
                  <SelectItem value="part7">
                    Part 7: Reading Comprehension
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-slate-500">
                Không thể đổi loại bài sau khi bài tập đã được tạo. Vui lòng tạo bài tập mới nếu cần đổi cấu trúc bài.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setEditingExercise(null)}
              className="rounded-lg"
            >
              Hủy
            </Button>
            <Button
              disabled={isPending || editTitle.length < 4}
              onClick={handleEditExerciseBasic}
              className="bg-[#3B82F6] text-white rounded-lg"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL SỬA NHÓM TẦNG 2 - CẬP NHẬT THÊM IMAGE_URL */}
      <Dialog
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
      >
        <DialogContent className="sm:max-w-xl bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Sửa Nhóm ngữ liệu
            </DialogTitle>
            <DialogDescription className="hidden">
              Cập nhật nội dung tài nguyên phương tiện
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {showEditGroupPassage && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Đoạn văn (Reading Passage)
              </label>
              <Textarea
                name="edit_group_passage_text"
                value={editGroupPassage}
                onChange={(e) => {
                  setEditGroupPassage(e.target.value);
                  setEditGroupPassageError("");
                }}
                className="min-h-32 rounded-lg resize-none"
                aria-invalid={!!editGroupPassageError}
                placeholder="Nhập đoạn văn..."
              />
              {editGroupPassageError && (
                <p className="mt-2 text-xs font-medium text-rose-500">
                  {editGroupPassageError}
                </p>
              )}
            </div>
            )}
            {showEditGroupAudio && (
            <QuestionGroupMediaField
              type="audio"
              label="Audio"
              inputName="edit_group_audio_url"
              value={editGroupAudio}
              error={editGroupAudioError}
              onChange={(value) => {
                setEditGroupAudio(value);
                setEditGroupAudioError("");
              }}
              onUploaded={trackEditUploadedMedia}
              onDeleted={forgetEditUploadedMedia}
              disabled={isPending}
            />
            )}
            {showEditGroupImage && (
            <QuestionGroupMediaField
              type="image"
              label="Hình ảnh"
              inputName="edit_group_image_url"
              value={editGroupImage}
              error={editGroupImageError}
              onChange={(value) => {
                setEditGroupImage(value);
                setEditGroupImageError("");
              }}
              onUploaded={trackEditUploadedMedia}
              onDeleted={forgetEditUploadedMedia}
              disabled={isPending}
            />
            )}
          </div>
          <div className="mt-4 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setEditingGroup(null)}
              className="rounded-lg"
            >
              Hủy
            </Button>
            <Button
              disabled={isPending}
              onClick={handleEditGroup}
              className="bg-[#3B82F6] text-white rounded-lg"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL SỬA CÂU HỎI TẦNG 3 - ĐÃ BỔ SUNG Ô NHẬP GIẢI THÍCH (EXPLANATION) */}
      <Dialog
        open={!!editingQuestion}
        onOpenChange={(open) => !open && setEditingQuestion(null)}
      >
        <DialogContent className="sm:max-w-2xl bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Sửa Câu hỏi & Đáp án
            </DialogTitle>
            <DialogDescription className="hidden">
              Chỉnh sửa nội dung và phân định đáp án đúng
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto max-h-[65vh] pr-1">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Nội dung câu hỏi
              </label>
              <Input
                value={editQuestionContent}
                onChange={(e) => setEditQuestionContent(e.target.value)}
                className="h-12 rounded-lg font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Giải thích đáp án (Explanation)
              </label>
              <Textarea
                value={editQuestionExplanation}
                onChange={(e) => setEditQuestionExplanation(e.target.value)}
                className="min-h-20 rounded-lg resize-none"
                placeholder="Nhập căn cứ chọn đáp án đúng..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">
                Các đáp án (Tích chọn đáp án đúng)
              </label>
              <div className="space-y-3">
                {editQuestionOptions.map((opt, index) => (
                  <div
                    key={opt.id || index}
                    className="flex items-center gap-4 p-2 bg-slate-50 rounded-lg border"
                  >
                    <input
                      type="radio"
                      name="edit_correct_option"
                      className="w-5 h-5 text-blue-600 ml-2"
                      checked={opt.is_correct}
                      onChange={() => {
                        setEditQuestionOptions((prev) =>
                          prev.map((o, i) => ({
                            ...o,
                            is_correct: i === index,
                          })),
                        );
                      }}
                    />
                    <span className="w-8 text-sm font-bold text-slate-500 text-center">
                      {optionLabel(index)}
                    </span>
                    <Input
                      value={opt.content}
                      onChange={(e) => {
                        setEditQuestionOptions((prev) =>
                          prev.map((o, i) =>
                            i === index ? { ...o, content: e.target.value } : o,
                          ),
                        );
                      }}
                      className="h-10 rounded-lg flex-1 bg-white"
                      placeholder={`Đáp án ${String.fromCharCode(65 + index)}`}
                    />
                    {editQuestionOptions.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-400 hover:text-rose-600"
                        onClick={() => {
                          setEditQuestionOptions((prev) => {
                            const next = prev.filter((_, i) => i !== index);
                            if (!next.some((option) => option.is_correct)) {
                              next[0] = { ...next[0], is_correct: true };
                            }
                            return next;
                          });
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setEditQuestionOptions((prev) => [
                      ...prev,
                      { content: "", is_correct: false },
                    ])
                  }
                  className="w-full border-dashed text-blue-600 hover:bg-blue-50 rounded-lg font-bold"
                >
                  <Plus size={16} className="mr-2" /> Thêm đáp án{" "}
                  {optionLabel(editQuestionOptions.length)}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setEditingQuestion(null)}
              className="rounded-lg"
            >
              Hủy
            </Button>
            <Button
              disabled={isPending || !editQuestionContent.trim()}
              onClick={handleEditQuestion}
              className="bg-[#3B82F6] text-white rounded-lg"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Lưu dữ liệu"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE MODALS */}
      <Dialog
        open={!!deletingExercise}
        onOpenChange={(open) => !open && setDeletingExercise(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa bài tập</DialogTitle>
            <DialogDescription>
              Hành động này sẽ soft-delete toàn bộ nhóm dữ liệu bên dưới.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeletingExercise(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleDeleteExercise}
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-lg"
            >
              Xóa bài
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deletingQuestion}
        onOpenChange={(open) => !open && setDeletingQuestion(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle>Xóa câu hỏi</DialogTitle>
            <DialogDescription>
              Xóa câu hỏi và toàn bộ các phương án lựa chọn liên quan.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeletingQuestion(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleDeleteQuestion}
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-lg"
            >
              Xóa câu hỏi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
