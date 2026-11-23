import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { selectHighlightedCourses } from "@/lib/public-courses/highlighted-course-selector";
import { getHomeCatalog } from "./home-data";

export function HeroFact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Check aria-hidden="true" className="size-4 shrink-0 text-growth" />
      {children}
    </li>
  );
}

// Chỉ khẳng định "có khóa miễn phí" khi danh sách nổi bật thật sự có khóa giá 0; lỗi hoặc rỗng thì im lặng.
export default async function HeroFreeCourseFact() {
  const result = await getHomeCatalog();
  if (result.status !== "success") return null;
  const hasFreeCourse = selectHighlightedCourses(result.data).some((course) => course.price === 0);
  if (!hasFreeCourse) return null;
  const t = await getTranslations("home");
  return <HeroFact>{t("hero.factFree")}</HeroFact>;
}
