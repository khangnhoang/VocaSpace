import Link from "next/link";
import { ArrowRight, BookOpen, LockKeyhole } from "lucide-react";
import { getPublicCoursePreviewPath } from "@/lib/public-courses/routes";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

type PublicCourseSyllabusProps = {
  courseSlug: string;
  isPreviewSuspended: boolean;
  syllabus: PublicCourseDetail["syllabus"];
};

export function PublicCourseSyllabus({
  courseSlug,
  isPreviewSuspended,
  syllabus,
}: PublicCourseSyllabusProps) {
  return (
    <section aria-labelledby="public-course-syllabus-title">
      <div>
        <h2
          id="public-course-syllabus-title"
          className="text-2xl font-extrabold text-gray-900"
        >
          Đề cương khóa học
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Nội dung xem thử mở ở các chủ đề được chọn; bài học đầy đủ dành cho học viên.
        </p>
      </div>

      {syllabus.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <BookOpen aria-hidden="true" className="mx-auto size-8 text-blue-400" />
          <p className="mt-3 font-semibold text-gray-800">
            Đề cương đang được cập nhật
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Khóa học chưa có chương công khai để hiển thị.
          </p>
        </div>
      ) : (
        <ol className="mt-5 space-y-4">
          {syllabus.map((chapter, chapterIndex) => (
            <li
              key={chapter.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
                  {chapterIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="wrap-break-word text-lg font-bold text-gray-900">
                    {chapter.title}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {chapter.topics.length} chủ đề công khai
                  </p>
                </div>
              </div>

              {chapter.topics.length === 0 ? (
                <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  Chương này chưa có chủ đề công khai.
                </p>
              ) : (
                <ol className="mt-4 space-y-2 border-l-2 border-blue-100 pl-4">
                  {chapter.topics.map((topic) => (
                    <li
                      key={topic.id}
                      className="rounded-xl bg-gray-50 px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="wrap-break-word text-sm font-semibold text-gray-800">
                          {topic.title}
                        </span>
                        {topic.is_preview && !isPreviewSuspended ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-fit rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">
                              Xem thử
                            </span>
                            <Link
                              href={getPublicCoursePreviewPath(courseSlug, topic.slug)}
                              className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-bold text-blue-700 underline-offset-4 transition-colors hover:text-blue-900 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-400/50"
                            >
                              Xem thử bài học
                              <ArrowRight aria-hidden="true" className="size-4" />
                            </Link>
                          </div>
                        ) : (
                          <span className="inline-flex w-fit items-center gap-1 text-xs text-gray-500">
                            <LockKeyhole aria-hidden="true" className="size-3.5" />
                            Nội dung dành cho học viên
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
