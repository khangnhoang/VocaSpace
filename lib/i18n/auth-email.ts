import { SITE_URL } from "@/lib/site";
import { getRequestLocale } from "./request-locale";

/**
 * Marker ngôn ngữ của email Auth (U6, quyết định 8): template xác minh và khôi phục so `.RedirectTo` với đúng chuỗi này để
 * chọn bản tiếng Anh. Phải trùng từng ký tự với `supabase/templates/*.html`, subject trong `supabase/config.toml` và allowlist
 * redirect (local và hosted). Link trong email vẫn dựng từ `.SiteURL`, nên URL này không bao giờ là đích điều hướng.
 */
export const AUTH_EMAIL_ENGLISH_MARKER = `${SITE_URL}/?lang=en`;

/**
 * URL redirect gửi kèm yêu cầu email Auth: marker khi giao diện đang tiếng Anh, `undefined` khi tiếng Việt. Cờ tắt hoặc khu
 * vực bị khóa thì `getRequestLocale` trả `vi`, nên lời gọi Auth giữ nguyên tham số như trước U6 (G1).
 */
export async function authEmailRedirect(): Promise<string | undefined> {
  return (await getRequestLocale()) === "en" ? AUTH_EMAIL_ENGLISH_MARKER : undefined;
}
