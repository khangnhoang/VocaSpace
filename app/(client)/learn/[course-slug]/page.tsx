import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getEnrolledCourseOverview } from "@/app/actions/enrolled-course-overview";
import { SIGN_IN_REQUIRED_LOGIN_PATH } from "@/lib/auth/sign-in-reason";
import EnrolledCourseOverview from "./_components/EnrolledCourseOverview";
import EnrolledCourseOverviewFeedback from "./_components/EnrolledCourseOverviewFeedback";

type PageProps = {
  params: Promise<{ "course-slug": string }>;
};

// Metadata và page dùng chung một lần đọc trong cùng request.
const getCachedEnrolledCourseOverview = cache(getEnrolledCourseOverview);

// Chỉ xử lý `not_found` để title lấy từ app/not-found.tsx (F1 AC5); mọi trường hợp khác giữ title của layout learn.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await getCachedEnrolledCourseOverview((await params)["course-slug"]);
  if (result.status === "not_found") notFound();
  return {};
}

export default async function EnrolledCourseOverviewPage({ params }: PageProps) {
  const rawCourseSlug = (await params)["course-slug"];
  const result = await getCachedEnrolledCourseOverview(rawCourseSlug);

  if (result.status === "auth_required") redirect(SIGN_IN_REQUIRED_LOGIN_PATH);
  if (result.status === "not_found") notFound();
  if (result.status === "success") {
    return <EnrolledCourseOverview data={result.data} />;
  }

  return <EnrolledCourseOverviewFeedback result={result} />;
}
