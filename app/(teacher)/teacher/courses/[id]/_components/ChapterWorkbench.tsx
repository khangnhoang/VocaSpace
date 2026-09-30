"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Clock,
  FilePen,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { chapterFormSchema } from "@/lib/schemas/chapter";
import { topicSchema, type TopicFormValues } from "@/lib/schemas/topic";
import type { CoursePreviewAllocation } from "@/lib/schemas/course-preview";
import {
  createTopic,
  deleteTopic,
  getTopicsByChapterId,
  updateTopic,
} from "@/app/actions/topic";
import { getTopicDeletePreviewProjection } from "@/app/actions/course-preview";
import { getTopicBuilderPath } from "@/lib/course-authoring/routes";
import { confirmPublishedTopicMutation } from "@/lib/course-authoring/topic-workflow";
import type { PreviewMarkerChange } from "./course-preview-controls";
import PreviewQuotaResolutionDialog from "./PreviewQuotaResolutionDialog";
import {
  InlineRenameActions,
  InlineRenameInput,
  useInlineRename,
  type InlineRenameResult,
} from "./InlineRename";
import type {
  Chapter,
  ChapterMoveRequest,
  MoveDirection,
  OrderingPendingState,
  Topic,
  TopicMoveRequest,
} from "./types";

export const WORKBENCH_HEADING_ID = "chapter-workbench-heading";

export type MoveErrorState =
  | { type: "chapter"; message: string; request: ChapterMoveRequest }
  | { type: "topic"; message: string; request: TopicMoveRequest }
  | null;

const topicStatusMeta: Record<
  Topic["status"],
  { label: string; icon: typeof FilePen; className: string }
> = {
  draft: { label: "Bản nháp", icon: FilePen, className: "text-muted-foreground" },
  pending: { label: "Chờ duyệt", icon: Clock, className: "text-amber-700" },
  published: { label: "Đã xuất bản", icon: CheckCircle2, className: "text-emerald-700" },
};

const PENDING_TOPIC_REASON = "Bài học đang chờ duyệt";

// Nút phụ: dạng chữ trên chuột/trackpad, dạng nút viền 44px trên màn hình cảm ứng.
const touchLabeledButton = "h-11 [@media(hover:hover)_and_(pointer:fine)]:h-8";

interface ChapterWorkbenchProps {
  courseId: string;
  chapter: Chapter;
  position: number;
  total: number;
  readOnly: boolean;
  canReorderChapters: boolean;
  pendingMove: OrderingPendingState;
  moveError: MoveErrorState;
  onMoveChapter: (request: ChapterMoveRequest) => Promise<void>;
  /** Trả về true khi server đã xác nhận thứ tự mới. */
  onMoveTopic: (request: TopicMoveRequest) => Promise<boolean>;
  onRenameChapter: (title: string) => Promise<InlineRenameResult>;
  onDeleteChapter: () => void;
  onTopicsChanged: (chapterId: string) => Promise<void> | void;
  /** Gọi ngay trước khi rời sang Topic Builder với id bài học server vừa tạo. */
  onTopicCreated: (topicId: string) => void;
  onBack: () => void;
  announce: (message: string) => void;
  previewAllocation: CoursePreviewAllocation | null;
  canManagePreviewMarkers: boolean;
  isPreviewMarkerUpdating: boolean;
  onPreviewMarkersChange: (change: PreviewMarkerChange) => Promise<unknown>;
  onFocusPreviewMarkers: () => void;
  onPreviewAllocationRefresh: () => Promise<void> | void;
}

