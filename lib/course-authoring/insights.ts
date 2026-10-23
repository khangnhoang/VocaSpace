import type { TeacherCourseProgressDistribution } from "@/lib/schemas/teacher-course-insights";

// "2026-09" -> số tháng và năm để hiển thị; tháng do database tính theo giờ Việt Nam nên không đổi múi giờ ở đây.
function parseMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthNumber };
}

export function formatInsightMonthShort(month: string) {
  return `Th${parseMonth(month).monthNumber}`;
}

export function formatInsightMonthLong(month: string) {
  const { year, monthNumber } = parseMonth(month);
  return `Tháng ${monthNumber}/${year}`;
}

export const progressCategories = [
  { key: "not_started", label: "Chưa bắt đầu" },
  { key: "in_progress", label: "Đang học" },
  { key: "completed", label: "Hoàn thành" },
] as const satisfies ReadonlyArray<{ key: keyof TeacherCourseProgressDistribution; label: string }>;

// Làm tròn theo phần dư lớn nhất để ba tỷ lệ luôn cộng đủ 100; hòa phần dư thì giữ thứ tự hiển thị.
export function toWholePercentages(progress: TeacherCourseProgressDistribution) {
  const total = progress.not_started + progress.in_progress + progress.completed;
  const result = { not_started: 0, in_progress: 0, completed: 0 };
  if (total === 0) return result;
  const parts = progressCategories.map(({ key }, order) => {
    const exact = (progress[key] / total) * 100;
    return { key, order, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let missing = 100 - parts.reduce((sum, part) => sum + part.floor, 0);
  for (const part of [...parts].sort((a, b) => b.remainder - a.remainder || a.order - b.order)) {
    result[part.key] = part.floor + (missing > 0 ? 1 : 0);
    if (missing > 0) missing -= 1;
  }
  return result;
}
