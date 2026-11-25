import { getRequestConfig } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/request-locale";

// Thay `i18n/request.ts` trong Vitest (alias `next-intl/config`): không có request thật nên ngôn ngữ do test chọn, mặc định
// tiếng Việt để mọi test hiện có giữ nguyên assertion.
let serverTestLocale: Locale = "vi";

// Bật thì ngôn ngữ đi qua bộ phân giải thật (`getRequestLocale`: cờ, cookie, Accept-Language), cho test cần chứng minh hành vi
// khi cờ tắt; test bật nó phải tự mock `next/headers`.
let useRealResolver = false;

export function setServerTestLocale(locale: Locale) {
  serverTestLocale = locale;
}

export function useRealRequestLocale(enabled: boolean) {
  useRealResolver = enabled;
}

export default getRequestConfig(async () => {
  const locale = useRealResolver ? await getRequestLocale() : serverTestLocale;
  return { locale, messages: MESSAGES[locale], timeZone: "Asia/Ho_Chi_Minh" };
});
