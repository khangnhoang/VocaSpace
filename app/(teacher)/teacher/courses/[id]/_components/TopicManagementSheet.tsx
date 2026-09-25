import React, { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  type Chapter,
  type OrderingPendingState,
  type Topic,
  type TopicMoveRequest,
} from "./types";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { topicSchema, type TopicFormValues } from "@/lib/schemas/topic";
import {
  createTopic,
  deleteTopic,
  getTopicsByChapterId,
  updateTopic,
} from "@/app/actions/topic";
import { getTopicBuilderPath } from "@/lib/course-authoring/routes";
import type { CourseAuthoringSuccessEvent } from "@/lib/course-authoring/issue-success";
import { confirmPublishedTopicMutation } from "@/lib/course-authoring/topic-workflow";
import type { CoursePreviewAllocation } from "@/lib/schemas/course-preview";
import type { PreviewMarkerChange } from "./course-preview-controls";
import { TopicPreviewMarkerToggle } from "./course-preview-controls";
import PreviewQuotaResolutionDialog from "./PreviewQuotaResolutionDialog";
import { getTopicDeletePreviewProjection } from "@/app/actions/course-preview";

interface TopicManagementSheetProps {
  chapter: Chapter | null;
  onClose: () => void;
  onTopicsChanged?: (chapterId: string) => Promise<void> | void;
  onAuthoringSuccess?: (event: CourseAuthoringSuccessEvent) => boolean;
  onMoveTopic?: (request: TopicMoveRequest) => Promise<void> | void;
  pendingMove?: OrderingPendingState;
  moveError?: string | null;
  readOnly?: boolean;
  previewAllocation?: CoursePreviewAllocation | null;
  canManagePreviewMarkers?: boolean;
  isPreviewMarkerUpdating?: boolean;
  previewMarkerError?: string | null;
  onPreviewMarkersChange?: (change: PreviewMarkerChange) => Promise<unknown>;
  onFocusPreviewMarkers?: () => void;
  onPreviewAllocationRefresh?: () => Promise<void> | void;
}

const topicStatusLabels: Record<Topic["status"], string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Xuất bản",
};

