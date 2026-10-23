import { getCourseDashboardReadiness } from "@/app/actions/course-readiness";
import { getTeacherCourseInsights } from "@/app/actions/teacher-course-insights";
import { getTeacherCoursePortfolio } from "@/app/actions/teacher-course-portfolio";
import { selectCourseAttention } from "@/lib/course-authoring/portfolio";
import { getCourseOverviewPath, getCourseStructurePath } from "@/lib/course-authoring/routes";
import CourseOverview from "./_components/CourseOverview";
import CourseOverviewError from "./_components/CourseOverviewError";
import EmptyCourseDashboard from "./_components/EmptyCourseDashboard";

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

  const courseId = readiness.data.course.id;
  // Khóa chưa có chương hiển thị EmptyCourseDashboard, không dùng hai read phụ.
  if (readiness.data.counts.chapters === 0) {
    return <EmptyCourseDashboard readiness={readiness.data} />;
  }

  // Không await: readiness hiện ngay, số liệu và việc chờ duyệt stream vào sau qua Suspense (G5).
  // Portfolio được lọc trên server trước khi tới client để không gửi việc của khóa học khác xuống trình duyệt (G6).
  const insights = getTeacherCourseInsights(courseId);
  const attention = getTeacherCoursePortfolio().then((result) => selectCourseAttention(result, courseId));

  return <CourseOverview readiness={readiness.data} insights={insights} attention={attention} />;
}
