import { cache } from "react";
import { notFound } from "next/navigation";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
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

  // FEAT3 G5: học viên đã ghi danh mới đọc chuỗi ngày học, và đọc riêng ngoài payload công khai; khách và người chưa ghi danh không tốn truy vấn nào.
  const learningSummary = result.data.is_enrolled
    ? await getCourseLearningSummary(result.data.id)
    : undefined;

  return <PublicCourseDetailView course={result.data} learningSummary={learningSummary} />;
}
