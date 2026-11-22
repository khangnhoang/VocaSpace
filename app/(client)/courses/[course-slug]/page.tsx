import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

  const t = await getTranslations("courses");

  if (result.status !== "success") {
    return {
      title: t("meta.detailFallbackTitle"),
      robots: { index: false, follow: false },
    };
  }

  return {
    title: t("meta.detailTitle", { title: result.data.title }),
    description:
      result.data.description ||
      t("meta.detailDescription", { title: result.data.title }),
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
