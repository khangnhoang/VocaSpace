"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { DragDropProvider, PointerSensor } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Accessibility, Feedback } from "@dnd-kit/dom";
import { arrayMove } from "@dnd-kit/helpers";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Clock,
  FilePen,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Pencil,
  PieChart,
  Plus,
  Settings,
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
import { useDialogReturnFocus } from "./use-dialog-return-focus";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
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
  TopicDropRequest,
  TopicMoveRequest,
} from "./types";

export const WORKBENCH_HEADING_ID = "chapter-workbench-heading";

export type MoveErrorState =
  | { type: "chapter"; message: string; request: ChapterMoveRequest }
  | { type: "topic"; message: string; request: TopicMoveRequest | TopicDropRequest }
  | null;

const topicStatusMeta: Record<
  Topic["status"],
  { label: string; icon: typeof FilePen; className: string }
> = {
  draft: { label: "Bản nháp", icon: FilePen, className: "text-muted-foreground" },
  pending: { label: "Chờ duyệt", icon: Clock, className: "text-amber-700" },
  published: { label: "Đã xuất bản", icon: CheckCircle2, className: "text-emerald-700" },
};

// Bài chờ duyệt vẫn đổi được vị trí (R3) nhưng các thao tác nội dung còn bị khóa.
const PENDING_TOPIC_REASON = "Bài học đang chờ duyệt";
function getTopicMoveButtonId(topicId: string, direction: MoveDirection) {
  return `topic-move-${direction}-button-${topicId}`;
}

// Thư viện kéo-thả chạy bằng pointer: bàn phím không có mô hình thứ hai, đã có nút Lên/Xuống.
// Bỏ plugin Accessibility vì nó thêm hướng dẫn phím tiếng Anh và vùng đọc thứ hai (vùng đọc duy
// nhất của màn hình là `announce`); tay cầm vì thế cũng không cần vai trò hay tabindex.
type DragPlugins = NonNullable<React.ComponentProps<typeof DragDropProvider>["plugins"]>;
const dragPlugins: DragPlugins = (defaults) =>
  defaults.filter((plugin) => plugin !== Accessibility);
// Giảm chuyển động: không animate lúc thả; dòng vẫn theo con trỏ khi đang kéo.
const reducedMotionDragPlugins: DragPlugins = (defaults) =>
  defaults
    .filter((plugin) => plugin !== Accessibility)
    .map((plugin) => (plugin === Feedback ? Feedback.configure({ dropAnimation: null }) : plugin));
const dragSensors = [PointerSensor];


// Cùng nhịp với menu tài khoản ở header: dòng cao, bo 8px, icon xám, focus Route Blue.
const topicMenuItemBase =
  "min-h-10 cursor-pointer gap-3 rounded-[8px] px-3 py-2 font-medium [&_svg:not([class*='size-'])]:size-[18px]";
const topicMenuItemClass = cn(
  topicMenuItemBase,
  "text-foreground [&_svg]:text-muted-foreground focus:bg-route-quiet focus:text-route not-data-[variant=destructive]:focus:**:text-route",
);

// Nút phụ: dạng chữ trên chuột/trackpad, dạng nút viền 44px trên màn hình cảm ứng.
const touchLabeledButton = "h-11 [@media(hover:hover)_and_(pointer:fine)]:h-8";

interface ChapterWorkbenchProps {
  courseId: string;
  chapter: Chapter;
  position: number;
  total: number;
  readOnly: boolean;
  pendingMove: OrderingPendingState;
  moveError: MoveErrorState;
  /** Trả về true khi server đã xác nhận thứ tự mới. */
  onMoveTopic: (request: TopicMoveRequest) => Promise<boolean>;
  /** Trả về true khi server đã lưu đúng vị trí thả. */
  onDropTopic: (request: TopicDropRequest) => Promise<boolean>;
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
  pendingMove,
  moveError,
  onMoveTopic,
  onDropTopic,
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
  const returnTopicDialogFocus = useDialogReturnFocus(isTopicDialogOpen);
  const prefersReducedMotion = usePrefersReducedMotion();

  const canManageChapter = !readOnly && chapter.canManage;

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

