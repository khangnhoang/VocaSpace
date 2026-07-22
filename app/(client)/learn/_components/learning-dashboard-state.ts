import type {
  LearnDashboardCourse,
  LearnCourseStatus,
} from "@/lib/schemas/learn-dashboard";

export const MOBILE_COURSES_PER_PAGE = 3;
export const WIDE_COURSES_PER_PAGE = 4;

export type RemainingCourseFilter = "all" | "not-started" | "completed";

export function getInProgressCourses(courses: LearnDashboardCourse[]) {
  return courses.filter((course) => course.status === "in-progress");
}

export function getRemainingCourses(courses: LearnDashboardCourse[]) {
  return courses.filter((course) => course.status !== "in-progress");
}

export function filterRemainingCourses(
  courses: LearnDashboardCourse[],
  filter: RemainingCourseFilter,
) {
  if (filter === "all") return courses;
  return courses.filter((course) => course.status === filter);
}

export function paginateCourses(
  courses: LearnDashboardCourse[],
  page: number,
  pageSize: number,
) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return courses.slice(start, start + pageSize);
}

export function getCourseStatusCount(
  courses: LearnDashboardCourse[],
  status: LearnCourseStatus,
) {
  return courses.filter((course) => course.status === status).length;
}

export function getPaymentPreviewLimit(isDesktop: boolean) {
  return isDesktop ? 3 : 1;
}
