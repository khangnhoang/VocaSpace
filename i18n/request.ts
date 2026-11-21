import { getRequestConfig } from "next-intl/server";
import { MESSAGES } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/request-locale";

// Cấu hình next-intl không dùng i18n routing (quyết định 2: URL giữ nguyên). Không đọc `requestLocale` vì getter đó gọi
// `headers()` và làm mọi route thành dynamic kể cả khi cờ tắt.
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return {
    locale,
    messages: MESSAGES[locale],
    // Cố định múi giờ để server và trình duyệt định dạng ngày giống nhau; người học hiện ở Việt Nam.
    timeZone: "Asia/Ho_Chi_Minh",
  };
});
