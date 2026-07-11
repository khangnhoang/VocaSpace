import { cache } from "react";
import { notFound } from "next/navigation";
import { getPublicCourseDetail } from "@/app/actions/public-course";
import { PublicCourseDetailView } from "./PublicCourseDetailView";
import { PublicCourseFeedback } from "./PublicCourseStates";

export const getCachedPublicCourseDetail = cache(getPublicCourseDetail);

type PublicCourseDetailRouteProps = {
  courseSlug: string;
};

export async function PublicCourseDetailRoute({
  courseSlug,
}: PublicCourseDetailRouteProps) {
  const result = await getCachedPublicCourseDetail(courseSlug);

  if (result.status === "not_found") notFound();

  if (result.status === "error") {
    return (
      <div className="container mx-auto px-4 py-12 md:py-16">
        <PublicCourseFeedback
          kind="error"
          title="Chưa thể tải thông tin khóa học"
          description="Dữ liệu khóa học tạm thời chưa sẵn sàng. Hãy thử tải lại trang sau ít phút."
        />
      </div>
    );
  }

  return <PublicCourseDetailView course={result.data} />;
}
