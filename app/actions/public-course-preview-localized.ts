"use server";

import { answerPublicCoursePreviewQuestion } from "@/app/actions/public-course-preview";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ của request vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function answerPublicCoursePreviewQuestionLocalized(rawInput: unknown) {
  return withRequestLocale(await answerPublicCoursePreviewQuestion(rawInput));
}
