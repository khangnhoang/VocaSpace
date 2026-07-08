// Nguồn chung cho các path course-authoring ổn định, không gắn với UI.
// Dashboard và các màn hình authoring cùng dùng helper này để không tự tạo URL lệch nhau.
export const TOPIC_BUILDER_TABS = [
  "flashcards",
  "exercises",
  "settings",
] as const;

export type TopicBuilderTab = (typeof TOPIC_BUILDER_TABS)[number];

export const TEACHER_COURSE_AUTHORING_BASE_PATH = "/teacher/courses";

const TEACHER_COURSE_LIST_ROUTE_FILE_REVALIDATION_PATH =
  "/(teacher)/teacher/courses";

export function getTeacherCourseListPath() {
  return TEACHER_COURSE_AUTHORING_BASE_PATH;
}

export function getTeacherCourseCreatePath() {
  return `${TEACHER_COURSE_AUTHORING_BASE_PATH}/new`;
}

export function getCourseOverviewPath(courseId: string) {
  return `${TEACHER_COURSE_AUTHORING_BASE_PATH}/${courseId}`;
}

export function getCourseStructurePath(courseId: string) {
  return `${getCourseOverviewPath(courseId)}/structure`;
}

export function getTopicBuilderPath(
  courseId: string,
  topicId: string,
  tab?: TopicBuilderTab,
) {
  return `${getCourseOverviewPath(courseId)}/topics/${topicId}${tab ? `?tab=${tab}` : ""}`;
}

export function getTeacherCourseListRouteFileRevalidationPath() {
  return TEACHER_COURSE_LIST_ROUTE_FILE_REVALIDATION_PATH;
}

export function getTopicBuilderTab(rawTab: string | null): TopicBuilderTab {
  return TOPIC_BUILDER_TABS.includes(rawTab as TopicBuilderTab)
    ? (rawTab as TopicBuilderTab)
    : "exercises";
}
