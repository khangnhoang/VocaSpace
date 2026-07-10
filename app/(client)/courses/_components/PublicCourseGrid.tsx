import type { PublicCourseCatalogItem } from "@/lib/schemas/public-course";
import { PublicCourseCard } from "./PublicCourseCard";

type PublicCourseGridProps = {
  courses: readonly PublicCourseCatalogItem[];
  prioritizeFirstImage?: boolean;
};

export function PublicCourseGrid({
  courses,
  prioritizeFirstImage = false,
}: PublicCourseGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {courses.map((course, index) => (
        <PublicCourseCard
          key={course.id}
          course={course}
          prioritizeImage={prioritizeFirstImage && index === 0}
        />
      ))}
    </div>
  );
}
