// FEAT3: chữ hiển thị cho chuỗi ngày học. Ngày đã được SQL tính theo Asia/Ho_Chi_Minh (G3); các hàm ở đây chỉ định dạng,
// không bao giờ tự suy ra "hôm nay" từ đồng hồ trình duyệt hay máy chủ web.

import { viLearningText } from "@/lib/i18n/learning-text";
import type { Translate } from "@/lib/i18n/translate";

/** Như `formatRelativeDay` nhưng theo bản dịch `t` của namespace `learning` (màn hình U2, H7). */
export function translateRelativeDay(daysAgo: number, t: Translate): string {
  if (daysAgo <= 0) return t("relativeDay.today");
  if (daysAgo === 1) return t("relativeDay.yesterday");
  return t("relativeDay.daysAgo", { days: daysAgo });
}

/** "Hôm nay", "Hôm qua", "N ngày trước" từ số ngày lệch do SQL trả về. Luôn tiếng Việt: người gọi U3 và test hiện có dựa vào đây. */
export function formatRelativeDay(daysAgo: number): string {
  return translateRelativeDay(daysAgo, viLearningText);
}

/** Thời gian học ước tính, luôn có "khoảng": 25 -> "khoảng 25 phút", 80 -> "khoảng 1 giờ 20 phút", 120 -> "khoảng 2 giờ". */
export function formatStudyDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `khoảng ${total} phút`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `khoảng ${hours} giờ` : `khoảng ${hours} giờ ${rest} phút`;
}

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

/** Thứ của một ngày dạng "YYYY-MM-DD" (ngày lịch thuần, không múi giờ): "T2".."T7", "CN". */
export function weekdayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/** Dạng đọc được của ngày "YYYY-MM-DD" cho trình đọc màn hình: "10/03". */
export function dayMonthLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}
