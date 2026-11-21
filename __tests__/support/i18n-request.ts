import { getRequestConfig } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";

// Thay `i18n/request.ts` trong Vitest (alias `next-intl/config`): không có request thật nên ngôn ngữ do test chọn, mặc định
// tiếng Việt để mọi test hiện có giữ nguyên assertion.
let serverTestLocale: Locale = "vi";

export function setServerTestLocale(locale: Locale) {
  serverTestLocale = locale;
}

export default getRequestConfig(async () => ({
  locale: serverTestLocale,
  messages: MESSAGES[serverTestLocale],
  timeZone: "Asia/Ho_Chi_Minh",
}));
