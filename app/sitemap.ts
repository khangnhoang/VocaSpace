import type { MetadataRoute } from "next";
import { getPublicCourseCatalog } from "@/app/actions/public-course";
import { getPublicCourseDetailPath } from "@/lib/public-courses/routes";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getPublicCourseCatalog();
  if (catalog.status !== "success") {
    throw new Error("Unable to generate the public course sitemap");
  }

  return [
    ...["/", "/courses", "/privacy", "/terms"].map((path) => ({
      url: new URL(path, SITE_URL).href,
    })),
    ...catalog.data.map((course) => ({
      url: new URL(getPublicCourseDetailPath(course.slug), SITE_URL).href,
    })),
  ];
}
