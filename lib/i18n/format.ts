import type { Locale } from "./config";

// Locale giao diện -> thẻ Intl. Tiếng Việt giữ đúng "vi-VN" mà các lệnh định dạng hiện có đang dùng.
const INTL_TAGS: Record<Locale, string> = { vi: "vi-VN", en: "en-US" };

export function intlTag(locale: Locale): string {
  return INTL_TAGS[locale];
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlTag(locale), options).format(value);
}

export function formatDateTime(locale: Locale, value: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlTag(locale), options).format(value);
}

/**
 * Giá luôn là VND ở mọi ngôn ngữ; ngôn ngữ chỉ đổi dấu phân cách hàng nghìn. Dạng "159.000 ₫" khớp các chỗ hiện đang ghép
 * `toLocaleString("vi-VN")` với " ₫".
 */
export function formatVnd(locale: Locale, amount: number): string {
  return `${formatNumber(locale, amount)} ₫`;
}
