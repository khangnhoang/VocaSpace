import { Check, Flame } from "lucide-react";
import {
  dayMonthLabel,
  formatStudyDuration,
  weekdayLabel,
} from "@/lib/learning-activity-format";
import type {
  OverallLearningSummary,
  OverallLearningSummaryResult,
} from "@/lib/schemas/learning-activity";

const CARD_CLASS =
  "rounded-[20px] border border-blue-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] lg:p-6";

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 id="learning-streak-title" className="mt-2 text-base font-bold text-slate-950">
      {children}
    </h2>
  );
}

function SevenDayStrip({ days }: { days: OverallLearningSummary["days"] }) {
  return (
    <ol aria-label="7 ngày gần nhất" className="mt-4 grid grid-cols-7 gap-1.5">
      {days.map((day, index) => {
        const isToday = index === days.length - 1;
        return (
          <li
            key={day.date}
            aria-current={isToday ? "date" : undefined}
            className="flex min-w-0 flex-col items-center gap-1"
          >
            <span className={`text-[11px] font-bold ${isToday ? "text-blue-800" : "text-slate-500"}`}>
              {isToday ? "Nay" : weekdayLabel(day.date)}
            </span>
            <span
              aria-hidden="true"
              className={`flex size-7 items-center justify-center rounded-full border ${
                day.studied
                  ? "border-growth bg-growth text-white"
                  : isToday
                    ? "border-dashed border-blue-300 bg-white"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              {day.studied && <Check className="size-4" />}
            </span>
            <span className="sr-only">
              {`${isToday ? "Hôm nay" : weekdayLabel(day.date)} ${dayMonthLabel(day.date)}: ${day.studied ? "đã học" : "chưa học"}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * FEAT3 AC5: thẻ chuỗi ngày học ở cột phải của /learn. Bốn trạng thái: chưa có chuỗi (mời bắt đầu, không phải lỗi),
 * đã học hôm nay, mới học hôm qua (nhắc giữ chuỗi), và chưa tải được (AC10, lặng lẽ, phần còn lại của trang vẫn dùng được).
 */
export default function LearningStreakCard({ result }: { result: OverallLearningSummaryResult }) {
  if (!result.success) {
    return (
      <section aria-labelledby="learning-streak-title" role="status" className={CARD_CLASS}>
        <p className="text-[11px] font-extrabold tracking-[0.08em] text-blue-900">CHUỖI NGÀY HỌC</p>
        <Heading>Chưa tải được chuỗi ngày học</Heading>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Bạn vẫn học và ôn tập bình thường. Thử tải lại trang sau ít phút.
        </p>
      </section>
    );
  }

  const { streak, studiedToday, days, weekStudyMinutes } = result.data;
  const hasStreak = streak > 0;

  return (
    <section aria-labelledby="learning-streak-title" className={CARD_CLASS}>
      <div className="flex items-center gap-2 text-blue-900">
        <Flame aria-hidden="true" className={`size-4 ${hasStreak ? "text-orange-500" : "text-slate-400"}`} />
        <p className="text-[11px] font-extrabold tracking-[0.08em]">CHUỖI NGÀY HỌC</p>
      </div>
      <Heading>{hasStreak ? `${streak} ngày liên tiếp` : "Bắt đầu chuỗi ngày học"}</Heading>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {!hasStreak
          ? "Làm một câu hỏi hoặc ôn một thẻ hôm nay để tính ngày học đầu tiên."
          : studiedToday
            ? "Hôm nay bạn đã học. Mai quay lại để nối tiếp chuỗi."
            : "Hôm nay bạn chưa học. Làm một câu hỏi hoặc ôn một thẻ để giữ chuỗi."}
      </p>
      <SevenDayStrip days={days} />
      <p className="mt-4 text-xs leading-5 text-slate-600">
        {weekStudyMinutes > 0
          ? `Tuần này bạn đã học ${formatStudyDuration(weekStudyMinutes)} (ước tính).`
          : "Tuần này chưa có thời gian học được ghi nhận."}
      </p>
    </section>
  );
}
