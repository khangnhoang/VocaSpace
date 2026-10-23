import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCourseStructurePath,
  getTeacherCourseListPath,
} from "@/lib/course-authoring/routes";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";
import type { TeacherCourseInsightsResult } from "@/lib/schemas/teacher-course-insights";
import type { TeacherCoursePortfolioResult } from "@/lib/schemas/teacher-course-portfolio";
import EmptyCourseDashboard from "./EmptyCourseDashboard";
import CourseIdentityHero from "./CourseIdentityHero";
import CourseInsights, { CourseInsightsFallback } from "./CourseInsights";
import CourseNextActionPanel, { getCourseNextAction } from "./CourseNextActionPanel";
import { CoursePreviewOverviewNotice } from "./course-preview-controls";

interface CourseOverviewProps {
  readiness: CourseDashboardReadiness;
  // Hai read phụ được truyền dạng promise để trang hiện ngay phần readiness; mỗi phần có Suspense và
  // trạng thái lỗi riêng nên lỗi của chúng không che hành động tiếp theo (G5).
  insights: Promise<TeacherCourseInsightsResult>;
  portfolio: Promise<TeacherCoursePortfolioResult>;
}

function CourseContentSummary({ readiness }: { readiness: CourseDashboardReadiness }) {
  const { course, counts, publishedTopicCount } = readiness;
  const rows = [
    { label: "Chương", value: counts.chapters },
    { label: "Bài học", value: `${counts.topics} · ${publishedTopicCount} đã xuất bản` },
    { label: "Flashcard", value: counts.flashcards },
    { label: "Bài tập · câu hỏi", value: `${counts.exercises} · ${counts.questions}` },
  ];
  return (
    <section aria-labelledby="content-summary-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="content-summary-title" className="text-lg font-bold leading-7">Nội dung khóa học</h2>
          <p className="text-xs font-medium leading-5 text-slate-600">Tóm tắt nhanh · quản lý chi tiết ở trang Cấu trúc</p>
        </div>
        <Button asChild variant="link" className="shrink-0 px-0 coarse-input:h-11">
          <Link href={getCourseStructurePath(course.id)}>Cấu trúc<ArrowRight aria-hidden="true" /></Link>
        </Button>
      </div>
      <dl className="mt-3 divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 py-2.5 text-sm">
            <dt className="text-slate-600">{row.label}</dt>
            <dd className="text-right font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function CourseOverview({ readiness, insights, portfolio }: CourseOverviewProps) {
  const { course, counts, role } = readiness;

  if (counts.chapters === 0) {
    return <EmptyCourseDashboard readiness={readiness} />;
  }

  const { isRejected } = getCourseNextAction(readiness);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto flex max-w-310 flex-col gap-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-600">
          <Link href={getTeacherCourseListPath()} className="rounded-sm hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route">
            Khóa học của tôi
          </Link>
          <ChevronRight className="size-4" aria-hidden="true" />
          <span aria-current="page" className="min-w-0 text-slate-900 [overflow-wrap:anywhere]">Tổng quan</span>
        </nav>

        {role !== "previewer" ? (
          <CoursePreviewOverviewNotice courseId={course.id} canManage />
        ) : null}

        <CourseIdentityHero readiness={readiness} isRejected={isRejected} />

        {/* Thứ tự DOM = thứ tự đọc trên màn hẹp: hành động tiếp theo → số liệu → nội dung (AC14). */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] lg:grid-rows-[auto_1fr]">
          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            <CourseNextActionPanel readiness={readiness} portfolio={portfolio} />
          </div>
          <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <Suspense fallback={<CourseInsightsFallback />}>
              <CourseInsights insights={insights} />
            </Suspense>
          </div>
          <div className="min-w-0 lg:col-start-2 lg:row-start-2">
            <CourseContentSummary readiness={readiness} />
          </div>
        </div>
      </div>
    </div>
  );
}
