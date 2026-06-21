import Link from "next/link";
import { ArrowLeft, Layers3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";

interface EmptyCourseDashboardProps {
  readiness: CourseDashboardReadiness;
}

export default function EmptyCourseDashboard({
  readiness,
}: EmptyCourseDashboardProps) {
  const { course, primaryCta } = readiness;

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-6 text-slate-900 sm:px-6 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link
            href="/courses"
            className="rounded-sm hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            Khóa học của tôi
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900">Tổng quan</span>
        </nav>

        <section className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm sm:px-8 sm:py-14">
          <div
            className="mx-auto flex size-14 items-center justify-center rounded-lg bg-blue-50 text-blue-700"
            aria-hidden="true"
          >
            <Layers3 className="size-7" />
          </div>
          <p className="mt-5 text-sm font-bold text-blue-700">Khóa học mới</p>
          <h1 className="mx-auto mt-2 max-w-2xl wrap-break-word text-2xl font-bold text-slate-950 sm:text-3xl">
            {course.title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl wrap-break-word text-sm leading-6 text-slate-600">
            Khóa học chưa có chương nào. Hãy tạo chương đầu tiên để bắt đầu xây dựng
            bài học và nội dung luyện tập.
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-auto min-h-10 w-full whitespace-normal bg-[#3B82F6] px-3 py-2 text-center leading-5 text-white hover:bg-[#2563EB] sm:w-auto"
            >
              <Link href={primaryCta.destination.href}>
                <Plus className="size-4" aria-hidden="true" />
                {primaryCta.label}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-auto min-h-10 w-full whitespace-normal px-3 py-2 text-center leading-5 sm:w-auto"
            >
              <Link href="/courses">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Danh sách khóa học
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
