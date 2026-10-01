"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  type Chapter,
  type ChapterMoveRequest,
  type OrderingPendingState,
  type TopicDropRequest,
  type TopicMoveRequest,
} from "./types";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  chapterFormSchema,
  type ChapterMetadataFormValues,
} from "@/lib/schemas/chapter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { verifyCourseAccess } from "@/app/actions/course";
import { getChapterHidePreviewProjection } from "@/app/actions/course-preview";
import {
  getCourseStats,
  moveTopicOrder,
  moveTopicToPosition,
} from "@/app/actions/topic";
import {
  getChaptersByCourseId,
  getDeletedChaptersByCourseId,
  createChapter,
  deleteChapter,
  moveChapterOrder,
  restoreChapter,
  updateChapter,
} from "@/app/actions/chapter";
import ChapterNavigator, { getChapterRowId } from "./ChapterNavigator";
import ChapterWorkbench, {
  WORKBENCH_HEADING_ID,
  type MoveErrorState,
} from "./ChapterWorkbench";
import DeletedChaptersModal from "./DeletedChaptersModal";
import ChapterFormModal from "./ChapterFormModal";
import DeleteChapterModal from "./DeleteChapterModal";
import DashboardIssueNotice from "./DashboardIssueNotice";
import DashboardReturnFeedback from "./DashboardReturnFeedback";
import {
  CoursePreviewAllocationCard,
  PreviewSuspensionNotice,
  useCoursePreviewAllocation,
} from "./course-preview-controls";
import {
  hasDashboardIssueContextParams,
  parseCourseStructureIssueFeedback,
  parseCourseAuthoringIssueContext,
  removeCourseStructureIssueFeedbackParam,
  removeDashboardIssueContextParams,
  type CourseStructureIssueContext,
} from "@/lib/course-authoring/issue-context";
import {
  getInvalidDashboardIssueGuidance,
  resolveCourseStructureIssueGuidance,
} from "@/lib/course-authoring/issue-guidance";
import {
  getDashboardIssueReturnFeedback,
  type CourseAuthoringReturnFeedback,
  type CourseAuthoringSuccessEvent,
} from "@/lib/course-authoring/issue-success";
import {
  getCourseOverviewPath,
  getTeacherCourseListPath,
} from "@/lib/course-authoring/routes";

interface CourseStructureWorkspaceProps {
  courseId: string;
  initialIssueFeedback: ReturnType<typeof parseCourseStructureIssueFeedback>;
}

type CourseStats = {
  chapters: number;
  topics: number;
  cards: number;
  exercises: number;
};

const CHAPTER_PARAM = "chapter";
const WIDE_LAYOUT_QUERY = "(min-width: 1024px)";

const unavailableContentGuidance = {
  tone: "warning" as const,
  title: "Nội dung không còn khả dụng",
  description:
    "Nội dung bạn muốn mở không còn khả dụng. Bạn đã được đưa về cấu trúc khóa học.",
};

function isWideLayout() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_LAYOUT_QUERY).matches
    : true;
}

