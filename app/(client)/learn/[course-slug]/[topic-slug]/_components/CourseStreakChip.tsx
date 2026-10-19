import { Flame } from "lucide-react";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

/**
 * FEAT3 AC7: chip chuỗi ngày học của khóa trong header của không gian học. Chưa có chuỗi thì không hiện gì; chưa tải được
 * hiện một dòng lặng lẽ (AC10) vì việc học không phụ thuộc vào chip này. Trang không truyền kết quả nào thì không hiện gì.
 */
export default function CourseStreakChip({ summary }: { summary: CourseLearningSummaryResult | undefined }) {
  if (!summary) return null;
  if (!summary.success) {
    return (
      <span role="status" className="inline-flex shrink-0 items-center text-sm text-slate-500">
        Chưa tải được chuỗi ngày học
      </span>
    );
  }
  if (summary.data.streak === 0) return null;
  const { streak, studiedToday } = summary.data;

  return (
    <span
      role="status"
      title={studiedToday ? "Hôm nay bạn đã học khóa này" : "Học hôm nay để giữ chuỗi"}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-sm font-bold text-orange-700"
    >
      <Flame aria-hidden="true" className="size-4" />
      <span>Chuỗi {streak} ngày</span>
      {!studiedToday && <span className="sr-only">. Học hôm nay để giữ chuỗi.</span>}
    </span>
  );
}
