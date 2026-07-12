import type { Metadata } from "next";
import {
  getCachedPublicCourseDetail,
  PublicCourseDetailRoute,
} from "../_components/PublicCourseDetailRoute";
import { getPublicCourseDetailPath } from "@/lib/public-courses/routes";

type CourseDetailPageProps = {
  params: Promise<{ "course-slug": string }>;
};

export async function generateMetadata({
  params,
}: CourseDetailPageProps): Promise<Metadata> {
  const courseSlug = (await params)["course-slug"];
  const result = await getCachedPublicCourseDetail(courseSlug);

  if (result.status !== "success") {
    return {
      title: "Khóa học | VocaSpace",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${result.data.title} | VocaSpace`,
    description:
      result.data.description ||
      `Khám phá khóa học ${result.data.title} trên VocaSpace.`,
    alternates: {
      canonical: getPublicCourseDetailPath(result.data.slug),
    },
  };
}

export default async function PublicCourseDetailPage({
  params,
}: CourseDetailPageProps) {
  const courseSlug = (await params)["course-slug"];
  return PublicCourseDetailRoute({ courseSlug });
}
