export function getCourseStructurePath(courseId: string) {
  return `/courses/${courseId}/structure`;
}

export function getTopicBuilderPath(
  courseId: string,
  topicId: string,
  tab?: "settings",
) {
  return `/courses/${courseId}/topics/${topicId}${tab ? `?tab=${tab}` : ""}`;
}
