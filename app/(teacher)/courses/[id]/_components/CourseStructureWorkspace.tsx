"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Chapter } from "./types";
import { Plus, BookOpen, Layers, FileText, Library, HelpCircle } from "lucide-react";
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
import { getCourseStats } from "@/app/actions/topic";
import {
  getChaptersByCourseId,
  createChapter,
  deleteChapter,
  updateChapter,
} from "@/app/actions/chapter";
import ChapterList from "./ChapterList";
import ChapterFormModal from "./ChapterFormModal";
import DeleteChapterModal from "./DeleteChapterModal";
import DashboardIssueNotice from "./DashboardIssueNotice";
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

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stats, setStats] = useState({
    chapters: 0,
    topics: 0,
    cards: 0,
    exercises: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [chapterToEdit, setChapterToEdit] = useState<Chapter | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null);
  const [routeIssueFeedback, setRouteIssueFeedback] =
    useState(initialIssueFeedback);

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
  const structureIssueContext =
    dashboardIssueContext?.issue === "course_has_no_chapters" ||
    dashboardIssueContext?.issue === "chapter_has_no_topics"
      ? (dashboardIssueContext as CourseStructureIssueContext)
      : null;
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

  useEffect(() => {
    const fetchInit = async () => {
      const access = await verifyCourseAccess(courseId);
      if (!access.isValid) {
        toast.error(access.error);
        router.push("/courses");
        return;
      }

      const [chaptersRes, statsRes] = await Promise.all([
        getChaptersByCourseId(courseId),
        getCourseStats(courseId),
      ]);

      if (chaptersRes.error) toast.error(chaptersRes.error);
      else {
        setChapters(chaptersRes.data || []);
      }

      if ("error" in statsRes) {
        toast.error(statsRes.error ?? "Không thể tải thống kê khóa học.");
      } else setStats(statsRes);

      setIsLoading(false);
    };
    fetchInit();
  }, [courseId, router]);

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
    const [chaptersRes, statsRes] = await Promise.all([
      getChaptersByCourseId(courseId),
      getCourseStats(courseId),
    ]);
    if (chaptersRes.data) {
      setChapters(chaptersRes.data);
    }
    if ("error" in statsRes) {
      toast.error(statsRes.error ?? "Không thể tải thống kê khóa học.");
    } else setStats(statsRes);
  };

  const openCreateChapterDialog = () => {
    setChapterToEdit(null);
    form.reset({ title: "" });
    setIsAddDialogOpen(true);
  };

  const dismissDashboardIssueGuidance = () => {
    router.replace(removeDashboardIssueContextParams(pathname, search), {
      scroll: false,
    });
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
      structureIssueContext?.issue === "chapter_has_no_topics" &&
      structureIssueContext.target === chapterId
    ) {
      router.replace(removeDashboardIssueContextParams(pathname, search), {
        scroll: false,
      });
    }

    router.refresh();
  };

  const openEditChapterDialog = (chapter: Chapter) => {
    setChapterToEdit(chapter);
    form.reset({ title: chapter.title });
    setIsAddDialogOpen(true);
  };

  const onSubmitForm = (values: ChapterMetadataFormValues) => {
    startTransition(async () => {
      const res = chapterToEdit
        ? await updateChapter({ chapterId: chapterToEdit.id, title: values.title })
        : await createChapter({ courseId, title: values.title });
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setIsAddDialogOpen(false);
        setChapterToEdit(null);
        form.reset();
        refreshData();
      }
    });
  };

  const handleConfirmDelete = async () => {
    if (!chapterToDelete) return;
    startTransition(async () => {
      const res = await deleteChapter({ chapterId: chapterToDelete.id });
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setChapterToDelete(null);
        refreshData();
      }
    });
  };

  const dynamicStats = [
    { id: 1, title: "Tổng số chương", value: stats.chapters, description: "Chương học (Chapters)", icon: <Layers size={24} />, color: "text-blue-600", bgColor: "bg-blue-100/50", borderColor: "border-blue-200" },
    { id: 2, title: "Tổng số bài học", value: stats.topics, description: "Bài học chi tiết (Topics)", icon: <FileText size={24} />, color: "text-emerald-600", bgColor: "bg-emerald-100/50", borderColor: "border-emerald-200" },
    { id: 3, title: "Thẻ từ vựng", value: stats.cards, description: "Flashcards đã tạo (Cards)", icon: <Library size={24} />, color: "text-amber-600", bgColor: "bg-amber-100/50", borderColor: "border-amber-200" },
    { id: 4, title: "Bài tập TOEIC", value: stats.exercises, description: "Câu hỏi trắc nghiệm (Questions)", icon: <HelpCircle size={24} />, color: "text-rose-600", bgColor: "bg-rose-100/50", borderColor: "border-rose-200" },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        <DeleteChapterModal chapterToDelete={chapterToDelete} setChapterToDelete={setChapterToDelete} handleConfirmDelete={handleConfirmDelete} isPending={isPending} />

        <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link href="/courses" className="hover:text-slate-900">
            Khóa học của tôi
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/courses/${courseId}`} className="hover:text-slate-900">
            Tổng quan
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900">Cấu trúc</span>
        </nav>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl"><BookOpen size={32} /></div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Khung Chương Trình</h1>
              <p className="text-slate-500 font-medium mt-1">Xây dựng cấu trúc cho khóa học của bạn</p>
            </div>
          </div>
          <Button onClick={openCreateChapterDialog} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold h-12 px-6 rounded-xl shadow-md cursor-pointer">
            <Plus className="mr-2" size={20} /> Thêm Chương
          </Button>
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

        {routeIssueGuidance ? (
          <DashboardIssueNotice
            guidance={routeIssueGuidance}
            onDismiss={dismissRouteIssueGuidance}
          />
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {dynamicStats.map((stat) => (
            <div key={stat.id} className={`flex items-center gap-4 p-5 bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md hover:-translate-y-1 ${stat.borderColor}`}>
              <div className={`p-3 rounded-xl ${stat.bgColor} ${stat.color}`}>{stat.icon}</div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{stat.title}</p>
                <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stat.value}</h3>
                <p className="text-xs text-slate-400 font-medium">{stat.description}</p>
              </div>
            </div>
          ))}
        </div>

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

        <ChapterList
          chapters={chapters}
          isLoading={isLoading}
          setChapterToDelete={setChapterToDelete}
          onEditChapter={openEditChapterDialog}
          onTopicsChanged={handleTopicsChanged}
          highlightedChapterId={
            dashboardIssueGuidance?.targetChapterId ??
            routeIssueGuidance?.targetChapterId
          }
        />
      </div>
    </div>
  );
}
