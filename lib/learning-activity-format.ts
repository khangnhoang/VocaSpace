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

/**
 * Thời gian học ước tính theo bản dịch `t` của namespace `learning` (màn hình U3, H5). Số giờ/phút truyền dạng chuỗi để tiếng Việt
 * giữ chữ số trần như trước U3, không bị ICU thêm dấu phân cách hàng nghìn.
 */
export function translateStudyDuration(minutes: number, t: Translate): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return t("duration.minutes", { minutes: String(total) });
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0
    ? t("duration.hours", { hours: String(hours) })
    : t("duration.hoursMinutes", { hours: String(hours), minutes: String(rest) });
}

/** Thời gian học ước tính, luôn có "khoảng": 25 -> "khoảng 25 phút", 80 -> "khoảng 1 giờ 20 phút", 120 -> "khoảng 2 giờ". */
export function formatStudyDuration(minutes: number): string {
  return translateStudyDuration(minutes, viLearningText);
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Thứ của một ngày dạng "YYYY-MM-DD" (ngày lịch thuần, không múi giờ) theo bản dịch `t` của namespace `learning`. */
export function translateWeekday(date: string, t: Translate): string {
  const [year, month, day] = date.split("-").map(Number);
  return t(`weekday.${WEEKDAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}`);
}

/** Thứ của một ngày dạng "YYYY-MM-DD" (ngày lịch thuần, không múi giờ): "T2".."T7", "CN". */
export function weekdayLabel(date: string): string {
  return translateWeekday(date, viLearningText);
}

/** Ngày-tháng của "YYYY-MM-DD" theo bản dịch `t`: thứ tự ngày/tháng do catalog quyết định ("10/03" ở tiếng Việt). */
export function translateDayMonth(date: string, t: Translate): string {
  const [, month, day] = date.split("-");
  return t("dayMonth", { day, month });
}

/** Dạng đọc được của ngày "YYYY-MM-DD" cho trình đọc màn hình: "10/03". */
export function dayMonthLabel(date: string): string {
  return translateDayMonth(date, viLearningText);
}
