export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Cờ bật giao diện tiếng Anh (English localization, quyết định 5). Chỉ bật khi biến môi trường bằng đúng "1"; thiếu hoặc giá
 * trị khác đều là tắt. Route static đọc giá trị này lúc build, nên đổi cờ phải build lại.
 */
export function isEnglishUiEnabled(): boolean {
  return process.env.ENGLISH_UI_ENABLED === "1";
}
