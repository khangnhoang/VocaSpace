"use server";

import { getDeckReviewCards } from "@/app/actions/profile";
import { withRequestLocaleFields } from "@/lib/i18n/request-locale-result";

// Tách khỏi `review-localized.ts` để hàng đợi lưu đánh giá không kéo `profile.ts` (và `server-only`) vào bundle của nó. Kèm ngôn ngữ của
// server và khóa catalog của `error`; hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function getDeckReviewCardsLocalized() {
  return withRequestLocaleFields(() => getDeckReviewCards());
}
