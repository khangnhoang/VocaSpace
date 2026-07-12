import { publicCourseSlugSchema } from "@/lib/schemas/public-course";

export const PUBLIC_COURSE_CATALOG_PATH = "/courses";

export function getPublicCourseCatalogPath() {
  return PUBLIC_COURSE_CATALOG_PATH;
}

export function getPublicCourseDetailPath(rawCourseSlug: string) {
  const courseSlug = publicCourseSlugSchema.parse(rawCourseSlug);
  return `${PUBLIC_COURSE_CATALOG_PATH}/${encodeURIComponent(courseSlug)}`;
}
