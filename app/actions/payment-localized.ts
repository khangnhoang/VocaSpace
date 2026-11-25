"use server";

import { getLocale } from "next-intl/server";
import { cancelCheckoutSession, createCheckoutSession } from "@/app/actions/payment";
import type { Locale } from "@/lib/i18n/config";
import { collectMessageRefs, type MessageRef } from "@/lib/i18n/message-ref";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ và khóa catalog của thông báo vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function cancelCheckoutSessionLocalized(paymentId: string) {
  return withRequestLocale(() => cancelCheckoutSession(paymentId));
}

/**
 * English localization U5 H5: như `withRequestLocaleFields` (khóa của `error`/`message` khi kết quả trả chuỗi đó), thêm
 * `accountNumberRef` là khóa của câu thay cho số tài khoản nằm trong `data`, chỉ khi kết quả là phiên trả phí và action đã chọn
 * câu đó (PayOS không trả số tài khoản). Số tài khoản thật thì không có khóa và client hiện đúng giá trị trả về.
 */
export async function createCheckoutSessionLocalized(rawInput: unknown) {
  const { value: result, refs } = await collectMessageRefs(() => createCheckoutSession(rawInput));
  const locale = (await getLocale()) as Locale;
  const messageRefs: Record<string, MessageRef> = {};
  for (const field of ["error", "message"]) {
    const ref = refs[field];
    if (ref && typeof (result as Record<string, unknown>)[field] === "string") messageRefs[field] = ref;
  }
  const accountNumberRef = "type" in result && result.type === "paid" ? (refs.accountNumber ?? null) : null;
  return { result, locale, messageRefs, accountNumberRef };
}
