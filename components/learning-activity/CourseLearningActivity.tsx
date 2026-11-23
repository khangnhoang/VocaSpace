import Link from "next/link";
import { Flame } from "lucide-react";
import { viLearningText } from "@/lib/i18n/learning-text";
import type { Translate } from "@/lib/i18n/translate";
import { translateRelativeDay } from "@/lib/learning-activity-format";
import type { CourseLearningSummary, CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

const SECTION_CLASS = "rounded-3xl border border-blue-100 bg-white p-6 shadow-sm";

type Heading = "h2" | "h3";

// H7: `t` là bản dịch namespace `learning`. Màn hình U2 truyền vào; người gọi U3 không truyền nên vẫn là tiếng Việt hiện tại.

/** Dòng chuỗi ngày học + lời nhắc hôm nay của một khóa; `id` để vùng chứa gắn aria-labelledby. */
export function CourseStreakLine({
  data,
  headingId,
  as: HeadingTag = "h2",
  t = viLearningText,
}: {
  data: CourseLearningSummary;
  headingId?: string;
  as?: Heading;
  t?: Translate;
}) {
  const { streak, studiedToday } = data;
  const hasStreak = streak > 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <Flame aria-hidden="true" className={`size-5 ${hasStreak ? "text-orange-500" : "text-slate-400"}`} />
        <HeadingTag id={headingId} className="text-base font-bold text-slate-950">
          {hasStreak ? t("activity.streak", { streak }) : t("activity.noStreak")}
        </HeadingTag>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {!hasStreak
          ? t("activity.startStreak")
          : studiedToday
            ? t("activity.studiedToday")
            : t("activity.notStudiedToday")}
      </p>
    </>
  );
}

/** Tối đa 3 chủ đề học gần nhất, mỗi chủ đề là liên kết vào không gian học; không render gì khi chưa có chủ đề nào. */
export function RecentTopicsList({
  courseSlug,
  topics,
  className = "mt-5",
  t = viLearningText,
}: {
  courseSlug: string;
  topics: CourseLearningSummary["recentTopics"];
  className?: string;
  t?: Translate;
}) {
  if (topics.length === 0) return null;

  return (
    <div className={className}>
      <h3 className="text-xs font-extrabold tracking-[0.08em] text-blue-900">{t("activity.recent")}</h3>
      <ul className="mt-2 space-y-2">
        {topics.map((topic) => (
          <li key={topic.topicId}>
            <Link
              href={`/learn/${courseSlug}/${topic.slug}`}
              className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-transparent bg-slate-50 px-3.5 py-3 transition hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2"
            >
              <span className="min-w-0 wrap-break-word text-sm font-bold leading-6 text-slate-900">
                {topic.title}
              </span>
              <span className="shrink-0 text-xs font-semibold text-slate-500">
                {translateRelativeDay(topic.daysAgo, t)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Trạng thái lặng lẽ khi chưa đọc được chuỗi ngày học (AC10); dùng chung cho khối và thẻ đang học. */
export function CourseActivityUnavailable({
  className = "",
  t = viLearningText,
}: {
  className?: string;
  t?: Translate;
}) {
  return (
    <div role="status" className={className}>
      <p className="text-base font-bold text-slate-950">{t("activity.unavailableTitle")}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{t("activity.unavailableBody")}</p>
    </div>
  );
}

/**
 * FEAT3 AC6: chuỗi ngày học của MỘT khóa học và tối đa 3 chủ đề học gần nhất, dùng cho tổng quan khóa học đã ghi danh. Chỉ trình
 * bày kết quả đã có: dữ liệu do trang truyền vào, nên không nằm trong payload công khai được cache (G5). Thất bại hiện một dòng
 * lặng lẽ, không chặn phần còn lại (AC10). Trang khóa học công khai (AC6a) ghép các mảnh trên vào thẻ đang học thay vì dùng khối này.
 */
export default function CourseLearningActivity({
  courseSlug,
  result,
  className = "",
  t = viLearningText,
}: {
  courseSlug: string;
  result: CourseLearningSummaryResult;
  className?: string;
  t?: Translate;
}) {
  if (!result.success) {
    return (
      <section
        aria-labelledby="course-learning-activity-title"
        role="status"
        className={`${SECTION_CLASS} ${className}`}
      >
        <h2 id="course-learning-activity-title" className="text-base font-bold text-slate-950">
          {t("activity.unavailableTitle")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{t("activity.unavailableBody")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="course-learning-activity-title" className={`${SECTION_CLASS} ${className}`}>
      <CourseStreakLine data={result.data} headingId="course-learning-activity-title" t={t} />
      <RecentTopicsList courseSlug={courseSlug} topics={result.data.recentTopics} t={t} />
    </section>
  );
}
