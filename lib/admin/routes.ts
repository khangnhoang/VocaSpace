import type { AdminCourseStatusFilter } from "@/lib/schemas/admin-course";

export const ADMIN_COURSES_PATH = "/admin/courses";

/**
 * URL của /admin/courses cho một bộ lọc. Giá trị mặc định (tab `pending`, không `q`, trang 1) bị lược khỏi query
 * để cùng một trạng thái luôn có đúng một URL, và để "Xóa tìm kiếm" / "Về trang 1" về URL gọn.
 */
export function buildAdminCoursesHref({
  status = "pending",
  q = "",
  page = 1,
}: {
  status?: AdminCourseStatusFilter;
  q?: string;
  page?: number;
} = {}): string {
  const params = new URLSearchParams();
  if (status !== "pending") params.set("status", status);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${ADMIN_COURSES_PATH}?${query}` : ADMIN_COURSES_PATH;
}
