import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";
import { PublicCourseEnrollmentCard } from "./PublicCourseEnrollmentCard";
import { PublicCourseInstructors } from "./PublicCourseInstructors";
import { PublicCourseStats } from "./PublicCourseStats";
import { PublicCourseSyllabus } from "./PublicCourseSyllabus";

type PublicCourseDetailViewProps = {
  course: PublicCourseDetail;
};

export function PublicCourseDetailView({ course }: PublicCourseDetailViewProps) {
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
          <div className="min-w-0 space-y-9">
            <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">
                Lộ trình học tại VocaSpace
              </p>
              <h1 className="mt-3 break-words text-3xl font-extrabold leading-tight tracking-tight text-gray-950 md:text-4xl">
                {course.title}
              </h1>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-600 md:text-base">
                {course.description ||
                  "Thông tin giới thiệu khóa học đang được cập nhật."}
              </p>
            </header>

            <PublicCourseStats course={course} />
            <PublicCourseInstructors
              owner={course.owner}
              collaborators={course.collaborators}
            />
            <PublicCourseSyllabus syllabus={course.syllabus} />
          </div>

          <aside aria-label="Đăng ký khóa học" className="lg:sticky lg:top-6">
            <PublicCourseEnrollmentCard
              course={{
                id: course.id,
                title: course.title,
                slug: course.slug,
                price: course.price,
                thumbnail_url: course.thumbnail_url,
                is_enrolled: course.is_enrolled,
              }}
            />
          </aside>
        </div>
      </div>
    </article>
  );
}
