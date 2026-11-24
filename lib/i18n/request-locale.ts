import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isEnglishUiEnabled, isTeacherAdminLockActive, LOCALE_COOKIE_NAME, type Locale } from "./config";
import { isLockedAreaPath, PATHNAME_HEADER } from "./locked-areas";
import { resolveLocale } from "./resolve-locale";

/** Request hiện tại có thuộc khu vực bị khóa tiếng Việt không; không đọc dữ liệu request khi khóa không hoạt động. */
export async function isTeacherAdminLockedRequest(): Promise<boolean> {
  if (!isTeacherAdminLockActive()) return false;
  return isLockedAreaPath((await headers()).get(PATHNAME_HEADER));
}

/**
 * Ngôn ngữ của request hiện tại. U1 G1: khi cờ tắt thì trả tiếng Việt mà không gọi `cookies()`/`headers()`, vì đọc dữ liệu
 * request sẽ biến route static thành dynamic và để cookie/header đổi được giao diện trước bước phát hành.
 * U9 G2: khóa chỉ ép được tiếng Việt, không bao giờ ghi hay xoá cookie ngôn ngữ.
 */
export async function getRequestLocale(): Promise<Locale> {
  if (!isEnglishUiEnabled()) return DEFAULT_LOCALE;

  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  // Thiếu header đường dẫn nghĩa là không khóa (H2); proxy luôn ghi đè header này trên mọi request nó xử lý.
  if (isTeacherAdminLockActive() && isLockedAreaPath(headerList.get(PATHNAME_HEADER))) {
    return DEFAULT_LOCALE;
  }
  return resolveLocale({
    enabled: true,
    cookieValue: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
}
