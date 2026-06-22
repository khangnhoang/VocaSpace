// Nguồn chung cho các path course-authoring ổn định, không gắn với UI.
// Dashboard và các màn hình authoring cùng dùng helper này để không tự tạo URL lệch nhau.
export const TOPIC_BUILDER_TABS = [
  "flashcards",
  "exercises",
  "settings",
] as const;

export type TopicBuilderTab = (typeof TOPIC_BUILDER_TABS)[number];

export function getCourseOverviewPath(courseId: string) {
  return `/courses/${courseId}`;
}

export function getCourseStructurePath(courseId: string) {
  return `/courses/${courseId}/structure`;
}

export function getTopicBuilderPath(
  courseId: string,
  topicId: string,
  tab?: TopicBuilderTab,
) {
  return `/courses/${courseId}/topics/${topicId}${tab ? `?tab=${tab}` : ""}`;
}

export function getTopicBuilderTab(rawTab: string | null): TopicBuilderTab {
  return TOPIC_BUILDER_TABS.includes(rawTab as TopicBuilderTab)
    ? (rawTab as TopicBuilderTab)
    : "exercises";
}
