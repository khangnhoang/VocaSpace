import { publicCourseSlugSchema } from "@/lib/schemas/public-course";

export const PUBLIC_COURSE_CATALOG_PATH = "/courses";

export function getPublicCourseCatalogPath() {
  return PUBLIC_COURSE_CATALOG_PATH;
}

export function getPublicCourseDetailPath(rawCourseSlug: string) {
  const courseSlug = publicCourseSlugSchema.parse(rawCourseSlug);
  return `${PUBLIC_COURSE_CATALOG_PATH}/${encodeURIComponent(courseSlug)}`;
}

export function getPublicCoursePreviewPath(
  rawCourseSlug: string,
  rawTopicSlug: string,
) {
  const courseSlug = publicCourseSlugSchema.parse(rawCourseSlug);
  const topicSlug = publicCourseSlugSchema.parse(rawTopicSlug);
  return `${getPublicCourseDetailPath(courseSlug)}/preview/${encodeURIComponent(topicSlug)}`;
}

// FEAT6 AC11: "Tiếp tục thanh toán" mở thẳng mã QR của khoản đang chờ. Không parse slug để một slug lạ không làm hỏng cả danh sách.
export const RESUME_PAYMENT_PARAM = "thanh-toan";
export const RESUME_PAYMENT_VALUE = "tiep-tuc";

export function getResumePaymentPath(courseSlug: string) {
  return `${PUBLIC_COURSE_CATALOG_PATH}/${encodeURIComponent(courseSlug)}?${RESUME_PAYMENT_PARAM}=${RESUME_PAYMENT_VALUE}`;
}
