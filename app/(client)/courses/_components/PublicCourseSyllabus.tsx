import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  LockKeyhole,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicCoursePreviewPath } from "@/lib/public-courses/routes";
import type {
  PublicCourseDetail,
  PublicCourseLearnerProgress,
} from "@/lib/schemas/public-course";

type PublicCourseSyllabusProps = {
  courseSlug: string;
  isPreviewSuspended: boolean;
  // LF3 AC10: có giá trị khi người xem đã ghi danh; null giữ nguyên hiển thị cho khách và người chưa ghi danh.
  learnerProgress?: PublicCourseLearnerProgress | null;
  syllabus: PublicCourseDetail["syllabus"];
};

export function PublicCourseSyllabus({
  courseSlug,
  isPreviewSuspended,
  learnerProgress = null,
  syllabus,
}: PublicCourseSyllabusProps) {
  const completedTopicIds = new Set(learnerProgress?.completed_topic_ids);

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
              data-reveal-item=""
              // Hiện dần khi cuộn (opacity/transform, 600ms) và viền hover (phản hồi tức thì, 150ms) dùng thời lượng riêng.
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs [transition-duration:600ms,600ms,150ms] [transition-property:opacity,transform,border-color] [transition-timing-function:cubic-bezier(0.2,0,0,1)] hover:border-slate-300 motion-reduce:transition-none data-[reveal=pending]:[transform:translateY(16px)] data-[reveal=pending]:opacity-0 md:p-6"
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
                  {chapter.topics.map((topic) => {
                    if (learnerProgress) {
                      // Học viên đã ghi danh: mọi chủ đề (kể cả Preview) là liên kết vào bài học, trạng thái giống tổng quan khóa học.
                      const isCompleted = completedTopicIds.has(topic.id);
                      const isCurrent =
                        !isCompleted &&
                        learnerProgress.next_topic_slug === topic.slug;
                      const stateLabel = isCompleted
                        ? "Đã hoàn thành"
                        : isCurrent
                          ? "Học tiếp"
                          : "Sắp tới";
                      const StateIcon = isCompleted
                        ? CheckCircle2
                        : isCurrent
                          ? PlayCircle
                          : Circle;

                      return (
                        <li key={topic.id}>
                          <Link
                            href={`/learn/${courseSlug}/${topic.slug}`}
                            className={`group flex min-h-11 min-w-0 items-center gap-3 rounded-xl border px-4 py-3 transition-[background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 ${
                              isCurrent
                                ? "border-route-line bg-route-quiet"
                                : isCompleted
                                  ? "border-growth-line bg-growth-quiet hover:border-growth"
                                  : "border-slate-100 bg-slate-50/60 hover:bg-slate-50"
                            }`}
                          >
                            <StateIcon
                              aria-hidden="true"
                              className={`size-5 shrink-0 ${
                                isCurrent
                                  ? "text-blue-600"
                                  : isCompleted
                                    ? "text-growth"
                                    : "text-slate-400"
                              }`}
                            />
                            <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-800">
                              {topic.title}
                            </span>
                            <span
                              className={`shrink-0 text-[11px] font-extrabold ${
                                isCurrent
                                  ? "text-blue-700"
                                  : isCompleted
                                    ? "text-growth"
                                    : "text-slate-500"
                              }`}
                            >
                              {stateLabel}
                            </span>
                          </Link>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={topic.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-50"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="break-words text-sm font-semibold text-slate-800">
                            {topic.title}
                          </span>
                          {topic.is_preview && !isPreviewSuspended ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-11 w-fit text-route [@media(hover:hover)_and_(pointer:fine)]:h-8 [@media(hover:hover)_and_(pointer:fine)]:border-transparent [@media(hover:hover)_and_(pointer:fine)]:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:px-0 [@media(hover:hover)_and_(pointer:fine)]:hover:border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:underline underline-offset-4"
                            >
                              <Link
                                href={getPublicCoursePreviewPath(courseSlug, topic.slug)}
                              >
                                <span>Xem thử bài học</span>
                                <ArrowRight aria-hidden="true" className="size-3.5" />
                              </Link>
                            </Button>
                          ) : (
                            <span className="inline-flex w-fit items-center gap-1.5 text-xs text-slate-400">
                              <LockKeyhole aria-hidden="true" className="size-3.5" />
                              Nội dung dành cho học viên
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
