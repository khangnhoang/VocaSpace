import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPublicCourseCatalogListing } from "@/app/actions/public-course";
import { Button } from "@/components/ui/button";
import {
  filterAndSortCatalog,
  paginateCatalog,
  parseCatalogQuery,
  serializeCatalogQuery,
  toCatalogCourses,
} from "@/lib/public-courses/catalog-query";
import { CatalogExplorer } from "./_components/catalog/CatalogExplorer";
import { CatalogHero } from "./_components/catalog/CatalogHero";
import { CatalogResultsSkeleton } from "./_components/catalog/CatalogSkeleton";
import { CatalogStatePanel } from "./_components/catalog/CatalogStatePanel";
import { PublicCourseRetryButton } from "./_components/PublicCourseRetryButton";

export const metadata: Metadata = {
  title: "Khóa học | VocaSpace",
  description: "Khám phá toàn bộ khóa học công khai trên VocaSpace.",
};

const CONTAINER = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";

type CoursesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function rawSearch(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) =>
    (Array.isArray(value) ? value : value === undefined ? [] : [value]).forEach((item) => search.append(key, item)),
  );
  return search.toString();
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const params = await searchParams;
  const result = await getPublicCourseCatalogListing();

  if (result.status === "error") {
    return (
      <div className="pb-16">
        <CatalogHero facts={null} />
        <div className={CONTAINER}>
          <CatalogStatePanel
            art="error"
            role="alert"
            eyebrow="Lỗi kết nối"
            title="Chưa thể tải danh sách khóa học"
            description="Kết nối dữ liệu đang gián đoạn. Thử tải lại; bộ lọc bạn đã chọn vẫn được giữ nguyên."
          >
            <PublicCourseRetryButton className="min-h-11 px-5" />
          </CatalogStatePanel>
        </div>
      </div>
    );
  }

  const { courses: listing, enrolledCourseIds } = result.data;

  if (listing.length === 0) {
    return (
      <div className="pb-16">
        <CatalogHero facts={null} />
        <div className={CONTAINER}>
          <CatalogStatePanel
            art="deck"
            role="status"
            eyebrow="Thư viện đang được soạn"
            title="Chưa có khóa học nào được công khai"
            description="Các giáo viên đang hoàn thiện những khóa học đầu tiên. Trong lúc chờ, bạn có thể thử cách VocaSpace giúp nhớ từ lâu hơn bằng bộ thẻ mẫu trên trang chủ."
          >
            <Button asChild size="lg">
              <Link href="/#hero-practice-title">Thử bộ thẻ mẫu</Link>
            </Button>
            <Button asChild variant="link" size="lg" className="px-1">
              <Link href="/">Về trang chủ</Link>
            </Button>
          </CatalogStatePanel>
        </div>
      </div>
    );
  }

  // "Mới" và thứ tự A–Z tính một lần ở server để server và trình duyệt render giống nhau khi hydrate.
  const courses = toCatalogCourses(listing, new Date());

  // U2 AC5: tham số sai hoặc trang vượt quá chuyển về URL chuẩn ngay ở server (không phụ thuộc lúc router hydrate).
  const query = parseCatalogQuery(params);
  const { page } = paginateCatalog(filterAndSortCatalog(courses, query), query.page);
  const canonicalSearch = serializeCatalogQuery({ ...query, page });
  if (rawSearch(params) !== canonicalSearch) {
    redirect(canonicalSearch ? `/courses?${canonicalSearch}` : "/courses");
  }
  const facts = {
    total: courses.length,
    free: courses.filter((course) => course.price === 0).length,
    preview: courses.filter((course) => course.preview_topic_slug).length,
  };

  return (
    <div className="pb-16">
      <CatalogHero facts={facts} />
      <Suspense fallback={<CatalogResultsSkeleton />}>
        <CatalogExplorer courses={courses} enrolledCourseIds={enrolledCourseIds} />
      </Suspense>
    </div>
  );
}
