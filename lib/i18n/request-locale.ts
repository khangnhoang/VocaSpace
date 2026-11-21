import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isEnglishUiEnabled, LOCALE_COOKIE_NAME, type Locale } from "./config";
import { resolveLocale } from "./resolve-locale";

/**
 * Ngôn ngữ của request hiện tại. U1 G1: khi cờ tắt thì trả tiếng Việt mà không gọi `cookies()`/`headers()`, vì đọc dữ liệu
 * request sẽ biến route static thành dynamic và để cookie/header đổi được giao diện trước bước phát hành.
 */
export async function getRequestLocale(): Promise<Locale> {
  if (!isEnglishUiEnabled()) return DEFAULT_LOCALE;

  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    enabled: true,
    cookieValue: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
}
