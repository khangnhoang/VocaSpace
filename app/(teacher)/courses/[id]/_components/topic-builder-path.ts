export function getTopicBuilderPath(
  courseId: string,
  topicId: string,
  tab?: "settings",
) {
  return `/courses/${courseId}/topics/${topicId}${tab ? `?tab=${tab}` : ""}`;
}
