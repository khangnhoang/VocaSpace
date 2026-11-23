"use server";

import { getFirstTopicSlugByCourseSlug } from "@/app/actions/course-navigation";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// Namespace chứa chuỗi mà action này trả về; client tra lại khóa trong đó (xem `lib/i18n/message-key.ts`).
const NAMESPACES = ["courses"] as const;

// Kèm ngôn ngữ của request vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function getFirstTopicSlugByCourseSlugLocalized(courseSlug: string) {
  return withRequestLocale(await getFirstTopicSlugByCourseSlug(courseSlug), NAMESPACES);
}
