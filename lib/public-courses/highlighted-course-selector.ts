import type { PublicCourseCatalogItem } from "@/lib/schemas/public-course";

export function comparePublicCourseHighlights(
  left: PublicCourseCatalogItem,
  right: PublicCourseCatalogItem,
) {
  return (
    right.enrollment_count - left.enrollment_count ||
    Date.parse(right.created_at) - Date.parse(left.created_at) ||
    left.id.localeCompare(right.id)
  );
}

export function selectHighlightedCourses(
  courses: readonly PublicCourseCatalogItem[],
) {
  const paid = courses
    .filter((course) => course.price > 0)
    .sort(comparePublicCourseHighlights);
  const free = courses
    .filter((course) => course.price === 0)
    .sort(comparePublicCourseHighlights);
  const selected = [...paid.slice(0, 2), ...free.slice(0, 2)];

  if (selected.length < 4) {
    const selectedIds = new Set(selected.map((course) => course.id));
    const remaining = courses
      .filter((course) => !selectedIds.has(course.id))
      .sort(comparePublicCourseHighlights);
    selected.push(...remaining.slice(0, 4 - selected.length));
  }

  return selected;
}
