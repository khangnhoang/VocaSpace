"use server";

import { validateDiscountPreview } from "@/app/actions/discount";
import { withRequestLocaleFields } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ và khóa catalog của `error`/`message` vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function validateDiscountPreviewLocalized(rawInput: unknown) {
  return withRequestLocaleFields(() => validateDiscountPreview(rawInput));
}
