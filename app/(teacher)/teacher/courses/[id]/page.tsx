import { getCourseDashboardReadiness } from "@/app/actions/course-readiness";
import { getCourseOverviewPath } from "@/lib/course-authoring/routes";
import CourseOverview from "./_components/CourseOverview";
import CourseOverviewError from "./_components/CourseOverviewError";

export default async function CourseOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const readiness = await getCourseDashboardReadiness(resolvedParams.id);
  const retryHref = getCourseOverviewPath(resolvedParams.id);

  if (!readiness.success) {
    return (
      <CourseOverviewError
        code={readiness.error.code}
        message={readiness.error.message}
        retryHref={retryHref}
      />
    );
  }

  return <CourseOverview readiness={readiness.data} />;
}
