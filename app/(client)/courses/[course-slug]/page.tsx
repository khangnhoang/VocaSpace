import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCachedPublicCourseDetail,
  PublicCourseDetailRoute,
} from "../_components/PublicCourseDetailRoute";
import {
  getPublicCourseDetailPath,
  RESUME_PAYMENT_PARAM,
  RESUME_PAYMENT_VALUE,
} from "@/lib/public-courses/routes";

type CourseDetailPageProps = {
  params: Promise<{ "course-slug": string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: CourseDetailPageProps): Promise<Metadata> {
  const courseSlug = (await params)["course-slug"];
  const result = await getCachedPublicCourseDetail(courseSlug);

  // Gọi notFound() ở đây để title lấy từ app/not-found.tsx thay vì title dự phòng bên dưới (F1 AC5).
  if (result.status === "not_found") notFound();

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
  searchParams,
}: CourseDetailPageProps) {
  const courseSlug = (await params)["course-slug"];
  // FEAT6 AC11: chỉ đúng giá trị `tiep-tuc` mới bật đường mở lại mã QR; giá trị khác bị bỏ qua như không có tham số.
  const resumeParam = (await searchParams)?.[RESUME_PAYMENT_PARAM];
  const resumePayment =
    (Array.isArray(resumeParam) ? resumeParam[0] : resumeParam) === RESUME_PAYMENT_VALUE;
  return PublicCourseDetailRoute({ courseSlug, resumePayment });
}