export default function TopicManagementSheet({
  chapter,
  onClose,
  onTopicsChanged,
  onAuthoringSuccess,
  onMoveTopic,
  pendingMove = null,
  readOnly = false,
  previewAllocation = null,
  canManagePreviewMarkers = false,
  isPreviewMarkerUpdating = false,
  previewMarkerError = null,
  onPreviewMarkersChange,
  onFocusPreviewMarkers,
  onPreviewAllocationRefresh,
}: TopicManagementSheetProps) {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [topicToEdit, setTopicToEdit] = useState<Topic | null>(null);
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasTopicChanges, setHasTopicChanges] = useState(false);

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicSchema),
    defaultValues: { title: "" },
  });

  useEffect(() => {
    let isMounted = true;

    const loadTopics = async () => {
      if (!chapter) return;
      setIsLoading(true);
      setLoadError(null);
      const res = await getTopicsByChapterId(chapter.id);

      if (!isMounted) return;

      if (res.error) {
        setLoadError(res.error);
        toast.error(res.error);
        setTopics([]);
      } else {
        const loadedTopics = res.data ?? [];
        setTopics(loadedTopics);
        // Automatically select first topic if none is selected
        setSelectedTopicId((current) => {
          if (current && loadedTopics.some((t) => t.id === current)) return current;
          return loadedTopics[0]?.id ?? null;
        });
      }
      setIsLoading(false);
    };

    loadTopics();

    return () => {
      isMounted = false;
    };
  }, [chapter, refreshKey]);

  const openCreateTopicDialog = () => {
    if (readOnly) return;
    setTopicToEdit(null);
    form.reset({ title: "" });
    setIsTopicDialogOpen(true);
  };

  const openEditTopicDialog = (topic: Topic) => {
    if (readOnly || !topic.canEditContent || topic.status === "pending") return;
    setTopicToEdit(topic);
    form.reset({ title: topic.title });
    setIsTopicDialogOpen(true);
  };

  const refreshTopics = () => setRefreshKey((prev) => prev + 1);

  const handleMoveTopic = async (request: TopicMoveRequest) => {
    if (!onMoveTopic || readOnly) return;

    const topic = topics.find((item) => item.id === request.topicId);
    if (!topic?.canManageStructure || topic.status === "pending") return;

    await onMoveTopic(request);
    refreshTopics();
  };

  const returnToStructure = async () => {
    if (chapter && hasTopicChanges) {
      await onTopicsChanged?.(chapter.id);
      setHasTopicChanges(false);
    }
    onClose();
  };

  const onSubmit = (values: TopicFormValues) => {
    if (
      !chapter ||
      readOnly ||
      (topicToEdit && (!topicToEdit.canEditContent || topicToEdit.status === "pending"))
    ) return;

    const confirmPublished = topicToEdit?.status === "published"
      ? confirmPublishedTopicMutation("Việc đổi tên bài học")
      : false;
    if (topicToEdit?.status === "published" && !confirmPublished) return;

    startTransition(async () => {
      const res = topicToEdit
        ? await updateTopic({
            topicId: topicToEdit.id,
            title: values.title,
            confirmPublished,
          })
        : await createTopic({
            courseId,
            chapterId: chapter.id,
            title: values.title,
          });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      const createdTopicId = !topicToEdit ? res.data?.id : undefined;

      if (createdTopicId) {
        setHasTopicChanges(true);
        await onPreviewAllocationRefresh?.();
        router.push(getTopicBuilderPath(courseId, createdTopicId));
        return;
      }

      const handledByDashboardFeedback =
        !topicToEdit &&
        res.data &&
        onAuthoringSuccess?.({
          type: "topic_created",
          courseId,
          chapterId: chapter.id,
          topicId: res.data.id,
        });

      if (!handledByDashboardFeedback) {
        toast.success(res.message);
      }

      setIsTopicDialogOpen(false);
      setTopicToEdit(null);
      form.reset({ title: "" });
      refreshTopics();
      setHasTopicChanges(true);
    });
  };

  const handleConfirmDelete = async (unmarkTopicIds: string[]) => {
    if (
      !topicToDelete ||
      readOnly ||
      !topicToDelete.canDeleteTopic ||
      topicToDelete.status === "pending"
    ) return { error: "Bạn không có quyền ẩn bài học này." };

    const confirmPublished = topicToDelete.status === "published"
      ? confirmPublishedTopicMutation("Việc ẩn bài học")
      : false;
    if (topicToDelete.status === "published" && !confirmPublished) return { cancelled: true };

    const res = await deleteTopic({
      topicId: topicToDelete.id,
      confirmPublished,
      unmarkTopicIds,
    });
    if (res.error) return res;

    toast.success(res.message);
    refreshTopics();
    setHasTopicChanges(true);
    await onPreviewAllocationRefresh?.();
    return res;
  };

  if (!chapter) return null;

  return (
    <>
      <Dialog
        open={!!chapter}
        onOpenChange={(open) => {
          if (!open) void returnToStructure();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-5xl md:max-w-6xl w-[95vw] h-[86vh] max-h-[860px] p-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl"
        >
          {/* Header Bar */}
          <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void returnToStructure()}
                className="flex items-center gap-1.5 rounded-lg text-slate-600 hover:text-slate-900 -ml-2"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Quay về</span>
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              <div className="flex items-center gap-2 min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  Quản lý bài học: <span className="text-blue-600">{chapter.title}</span>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Quản lý danh sách bài học và phân bổ xem thử trong chương này
                </DialogDescription>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {topics.length} bài học
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={openCreateTopicDialog}
              disabled={readOnly}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl h-9 px-3.5 text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer text-white"
            >
              <Plus size={16} className="mr-1.5" /> Thêm bài học
            </Button>
          </div>

          {/* Body: 2-Column Split Layout */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Left Column: Topics List (~35% width, md:col-span-4 lg:col-span-4) */}
            <div className="md:col-span-4 lg:col-span-4 flex flex-col h-full min-h-0 bg-slate-50/70">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Danh sách bài học
                </span>
                <span className="text-xs text-slate-400">
                  {topics.length > 0 ? `${topics.length} bài` : "Trống"}
                </span>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center py-20 text-blue-500">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : loadError ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-rose-600 font-medium">{loadError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 rounded-lg text-xs"
                    onClick={refreshTopics}
                  >
                    Thử tải lại
                  </Button>
                </div>
              ) : topics.length > 0 ? (
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {topics.map((topic, index) => {
                    const isSelected = (selectedTopicId ?? topics[0]?.id) === topic.id;
                    const isPreview = previewAllocation?.markedTopics.some((t) => t.id === topic.id);
                    const isFirst = index === 0;
                    const isLast = index === topics.length - 1;
                    const hasMoveHandler = Boolean(onMoveTopic);
                    const canMove =
                      hasMoveHandler &&
                      !readOnly &&
                      topic.canManageStructure &&
                      topic.status !== "pending";
                    const isMovePending = Boolean(pendingMove);
                    const isMovingUp =
                      pendingMove?.type === "topic" &&
                      pendingMove.id === topic.id &&
                      pendingMove.direction === "up";
                    const isMovingDown =
                      pendingMove?.type === "topic" &&
                      pendingMove.id === topic.id &&
                      pendingMove.direction === "down";
                    const upDisabled = isFirst || isMovePending || !canMove;
                    const downDisabled = isLast || isMovePending || !canMove;
                    const upDescriptionId = `topic-move-up-${topic.id}`;
                    const downDescriptionId = `topic-move-down-${topic.id}`;
                    const upTitle = isFirst ? "Đã ở đầu danh sách" : `Di chuyển bài học "${topic.title}" lên`;
                    const downTitle = isLast ? "Đã ở cuối danh sách" : `Di chuyển bài học "${topic.title}" xuống`;

                    return (
                      <div
                        key={topic.id}
                        onClick={() => setSelectedTopicId(topic.id)}
                        className={`group p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? "bg-white border-blue-300 shadow-xs ring-1 ring-blue-500/20"
                            : "bg-white/80 border-slate-200/70 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">

                            <h4
                              className={`text-sm truncate font-semibold ${
                                isSelected ? "text-blue-950 font-bold" : "text-slate-800"
                              }`}
                            >
                              {`${topic.order_index}. ${topic.title}`}
                            </h4>
                          </div>

                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title={upTitle}
                              aria-label={`Di chuyển bài học "${topic.title}" lên`}
                              aria-describedby={upDescriptionId}
                              disabled={upDisabled}
                              className="size-6 rounded text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              onClick={() => void handleMoveTopic({ topicId: topic.id, direction: "up" })}
                            >
                              {isMovingUp ? <Loader2 className="animate-spin size-3" /> : <ArrowUp size={12} />}
                            </Button>
                            <span id={upDescriptionId} className="sr-only">{upTitle}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title={downTitle}
                              aria-label={`Di chuyển bài học "${topic.title}" xuống`}
                              aria-describedby={downDescriptionId}
                              disabled={downDisabled}
                              className="size-6 rounded text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              onClick={() => void handleMoveTopic({ topicId: topic.id, direction: "down" })}
                            >
                              {isMovingDown ? <Loader2 className="animate-spin size-3" /> : <ArrowDown size={12} />}
                            </Button>
                            <span id={downDescriptionId} className="sr-only">{downTitle}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-1 text-[11px]">
                          <span
                            className={`font-semibold px-2 py-0.5 rounded text-[10px] border ${
                              topic.status === "published"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                                : topic.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border-amber-200/80"
                                  : "bg-slate-50 text-slate-600 border-slate-200/80"
                            }`}
                          >
                            {topicStatusLabels[topic.status]}
                          </span>

                          {isPreview ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/70">
                              <Sparkles size={10} /> Xem thử
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Chương chưa có bài học nào.
                </div>
              )}
            </div>

            {/* Right Column: Active Topic Content & Management (~65% width, md:col-span-8 lg:col-span-8) */}
            <div className="md:col-span-8 lg:col-span-8 flex flex-col h-full min-h-0 bg-white overflow-y-auto p-6 md:p-8 space-y-6">
              {(() => {
                const currentTopic = topics.find((t) => t.id === (selectedTopicId ?? topics[0]?.id));
                if (!currentTopic) {
                  return (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="size-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                        <FileText size={32} />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">Chưa có bài học nào trong chương</h3>
                      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                        Tạo bài học đầu tiên để bắt đầu thêm thẻ từ vựng và câu hỏi bài tập.
                      </p>
                      <Button
                        type="button"
                        onClick={openCreateTopicDialog}
                        disabled={readOnly}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold h-10 px-5 text-sm"
                      >
                        <Plus size={16} className="mr-1.5" /> Tạo bài học đầu tiên
                      </Button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* Header of Active Topic */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                            Bài {currentTopic.order_index} trong {chapter.title}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              currentTopic.status === "published"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                                : currentTopic.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border-amber-200/80"
                                  : "bg-slate-50 text-slate-600 border-slate-200/80"
                            }`}
                          >
                            {topicStatusLabels[currentTopic.status]}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 break-words">
                          {currentTopic.title}
                        </h3>
                        <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <Clock size={13} aria-hidden="true" />
                          Ngày tạo: {new Date(currentTopic.created_at).toLocaleDateString("vi-VN")}
                        </p>
                      </div>

                      {/* Tool actions: Rename, Settings, Delete */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditTopicDialog(currentTopic)}
                          disabled={readOnly || !currentTopic.canEditContent || currentTopic.status === "pending"}
                          aria-label={`Sửa bài học ${currentTopic.title}`}
                          className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50"
                        >
                          <Pencil size={14} className="mr-1.5 text-slate-500" /> Đổi tên
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(getTopicBuilderPath(courseId, currentTopic.id, "settings"))}
                          aria-label={`Mở cài đặt bài học ${currentTopic.title}`}
                          className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50"
                        >
                          <Settings size={14} className="mr-1.5 text-slate-500" /> Cài đặt
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTopicToDelete(currentTopic)}
                          disabled={readOnly || !currentTopic.canDeleteTopic || currentTopic.status === "pending"}
                          aria-label={`Ẩn bài học ${currentTopic.title}`}
                          className="h-9 px-3 rounded-lg text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 size={14} className="mr-1.5 text-rose-500" /> Xóa
                        </Button>
                      </div>
                    </div>

                    {/* Main CTA: Go to Topic Builder */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/40">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">Soạn thảo nội dung bài học</h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Quản lý thẻ từ vựng flashcards, bài tập TOEIC và xem trước kết quả hiển thị.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => router.push(getTopicBuilderPath(courseId, currentTopic.id))}
                        aria-label={`Mở trình soạn nội dung bài học ${currentTopic.title}`}
                        className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-white shadow-xs shrink-0 cursor-pointer text-sm"
                      >
                        <Eye size={16} className="mr-2" /> Vào soạn thảo nội dung
                      </Button>
                    </div>

                    {/* Section: Public Preview Marker */}
                    {onPreviewMarkersChange ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-blue-600" />
                          <h4 className="text-sm font-bold text-slate-900">Bài học xem thử (Public Preview)</h4>
                        </div>
                        <p className="text-xs text-slate-500">
                          Cho phép học viên trải nghiệm trước nội dung bài học này ngay tại trang giới thiệu khóa học mà không cần đăng ký.
                        </p>
                        <TopicPreviewMarkerToggle
                          topicId={currentTopic.id}
                          title={currentTopic.title}
                          status={currentTopic.status}
                          allocation={previewAllocation}
                          canManage={canManagePreviewMarkers && !readOnly}
                          isUpdating={isPreviewMarkerUpdating}
                          error={previewMarkerError}
                          onChange={onPreviewMarkersChange}
                          onShowAllocation={onFocusPreviewMarkers}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTopicDialogOpen && !readOnly}
        onOpenChange={(open) => {
          setIsTopicDialogOpen(open);
          if (!open) setTopicToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-5 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Plus className="text-blue-600" size={24} strokeWidth={3} />
              {topicToEdit ? "Sửa bài học" : "Thêm bài học"}
            </DialogTitle>
            <DialogDescription className="hidden">
              Nhập tên bài học trong chương này.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="p-6 space-y-5"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tên bài học
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nhập tên bài học..."
                        className="h-12 border-slate-200 focus-visible:ring-blue-500 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-rose-500 text-xs font-medium" />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4 flex gap-3 justify-end border-t border-slate-100 mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-5 h-11 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  onClick={() => setIsTopicDialogOpen(false)}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="px-6 h-11 text-sm font-semibold text-white bg-blue-600 rounded-xl shadow-md hover:bg-blue-700"
                >
                  {isPending ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : topicToEdit ? (
                    "Lưu thay đổi"
                  ) : (
                    "Tạo và tiếp tục"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <PreviewQuotaResolutionDialog
        open={!!topicToDelete}
        setOpen={(open) => {
          if (!open) setTopicToDelete(null);
        }}
        targetType="topic"
        targetId={topicToDelete?.id ?? null}
        targetTitle={topicToDelete?.title ?? "bài học này"}
        description="Bài học sẽ được chuyển vào danh sách đã xóa. Nội dung bên trong được giữ lại và có thể khôi phục."
        confirmText="Xóa bài học"
        loadingText="Đang xóa bài học…"
        getProjection={getTopicDeletePreviewProjection}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
