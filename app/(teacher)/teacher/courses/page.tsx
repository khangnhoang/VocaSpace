import { getTeacherCoursePortfolio } from "@/app/actions/teacher-course-portfolio";
import TeacherCoursePortfolio from "./_components/TeacherCoursePortfolio";

export default async function TeacherCoursesPage() {
  const result = await getTeacherCoursePortfolio();
  return <TeacherCoursePortfolio result={result} />;
}
