import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicCourseCatalogResult } from "@/app/actions/public-course";
import { Button } from "@/components/ui/button";
import { selectHighlightedCourses } from "@/lib/public-courses/highlighted-course-selector";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import { cn } from "@/lib/utils";
import { PublicCourseGrid } from "../courses/_components/PublicCourseGrid";
import { PublicCourseFeedback } from "../courses/_components/PublicCourseStates";
import { getHomeCatalog } from "./home/home-data";
import { HOME_CONTAINER, HOME_EYEBROW, HOME_SECTION_TITLE } from "./home/home-layout";

type PublicCourseHighlightsViewProps = {
  result: PublicCourseCatalogResult;
};

export function PublicCourseHighlightsView({
  result,
}: PublicCourseHighlightsViewProps) {
  const catalogPath = getPublicCourseCatalogPath();

  return (
    <section
      aria-labelledby="public-course-highlights-title"
      className={cn(HOME_CONTAINER, "py-12 sm:py-16")}
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={HOME_EYEBROW}>Khóa học</p>
          <h2
            id="public-course-highlights-title"
            className={cn("mt-2", HOME_SECTION_TITLE)}
          >
            Khóa học nổi bật
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-[22px] text-slate-600">
            Những lựa chọn được học viên quan tâm nhiều, cân bằng giữa khóa học miễn
            phí và trả phí.
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit shrink-0">
          <Link href={catalogPath}>
            Xem tất cả khóa học
            <ArrowRight aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </div>

      {result.status === "error" ? (
        <PublicCourseFeedback
          kind="error"
          title="Chưa thể tải khóa học nổi bật"
          description="Danh sách khóa học tạm thời chưa sẵn sàng. Bạn có thể thử lại hoặc mở thư viện khóa học sau."
        />
      ) : result.data.length === 0 ? (
        <PublicCourseFeedback
          kind="empty"
          title="Khóa học mới đang được chuẩn bị"
          description="Hiện chưa có khóa học công khai. Hãy quay lại sau để khám phá những lộ trình đầu tiên."
          actionHref={catalogPath}
          actionLabel="Mở thư viện khóa học"
        />
      ) : (
        <PublicCourseGrid
          courses={selectHighlightedCourses(result.data)}
          headingLevel="h3"
          prioritizeFirstImage
        />
      )}
    </section>
  );
}

export default async function PublicCourseHighlights() {
  const result = await getHomeCatalog();
  return <PublicCourseHighlightsView result={result} />;
}
