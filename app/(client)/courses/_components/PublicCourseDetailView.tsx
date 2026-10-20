import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";
import type { ResumeCheckoutResult } from "@/lib/schemas/payment";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";
import { PublicCourseCover } from "./PublicCourseCover";
import { PublicCourseEnrollmentCard, type PublicCourseLearnerCard } from "./PublicCourseEnrollmentCard";
import { PublicCourseInstructors } from "./PublicCourseInstructors";
import { PublicCourseStats } from "./PublicCourseStats";
import { PublicCourseSyllabus } from "./PublicCourseSyllabus";

type PublicCourseDetailViewProps = {
  course: PublicCourseDetail;
  // FEAT3 G5: chỉ có khi học viên đã đăng nhập và ghi danh; đi riêng khỏi `course` để dữ liệu người học không vào payload công khai.
  learningSummary?: CourseLearningSummaryResult;
  // FEAT6 AC11: kết quả mở lại mã QR khi vào bằng link "Tiếp tục thanh toán"; không có tham số thì không có giá trị.
  resumeCheckout?: ResumeCheckoutResult;
};

// FEAT3 AC6a: số liệu thẻ "đang học" lấy từ đề cương và tiến độ đã có trong payload công khai, không đọc thêm gì.
function buildLearnerCard(course: PublicCourseDetail, summary: CourseLearningSummaryResult | undefined): PublicCourseLearnerCard {
  const topics = course.syllabus.flatMap((chapter) => chapter.topics);
  const completed = new Set(course.learner_progress?.completed_topic_ids);
  const nextSlug = course.learner_progress?.next_topic_slug ?? null;

  return {
    completedTopicCount: topics.filter((topic) => completed.has(topic.id)).length,
    totalTopicCount: topics.length,
    nextTopicTitle: nextSlug ? (topics.find((topic) => topic.slug === nextSlug)?.title ?? null) : null,
    summary,
  };
}

export function PublicCourseDetailView({ course, learningSummary, resumeCheckout }: PublicCourseDetailViewProps) {
  return (
    <article className="bg-gray-50 pb-16">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <nav aria-label="Điều hướng khóa học" className="mb-7">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
            <li>
              <Link
                href="/"
                className="rounded-sm transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-400/50"
              >
                Trang chủ
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-4" />
            </li>
            <li>
              <Link
                href={getPublicCourseCatalogPath()}
                className="rounded-sm transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-400/50"
              >
                Khóa học
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-4" />
            </li>
            <li className="min-w-0" aria-current="page">
              <span className="block truncate font-semibold text-gray-800">
                {course.title}
              </span>
            </li>
          </ol>
        </nav>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
          <header className="min-w-0 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-8 lg:col-start-1 lg:row-start-1">
            {/* Học viên đã ghi danh: ảnh bìa ở đây (dưới tiêu đề khi màn hình hẹp) thay vì trong thẻ bên phải (AC6a). */}
            <div className={course.is_enrolled ? "grid gap-x-8 gap-y-4 md:grid-cols-[minmax(0,1fr)_15rem]" : undefined}>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">
                  Lộ trình học tại VocaSpace
                </p>
                <h1 className="mt-3 break-words text-3xl font-extrabold leading-tight tracking-tight text-gray-950 md:text-4xl">
                  {course.title}
                </h1>
              </div>
              {course.is_enrolled && (
                <PublicCourseCover
                  title={course.title}
                  thumbnailUrl={course.thumbnail_url}
                  sizes="(max-width: 767px) 100vw, 240px"
                  className="overflow-hidden rounded-2xl md:col-start-2 md:row-span-2 md:row-start-1"
                />
              )}
              <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600 md:text-base">
                {course.description ||
                  "Thông tin giới thiệu khóa học đang được cập nhật."}
              </p>
            </div>
          </header>

          <aside
            aria-label="Đăng ký khóa học"
            className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          >
            <PublicCourseEnrollmentCard
              course={{
                id: course.id,
                title: course.title,
                slug: course.slug,
                price: course.price,
                thumbnail_url: course.thumbnail_url,
                is_enrolled: course.is_enrolled,
                learner_progress: course.learner_progress,
              }}
              learnerCard={course.is_enrolled ? buildLearnerCard(course, learningSummary) : undefined}
              resume={resumeCheckout}
            />
          </aside>

          <div className="min-w-0 space-y-9 lg:col-start-1 lg:row-start-2">
            <PublicCourseStats course={course} />
            {course.is_preview_suspended && (
              <p
                role="status"
                className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
                Tính năng xem trước nội dung của khóa học này đang tạm thời không khả dụng.
              </p>
            )}
            <PublicCourseInstructors
              owner={course.owner}
              collaborators={course.collaborators}
            />
            <PublicCourseSyllabus
              courseSlug={course.slug}
              isPreviewSuspended={course.is_preview_suspended}
              learnerProgress={course.learner_progress}
              syllabus={course.syllabus}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
