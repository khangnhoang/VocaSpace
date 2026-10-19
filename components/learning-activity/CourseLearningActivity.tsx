import Link from "next/link";
import { Flame } from "lucide-react";
import { formatRelativeDay } from "@/lib/learning-activity-format";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

const SECTION_CLASS = "rounded-3xl border border-blue-100 bg-white p-6 shadow-sm";

/**
 * FEAT3 AC6: chuỗi ngày học của MỘT khóa học và tối đa 3 chủ đề học gần nhất, dùng chung cho trang khóa học công khai
 * (chỉ khi học viên đã ghi danh) và tổng quan khóa học đã ghi danh. Chỉ trình bày kết quả đã có: dữ liệu do trang truyền vào,
 * nên không nằm trong payload công khai được cache (G5). Thất bại hiện một dòng lặng lẽ, không chặn phần còn lại (AC10).
 */
export default function CourseLearningActivity({
  courseSlug,
  result,
  className = "",
}: {
  courseSlug: string;
  result: CourseLearningSummaryResult;
  className?: string;
}) {
  if (!result.success) {
    return (
      <section
        aria-labelledby="course-learning-activity-title"
        role="status"
        className={`${SECTION_CLASS} ${className}`}
      >
        <h2 id="course-learning-activity-title" className="text-base font-bold text-slate-950">
          Chưa tải được chuỗi ngày học của khóa này
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Bạn vẫn học bình thường.</p>
      </section>
    );
  }

  const { streak, studiedToday, recentTopics } = result.data;
  const hasStreak = streak > 0;

  return (
    <section aria-labelledby="course-learning-activity-title" className={`${SECTION_CLASS} ${className}`}>
      <div className="flex items-center gap-2">
        <Flame aria-hidden="true" className={`size-5 ${hasStreak ? "text-orange-500" : "text-slate-400"}`} />
        <h2 id="course-learning-activity-title" className="text-base font-bold text-slate-950">
          {hasStreak ? `Chuỗi ${streak} ngày học khóa này` : "Chưa có chuỗi ngày học khóa này"}
        </h2>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {!hasStreak
          ? "Làm một câu hỏi hoặc ôn một thẻ của khóa này hôm nay để bắt đầu chuỗi."
          : studiedToday
            ? "Hôm nay bạn đã học khóa này."
            : "Hôm nay bạn chưa học khóa này. Học một chút để giữ chuỗi."}
      </p>

      {recentTopics.length > 0 && (
        <>
          <h3 className="mt-5 text-xs font-extrabold tracking-[0.08em] text-blue-900">HỌC GẦN ĐÂY</h3>
          <ul className="mt-2 space-y-2">
            {recentTopics.map((topic) => (
              <li key={topic.topicId}>
                <Link
                  href={`/learn/${courseSlug}/${topic.slug}`}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-transparent bg-slate-50 px-3.5 py-3 transition hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2"
                >
                  <span className="min-w-0 wrap-break-word text-sm font-bold leading-6 text-slate-900">
                    {topic.title}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {formatRelativeDay(topic.daysAgo)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
