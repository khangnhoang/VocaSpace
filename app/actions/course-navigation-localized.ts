"use server";

import { getFirstTopicSlugByCourseSlug } from "@/app/actions/course-navigation";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ của request vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function getFirstTopicSlugByCourseSlugLocalized(courseSlug: string) {
  return withRequestLocale(await getFirstTopicSlugByCourseSlug(courseSlug));
}
