export function resolveInitialLesson<
  TLesson extends { slug: string },
>(lessons: TLesson[], initialTopicSlug?: string): TLesson | undefined {
  if (initialTopicSlug) {
    const requestedLesson = lessons.find(
      (lesson) => lesson.slug === initialTopicSlug,
    );
    if (requestedLesson) return requestedLesson;
  }

  return lessons[0];
}
