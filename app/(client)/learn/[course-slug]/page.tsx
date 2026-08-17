import { notFound, redirect } from "next/navigation";
import { getPublicCourseDetailPath } from "@/lib/public-courses/routes";
import { publicCourseSlugSchema } from "@/lib/schemas/public-course";

type PageProps = {
  params: Promise<{ "course-slug": string }>;
};

export default async function LegacyPublicCourseDetailPage({ params }: PageProps) {
  const rawCourseSlug = (await params)["course-slug"];
  const courseSlugResult = publicCourseSlugSchema.safeParse(rawCourseSlug);

  if (!courseSlugResult.success) {
    notFound();
  }

  redirect(getPublicCourseDetailPath(courseSlugResult.data));
}
