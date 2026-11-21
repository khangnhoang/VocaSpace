export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Tên mỗi ngôn ngữ viết bằng chính ngôn ngữ đó, nên giống nhau ở mọi giao diện và không nằm trong catalog.
export const LOCALE_NAMES: Record<Locale, string> = { vi: "Tiếng Việt", en: "English" };

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
