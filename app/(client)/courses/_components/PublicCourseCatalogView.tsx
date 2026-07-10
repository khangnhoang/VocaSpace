import type { PublicCourseCatalogResult } from "@/app/actions/public-course";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import { PublicCourseGrid } from "./PublicCourseGrid";
import { PublicCourseFeedback } from "./PublicCourseStates";

type PublicCourseCatalogViewProps = {
  result: PublicCourseCatalogResult;
};

export function PublicCourseCatalogView({
  result,
}: PublicCourseCatalogViewProps) {
  if (result.status === "error") {
    return (
      <PublicCourseFeedback
        kind="error"
        title="Chưa thể tải danh sách khóa học"
        description="Kết nối dữ liệu đang gián đoạn. Bạn có thể thử tải lại mà không mất thông tin nào."
        actionHref={getPublicCourseCatalogPath()}
        actionLabel="Thử tải lại"
      />
    );
  }

  if (result.data.length === 0) {
    return (
      <PublicCourseFeedback
        kind="empty"
        title="Chưa có khóa học công khai"
        description="Các khóa học mới đang được chuẩn bị. Hãy quay lại trang chủ để khám phá những nội dung khác của VocaSpace."
        actionHref="/"
        actionLabel="Về trang chủ"
      />
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-gray-500">
        {result.data.length} khóa học đang sẵn sàng
      </p>
      <PublicCourseGrid courses={result.data} prioritizeFirstImage />
    </>
  );
}
