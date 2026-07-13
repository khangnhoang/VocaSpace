import type {
  Chapter,
  Course,
  ItemStatus,
  Topic,
} from "@/types/database";
import type {
  LearnDashboardCourse,
  PendingPaymentSummary,
  ReviewSummary,
} from "@/lib/schemas/learn-dashboard";

type DashboardCourse = Pick<
  Course,
  "id" | "title" | "slug" | "thumbnail_url" | "status" | "removed_at"
>;

export interface LearnDashboardEnrollmentRow {
  id: string;
  course_id: string;
  course: DashboardCourse | null;
}

export type LearnDashboardChapterRow = Pick<
  Chapter,
  "id" | "title" | "order_index" | "removed_at" | "course_id"
>;

export type LearnDashboardTopicRow = Pick<
  Topic,
  | "id"
  | "slug"
  | "title"
  | "order_index"
  | "status"
  | "removed_at"
  | "chapter_id"
  | "course_id"
>;

export interface LearnDashboardTopicProgressRow {
  topic_id: string;
  is_topic_completed: boolean;
}

export interface LearnDashboardFlashcardRow {
  next_review_date: string | null;
  fsrs_meta: unknown;
}

export interface LearnDashboardPaymentRow {
  id: string;
  course_id: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  course: {
    slug: string;
    title: string;
  } | null;
}

export function getVisibleLearnDashboardEnrollments(
  enrollments: LearnDashboardEnrollmentRow[],
) {
  return enrollments.filter(
    (enrollment) =>
      enrollment.course?.status === "published" &&
      enrollment.course.removed_at === null,
  );
}

export function buildLearnDashboardCourses({
  enrollments,
  chapters,
  topics,
  progress,
}: {
  enrollments: LearnDashboardEnrollmentRow[];
  chapters: LearnDashboardChapterRow[];
  topics: LearnDashboardTopicRow[];
  progress: LearnDashboardTopicProgressRow[];
}): LearnDashboardCourse[] {
  const visibleEnrollments = getVisibleLearnDashboardEnrollments(enrollments);
  const visibleCourseIds = new Set(
    visibleEnrollments.map((enrollment) => enrollment.course_id),
  );
  const activeChapters = chapters.filter(
    (chapter) =>
      chapter.removed_at === null && visibleCourseIds.has(chapter.course_id),
  );
  const chapterById = new Map(
    activeChapters.map((chapter) => [chapter.id, chapter]),
  );
  const completedTopicIds = new Set(
    progress
      .filter((entry) => entry.is_topic_completed)
      .map((entry) => entry.topic_id),
  );

  return visibleEnrollments.map((enrollment) => {
    const course = enrollment.course!;
    const eligibleTopics = topics
      .filter((topic) => {
        const chapter = topic.chapter_id
          ? chapterById.get(topic.chapter_id)
          : undefined;

        return (
          topic.course_id === course.id &&
          topic.status === ("published" satisfies ItemStatus) &&
          topic.removed_at === null &&
          chapter?.course_id === course.id
        );
      })
      .sort((left, right) => {
        const leftChapter = chapterById.get(left.chapter_id!);
        const rightChapter = chapterById.get(right.chapter_id!);

        return (
          leftChapter!.order_index - rightChapter!.order_index ||
          left.order_index - right.order_index ||
          left.id.localeCompare(right.id)
        );
      });

    const completedTopicCount = eligibleTopics.filter((topic) =>
      completedTopicIds.has(topic.id),
    ).length;
    const totalTopicCount = eligibleTopics.length;
    const nextTopicRow = eligibleTopics.find(
      (topic) => !completedTopicIds.has(topic.id),
    );
    const lastTopicRow = eligibleTopics.at(-1);

    const toTopicSummary = (topic: LearnDashboardTopicRow | undefined) => {
      if (!topic?.chapter_id) return null;
      const chapter = chapterById.get(topic.chapter_id);
      if (!chapter) return null;

      return {
        slug: topic.slug,
        title: topic.title,
        chapterTitle: chapter.title,
      };
    };

    const status =
      totalTopicCount === 0
        ? "no-content"
        : completedTopicCount === 0
          ? "not-started"
          : completedTopicCount === totalTopicCount
            ? "completed"
            : "in-progress";

    return {
      enrollmentId: enrollment.id,
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      courseThumbnailUrl: course.thumbnail_url,
      totalTopicCount,
      completedTopicCount,
      progressPercentage:
        totalTopicCount === 0
          ? null
          : Math.round((completedTopicCount / totalTopicCount) * 100),
      status,
      nextTopic: toTopicSummary(nextTopicRow),
      lastTopic: toTopicSummary(lastTopicRow),
    };
  });
}

export function buildReviewSummary(
  cards: LearnDashboardFlashcardRow[],
  now = new Date(),
): ReviewSummary {
  let learningCardCount = 0;
  let dueCardCount = 0;

  for (const card of cards) {
    if (
      card.next_review_date &&
      new Date(card.next_review_date).getTime() <= now.getTime()
    ) {
      dueCardCount += 1;
    }

    if (
      card.fsrs_meta &&
      typeof card.fsrs_meta === "object" &&
      "state" in card.fsrs_meta &&
      (card.fsrs_meta.state === 1 || card.fsrs_meta.state === 3)
    ) {
      learningCardCount += 1;
    }
  }

  return {
    totalCardCount: cards.length,
    learningCardCount,
    dueCardCount,
  };
}

export function buildPendingPaymentSummaries(
  rows: LearnDashboardPaymentRow[],
): PendingPaymentSummary[] {
  return rows
    .filter(
      (row) =>
        row.course !== null &&
        (row.status === "creating" || row.status === "pending"),
    )
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime() ||
        right.id.localeCompare(left.id),
    )
    .map((row) => ({
      paymentId: row.id,
      courseId: row.course_id,
      courseSlug: row.course!.slug,
      courseTitle: row.course!.title,
      status: row.status as "creating" | "pending",
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
}

export function getVisiblePendingPayments(
  payments: PendingPaymentSummary[],
  dismissedPaymentIds: string[],
) {
  const dismissedIds = new Set(dismissedPaymentIds);
  return payments.filter((payment) => !dismissedIds.has(payment.paymentId));
}

export function addDismissedPaymentId(
  dismissedPaymentIds: string[],
  paymentId: string,
) {
  return dismissedPaymentIds.includes(paymentId)
    ? dismissedPaymentIds
    : [...dismissedPaymentIds, paymentId];
}
