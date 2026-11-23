"use server";

import type { Rating } from "ts-fsrs";
import { submitCardReview } from "@/app/actions/review";
import { withRequestLocaleFields } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ của server và khóa catalog từng trường thông báo (`error`, `progressError`) vào kết quả; lý do và hợp đồng ở
// `lib/i18n/request-locale-result.ts` (`withRequestLocaleFields`). Kết quả gốc và quyền truy cập do action gốc tự kiểm.
export async function submitCardReviewLocalized(cardId: string, rating: Rating) {
  return withRequestLocaleFields(() => submitCardReview(cardId, rating));
}
