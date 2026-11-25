// lib/payment-history-format.ts
// FEAT6: định dạng tiền và thời gian thanh toán. Múi giờ cố định Asia/Ho_Chi_Minh để máy chủ và trình duyệt cho cùng một chuỗi.

import type { Locale } from "@/lib/i18n/config";
import { formatVnd as formatLocaleVnd } from "@/lib/i18n/format";
import type { PaymentHistoryItem } from "@/lib/schemas/payment-history";

const PAYMENT_TIME_ZONE = "Asia/Ho_Chi_Minh";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: PAYMENT_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function readParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(
    dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
}

/** "dd/mm/yyyy"; null khi chuỗi không phải thời điểm hợp lệ. */
export function formatPaymentDate(value: string): string | null {
  const parts = readParts(value);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : null;
}

/** "dd/mm/yyyy HH:mm"; null khi chuỗi không phải thời điểm hợp lệ. */
export function formatPaymentDateTime(value: string): string | null {
  const parts = readParts(value);
  return parts
    ? `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
    : null;
}

// English localization U5: tiếng Việt đi qua đúng hai hàm trên để chuỗi giữ nguyên từng ký tự; tiếng Anh dùng tên tháng ngắn
// (ví dụ "Jan 2, 2099") vì "dd/mm" dễ đọc nhầm thành tháng trước ngày. Múi giờ vẫn cố định như trên.
const englishDate = new Intl.DateTimeFormat("en-US", {
  timeZone: PAYMENT_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const englishDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: PAYMENT_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatEnglish(formatter: Intl.DateTimeFormat, value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatter.format(date);
}

export function formatPaymentDateIn(locale: Locale, value: string): string | null {
  return locale === "en" ? formatEnglish(englishDate, value) : formatPaymentDate(value);
}

export function formatPaymentDateTimeIn(locale: Locale, value: string): string | null {
  return locale === "en" ? formatEnglish(englishDateTime, value) : formatPaymentDateTime(value);
}

/** "159.000 ₫" (cùng dạng với thẻ giá ở trang khóa học). */
export function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} ₫`;
}

/**
 * Số tiền ở hộp thoại thanh toán (U5 AC6). Tiếng Việt giữ đúng dạng cũ, `toLocaleString()` không truyền locale cộng hậu tố
 * ("đ" ở bước mã giảm giá, " VNĐ" ở bước QR), nên vẫn theo locale của trình duyệt như trước (G1); tiếng Anh dùng `formatVnd` chung.
 */
export function formatCheckoutAmount(locale: Locale, amount: number, viSuffix: "đ" | " VNĐ"): string {
  return locale === "vi" ? `${amount.toLocaleString()}${viSuffix}` : formatLocaleVnd(locale, amount);
}

/**
 * Hàng `creating`/`pending` còn hạn thì hiện "Hạn dd/mm/yyyy" (AC3). Dùng `now` truyền vào để kết quả không phụ thuộc đồng hồ ẩn trong test.
 */
export function hasLivePaymentDeadline(
  item: Pick<PaymentHistoryItem, "status" | "expiresAt">,
  now: number,
): boolean {
  if (item.status !== "creating" && item.status !== "pending") return false;
  if (!item.expiresAt) return false;
  const expiresAt = new Date(item.expiresAt).getTime();
  return !Number.isNaN(expiresAt) && expiresAt > now;
}

/**
 * Chỉ hàng `pending` còn hạn, trên khóa học học viên chưa ghi danh, mới được "Tiếp tục thanh toán" (Decision 17, AC11):
 * `creating` chưa có mã QR để mở, và khóa đã ghi danh thì không còn gì để thanh toán. `isEnrolled` vắng mặt (nguồn không theo dõi ghi danh,
 * như thẻ /learn đã tự loại khóa đã ghi danh) nghĩa là chưa ghi danh; `null` là không rõ nên cũng không cho tiếp tục.
 */
export function canContinuePayment(
  item: Pick<PaymentHistoryItem, "status" | "expiresAt"> & { isEnrolled?: boolean | null },
  now: number,
): boolean {
  return (
    item.status === "pending" &&
    (item.isEnrolled === undefined || item.isEnrolled === false) &&
    hasLivePaymentDeadline(item, now)
  );
}
