export function resolveLessonNeighbors<TLesson extends { slug: string }>(
  lessons: TLesson[],
  currentTopicSlug: string,
) {
  const currentIndex = lessons.findIndex(
    (lesson) => lesson.slug === currentTopicSlug,
  );

  if (currentIndex < 0) {
    return { previous: undefined, next: undefined };
  }

  return {
    previous: lessons[currentIndex - 1],
    next: lessons[currentIndex + 1],
  };
}
