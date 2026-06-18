// SSOT không gắn UI cho các path course-authoring ổn định.
// Các readiness issue và structure workspace cùng dùng helper này; PR6 repair
// state hoặc deep-link context chưa thuộc trách nhiệm của file này.
export const TOPIC_BUILDER_TABS = [
  "flashcards",
  "exercises",
  "settings",
] as const;

export type TopicBuilderTab = (typeof TOPIC_BUILDER_TABS)[number];
type TopicBuilderPathTab = Extract<TopicBuilderTab, "settings">;

export function getCourseOverviewPath(courseId: string) {
  return `/courses/${courseId}`;
}

export function getCourseStructurePath(courseId: string) {
  return `/courses/${courseId}/structure`;
}

export function getTopicBuilderPath(
  courseId: string,
  topicId: string,
  tab?: TopicBuilderPathTab,
) {
  return `/courses/${courseId}/topics/${topicId}${tab ? `?tab=${tab}` : ""}`;
}

export function getTopicBuilderTab(rawTab: string | null): TopicBuilderTab {
  return TOPIC_BUILDER_TABS.includes(rawTab as TopicBuilderTab)
    ? (rawTab as TopicBuilderTab)
    : "exercises";
}