function focusAfterRender(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

export default function CourseStructureWorkspace({
  courseId,
  initialIssueFeedback,
}: CourseStructureWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const urlChapterId = searchParams.get(CHAPTER_PARAM);
  const listHref = getTeacherCourseListPath();
  const overviewHref = getCourseOverviewPath(courseId);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersError, setChaptersError] = useState<string | null>(null);
  const [deletedChapters, setDeletedChapters] = useState<Chapter[]>([]);
  const [isDeletedModalOpen, setIsDeletedModalOpen] = useState(false);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [canManagePreviewMarkers, setCanManagePreviewMarkers] = useState(false);
  const [canReorderChapters, setCanReorderChapters] = useState(false);
  const [restoringChapterId, setRestoringChapterId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null);
  const [pendingMove, setPendingMove] = useState<OrderingPendingState>(null);
  const [moveError, setMoveError] = useState<MoveErrorState>(null);
  const [routeIssueFeedback, setRouteIssueFeedback] =
    useState(initialIssueFeedback);
  const [staleChapterNotice, setStaleChapterNotice] = useState(false);
  // Chương vừa bị xóa vẫn nằm trên URL cho đến khi dữ liệu tải lại xong;
  // không coi đó là liên kết cũ.
  const deletingChapterIdRef = useRef<string | null>(null);
  const focusHeadingOnDialogCloseRef = useRef(false);
  // Chương sẽ được chọn sau khi xóa; dùng trong lúc URL còn trỏ tới chương vừa xóa để không
  // nhảy tạm về chương đầu.
  const [deleteFallbackChapterId, setDeleteFallbackChapterId] = useState<string | null>(null);
  const [returnFeedback, setReturnFeedback] =
    useState<CourseAuthoringReturnFeedback | null>(null);
  const [hasConsumedDashboardIssue, setHasConsumedDashboardIssue] =
    useState(false);
  const [announcement, setAnnouncement] = useState("");

  const dashboardIssueContext = useMemo(
    () => parseCourseAuthoringIssueContext(search),
    [search],
  );
  const hasDashboardIssueParams = useMemo(
    () => hasDashboardIssueContextParams(search),
    [search],
  );
  const structureIssueFeedback = useMemo(
    () => parseCourseStructureIssueFeedback(search),
    [search],
  );
  // Trên màn hẹp chỉ hiện một bước: danh sách chương hoặc chương đang chọn.
  const [narrowView, setNarrowView] = useState<"list" | "chapter">(() =>
    urlChapterId || hasDashboardIssueParams ? "chapter" : "list",
  );
  // Giữ ngữ cảnh gốc để còn so khớp success khi workbench báo về,
  // dù guidance đã bị ẩn sau khi xử lý đúng vấn đề.
  const originalStructureIssueContext =
    dashboardIssueContext?.issue === "course_has_no_chapters" ||
    dashboardIssueContext?.issue === "chapter_has_no_topics"
      ? (dashboardIssueContext as CourseStructureIssueContext)
      : null;
  const structureIssueContext = hasConsumedDashboardIssue
    ? null
    : originalStructureIssueContext;
  const dashboardIssueGuidance = !isLoading
    ? structureIssueContext
      ? resolveCourseStructureIssueGuidance({
          courseId,
          chapters,
          context: structureIssueContext,
        })
      : hasDashboardIssueParams
        ? getInvalidDashboardIssueGuidance()
        : null
    : null;
  const routeFeedbackChapterId =
    routeIssueFeedback && !isLoading
      ? chapters.find((chapter) => chapter.id === routeIssueFeedback.chapterId)
          ?.id
      : undefined;
  const routeIssueGuidance = routeIssueFeedback
    ? { ...unavailableContentGuidance, targetChapterId: routeFeedbackChapterId }
    : null;
  const issueChapterId =
    dashboardIssueGuidance?.targetChapterId ?? routeIssueGuidance?.targetChapterId;

  // Chọn chương: lựa chọn trên URL (người dùng đã bấm) → chương được deep link đánh dấu → chương đầu.
  const selectedChapterId = isLoading
    ? null
    : (chapters.find((chapter) => chapter.id === urlChapterId)?.id ??
      chapters.find((chapter) => chapter.id === deleteFallbackChapterId)?.id ??
      chapters.find((chapter) => chapter.id === issueChapterId)?.id ??
      chapters[0]?.id ??
      null);
  const selectedIndex = chapters.findIndex((chapter) => chapter.id === selectedChapterId);
  const selectedChapter = selectedIndex >= 0 ? chapters[selectedIndex] : null;

  const form = useForm<ChapterMetadataFormValues>({
    resolver: zodResolver(chapterFormSchema),
    defaultValues: { title: "" },
  });

  const preview = useCoursePreviewAllocation(
    courseId,
    canManagePreviewMarkers && !isLoading,
  );

  const announce = useCallback((message: string) => {
    // Xóa rồi đặt lại để cùng một câu vẫn được đọc lại lần nữa.
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  const writeChapterParam = useCallback(
    (chapterId: string | null) => {
      const params = new URLSearchParams(window.location.search);
      if (chapterId) params.set(CHAPTER_PARAM, chapterId);
      else params.delete(CHAPTER_PARAM);
      const nextSearch = params.toString();
      // Next.js đồng bộ history API với useSearchParams, nên đổi chương không cần tải lại server.
      window.history.replaceState(
        null,
        "",
        nextSearch ? `${pathname}?${nextSearch}` : pathname,
      );
    },
    [pathname],
  );

  const selectChapter = (chapterId: string) => {
    if (chapterId !== selectedChapterId) setMoveError(null);
    writeChapterParam(chapterId);
    setNarrowView("chapter");
    if (!isWideLayout()) focusAfterRender(WORKBENCH_HEADING_ID);
  };

  // Màn hình rộng giữ focus ở dòng chương nên cần báo chương vừa chọn; màn hình hẹp đã đưa
  // focus tới tiêu đề chương.
  const selectChapterRow = (chapterId: string) => {
    selectChapter(chapterId);
    const chapter = chapters.find((item) => item.id === chapterId);
    if (chapter && isWideLayout()) announce(`Đã chọn chương "${chapter.title}"`);
  };

  const showChapterList = () => {
    setNarrowView("list");
    if (selectedChapterId) focusAfterRender(getChapterRowId(selectedChapterId));
  };

  const loadStats = useCallback(async () => {
    const statsRes = await getCourseStats(courseId);
    if ("error" in statsRes) {
      setStatsError(statsRes.error ?? "Không thể tải thống kê khóa học.");
    } else {
      setStats(statsRes);
      setStatsError(null);
    }
  }, [courseId]);

  const loadStructure = useCallback(async () => {
    const [chaptersRes, deletedChaptersRes] = await Promise.all([
      getChaptersByCourseId(courseId),
      getDeletedChaptersByCourseId(courseId),
      loadStats(),
    ]);

    let nextChapters: Chapter[] | null = null;
    if (chaptersRes.error) setChaptersError(chaptersRes.error);
    else {
      nextChapters = chaptersRes.data ?? [];
      setChapters(nextChapters);
      setChaptersError(null);
    }

    if (deletedChaptersRes.error) toast.error(deletedChaptersRes.error);
    else setDeletedChapters(deletedChaptersRes.data ?? []);

    return nextChapters;
  }, [courseId, loadStats]);

  useEffect(() => {
    const fetchInit = async () => {
      const access = await verifyCourseAccess(courseId);
      if (!access.isValid) {
        toast.error(access.error);
        router.push(listHref);
        return;
      }
      setIsReadOnly(access.role === "previewer");
      setCanManagePreviewMarkers(
        access.role === "owner" ||
          access.role === "co_owner" ||
          access.role === "editor",
      );
      setCanReorderChapters(
        access.role === "owner" || access.role === "co_owner",
      );

      await loadStructure();
      setIsLoading(false);
    };
    fetchInit();
  }, [courseId, listHref, loadStructure, router]);

  useEffect(() => {
    if (!routeIssueFeedback || !structureIssueFeedback) return;

    // Dọn tham số cảnh báo khỏi URL sau khi trang đã nhận nó,
    // để refresh hoặc Back/Forward không phát lại cùng một cảnh báo.
    router.replace(removeCourseStructureIssueFeedbackParam(pathname, search), {
      scroll: false,
    });
  }, [
    pathname,
    routeIssueFeedback,
    router,
    search,
    structureIssueFeedback,
  ]);

  useEffect(() => {
    if (isLoading || chaptersError || !urlChapterId) return;
    if (chapters.some((chapter) => chapter.id === urlChapterId)) return;
    if (deletingChapterIdRef.current === urlChapterId) return;
    // Chương trên URL không còn trong cấu trúc: về chương mặc định và báo cho người dùng.
    writeChapterParam(null);
    setStaleChapterNotice(true);
  }, [chapters, chaptersError, isLoading, urlChapterId, writeChapterParam]);

  useEffect(() => {
    // Khi URL đã đổi sau lần xóa, lựa chọn tạm không còn cần.
    if (deleteFallbackChapterId && !deletingChapterIdRef.current) setDeleteFallbackChapterId(null);
  }, [deleteFallbackChapterId, urlChapterId]);

  const refreshData = async () => {
    const [nextChapters] = await Promise.all([loadStructure(), preview.refresh()]);
    return nextChapters;
  };

  const handleMoveChapter = async (request: ChapterMoveRequest) => {
    if (isReadOnly || !canReorderChapters) return;
    setMoveError(null);
    setPendingMove({
      type: "chapter",
      id: request.chapterId,
      direction: request.direction,
    });

    try {
      const res = await moveChapterOrder({
        chapterId: request.chapterId,
        direction: request.direction,
      });

      if (res.error) {
        setMoveError({ type: "chapter", message: res.error, request });
        return;
      }

      const refreshedChapters = await refreshData();
      router.refresh();
      const newIndex =
        refreshedChapters?.findIndex((chapter) => chapter.id === request.chapterId) ?? -1;
      if (newIndex >= 0 && refreshedChapters) {
        announce(
          `Đã chuyển "${refreshedChapters[newIndex].title}" ${request.direction === "up" ? "lên" : "xuống"} vị trí ${newIndex + 1}`,
        );
      }
    } catch (error) {
      console.error("[CHAPTER ORDER UI ERROR]:", error);
      setMoveError({
        type: "chapter",
        message: "Không thể cập nhật thứ tự chương. Vui lòng thử lại.",
        request,
      });
    } finally {
      setPendingMove(null);
    }
  };

  const handleMoveTopic = async (request: TopicMoveRequest) => {
    if (isReadOnly) return false;
    setMoveError(null);
    setPendingMove({
      type: "topic",
      id: request.topicId,
      direction: request.direction,
    });

    try {
      const res = await moveTopicOrder({
        topicId: request.topicId,
        direction: request.direction,
      });

      if (res.error) {
        setMoveError({ type: "topic", message: res.error, request, staleOrder: res.staleOrder });
        return false;
      }

      await refreshData();
      router.refresh();
      return true;
    } catch (error) {
      console.error("[TOPIC ORDER UI ERROR]:", error);
      setMoveError({
        type: "topic",
        message: "Không thể cập nhật thứ tự bài học. Vui lòng thử lại.",
        request,
      });
      return false;
    } finally {
      setPendingMove(null);
    }
  };

  // Kéo-thả: workbench đã đặt dòng ở vị trí mới (R4); ở đây chỉ lưu và báo lại kết quả để
  // workbench xác nhận hoặc hoàn tác về thứ tự server.
  const handleDropTopic = async (request: TopicDropRequest) => {
    if (isReadOnly) return false;
    setMoveError(null);
    setPendingMove({ type: "topic", id: request.topicId, direction: "drop" });

    try {
      const res = await moveTopicToPosition(request);

      if (res.error) {
        setMoveError({ type: "topic", message: res.error, request, staleOrder: res.staleOrder });
        return false;
      }

      await refreshData();
      router.refresh();
      return true;
    } catch (error) {
      console.error("[TOPIC DROP UI ERROR]:", error);
      setMoveError({
        type: "topic",
        message: "Không thể cập nhật thứ tự bài học. Vui lòng thử lại.",
        request,
      });
      return false;
    } finally {
      setPendingMove(null);
    }
  };

  const openCreateChapterDialog = () => {
    if (isReadOnly) return;
    form.reset({ title: "" });
    setIsAddDialogOpen(true);
  };

  const dismissDashboardIssueGuidance = () => {
    router.replace(removeDashboardIssueContextParams(pathname, search), {
      scroll: false,
    });
  };

  const showReturnFeedbackForSuccess = (
    event: CourseAuthoringSuccessEvent,
  ) => {
    const feedback = getDashboardIssueReturnFeedback(
      dashboardIssueContext,
      event,
    );

    if (!feedback) return false;

    // Sau success liên quan, lời nhắc dashboard cũ được bỏ khỏi URL.
    // Thông báo quay lại tổng quan chỉ sống trong state của trang hiện tại.
    setReturnFeedback(feedback);
    setHasConsumedDashboardIssue(true);
    router.replace(removeDashboardIssueContextParams(pathname, search), {
      scroll: false,
    });
    return true;
  };

  const handleTopicCreated = (chapterId: string, topicId: string) => {
    const feedback = getDashboardIssueReturnFeedback(dashboardIssueContext, {
      type: "topic_created",
      courseId,
      chapterId,
      topicId,
    });
    if (!feedback) return;

    // Trang sắp chuyển sang Topic Builder bằng router.push. Bỏ ngữ cảnh dashboard khỏi
    // mục lịch sử hiện tại ngay (không qua router.replace, vì push sẽ hủy lượt replace đó),
    // để khi bấm Back không hiện lại lời nhắc đã được xử lý.
    setHasConsumedDashboardIssue(true);
    window.history.replaceState(
      window.history.state,
      "",
      removeDashboardIssueContextParams(pathname, window.location.search),
    );
  };

  const dismissRouteIssueGuidance = () => {
    const currentPathname = window.location.pathname;
    const currentSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;
    const nextHref = removeCourseStructureIssueFeedbackParam(
      currentPathname,
      currentSearch,
    );

    setRouteIssueFeedback(null);
    // Cập nhật history trước khi gọi router để nút đóng biến mất ngay,
    // kể cả khi router đang xử lý lại dữ liệu phía sau.
    window.history.replaceState(window.history.state, "", nextHref);
    router.replace(nextHref, { scroll: false });
  };

  const handleTopicsChanged = async (chapterId: string) => {
    await refreshData();

    // Workbench nằm trong trang structure, nên trang cha chịu trách nhiệm
    // bỏ lời nhắc dashboard khi đúng chương đã có thay đổi liên quan.
    if (
      originalStructureIssueContext?.issue === "chapter_has_no_topics" &&
      originalStructureIssueContext.target === chapterId
    ) {
      router.replace(removeDashboardIssueContextParams(pathname, search), {
        scroll: false,
      });
    }

    router.refresh();
  };

  const handleRenameChapter = async (chapter: Chapter, title: string) => {
    if (isReadOnly || !chapter.canManage) {
      return { error: "Bạn không có quyền đổi tên chương này." };
    }
    const res = await updateChapter({ chapterId: chapter.id, title });
    if (res.error) return { error: res.error };
    await refreshData();
    announce(`Đã đổi tên chương thành "${title}"`);
  };

  const onSubmitForm = (values: ChapterMetadataFormValues) => {
    if (isReadOnly) return;
    startTransition(async () => {
      const res = await createChapter({ courseId, title: values.title });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const createdChapterId =
        "data" in res && typeof res.data?.id === "string" ? res.data.id : null;
      const handledByDashboardFeedback =
        createdChapterId !== null &&
        showReturnFeedbackForSuccess({
          type: "chapter_created",
          courseId,
          chapterId: createdChapterId,
        });

      if (!handledByDashboardFeedback) {
        toast.success(res.message);
      }

      // Giữ hộp thoại (đang chờ) tới khi chương mới được chọn, để lúc đóng focus tới heading của nó.
      await refreshData();
      if (createdChapterId) {
        selectChapter(createdChapterId);
        focusHeadingOnDialogCloseRef.current = true;
      }
      setIsAddDialogOpen(false);
      form.reset();
    });
  };

  const handleConfirmDelete = async (unmarkTopicIds: string[]) => {
    if (!chapterToDelete || isReadOnly || !chapterToDelete.canManage) {
      return { error: "Bạn không có quyền xóa chương này." };
    }
    const deletedIndex = chapters.findIndex((chapter) => chapter.id === chapterToDelete.id);
    const nextSelection =
      chapters[deletedIndex + 1]?.id ?? chapters[deletedIndex - 1]?.id ?? null;

    const res = await deleteChapter({
      chapterId: chapterToDelete.id,
      unmarkTopicIds,
    });
    if (res.error) return res;
    toast.success(res.message);
    announce(
      `Đã xóa chương "${chapterToDelete.title}". Bạn có thể khôi phục trong Chương đã xóa.`,
    );
    // Đổi URL (history.replaceState) khi server action còn chạy sẽ khiến Next.js bỏ
    // action đó và promise không bao giờ kết thúc, nên chỉ đổi URL sau khi tải lại xong.
    deletingChapterIdRef.current = chapterToDelete.id;
    setDeleteFallbackChapterId(nextSelection);
    try {
      await refreshData();
      writeChapterParam(nextSelection);
    } finally {
      deletingChapterIdRef.current = null;
    }
    // Không gọi router.refresh(): action đã revalidate, dữ liệu trang tải lại ở client, và
    // refresh lúc workbench chương mới còn đang tải khiến Next.js tải lại cả trang.
    // Hộp thoại còn giữ focus trap tới khi đóng hẳn nên heading nhận focus lúc đóng.
    focusHeadingOnDialogCloseRef.current = nextSelection !== null;
    return res;
  };

  const handleRestoreChapter = (chapter: Chapter) => {
    if (isReadOnly || !chapter.canManage || restoringChapterId) return;
    setRestoringChapterId(chapter.id);
    startTransition(async () => {
      try {
        const res = await restoreChapter({ chapterId: chapter.id });
        if (res.error) toast.error(res.error);
        else {
          toast.success(res.message);
          await refreshData();
          // Không router.refresh() vì cùng lý do như khi xóa chương.
          writeChapterParam(chapter.id);
          setNarrowView("chapter");
        }
      } catch (error) {
        console.error("[CHAPTER RESTORE UI ERROR]:", error);
        toast.error("Không thể khôi phục chương. Vui lòng thử lại.");
      } finally {
        setRestoringChapterId(null);
      }
    });
  };

  // Hộp thoại giữ focus trap tới khi đóng hẳn, nên sau khi tạo/xóa thành công heading của
  // chương đang chọn nhận focus ngay lúc hộp thoại đóng.
  const takeHeadingFocusTarget = () => {
    if (!focusHeadingOnDialogCloseRef.current) return null;
    focusHeadingOnDialogCloseRef.current = false;
    return document.getElementById(WORKBENCH_HEADING_ID);
  };

  // Thanh quota nằm trong danh sách chương, vốn bị ẩn khi màn hẹp đang mở một chương.
  const focusPreviewMarkers = () => {
    setNarrowView("list");
    requestAnimationFrame(() => document.getElementById("course-preview-expand-markers")?.click());
  };

  const hasChapters = chapters.length > 0;

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-6 font-sans text-foreground sm:px-6 md:px-10 md:py-8">
      <div className="mx-auto max-w-7xl">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <DeletedChaptersModal
          open={isDeletedModalOpen}
          setOpen={setIsDeletedModalOpen}
          deletedChapters={deletedChapters}
          onRestoreChapter={handleRestoreChapter}
          restoringChapterId={restoringChapterId}
          readOnly={isReadOnly}
        />
        <DeleteChapterModal
          chapterToDelete={chapterToDelete}
          setChapterToDelete={setChapterToDelete}
          getPreviewProjection={getChapterHidePreviewProjection}
          handleConfirmDelete={handleConfirmDelete}
          getCloseFocusTarget={takeHeadingFocusTarget}
        />
        <ChapterFormModal
          isOpen={isAddDialogOpen}
          setIsOpen={setIsAddDialogOpen}
          form={form}
          onSubmitForm={onSubmitForm}
          isPending={isPending}
          title="Thêm chương"
          submitText="Tạo chương"
          getCloseFocusTarget={takeHeadingFocusTarget}
        />

        <nav
          aria-label="Đường dẫn"
          className="mb-4 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <Link href={listHref} className="inline-flex min-h-11 items-center hover:text-foreground [@media(hover:hover)_and_(pointer:fine)]:min-h-0">
            Khóa học của tôi
          </Link>
          <span aria-hidden="true">/</span>
          {!isReadOnly && (
            <>
              <Link href={overviewHref} className="inline-flex min-h-11 items-center hover:text-foreground [@media(hover:hover)_and_(pointer:fine)]:min-h-0">
                Tổng quan
              </Link>
              <span aria-hidden="true">/</span>
            </>
          )}
          <span className="text-foreground">Cấu trúc</span>
        </nav>

        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Cấu trúc khóa học
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isReadOnly
                ? "Bạn đang ở chế độ xem trước; chỉ hiển thị nội dung bạn có quyền xem."
                : "Sắp xếp chương và bài học cho khóa học của bạn."}
            </p>
            <CourseSummary
              stats={stats}
              error={statsError}
              isLoading={isLoading}
              onRetry={() => void loadStats()}
            />
          </div>
          {!isReadOnly ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeletedModalOpen(true)}
                className="h-11 text-route underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:h-9 [@media(hover:hover)_and_(pointer:fine)]:border-transparent [@media(hover:hover)_and_(pointer:fine)]:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
              >
                <Trash2 aria-hidden="true" />
                Chương đã xóa
                {deletedChapters.length > 0 ? ` (${deletedChapters.length})` : null}
              </Button>
              <Button
                type="button"
                variant={hasChapters ? "outline" : "default"}
                onClick={openCreateChapterDialog}
                disabled={isLoading}
                className="h-11 [@media(hover:hover)_and_(pointer:fine)]:h-9"
              >
                <Plus aria-hidden="true" />
                Thêm chương
              </Button>
            </div>
          ) : null}
        </header>

        {dashboardIssueGuidance ? (
          <DashboardIssueNotice
            guidance={dashboardIssueGuidance}
            onDismiss={dismissDashboardIssueGuidance}
            onAction={
              dashboardIssueGuidance.actionLabel
                ? openCreateChapterDialog
                : undefined
            }
          />
        ) : null}

        {returnFeedback ? (
          <DashboardReturnFeedback
            courseId={courseId}
            feedback={returnFeedback}
            onDismiss={() => setReturnFeedback(null)}
          />
        ) : null}

        {routeIssueGuidance ? (
          <DashboardIssueNotice
            guidance={routeIssueGuidance}
            onDismiss={dismissRouteIssueGuidance}
          />
        ) : staleChapterNotice ? (
          <DashboardIssueNotice
            guidance={unavailableContentGuidance}
            onDismiss={() => setStaleChapterNotice(false)}
          />
        ) : null}

        {canManagePreviewMarkers ? (
          <PreviewSuspensionNotice
            allocation={preview.allocation}
            canManage={canManagePreviewMarkers}
            onAction={focusPreviewMarkers}
          />
        ) : null}

        {isLoading ? (
          <div role="status" className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <span className="sr-only">Đang tải cấu trúc khóa học.</span>
            <div className="h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
            <div className="hidden h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none lg:block" />
          </div>
        ) : chaptersError ? (
          <div className="rounded-xl border border-correction/30 bg-correction-quiet p-5">
            <p className="text-sm font-medium text-correction">{chaptersError}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => void loadStructure()}
            >
              Thử lại
            </Button>
          </div>
        ) : !hasChapters ? (
          <div
            id="course-chapter-list"
            className="rounded-xl bg-muted px-6 py-12 text-center"
          >
            <p className="text-base font-semibold text-foreground">Khóa học chưa có chương</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isReadOnly
                ? "Chưa có chương nào bạn có thể xem."
                : "Dùng “Thêm chương” để tạo chương đầu tiên."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <ChapterNavigator
              chapters={chapters}
              selectedChapterId={selectedChapterId}
              issueChapterId={issueChapterId}
              onSelect={selectChapterRow}
              announce={announce}
              canReorder={!isReadOnly && canReorderChapters}
              pendingMove={pendingMove}
              moveError={
                moveError?.type === "chapter"
                  ? { message: moveError.message, request: moveError.request }
                  : null
              }
              onMove={handleMoveChapter}
              onRetryMove={() => {
                if (moveError?.type === "chapter") void handleMoveChapter(moveError.request);
              }}
              summary={
                canManagePreviewMarkers ? (
                  <CoursePreviewAllocationCard
                    allocation={preview.allocation}
                    isLoading={preview.isLoading}
                    isUpdating={preview.isUpdating}
                    error={preview.error}
                    canManage={canManagePreviewMarkers}
                    onChange={preview.changeMarkers}
                    onRefresh={preview.refresh}
                    compact
                  />
                ) : null
              }
              className={cn(
                "lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]",
                narrowView === "chapter" && "hidden lg:flex",
              )}
            />
            <div className={cn("min-w-0", narrowView === "list" && "hidden lg:block")}>
              {selectedChapter ? (
                <ChapterWorkbench
                  key={selectedChapter.id}
                  courseId={courseId}
                  chapter={selectedChapter}
                  position={selectedIndex + 1}
                  total={chapters.length}
                  readOnly={isReadOnly}
                  pendingMove={pendingMove}
                  moveError={moveError}
                  onMoveTopic={handleMoveTopic}
                  onDropTopic={handleDropTopic}
                  onRenameChapter={(title) => handleRenameChapter(selectedChapter, title)}
                  onDeleteChapter={() => setChapterToDelete(selectedChapter)}
                  onTopicsChanged={handleTopicsChanged}
                  onTopicCreated={(topicId) =>
                    handleTopicCreated(selectedChapter.id, topicId)
                  }
                  onBack={showChapterList}
                  announce={announce}
                  previewAllocation={preview.allocation}
                  canManagePreviewMarkers={canManagePreviewMarkers}
                  isPreviewMarkerUpdating={preview.isUpdating}
                  onPreviewMarkersChange={preview.changeMarkers}
                  onFocusPreviewMarkers={focusPreviewMarkers}
                  onPreviewAllocationRefresh={preview.refresh}
                />
              ) : null}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function CourseSummary({
  stats,
  error,
  isLoading,
  onRetry,
}: {
  stats: CourseStats | null;
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-correction">
        {error}
        <Button type="button" variant="link" className="h-auto p-0" onClick={onRetry}>
          Thử lại
        </Button>
      </p>
    );
  }
  if (isLoading || !stats) return null;
  return (
    <p className="mt-2 text-sm font-medium text-foreground">
      {stats.chapters} chương · {stats.topics} bài học · {stats.cards} thẻ từ vựng ·{" "}
      {stats.exercises} bài tập
    </p>
  );
}
