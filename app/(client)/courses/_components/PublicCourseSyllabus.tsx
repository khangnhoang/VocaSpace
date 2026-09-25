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
          className="text-2xl font-bold tracking-tight text-slate-900"
        >
          Đề cương khóa học
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Nội dung xem thử mở ở các chủ đề được chọn; bài học đầy đủ dành cho học viên.
        </p>
      </div>

      {syllabus.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <BookOpen aria-hidden="true" className="mx-auto size-8 text-blue-400" />
          <p className="mt-3 font-semibold text-slate-800">
            Đề cương đang được cập nhật
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Khóa học chưa có chương công khai để hiển thị.
          </p>
        </div>
      ) : (
        <ol className="mt-5 space-y-4">
          {syllabus.map((chapter, chapterIndex) => (
            <li
              key={chapter.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all hover:border-slate-300 md:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 px-2.5 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-100 text-xs font-semibold tracking-tight text-slate-700">
                  Chương {chapterIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-base sm:text-lg font-bold text-slate-900">
                    {chapter.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {chapter.topics.length} chủ đề công khai
                  </p>
                </div>
              </div>

              {chapter.topics.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Chương này chưa có chủ đề công khai.
                </p>
              ) : (
                <ol className="mt-4 space-y-2 border-l-2 border-slate-100 pl-3 sm:pl-4">
                  {chapter.topics.map((topic) => (
                    <li
                      key={topic.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="break-words text-sm font-semibold text-slate-800">
                          {topic.title}
                        </span>
                        {topic.is_preview && !isPreviewSuspended ? (
                          <div className="flex items-center gap-2">
                            <span className="w-fit rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200/60">
                              Xem thử
                            </span>
                            <Link
                              href={getPublicCoursePreviewPath(courseSlug, topic.slug)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-2xs"
                            >
                              <span>Xem thử bài học</span>
                              <ArrowRight aria-hidden="true" className="size-3.5" />
                            </Link>
                          </div>
                        ) : (
                          <span className="inline-flex w-fit items-center gap-1.5 text-xs text-slate-400">
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
