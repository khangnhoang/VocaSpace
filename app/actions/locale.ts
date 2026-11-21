"use server";

import { cookies, headers } from "next/headers";
import { isHttpsRequest } from "@/lib/auth/return-path";
import { isEnglishUiEnabled, LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME } from "@/lib/i18n/config";
import { localeSchema } from "@/lib/schemas/locale";

/**
 * Ghi ngôn ngữ giao diện người dùng chọn vào cookie (English localization U1, AC3). Cookie chỉ chọn chữ và định dạng nên
 * không cần đăng nhập. Khi cờ tắt thì không ghi gì, để không có cookie ngôn ngữ nào trước bước phát hành.
 */
export async function setLocale(input: unknown): Promise<{ ok: boolean }> {
  const parsed = localeSchema.safeParse(input);
  if (!parsed.success || !isEnglishUiEnabled()) return { ok: false };

  const secure = isHttpsRequest(await headers());
  (await cookies()).set(LOCALE_COOKIE_NAME, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
  });
  return { ok: true };
}
