import type { Metadata } from "next";
import { getPublicCourseCatalog } from "@/app/actions/public-course";
import { PublicCourseCatalogView } from "./_components/PublicCourseCatalogView";

export const metadata: Metadata = {
  title: "Khóa học | VocaSpace",
  description: "Khám phá toàn bộ khóa học công khai trên VocaSpace.",
};

export default async function CoursesPage() {
  const result = await getPublicCourseCatalog();

  return (
    <div className="container mx-auto px-4 py-10 md:py-14">
      <header className="mb-9 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">
          Thư viện VocaSpace
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
          Khám phá khóa học phù hợp với bạn
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 md:text-base">
          Học theo nhịp độ riêng với lộ trình rõ ràng, nội dung thực tế và phương pháp
          ôn tập giúp ghi nhớ lâu hơn.
        </p>
      </header>

      <PublicCourseCatalogView result={result} />
    </div>
  );
}