  // Một lượt đọc đang bay từ lần lưu trước mang thứ tự cũ hơn mutation sắp bắt đầu; bỏ kết quả
  // của nó để không ghi đè vị trí vừa đặt (R4). Lượt đọc sau mutation sẽ đặt lại trạng thái tải.
  // Lượt đọc bị bỏ không bao giờ tự tắt trạng thái tải, nên tắt ở đây; lượt đọc sau mutation
  // (nếu có) bật lại. Nếu mutation lỗi và không đọc lại, danh sách không bị kẹt ở trạng thái tải.
  const invalidatePendingTopicReads = () => {
    requestRef.current += 1;
    setIsLoadingTopics(false);
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

  // Nút di chuyển bị khóa (và danh sách tải lại) khi đang lưu nên focus rơi mất; khi thứ tự
  // mới đã hiển thị, trả focus về nút vừa bấm, hoặc nút còn lại nếu bài học đã tới đầu/cuối.
  const focusAfterMoveRef = useRef<{ request: TopicMoveRequest; fromIndex: number } | null>(null);

  useEffect(() => {
    const target = focusAfterMoveRef.current;
    if (!target || pendingMove || isLoadingTopics) return;
    const index = topics.findIndex((item) => item.id === target.request.topicId);
    if (index === target.fromIndex) return;
    focusAfterMoveRef.current = null;
    const { topicId, direction } = target.request;
    const pressed = document.getElementById(getTopicMoveButtonId(topicId, direction));
    const other = document.getElementById(
      getTopicMoveButtonId(topicId, direction === "up" ? "down" : "up"),
    );
    if (pressed instanceof HTMLButtonElement && !pressed.disabled) pressed.focus();
    else other?.focus();
  }, [pendingMove, isLoadingTopics, topics]);

  const handleMoveTopic = async (request: TopicMoveRequest) => {
    const topic = topics.find((item) => item.id === request.topicId);
    if (readOnly || !topic?.canManageStructure) return;
    const fromIndex = topics.indexOf(topic);
    focusAfterMoveRef.current = { request, fromIndex };
    invalidatePendingTopicReads();
    const moved = await onMoveTopic(request);
    if (!moved) {
      // Thứ tự không đổi: trả focus ngay khi nút được mở khóa.
      if (focusAfterMoveRef.current) focusAfterMoveRef.current.fromIndex = -1;
      return;
    }
    const reloaded = await reloadTopics();
    const newIndex = reloaded?.findIndex((item) => item.id === request.topicId) ?? -1;
    if (newIndex >= 0) {
      announce(
        `Đã chuyển "${topic.title}" ${request.direction === "up" ? "lên" : "xuống"} vị trí ${newIndex + 1}`,
      );
    }
  };

  // Thả bài học: dòng vào vị trí mới ngay (R4) và quay về thứ tự server đã xác nhận nếu lưu lỗi.
  // `optimistic` null nghĩa là không đặt trước (thử lại từ thông báo lỗi chờ server xác nhận).
  const handleDropTopic = async (request: TopicDropRequest, optimistic: Topic[] | null) => {
    const topic = topics.find((item) => item.id === request.topicId);
    if (readOnly || !topic?.canManageStructure) return;
    const confirmedTopics = topics;
    const fromIndex = topics.indexOf(topic);
    focusAfterMoveRef.current = { request: { topicId: topic.id, direction: "up" }, fromIndex };
    invalidatePendingTopicReads();
    // dnd-kit đã dời DOM theo vị trí thả. Commit thứ tự mới trước khi lưu để nếu lưu hỏng nhanh,
    // lần hoàn tác sau đó là một render thật và React dời DOM về thứ tự đã xác nhận (nếu gộp
    // batch thì React thấy không đổi gì và DOM kẹt ở thứ tự đang kéo).
    if (optimistic) flushSync(() => setTopics(optimistic));

    const saved = await onDropTopic(request);
    if (!saved) {
      // Ổn định lại ngay bằng thứ tự đã xác nhận, rồi đọc lại server để bắt luôn trường hợp
      // danh sách đã đổi dưới chân (TOPIC_ORDER_STALE).
      setTopics(confirmedTopics);
      if (focusAfterMoveRef.current) focusAfterMoveRef.current.fromIndex = -1;
      await reloadTopics();
      return;
    }
    const reloaded = await reloadTopics();
    const newIndex = reloaded?.findIndex((item) => item.id === request.topicId) ?? -1;
    if (newIndex >= 0) announce(`Đã chuyển "${topic.title}" tới vị trí ${newIndex + 1}`);
  };

  // Thứ tự lúc bắt đầu kéo: `initialIndex` của dnd-kit và `expectedTopicIds` đều thuộc về nó. Nếu
  // lượt đọc nền thay danh sách trong lúc kéo, vị trí thả vẫn tính trên thứ tự người dùng đã thấy,
  // server thấy thứ tự khác và từ chối (TOPIC_ORDER_STALE) thay vì áp ý định lên thứ tự mới.
  const dragSnapshotRef = useRef<Topic[] | null>(null);

  const handleDragStart: React.ComponentProps<typeof DragDropProvider>["onDragStart"] = () => {
    dragSnapshotRef.current = topics;
  };

  const handleDragEnd: React.ComponentProps<typeof DragDropProvider>["onDragEnd"] = (event) => {
    const dragStartTopics = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (!dragStartTopics || event.canceled || pendingMove || readOnly) return;
    // Vị trí hiển thị là nguồn sự thật: không dựa vào droppable dưới con trỏ (move() bỏ qua khi thiếu target).
    const source = event.operation.source;
    if (!source || !isSortable(source) || typeof source.id !== "string") return;
    const { initialIndex: from, index: to } = source;
    if (
      from === to ||
      from < 0 ||
      from >= dragStartTopics.length ||
      to < 0 ||
      to >= dragStartTopics.length
    ) {
      return;
    }
    const next = arrayMove(dragStartTopics, from, to);
    const newIndex = next.findIndex((topic) => topic.id === source.id);
    if (newIndex < 0) return;
    void handleDropTopic(
      {
        topicId: source.id,
        beforeTopicId: next[newIndex + 1]?.id ?? null,
        expectedTopicIds: dragStartTopics.map((topic) => topic.id),
      },
      next,
    );
  };

  const retryFailedMove = () => {
    if (moveError?.type !== "topic") return;
    if ("direction" in moveError.request) void handleMoveTopic(moveError.request);
    else void handleDropTopic(moveError.request, null);
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

        {canManageChapter && !chapterRename.isEditing ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
          </div>
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
              className="hidden gap-3 px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[9.5rem_minmax(0,1fr)_8.5rem_11rem]"
            >
              <span>Thứ tự</span>
              <span>Bài học</span>
              <span>Trạng thái</span>
              <span className="text-right">Thao tác</span>
            </div>
            <DragDropProvider
              sensors={dragSensors}
              plugins={prefersReducedMotion ? reducedMotionDragPlugins : dragPlugins}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <ol aria-label={`Bài học trong ${chapter.title}`} className="divide-y divide-border">
                {topics.map((topic, index) => (
                  <TopicRow
                    key={topic.id}
                    courseId={courseId}
                    topic={topic}
                    position={index + 1}
                    isFirst={index === 0}
                    isLast={index === topics.length - 1}
                    prefersReducedMotion={prefersReducedMotion}
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
            </DragDropProvider>
          </>
        )}
      </div>

      <Dialog
        open={isTopicDialogOpen && !readOnly}
        onOpenChange={setIsTopicDialogOpen}
      >
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={returnTopicDialogFocus}>
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

export function MoveErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
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

export function MoveButton({
  id,
  label,
  descriptionId,
  reason,
  direction,
  disabled,
  isPending,
  onClick,
}: {
  id?: string;
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
        id={id}
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
  prefersReducedMotion: boolean;
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
  prefersReducedMotion,
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
  // Vị trí không thuộc nội dung được duyệt nên bài chờ duyệt và bài kế bên nó vẫn di chuyển được.
  const moveReason = (edge: "up" | "down") =>
    edge === "up" && isFirst
      ? "Đã ở đầu danh sách"
      : edge === "down" && isLast
        ? "Đã ở cuối danh sách"
        : undefined;
  // Tay cầm chỉ là lối tắt cho con trỏ (TA: không bắt buộc kéo); bàn phím dùng nút Lên/Xuống.
  const { ref: sortableRef, handleRef, isDragging } = useSortable({
    id: topic.id,
    index: position - 1,
    disabled: !canMove || isMovePending,
    transition: prefersReducedMotion ? null : undefined,
  });

  const isMarked = Boolean(previewAllocation?.markedTopics.some((item) => item.id === topic.id));
  const showPreviewAction = canManagePreviewMarkers && Boolean(previewAllocation);
  const blockedByQuota = !isMarked && previewAllocation?.remaining === 0;
  // Giải thích ngay dưới mục menu (không dùng tooltip) để người mới hiểu "xem thử" trên cả màn cảm ứng.
  const previewHint = isMarked
    ? "Chỉ học viên đã ghi danh mới xem được"
    : topic.status === "published"
      ? "Ai cũng xem được, không cần ghi danh"
      : "Ai cũng xem được khi đã xuất bản, không cần ghi danh";
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
    if (action === "delete") {
      // Hộp thoại xóa ghi nhận nút đang focus để trả focus về khi hủy.
      menuTriggerRef.current?.focus();
      onDelete();
    }
    if (action === "allocation") onFocusPreviewMarkers();
  };

  return (
    <li
      ref={sortableRef}
      aria-busy={movingDirection ? true : undefined}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 bg-background px-3 py-3 md:grid-cols-[9.5rem_minmax(0,1fr)_8.5rem_11rem]",
        isDragging && "rounded-[8px] shadow-md ring-1 ring-border",
      )}
    >
      <div className="flex items-center gap-1">
        {canMove ? (
          <span
            ref={handleRef}
            aria-hidden="true"
            data-testid={`topic-drag-handle-${topic.id}`}
            className={cn(
              "inline-flex size-11 shrink-0 touch-none select-none items-center justify-center rounded-[8px] border border-border text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:size-8 [@media(hover:hover)_and_(pointer:fine)]:border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted",
              isMovePending ? "opacity-40" : "cursor-grab active:cursor-grabbing",
            )}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </span>
        ) : null}
        <span className="w-6 text-center text-sm font-semibold tabular-nums text-muted-foreground">
          {position}
        </span>
        {canMove ? (
          <>
            <MoveButton
              id={getTopicMoveButtonId(topic.id, "up")}
              label={`Di chuyển bài học "${topic.title}" lên`}
              descriptionId={`topic-move-up-${topic.id}`}
              reason={moveReason("up")}
              direction="up"
              disabled={isFirst || isMovePending}
              isPending={movingDirection === "up"}
              onClick={() => void onMove({ topicId: topic.id, direction: "up" })}
            />
            <MoveButton
              id={getTopicMoveButtonId(topic.id, "down")}
              label={`Di chuyển bài học "${topic.title}" xuống`}
              descriptionId={`topic-move-down-${topic.id}`}
              reason={moveReason("down")}
              direction="down"
              disabled={isLast || isMovePending}
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
            {movingDirection ? (
              <span className="text-xs font-medium text-muted-foreground">Đang di chuyển…</span>
            ) : null}
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
            className="h-11 px-4 text-route underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:h-8 [@media(hover:hover)_and_(pointer:fine)]:border-transparent [@media(hover:hover)_and_(pointer:fine)]:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:px-2 [@media(hover:hover)_and_(pointer:fine)]:hover:border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
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
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-xl p-1.5 shadow-lg"
                onCloseAutoFocus={runDeferredAction}
              >
                {canRename ? (
                  <DropdownMenuItem
                    className={topicMenuItemClass}
                    disabled={isPendingReview}
                    onSelect={() => {
                      deferredActionRef.current = "rename";
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    <MenuItemLabel label="Đổi tên" reason={isPendingReview ? PENDING_TOPIC_REASON : undefined} />
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild className={topicMenuItemClass}>
                  <Link href={getTopicBuilderPath(courseId, topic.id, "settings")}>
                    <Settings aria-hidden="true" />
                    Cài đặt
                  </Link>
                </DropdownMenuItem>
                {showPreviewAction ? (
                  <>
                    <DropdownMenuItem
                      className={topicMenuItemClass}
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
                        reason={blockedByQuota ? "Đã dùng hết lượt xem thử" : previewHint}
                      />
                    </DropdownMenuItem>
                    {blockedByQuota ? (
                      <DropdownMenuItem
                        className={topicMenuItemClass}
                        onSelect={() => {
                          deferredActionRef.current = "allocation";
                        }}
                      >
                        <PieChart aria-hidden="true" />
                        Xem phân bổ
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator className="mx-1.5 my-1.5" />
                    <DropdownMenuItem
                      variant="destructive"
                      className={topicMenuItemBase}
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
