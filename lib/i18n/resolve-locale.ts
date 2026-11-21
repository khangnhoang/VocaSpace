import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

/**
 * Chọn ngôn ngữ được hỗ trợ có trọng số `q` cao nhất trong header `Accept-Language`; hòa thì giữ thứ tự trong header.
 * Mã vùng được bỏ qua (`en-US` tính là `en`), `q=0` nghĩa là từ chối. Không có ngôn ngữ nào được hỗ trợ thì trả `null`.
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  let best: { locale: Locale; quality: number } | null = null;
  for (const part of header.split(",")) {
    const [tag, ...params] = part.trim().split(";");
    const base = tag.trim().toLowerCase().split("-")[0];
    if (!(LOCALES as readonly string[]).includes(base)) continue;

    const qParam = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
    const quality = qParam ? Number(qParam.slice(2)) : 1;
    if (!Number.isFinite(quality) || quality <= 0 || quality > 1) continue;

    if (!best || quality > best.quality) best = { locale: base as Locale, quality };
  }
  return best?.locale ?? null;
}

type ResolveLocaleInput = {
  enabled: boolean;
  cookieValue: string | undefined;
  acceptLanguage: string | null | undefined;
};

/**
 * Thứ tự ưu tiên của U1: cờ tắt thì luôn tiếng Việt; cookie hợp lệ thắng header; cookie có giá trị lạ cũng về tiếng Việt
 * (không rơi xuống header) để cookie bị sửa tay không đổi được hành vi; không có cookie thì theo `Accept-Language`.
 */
export function resolveLocale({ enabled, cookieValue, acceptLanguage }: ResolveLocaleInput): Locale {
  if (!enabled) return DEFAULT_LOCALE;
  if (cookieValue !== undefined) {
    return (LOCALES as readonly string[]).includes(cookieValue) ? (cookieValue as Locale) : DEFAULT_LOCALE;
  }
  return parseAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
