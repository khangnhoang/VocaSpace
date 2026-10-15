// Định dạng số, tiền và thời gian của dashboard /admin. Tự nhóm chữ số bằng tay thay vì Intl để kết quả
// không phụ thuộc dữ liệu locale của runtime (server, jsdom và trình duyệt cho cùng một chuỗi).

const NBSP = " ";

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Số nguyên có dấu chấm ngăn nghìn: 1234567 → "1.234.567". */
export function formatCount(value: number): string {
  return groupThousands(String(Math.round(value)));
}

/** Tiền đồng đầy đủ: 12000000 → "12.000.000 ₫" (dấu cách không ngắt dòng trước ký hiệu). */
export function formatVnd(value: number): string {
  return `${formatCount(value)}${NBSP}₫`;
}

/**
 * Triệu đồng với dấu phẩy thập phân, tối đa hai chữ số: 12300000 → "12,3"; 0 → "0".
 * Số dương nhỏ hơn 0,005 triệu hiện "<0,01" để không bị làm tròn thành "0" như thể không có doanh thu.
 */
export function formatMillions(value: number): string {
  if (value <= 0) return "0";
  const rounded = Math.round((value / 1_000_000) * 100) / 100;
  if (rounded === 0) return "<0,01";
  const [whole, fraction] = rounded.toFixed(2).split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${groupThousands(whole)},${trimmed}` : groupThousands(whole);
}

/** Tỷ lệ phần trăm một chữ số thập phân, bỏ ",0": 62.5 → "62,5%", 40 → "40%". */
export function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${text}%`;
}

function parseMonthKey(month: string): { year: number; monthNumber: number } {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthNumber };
}

/** "2026-08" → "T8" (nhãn trục, đủ hẹp cho 320 px). */
export function monthAxisLabel(month: string): string {
  return `T${parseMonthKey(month).monthNumber}`;
}

/** "2026-08" → "Tháng 8" (tooltip, vùng thông báo, văn bản thay thế). */
export function monthLabel(month: string): string {
  return `Tháng ${parseMonthKey(month).monthNumber}`;
}

/** "2026-08" → "Tháng 8/2026" (hàng của bảng, nơi cần rõ năm). */
export function monthLabelWithYear(month: string): string {
  const { year, monthNumber } = parseMonthKey(month);
  return `Tháng ${monthNumber}/${year}`;
}

/** Số phút từ `fromIso` đến `toIso`, không âm; null khi thiếu mốc đầu hoặc mốc không hợp lệ. */
export function elapsedMinutes(fromIso: string | null, toIso: string): number | null {
  if (!fromIso) return null;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.floor((to - from) / 60_000));
}

/** Thời gian chờ: "3 ngày", "5 giờ", "12 phút", "dưới 1 phút". */
export function formatWait(minutes: number): string {
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)} ngày`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} giờ`;
  if (minutes >= 1) return `${minutes} phút`;
  return "dưới 1 phút";
}

const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

function formatVietnamDate(iso: string): string {
  const shifted = new Date(Date.parse(iso) + VIETNAM_UTC_OFFSET_MS);
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${shifted.getUTCFullYear()}`;
}

/** Thời gian tương đối so với mốc `nowIso` của database; từ 30 ngày trở đi hiện ngày theo giờ Việt Nam. */
export function formatRelativeTime(iso: string, nowIso: string): string {
  const minutes = elapsedMinutes(iso, nowIso);
  if (minutes === null) return "";
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  if (minutes < 30 * 1440) return `${Math.floor(minutes / 1440)} ngày trước`;
  return formatVietnamDate(iso);
}
