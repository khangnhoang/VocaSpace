"use server";

import { submitQuestionAnswer } from "@/app/actions/progress";
import { withRequestLocaleFields } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ của server và khóa catalog từng trường thông báo (`error`, `explanation`, `progressError`) vào kết quả; lý do và hợp
// đồng ở `lib/i18n/request-locale-result.ts` (`withRequestLocaleFields`). Lời giải thích do tác giả viết không có khóa nên không có
// tham chiếu. Kết quả gốc và quyền truy cập do action gốc tự kiểm.
export async function submitQuestionAnswerLocalized(questionId: string, selectedOptionId: string) {
  return withRequestLocaleFields(() => submitQuestionAnswer(questionId, selectedOptionId));
}