export default function ChapterWorkbench({
  courseId,
  chapter,
  position,
  total,
  readOnly,
  canReorderChapters,
  pendingMove,
  moveError,
  onMoveChapter,
  onMoveTopic,
  onRenameChapter,
  onDeleteChapter,
  onTopicsChanged,
  onTopicCreated,
  onBack,
  announce,
  previewAllocation,
  canManagePreviewMarkers,
  isPreviewMarkerUpdating,
  onPreviewMarkersChange,
  onFocusPreviewMarkers,
  onPreviewAllocationRefresh,
}: ChapterWorkbenchProps) {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null);
  const [isCreating, startCreate] = useTransition();
  const requestRef = useRef(0);
  const renameButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moveUpRef = useRef<HTMLButtonElement>(null);
  const moveDownRef = useRef<HTMLButtonElement>(null);

  const canManageChapter = !readOnly && chapter.canManage;
  const canMoveChapters = !readOnly && canReorderChapters;
  const isMovePending = Boolean(pendingMove);

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicSchema),
    defaultValues: { title: "" },
  });

  const applyTopicsResult = (res: Awaited<ReturnType<typeof getTopicsByChapterId>>) => {
    const loadedTopics = res.error ? [] : (res.data ?? []);
    setTopicsError(res.error ?? null);
    setTopics(loadedTopics);
    setIsLoadingTopics(false);
    return loadedTopics;
  };

  const reloadTopics = async () => {
    const requestId = ++requestRef.current;
    setIsLoadingTopics(true);
    setTopicsError(null);
    const res = await getTopicsByChapterId(chapter.id);
    // Bỏ kết quả cũ nếu đã có lượt tải mới hơn (ví dụ sau khi di chuyển liên tiếp).
    if (requestId !== requestRef.current) return null;
    return applyTopicsResult(res);
  };

  useEffect(() => {
    // Workbench được mount lại theo từng chương nên lượt tải đầu đã ở trạng thái loading.
    const requestId = ++requestRef.current;
    let isActive = true;
    void getTopicsByChapterId(chapter.id).then((res) => {
      if (!isActive || requestId !== requestRef.current) return;
      const loadedTopics = res.error ? [] : (res.data ?? []);
      setTopicsError(res.error ?? null);
      setTopics(loadedTopics);
      setIsLoadingTopics(false);
    });
    return () => {
      isActive = false;
    };
  }, [chapter.id]);

  const chapterRename = useInlineRename({
    title: chapter.title,
    schema: chapterFormSchema,
    onSave: onRenameChapter,
    returnFocusTo: () => renameButtonRef.current,
  });

  const handleMoveChapter = async (direction: MoveDirection) => {
    if (!canMoveChapters || isMovePending) return;
    await onMoveChapter({ chapterId: chapter.id, direction });
    // Nút vừa bấm có thể bị khóa khi chương đã tới đầu/cuối; giữ focus trong nhóm di chuyển.
    requestAnimationFrame(() => {
      const pressed = direction === "up" ? moveUpRef.current : moveDownRef.current;
      const other = direction === "up" ? moveDownRef.current : moveUpRef.current;
      if (pressed?.disabled && document.activeElement !== pressed) other?.focus();
    });
  };

  const handleMoveTopic = async (request: TopicMoveRequest) => {
    const topic = topics.find((item) => item.id === request.topicId);
    if (readOnly || !topic?.canManageStructure || topic.status === "pending") return;
    const moved = await onMoveTopic(request);
    if (!moved) return;
    const reloaded = await reloadTopics();
    const newIndex = reloaded?.findIndex((item) => item.id === request.topicId) ?? -1;
    if (newIndex >= 0) {
      announce(
        `Đã chuyển "${topic.title}" ${request.direction === "up" ? "lên" : "xuống"} vị trí ${newIndex + 1}`,
      );
    }
  };

  const retryFailedMove = () => {
    if (moveError?.type === "chapter") void handleMoveChapter(moveError.request.direction);
    if (moveError?.type === "topic") void handleMoveTopic(moveError.request);
  };

  const handleRenameTopic = async (
    topic: Topic,
    title: string,
  ): Promise<InlineRenameResult> => {
    if (readOnly || !topic.canEditContent || topic.status === "pending") {
      return { error: "Bạn không có quyền đổi tên bài học này." };
    }
    const confirmPublished =
      topic.status === "published"
        ? confirmPublishedTopicMutation("Việc đổi tên bài học")
        : false;
    if (topic.status === "published" && !confirmPublished) return { cancelled: true };

    const res = await updateTopic({ topicId: topic.id, title, confirmPublished });
    if (res.error) return { error: res.error };

    await reloadTopics();
    await onTopicsChanged(chapter.id);
    announce(`Đã đổi tên bài học thành "${title}"`);
  };

  const openCreateTopicDialog = () => {
    if (readOnly) return;
    form.reset({ title: "" });
    setIsTopicDialogOpen(true);
  };

  const onSubmitTopic = (values: TopicFormValues) => {
    if (readOnly) return;
    startCreate(async () => {
      const res = await createTopic({
        courseId,
        chapterId: chapter.id,
        title: values.title,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const createdTopicId = res.data?.id;
      if (!createdTopicId) {
        toast.error("Không thể mở bài học vừa tạo. Vui lòng tải lại trang.");
        return;
      }
      await onPreviewAllocationRefresh();
      onTopicCreated(createdTopicId);
      router.push(getTopicBuilderPath(courseId, createdTopicId));
    });
  };

  const handleConfirmDeleteTopic = async (unmarkTopicIds: string[]) => {
    if (
      !topicToDelete ||
      readOnly ||
      !topicToDelete.canDeleteTopic ||
      topicToDelete.status === "pending"
    ) {
      return { error: "Bạn không có quyền xóa bài học này." };
    }

    const confirmPublished =
      topicToDelete.status === "published"
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
    await reloadTopics();
    await onTopicsChanged(chapter.id);
    await onPreviewAllocationRefresh();
    headingRef.current?.focus();
    return res;
  };

  const statusCounts = topics.reduce<Record<Topic["status"], number>>(
    (counts, topic) => ({ ...counts, [topic.status]: counts[topic.status] + 1 }),
    { draft: 0, pending: 0, published: 0 },
  );
  const lifecycleSummary = (["draft", "pending", "published"] as const)
    .filter((status) => statusCounts[status] > 0)
    .map((status) => `${statusCounts[status]} ${topicStatusMeta[status].label.toLocaleLowerCase("vi")}`)
    .join(" · ");

  const isFirstChapter = position === 1;
  const isLastChapter = position === total;
  const chapterMovingDirection =
    pendingMove?.type === "chapter" && pendingMove.id === chapter.id
      ? pendingMove.direction
      : null;

  return (
    <section
      aria-labelledby={WORKBENCH_HEADING_ID}
      className="min-w-0 rounded-xl border border-border bg-background"
    >
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className={cn("-ml-2 mb-2 lg:hidden", touchLabeledButton)}
        >
          <ArrowLeft aria-hidden="true" />
          Tất cả chương
        </Button>

        <p className="text-sm font-medium text-muted-foreground">
          Chương {position} / {total}
        </p>

        <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 basis-64 flex-wrap items-center gap-2">
            {chapterRename.isEditing ? (
              <>
                <InlineRenameInput
                  rename={chapterRename}
                  label="Tên chương"
                  className="h-10 text-lg font-semibold"
                />
                <InlineRenameActions rename={chapterRename} />
              </>
            ) : (
              <h2
                id={WORKBENCH_HEADING_ID}
                ref={headingRef}
                tabIndex={-1}
                className="min-w-0 break-words text-xl font-semibold text-foreground outline-none"
              >
                {chapter.title}
              </h2>
            )}
          </div>

          {!readOnly ? (
            <Button
              type="button"
              onClick={openCreateTopicDialog}
              className="h-11 [@media(hover:hover)_and_(pointer:fine)]:h-9"
            >
              <Plus aria-hidden="true" />
              Thêm bài học
            </Button>
          ) : null}
        </div>

        {chapterRename.isEditing ? (
          // Giữ heading trong cây để aria-labelledby của section vẫn trỏ đúng khi đang sửa tên.
          <span id={WORKBENCH_HEADING_ID} className="sr-only">
            {chapter.title}
          </span>
        ) : null}

        {lifecycleSummary ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{lifecycleSummary}</p>
        ) : null}

        {canManageChapter || canMoveChapters ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {canManageChapter && !chapterRename.isEditing ? (
              <>
                <Button
                  ref={renameButtonRef}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Đổi tên chương ${chapter.title}`}
                  onClick={chapterRename.start}
                  className={touchLabeledButton}
                >
                  <Pencil aria-hidden="true" />
                  Đổi tên
                </Button>
                <Button
                  type="button"
                  variant="destructive-quiet"
                  size="sm"
                  aria-label={`Xóa chương ${chapter.title}`}
                  onClick={onDeleteChapter}
                  className={touchLabeledButton}
                >
                  <Trash2 aria-hidden="true" />
                  Xóa chương
                </Button>
              </>
            ) : null}

            {canMoveChapters ? (
              <div className="flex items-center gap-1" role="group" aria-label="Thứ tự chương">
                <MoveButton
                  ref={moveUpRef}
                  label={`Di chuyển chương "${chapter.title}" lên`}
                  descriptionId={`chapter-move-up-${chapter.id}`}
                  reason={isFirstChapter ? "Đã ở đầu danh sách" : undefined}
                  direction="up"
                  disabled={isFirstChapter || isMovePending}
                  isPending={chapterMovingDirection === "up"}
                  onClick={() => void handleMoveChapter("up")}
                />
                <MoveButton
                  ref={moveDownRef}
                  label={`Di chuyển chương "${chapter.title}" xuống`}
                  descriptionId={`chapter-move-down-${chapter.id}`}
                  reason={isLastChapter ? "Đã ở cuối danh sách" : undefined}
                  direction="down"
                  disabled={isLastChapter || isMovePending}
                  isPending={chapterMovingDirection === "down"}
                  onClick={() => void handleMoveChapter("down")}
                />
                {chapterMovingDirection ? (
                  <span className="text-sm text-muted-foreground">Đang di chuyển…</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {moveError?.type === "chapter" ? (
          <MoveErrorMessage message={moveError.message} onRetry={retryFailedMove} />
        ) : null}
      </div>

      <div className="px-2 py-2 sm:px-3">
        {moveError?.type === "topic" ? (
          <div className="px-2">
            <MoveErrorMessage message={moveError.message} onRetry={retryFailedMove} />
          </div>
        ) : null}

        {isLoadingTopics && topics.length === 0 ? (
          <div role="status" className="space-y-2 p-2">
            <span className="sr-only">Đang tải bài học…</span>
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-[8px] bg-muted motion-reduce:animate-none" />
            ))}
          </div>
        ) : topicsError ? (
          <div className="m-2 rounded-[8px] border border-correction/30 bg-correction-quiet p-4">
            <p className="text-sm font-medium text-correction">{topicsError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void reloadTopics()}
            >
              Thử lại
            </Button>
          </div>
        ) : topics.length === 0 ? (
          <div className="m-2 rounded-[8px] bg-muted px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Chương này chưa có bài học</p>
            {!readOnly ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Dùng “Thêm bài học” để tạo bài học đầu tiên.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden gap-3 px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[8rem_minmax(0,1fr)_8.5rem_11rem]"
            >
              <span>Thứ tự</span>
              <span>Bài học</span>
              <span>Trạng thái</span>
              <span className="text-right">Thao tác</span>
            </div>
            <ol aria-label={`Bài học trong ${chapter.title}`} className="divide-y divide-border">
              {topics.map((topic, index) => (
                <TopicRow
                  key={topic.id}
                  courseId={courseId}
                  topic={topic}
                  position={index + 1}
                  isFirst={index === 0}
                  isLast={index === topics.length - 1}
                  readOnly={readOnly}
                  pendingMove={pendingMove}
                  previewAllocation={previewAllocation}
                  canManagePreviewMarkers={canManagePreviewMarkers && !readOnly}
                  isPreviewMarkerUpdating={isPreviewMarkerUpdating}
                  onMove={handleMoveTopic}
                  onRename={(title) => handleRenameTopic(topic, title)}
                  onDelete={() => setTopicToDelete(topic)}
                  onPreviewMarkersChange={onPreviewMarkersChange}
                  onFocusPreviewMarkers={onFocusPreviewMarkers}
                />
              ))}
            </ol>
          </>
        )}
      </div>

      <Dialog
        open={isTopicDialogOpen && !readOnly}
        onOpenChange={setIsTopicDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm bài học</DialogTitle>
            <DialogDescription>
              Nhập tên bài học trong chương này.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitTopic)} className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên bài học</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập tên bài học..." className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsTopicDialogOpen(false)}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isCreating} aria-busy={isCreating || undefined}>
                  {isCreating ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {isCreating ? "Đang tạo…" : "Tạo và tiếp tục"}
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
        onConfirm={handleConfirmDeleteTopic}
      />
    </section>
  );
}

function MoveErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[8px] border border-correction/30 bg-correction-quiet px-3 py-2 text-sm text-correction"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

function MoveButton({
  ref,
  label,
  descriptionId,
  reason,
  direction,
  disabled,
  isPending,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  descriptionId: string;
  reason?: string;
  direction: MoveDirection;
  disabled: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <>
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-describedby={reason ? descriptionId : undefined}
        title={reason ?? label}
        disabled={disabled}
        onClick={onClick}
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
      </Button>
      {reason ? (
        <span id={descriptionId} className="sr-only">
          {reason}
        </span>
      ) : null}
    </>
  );
}

interface TopicRowProps {
  courseId: string;
  topic: Topic;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  readOnly: boolean;
  pendingMove: OrderingPendingState;
  previewAllocation: CoursePreviewAllocation | null;
  canManagePreviewMarkers: boolean;
  isPreviewMarkerUpdating: boolean;
  onMove: (request: TopicMoveRequest) => Promise<void>;
  onRename: (title: string) => Promise<InlineRenameResult>;
  onDelete: () => void;
  onPreviewMarkersChange: (change: PreviewMarkerChange) => Promise<unknown>;
  onFocusPreviewMarkers: () => void;
}

type DeferredMenuAction = "rename" | "delete" | "allocation" | null;

function TopicRow({
  courseId,
  topic,
  position,
  isFirst,
  isLast,
  readOnly,
  pendingMove,
  previewAllocation,
  canManagePreviewMarkers,
  isPreviewMarkerUpdating,
  onMove,
  onRename,
  onDelete,
  onPreviewMarkersChange,
  onFocusPreviewMarkers,
}: TopicRowProps) {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const deferredActionRef = useRef<DeferredMenuAction>(null);
  const rename = useInlineRename({
    title: topic.title,
    schema: topicSchema,
    onSave: onRename,
    returnFocusTo: () => menuTriggerRef.current,
  });

  const isPendingReview = topic.status === "pending";
  const canMove = !readOnly && topic.canManageStructure;
  const isMovePending = Boolean(pendingMove);
  const movingDirection =
    pendingMove?.type === "topic" && pendingMove.id === topic.id ? pendingMove.direction : null;
  const moveReason = (edge: "up" | "down") =>
    isPendingReview
      ? PENDING_TOPIC_REASON
      : edge === "up" && isFirst
        ? "Đã ở đầu danh sách"
        : edge === "down" && isLast
          ? "Đã ở cuối danh sách"
          : undefined;

  const isMarked = Boolean(previewAllocation?.markedTopics.some((item) => item.id === topic.id));
  const showPreviewAction = canManagePreviewMarkers && Boolean(previewAllocation);
  const blockedByQuota = !isMarked && previewAllocation?.remaining === 0;
  const canRename = !readOnly && topic.canEditContent;
  const canDelete = !readOnly && topic.canDeleteTopic;
  const status = topicStatusMeta[topic.status];
  const StatusIcon = status.icon;

  // Radix trả focus về nút mở menu khi đóng; hành động cần focus riêng (ô nhập, hộp thoại)
  // chỉ chạy sau khi menu đóng hẳn để không bị giành lại focus.
  const runDeferredAction = (event: Event) => {
    const action = deferredActionRef.current;
    deferredActionRef.current = null;
    if (!action) return;
    event.preventDefault();
    if (action === "rename") rename.start();
    if (action === "delete") onDelete();
    if (action === "allocation") onFocusPreviewMarkers();
  };

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[8rem_minmax(0,1fr)_8.5rem_11rem]">
      <div className="flex items-center gap-1">
        <span className="w-6 text-center text-sm font-semibold tabular-nums text-muted-foreground">
          {position}
        </span>
        {canMove ? (
          <>
            <MoveButton
              label={`Di chuyển bài học "${topic.title}" lên`}
              descriptionId={`topic-move-up-${topic.id}`}
              reason={moveReason("up")}
              direction="up"
              disabled={isFirst || isMovePending || isPendingReview}
              isPending={movingDirection === "up"}
              onClick={() => void onMove({ topicId: topic.id, direction: "up" })}
            />
            <MoveButton
              label={`Di chuyển bài học "${topic.title}" xuống`}
              descriptionId={`topic-move-down-${topic.id}`}
              reason={moveReason("down")}
              direction="down"
              disabled={isLast || isMovePending || isPendingReview}
              isPending={movingDirection === "down"}
              onClick={() => void onMove({ topicId: topic.id, direction: "down" })}
            />
          </>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {rename.isEditing ? (
          <>
            <InlineRenameInput rename={rename} label="Tên bài học" className="h-9 text-sm" />
            <InlineRenameActions rename={rename} />
          </>
        ) : (
          <>
            <span className="min-w-0 break-words text-sm font-medium text-foreground">
              {topic.title}
            </span>
            {isMarked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-route/30 bg-route-quiet px-2 py-0.5 text-xs font-medium text-route">
                <Sparkles className="size-3" aria-hidden="true" />
                Xem thử
              </span>
            ) : null}
          </>
        )}
      </div>

      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 md:contents">
        <span className={cn("inline-flex items-center gap-1.5 text-sm", status.className)}>
          <StatusIcon className="size-4" aria-hidden="true" />
          {status.label}
        </span>

        <div className="flex items-center justify-end gap-1">
          <Button
            asChild
            variant="outline"
            className="h-11 px-4 text-route underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:h-8 [@media(hover:hover)_and_(pointer:fine)]:border-transparent [@media(hover:hover)_and_(pointer:fine)]:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:px-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
          >
            <Link
              href={getTopicBuilderPath(courseId, topic.id)}
              aria-label={`Mở bài học ${topic.title}`}
            >
              Mở bài học
            </Link>
          </Button>

          {!readOnly ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={menuTriggerRef}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Thao tác khác cho bài học ${topic.title}`}
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60" onCloseAutoFocus={runDeferredAction}>
                {canRename ? (
                  <DropdownMenuItem
                    disabled={isPendingReview}
                    onSelect={() => {
                      deferredActionRef.current = "rename";
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    <MenuItemLabel label="Đổi tên" reason={isPendingReview ? PENDING_TOPIC_REASON : undefined} />
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href={getTopicBuilderPath(courseId, topic.id, "settings")}>
                    Cài đặt
                  </Link>
                </DropdownMenuItem>
                {showPreviewAction ? (
                  <>
                    <DropdownMenuItem
                      disabled={isPreviewMarkerUpdating || blockedByQuota}
                      onSelect={() =>
                        void onPreviewMarkersChange(
                          isMarked ? { unmarkTopicIds: [topic.id] } : { markTopicIds: [topic.id] },
                        )
                      }
                    >
                      <Sparkles aria-hidden="true" />
                      <MenuItemLabel
                        label={isMarked ? "Bỏ xem thử" : "Đánh dấu xem thử"}
                        reason={blockedByQuota ? "Đã dùng hết lượt xem thử" : undefined}
                      />
                    </DropdownMenuItem>
                    {blockedByQuota ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          deferredActionRef.current = "allocation";
                        }}
                      >
                        Xem phân bổ
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={isPendingReview}
                      onSelect={() => {
                        deferredActionRef.current = "delete";
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      <MenuItemLabel
                        label="Xóa bài học"
                        reason={isPendingReview ? PENDING_TOPIC_REASON : undefined}
                      />
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function MenuItemLabel({ label, reason }: { label: string; reason?: string }) {
  return (
    <span className="flex flex-col">
      <span>{label}</span>
      {reason ? <span className="text-xs text-muted-foreground">{reason}</span> : null}
    </span>
  );
}
