"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  type Chapter,
  type ChapterMoveRequest,
  type OrderingPendingState,
  type TopicMoveRequest,
} from "./types";
import { Plus, BookOpen, Layers, FileText, Library, HelpCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  chapterFormSchema,
  type ChapterMetadataFormValues,
} from "@/lib/schemas/chapter";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { verifyCourseAccess } from "@/app/actions/course";
import { getChapterHidePreviewProjection } from "@/app/actions/course-preview";
import { getCourseStats, moveTopicOrder } from "@/app/actions/topic";
import {
  getChaptersByCourseId,
  getDeletedChaptersByCourseId,
  createChapter,
  deleteChapter,
  moveChapterOrder,
  restoreChapter,
  updateChapter,
} from "@/app/actions/chapter";
import ChapterList from "./ChapterList";
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

export default function CourseStructureWorkspace({
  courseId,
  initialIssueFeedback,
}: CourseStructureWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const listHref = getTeacherCourseListPath();
  const overviewHref = getCourseOverviewPath(courseId);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [deletedChapters, setDeletedChapters] = useState<Chapter[]>([]);
  const [isDeletedModalOpen, setIsDeletedModalOpen] = useState(false);
  const [stats, setStats] = useState({
    chapters: 0,
    topics: 0,
    cards: 0,
    exercises: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [canManagePreviewMarkers, setCanManagePreviewMarkers] = useState(false);
  const [canReorderChapters, setCanReorderChapters] = useState(false);
  const [restoringChapterId, setRestoringChapterId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [chapterToEdit, setChapterToEdit] = useState<Chapter | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null);
  const [pendingMove, setPendingMove] = useState<OrderingPendingState>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [routeIssueFeedback, setRouteIssueFeedback] =
    useState(initialIssueFeedback);
  const [returnFeedback, setReturnFeedback] =
    useState<CourseAuthoringReturnFeedback | null>(null);
  const [hasConsumedDashboardIssue, setHasConsumedDashboardIssue] =
    useState(false);

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
  // Giữ ngữ cảnh gốc để còn so khớp success khi sheet con báo về,
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
    ? {
        tone: "warning" as const,
        title: "Nội dung không còn khả dụng",
        description:
          "Nội dung bạn muốn mở không còn khả dụng. Bạn đã được đưa về cấu trúc khóa học.",
        targetChapterId: routeFeedbackChapterId,
      }
    : null;

  const form = useForm<ChapterMetadataFormValues>({
    resolver: zodResolver(chapterFormSchema),
    defaultValues: { title: "" },
  });

  const preview = useCoursePreviewAllocation(
    courseId,
    canManagePreviewMarkers && !isLoading,
  );

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

      const [chaptersRes, deletedChaptersRes, statsRes] = await Promise.all([
        getChaptersByCourseId(courseId),
        getDeletedChaptersByCourseId(courseId),
        getCourseStats(courseId),
      ]);

      if (chaptersRes.error) toast.error(chaptersRes.error);
      else {
        setChapters(chaptersRes.data || []);
      }

      if (deletedChaptersRes.error) toast.error(deletedChaptersRes.error);
      else setDeletedChapters(deletedChaptersRes.data || []);

      if ("error" in statsRes) {
        toast.error(statsRes.error ?? "Không thể tải thống kê khóa học.");
      } else setStats(statsRes);

      setIsLoading(false);
    };
    fetchInit();
  }, [courseId, listHref, router]);

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

  const refreshData = async () => {
    const [chaptersRes, deletedChaptersRes, statsRes] = await Promise.all([
      getChaptersByCourseId(courseId),
      getDeletedChaptersByCourseId(courseId),
      getCourseStats(courseId),
      preview.refresh(),
    ]);
    if (chaptersRes.data) {
      setChapters(chaptersRes.data);
    }
    if (deletedChaptersRes.data) {
      setDeletedChapters(deletedChaptersRes.data);
    }
    if ("error" in statsRes) {
      toast.error(statsRes.error ?? "Không thể tải thống kê khóa học.");
    } else setStats(statsRes);
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
        setMoveError(res.error);
        return;
      }

      await refreshData();
      router.refresh();
    } catch (error) {
      console.error("[CHAPTER ORDER UI ERROR]:", error);
      setMoveError("Không thể cập nhật thứ tự chương. Vui lòng thử lại.");
    } finally {
      setPendingMove(null);
    }
  };

  const handleMoveTopic = async (request: TopicMoveRequest) => {
    if (isReadOnly) return;
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
        setMoveError(res.error);
        return;
      }

      await refreshData();
      router.refresh();
    } catch (error) {
      console.error("[TOPIC ORDER UI ERROR]:", error);
      setMoveError("Không thể cập nhật thứ tự bài học. Vui lòng thử lại.");
    } finally {
      setPendingMove(null);
    }
  };

  const openCreateChapterDialog = () => {
    if (isReadOnly) return;
    setChapterToEdit(null);
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

    // Sheet quản lý bài học nằm trong trang structure, nên trang cha chịu trách nhiệm
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

  const handleAuthoringSuccess = (event: CourseAuthoringSuccessEvent) =>
    showReturnFeedbackForSuccess(event);

  const openEditChapterDialog = (chapter: Chapter) => {
    if (isReadOnly || !chapter.canManage) return;
    setChapterToEdit(chapter);
    form.reset({ title: chapter.title });
    setIsAddDialogOpen(true);
  };

  const onSubmitForm = (values: ChapterMetadataFormValues) => {
    if (isReadOnly) return;
    if (chapterToEdit && !chapterToEdit.canManage) return;
    startTransition(async () => {
      const res = chapterToEdit
        ? await updateChapter({ chapterId: chapterToEdit.id, title: values.title })
        : await createChapter({ courseId, title: values.title });
      if (res.error) toast.error(res.error);
      else {
        const handledByDashboardFeedback =
          !chapterToEdit &&
          "data" in res &&
          typeof res.data?.id === "string" &&
          showReturnFeedbackForSuccess({
            type: "chapter_created",
            courseId,
            chapterId: res.data.id,
          });

        if (!handledByDashboardFeedback) {
          toast.success(res.message);
        }

        setIsAddDialogOpen(false);
        setChapterToEdit(null);
        form.reset();
        refreshData();
      }
    });
  };

  const handleConfirmDelete = async (unmarkTopicIds: string[]) => {
    if (!chapterToDelete || isReadOnly || !chapterToDelete.canManage) {
      return { error: "Bạn không có quyền xóa chương này." };
    }
    const res = await deleteChapter({
      chapterId: chapterToDelete.id,
      unmarkTopicIds,
    });
    if (res.error) return res;
    toast.success(res.message);
    await refreshData();
    router.refresh();
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
          router.refresh();
        }
      } catch (error) {
        console.error("[CHAPTER RESTORE UI ERROR]:", error);
        toast.error("Không thể khôi phục chương. Vui lòng thử lại.");
      } finally {
        setRestoringChapterId(null);
      }
    });
  };

  const dynamicStats = [
    { id: 1, title: isReadOnly ? "Chương có thể xem" : "Tổng số chương", value: stats.chapters, description: "Chương học (Chapters)", icon: <Layers size={24} />, color: "text-blue-600", bgColor: "bg-blue-100/50", borderColor: "border-blue-200" },
    { id: 2, title: isReadOnly ? "Bài học có thể xem" : "Tổng số bài học", value: stats.topics, description: "Bài học chi tiết (Topics)", icon: <FileText size={24} />, color: "text-emerald-600", bgColor: "bg-emerald-100/50", borderColor: "border-emerald-200" },
    { id: 3, title: isReadOnly ? "Thẻ từ vựng có thể xem" : "Thẻ từ vựng", value: stats.cards, description: "Flashcards đã tạo (Cards)", icon: <Library size={24} />, color: "text-amber-600", bgColor: "bg-amber-100/50", borderColor: "border-amber-200" },
    { id: 4, title: isReadOnly ? "Bài tập có thể xem" : "Bài tập TOEIC", value: stats.exercises, description: "Câu hỏi trắc nghiệm (Questions)", icon: <HelpCircle size={24} />, color: "text-rose-600", bgColor: "bg-rose-100/50", borderColor: "border-rose-200" },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
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
        />

        <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link href={listHref} className="hover:text-slate-900">
            Khóa học của tôi
          </Link>
          <span aria-hidden="true">/</span>
          {!isReadOnly && (
            <>
              <Link href={overviewHref} className="hover:text-slate-900">
                Tổng quan
              </Link>
              <span aria-hidden="true">/</span>
            </>
          )}
          <span className="text-slate-900">Cấu trúc</span>
        </nav>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="p-3 sm:p-4 bg-blue-100 text-blue-600 rounded-xl sm:rounded-2xl shrink-0">
              <BookOpen size={28} className="sm:hidden" />
              <BookOpen size={32} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">Khung Chương Trình</h1>
              <p className="text-slate-500 font-medium mt-1 text-xs sm:text-sm">
                {isReadOnly
                  ? "Xem cấu trúc và bài học bạn có quyền truy cập"
                  : "Xây dựng cấu trúc cho khóa học của bạn"}
              </p>
            </div>
          </div>
          {!isReadOnly ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeletedModalOpen(true)}
                className="h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
              >
                <Trash2 size={18} className="text-slate-500" />
                <span>Chương đã xóa</span>
                {deletedChapters.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {deletedChapters.length}
                  </span>
                )}
              </Button>
              <Button
                onClick={openCreateChapterDialog}
                disabled={isLoading}
                className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold h-11 sm:h-12 px-4 sm:px-6 rounded-xl shadow-md cursor-pointer flex items-center justify-center text-xs sm:text-sm w-full sm:w-auto"
              >
                <Plus className="mr-2" size={20} /> Thêm Chương
              </Button>
            </div>
          ) : null}
          {isReadOnly ? (
            <p className="max-w-sm text-sm leading-6 text-slate-600">
              Bạn đang ở chế độ xem trước; thống kê chỉ gồm nội dung bạn có thể xem và các thao tác thay đổi cấu trúc đã bị khóa.
            </p>
          ) : null}
        </div>

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
        ) : null}

        {canManagePreviewMarkers ? (
          <div className="mb-6 space-y-4">
            <PreviewSuspensionNotice
              allocation={preview.allocation}
              canManage={canManagePreviewMarkers}
              onAction={() => {
                document.getElementById("course-preview-expand-markers")?.click();
              }}
            />
            <CoursePreviewAllocationCard
              allocation={preview.allocation}
              isLoading={preview.isLoading}
              isUpdating={preview.isUpdating}
              error={preview.error}
              canManage={canManagePreviewMarkers}
              onChange={preview.changeMarkers}
              onRefresh={preview.refresh}
            />
          </div>
        ) : null}

        <ChapterFormModal
          isOpen={isAddDialogOpen}
          setIsOpen={(open) => {
            setIsAddDialogOpen(open);
            if (!open) setChapterToEdit(null);
          }}
          form={form}
          onSubmitForm={onSubmitForm}
          isPending={isPending}
          title={chapterToEdit ? "Sửa chương" : "Thêm chương"}
          submitText={chapterToEdit ? "Lưu thay đổi" : "Tạo chương"}
        />

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dynamicStats.map((stat) => (
              <div key={stat.id} className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs transition-all hover:shadow-sm hover:border-slate-300">
                <div className={`p-3 rounded-xl ${stat.bgColor} ${stat.color}`}>{stat.icon}</div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stat.value}</h3>
                  <p className="text-xs text-slate-400 font-medium">{stat.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="w-full">
            <ChapterList
              chapters={chapters}
              deletedChapters={deletedChapters}
              isLoading={isLoading}
              setChapterToDelete={setChapterToDelete}
              onEditChapter={openEditChapterDialog}
              onTopicsChanged={handleTopicsChanged}
              onAuthoringSuccess={handleAuthoringSuccess}
              onMoveChapter={handleMoveChapter}
              onRestoreChapter={handleRestoreChapter}
              restoringChapterId={restoringChapterId}
              canReorderChapters={canReorderChapters}
              onMoveTopic={handleMoveTopic}
              pendingMove={pendingMove}
              moveError={moveError}
              previewAllocation={preview.allocation}
              canManagePreviewMarkers={canManagePreviewMarkers}
              isPreviewMarkerUpdating={preview.isUpdating}
              previewMarkerError={preview.error}
              onPreviewMarkersChange={preview.changeMarkers}
              onFocusPreviewMarkers={() => {
                document.getElementById("course-preview-expand-markers")?.click();
              }}
              onPreviewAllocationRefresh={preview.refresh}
              highlightedChapterId={
                dashboardIssueGuidance?.targetChapterId ??
                routeIssueGuidance?.targetChapterId
              }
              readOnly={isReadOnly}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
