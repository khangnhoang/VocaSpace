import { getCourseDashboardReadiness } from "@/app/actions/course-readiness";
import { getTeacherCourseInsights } from "@/app/actions/teacher-course-insights";
import { getTeacherCoursePortfolio } from "@/app/actions/teacher-course-portfolio";
import { getCourseOverviewPath, getCourseStructurePath } from "@/lib/course-authoring/routes";
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
        structureHref={getCourseStructurePath(resolvedParams.id)}
      />
    );
  }

  // Không await: readiness hiện ngay, số liệu và việc chờ duyệt stream vào sau qua Suspense (G5).
  const insights = getTeacherCourseInsights(readiness.data.course.id);
  const portfolio = getTeacherCoursePortfolio();

  return <CourseOverview readiness={readiness.data} insights={insights} portfolio={portfolio} />;
}
