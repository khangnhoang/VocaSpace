import { notFound, redirect } from "next/navigation";
import { getEnrolledCourseOverview } from "@/app/actions/enrolled-course-overview";
import EnrolledCourseOverview from "./_components/EnrolledCourseOverview";
import EnrolledCourseOverviewFeedback from "./_components/EnrolledCourseOverviewFeedback";

type PageProps = {
  params: Promise<{ "course-slug": string }>;
};

export default async function EnrolledCourseOverviewPage({ params }: PageProps) {
  const rawCourseSlug = (await params)["course-slug"];
  const result = await getEnrolledCourseOverview(rawCourseSlug);

  if (result.status === "auth_required") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status === "success") {
    return <EnrolledCourseOverview data={result.data} />;
  }

  return <EnrolledCourseOverviewFeedback result={result} />;
}
