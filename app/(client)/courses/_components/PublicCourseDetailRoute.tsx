import { cache } from "react";
import { notFound } from "next/navigation";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import { resumePendingCheckout } from "@/app/actions/payment";
import { getPublicCourseDetail } from "@/app/actions/public-course";
import { PublicCourseDetailView } from "./PublicCourseDetailView";
import { PublicCourseFeedback } from "./PublicCourseStates";

export const getCachedPublicCourseDetail = cache(getPublicCourseDetail);

type PublicCourseDetailRouteProps = {
  courseSlug: string;
  // FEAT6 AC11: link "Tiếp tục thanh toán" (?thanh-toan=tiep-tuc); chỉ có nghĩa khi trang khóa học thật sự render.
  resumePayment?: boolean;
};

export async function PublicCourseDetailRoute({
  courseSlug,
  resumePayment = false,
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

  // FEAT6 G8: đọc khoản pending ở đây, sau nhánh notFound/error, nên hai màn hình đó không bao giờ gọi mở lại; hành động chỉ đọc, không tạo thanh toán.
  const resumeCheckout = resumePayment
    ? await resumePendingCheckout({ courseId: result.data.id })
    : undefined;

  return (
    <PublicCourseDetailView
      course={result.data}
      learningSummary={learningSummary}
      resumeCheckout={resumeCheckout}
    />
  );
}
