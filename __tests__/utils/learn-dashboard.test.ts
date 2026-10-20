import { describe, expect, it } from "vitest";
import {
  addDismissedPaymentId,
  buildLearnCourseProgressProjection,
  buildLearnDashboardCourses,
  buildPendingPaymentSummaries,
  buildReviewSummary,
  getVisiblePendingPayments,
  selectNearestPendingPayment,
  type LearnDashboardChapterRow,
  type LearnDashboardEnrollmentRow,
  type LearnDashboardTopicProgressRow,
  type LearnDashboardTopicRow,
} from "@/lib/learn-dashboard";

// Test plan:
// - Mục tiêu: bảo vệ quy tắc visibility, thứ tự và tiến độ của learner dashboard.
// - Loại test: unit.
// - Đối tượng: các hàm aggregate thuần của dashboard.
// - Case thành công: course/topic hợp lệ được sắp xếp và tạo CTA đúng.
// - Case thất bại: course, chapter và topic không khả dụng bị loại.
// - Bảo mật/phân quyền: auth/RLS được kiểm tra riêng ở action và integration boundary.
// - Ổn định/resilience: chapter rỗng, học không tuyến tính và course rỗng không làm sai next topic.
// - Invariant cần giữ: progress chỉ tính published topic chưa soft-delete trong chapter chưa soft-delete.
// - Kết quả verify gần nhất: 31/31 test passed bằng focused CP1 Vitest command.

const course = {
  id: "course-one",
  title: "TOEIC nền tảng",
  slug: "toeic-nen-tang",
  thumbnail_url: null,
  status: "published" as const,
  removed_at: null,
};

const enrollment: LearnDashboardEnrollmentRow = {
  id: "enrollment-one",
  course_id: course.id,
  course,
};

const chapters: LearnDashboardChapterRow[] = [
  {
    id: "chapter-one",
    course_id: course.id,
    title: "Chương 1",
    order_index: 1,
    removed_at: null,
  },
  {
    id: "chapter-two",
    course_id: course.id,
    title: "Chương 2",
    order_index: 2,
    removed_at: null,
  },
];

const topics: LearnDashboardTopicRow[] = [
  {
    id: "topic-one",
    course_id: course.id,
    chapter_id: "chapter-one",
    title: "Bài 1",
    slug: "bai-1",
    order_index: 1,
    status: "published",
    removed_at: null,
  },
  {
    id: "topic-two",
    course_id: course.id,
    chapter_id: "chapter-one",
    title: "Bài 2",
    slug: "bai-2",
    order_index: 2,
    status: "published",
    removed_at: null,
  },
  {
    id: "topic-three",
    course_id: course.id,
    chapter_id: "chapter-two",
    title: "Bài 3",
    slug: "bai-3",
    order_index: 1,
    status: "published",
    removed_at: null,
  },
];

function buildCourses({
  enrollments = [enrollment],
  chapterRows = chapters,
  topicRows = topics,
  progress = [],
}: {
  enrollments?: LearnDashboardEnrollmentRow[];
  chapterRows?: LearnDashboardChapterRow[];
  topicRows?: LearnDashboardTopicRow[];
  progress?: LearnDashboardTopicProgressRow[];
} = {}) {
  return buildLearnDashboardCourses({
    enrollments,
    chapters: chapterRows,
    topics: topicRows,
    progress,
  });
}

describe("buildLearnDashboardCourses", () => {
  it("includes an enrolled published course and excludes draft, pending and soft-deleted courses", () => {
    const hiddenEnrollments: LearnDashboardEnrollmentRow[] = [
      {
        ...enrollment,
        id: "draft-enrollment",
        course: { ...course, id: "draft-course", status: "draft" },
        course_id: "draft-course",
      },
      {
        ...enrollment,
        id: "pending-enrollment",
        course: { ...course, id: "pending-course", status: "pending" },
        course_id: "pending-course",
      },
      {
        ...enrollment,
        id: "removed-enrollment",
        course: {
          ...course,
          id: "removed-course",
          removed_at: "2026-07-01T00:00:00.000Z",
        },
        course_id: "removed-course",
      },
    ];

    expect(
      buildCourses({ enrollments: [enrollment, ...hiddenEnrollments] }),
    ).toHaveLength(1);
  });

  it("excludes topics from removed chapters plus unpublished and removed topics", () => {
    const chapterRows = [
      ...chapters,
      {
        id: "removed-chapter",
        course_id: course.id,
        title: "Đã xóa",
        order_index: 0,
        removed_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "empty-chapter",
        course_id: course.id,
        title: "Chương rỗng",
        order_index: 3,
        removed_at: null,
      },
    ];
    const topicRows: LearnDashboardTopicRow[] = [
      topics[0],
      { ...topics[1], id: "draft-topic", status: "draft" },
      {
        ...topics[1],
        id: "removed-topic",
        removed_at: "2026-07-01T00:00:00.000Z",
      },
      {
        ...topics[2],
        id: "removed-chapter-topic",
        chapter_id: "removed-chapter",
      },
    ];

    expect(buildCourses({ chapterRows, topicRows })[0]).toMatchObject({
      totalTopicCount: 1,
      nextTopic: { slug: "bai-1" },
      lastTopic: { slug: "bai-1" },
    });
  });

  it("starts at zero progress and selects the first topic", () => {
    expect(buildCourses()[0]).toMatchObject({
      completedTopicCount: 0,
      progressPercentage: 0,
      status: "not-started",
      nextTopic: { slug: "bai-1" },
    });
  });

  it("orders next and last topics by chapter then topic order regardless of query order", () => {
    const result = buildCourses({
      chapterRows: [chapters[1], chapters[0]],
      topicRows: [topics[2], topics[1], topics[0]],
    })[0];

    expect(result.nextTopic).toMatchObject({ slug: "bai-1" });
    expect(result.lastTopic).toMatchObject({ slug: "bai-3" });
  });

  it("continues from a partially completed chapter into the next chapter", () => {
    const progress = topics.slice(0, 2).map((topic) => ({
      topic_id: topic.id,
      is_topic_completed: true,
    }));

    expect(buildCourses({ progress })[0]).toMatchObject({
      completedTopicCount: 2,
      progressPercentage: 67,
      status: "in-progress",
      nextTopic: { slug: "bai-3", chapterTitle: "Chương 2" },
    });
  });

  it("skips multiple consecutive empty chapters when resolving the next topic", () => {
    const chapterRows: LearnDashboardChapterRow[] = [
      chapters[0],
      { ...chapters[1], id: "empty-two", order_index: 2 },
      { ...chapters[1], id: "empty-three", order_index: 3 },
      { ...chapters[1], id: "chapter-four", order_index: 4 },
    ];
    const topicRows = [
      topics[0],
      { ...topics[2], chapter_id: "chapter-four", id: "topic-four" },
    ];

    expect(
      buildCourses({
        chapterRows,
        topicRows,
        progress: [{ topic_id: "topic-one", is_topic_completed: true }],
      })[0].nextTopic,
    ).toMatchObject({ slug: "bai-3", chapterTitle: "Chương 2" });
  });

  it("returns to the earliest incomplete topic after non-linear completion", () => {
    expect(
      buildCourses({
        progress: [
          { topic_id: "topic-two", is_topic_completed: true },
          { topic_id: "topic-three", is_topic_completed: true },
        ],
      })[0].nextTopic,
    ).toMatchObject({ slug: "bai-1" });
  });

  it("marks the course completed and retains the final topic for review", () => {
    const progress = topics.map((topic) => ({
      topic_id: topic.id,
      is_topic_completed: true,
    }));

    expect(buildCourses({ progress })[0]).toMatchObject({
      status: "completed",
      progressPercentage: 100,
      nextTopic: null,
      lastTopic: { slug: "bai-3" },
    });
  });

  it("returns a safe no-content state when no eligible topic exists", () => {
    expect(buildCourses({ topicRows: [] })[0]).toMatchObject({
      status: "no-content",
      totalTopicCount: 0,
      progressPercentage: null,
      nextTopic: null,
      lastTopic: null,
    });
  });
});

describe("buildLearnCourseProgressProjection", () => {
  it("returns the ordered chapter path while preserving B2 progress semantics", () => {
    const projection = buildLearnCourseProgressProjection({
      courseId: course.id,
      chapters: [chapters[1], chapters[0]],
      topics: [topics[2], topics[1], topics[0]],
      progress: [{ topic_id: "topic-one", is_topic_completed: true }],
    });

    expect(projection).toMatchObject({
      totalTopicCount: 3,
      completedTopicCount: 1,
      progressPercentage: 33,
      status: "in-progress",
      nextTopic: { slug: "bai-2", chapterTitle: "Chương 1" },
      lastTopic: { slug: "bai-3", chapterTitle: "Chương 2" },
      chapters: [
        {
          id: "chapter-one",
          topics: [
            { id: "topic-one", isCompleted: true },
            { id: "topic-two", isCompleted: false },
          ],
        },
        {
          id: "chapter-two",
          topics: [{ id: "topic-three", isCompleted: false }],
        },
      ],
    });
  });
});

describe("dashboard summaries", () => {
  it("sorts active pending payments newest first", () => {
    const summaries = buildPendingPaymentSummaries([
      {
        id: "payment-old",
        course_id: course.id,
        status: "pending",
        created_at: "2026-07-01T00:00:00.000Z",
        expires_at: null,
        course: { slug: course.slug, title: course.title },
      },
      {
        id: "payment-new",
        course_id: course.id,
        status: "creating",
        created_at: "2026-07-02T00:00:00.000Z",
        expires_at: null,
        course: { slug: course.slug, title: course.title },
      },
      {
        id: "payment-paid",
        course_id: course.id,
        status: "paid",
        created_at: "2026-07-03T00:00:00.000Z",
        expires_at: null,
        course: { slug: course.slug, title: course.title },
      },
    ]);

    expect(summaries.map((payment) => payment.paymentId)).toEqual([
      "payment-new",
      "payment-old",
    ]);
  });

  it("skips pending payments on enrolled courses, so they are not shown or counted", () => {
    const row = (id: string, courseId: string) => ({
      id,
      course_id: courseId,
      status: "pending",
      created_at: "2026-07-02T00:00:00.000Z",
      expires_at: null,
      course: { slug: `slug-${courseId}`, title: `Khóa ${courseId}` },
    });
    const rows = [row("payment-enrolled", "course-a"), row("payment-open", "course-b")];

    expect(
      buildPendingPaymentSummaries(rows, new Set(["course-a"])).map((payment) => payment.paymentId),
    ).toEqual(["payment-open"]);
    // Không truyền tập ghi danh thì hành vi cũ: giữ cả hai.
    expect(buildPendingPaymentSummaries(rows)).toHaveLength(2);
  });

  it("dismisses reminders by payment id without hiding another payment for the same course", () => {
    const payments = buildPendingPaymentSummaries([
      {
        id: "payment-one",
        course_id: course.id,
        status: "pending",
        created_at: "2026-07-02T00:00:00.000Z",
        expires_at: null,
        course: { slug: course.slug, title: course.title },
      },
      {
        id: "payment-two",
        course_id: course.id,
        status: "pending",
        created_at: "2026-07-01T00:00:00.000Z",
        expires_at: null,
        course: { slug: course.slug, title: course.title },
      },
    ]);
    const dismissedIds = addDismissedPaymentId([], "payment-one");

    expect(
      getVisiblePendingPayments(payments, dismissedIds).map(
        (payment) => payment.paymentId,
      ),
    ).toEqual(["payment-two"]);
    expect(addDismissedPaymentId(dismissedIds, "payment-one")).toBe(
      dismissedIds,
    );
  });

  it("counts total, learning and due flashcards", () => {
    expect(
      buildReviewSummary(
        [
          {
            next_review_date: "2026-07-01T00:00:00.000Z",
            fsrs_meta: { state: 1 },
          },
          {
            next_review_date: "2026-07-20T00:00:00.000Z",
            fsrs_meta: { state: 3 },
          },
          {
            next_review_date: "2026-07-01T00:00:00.000Z",
            fsrs_meta: { state: 2 },
          },
        ],
        new Date("2026-07-13T00:00:00.000Z"),
      ),
    ).toEqual({
      totalCardCount: 3,
      learningCardCount: 2,
      dueCardCount: 2,
    });
  });
});

describe("selectNearestPendingPayment", () => {
  const pay = (
    paymentId: string,
    expiresAt: string | null,
    createdAt: string,
  ) => ({
    paymentId,
    courseId: `course-${paymentId}`,
    courseSlug: `slug-${paymentId}`,
    courseTitle: `Khóa ${paymentId}`,
    status: "pending" as const,
    createdAt,
    expiresAt,
  });
  const idOf = (payments: Parameters<typeof selectNearestPendingPayment>[0]) =>
    selectNearestPendingPayment(payments)?.paymentId ?? null;

  it("returns null for an empty list", () => {
    expect(selectNearestPendingPayment([])).toBeNull();
  });

  it("picks the earliest expires_at whatever the input order", () => {
    const soon = pay("soon", "2026-08-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z");
    const later = pay("later", "2026-09-01T00:00:00.000Z", "2026-07-20T00:00:00.000Z");
    expect(idOf([later, soon])).toBe("soon");
    expect(idOf([soon, later])).toBe("soon");
  });

  it("breaks a deadline tie by the newer created_at, then the larger payment id", () => {
    const older = pay("a", "2026-08-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z");
    const newer = pay("b", "2026-08-01T00:00:00.000Z", "2026-07-02T00:00:00.000Z");
    expect(idOf([older, newer])).toBe("b");
    expect(idOf([newer, older])).toBe("b");

    const sameTimeLow = pay("m-1", "2026-08-01T00:00:00.000Z", "2026-07-02T00:00:00.000Z");
    const sameTimeHigh = pay("m-2", "2026-08-01T00:00:00.000Z", "2026-07-02T00:00:00.000Z");
    expect(idOf([sameTimeLow, sameTimeHigh])).toBe("m-2");
    expect(idOf([sameTimeHigh, sameTimeLow])).toBe("m-2");
  });

  it("places payments without a deadline after every dated one, even a far-future one", () => {
    const dated = pay("dated", "2099-01-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z");
    const undated = pay("undated", null, "2026-07-30T00:00:00.000Z");
    expect(idOf([undated, dated])).toBe("dated");
    expect(idOf([dated, undated])).toBe("dated");
  });

  it("falls back to the newest created_at when no payment has a deadline", () => {
    const older = pay("older", null, "2026-07-01T00:00:00.000Z");
    const newer = pay("newer", null, "2026-07-05T00:00:00.000Z");
    expect(idOf([older, newer])).toBe("newer");
    expect(idOf([newer, older])).toBe("newer");
  });

  it("treats an unparseable deadline like a missing one", () => {
    const broken = pay("broken", "not-a-date", "2026-07-30T00:00:00.000Z");
    const dated = pay("dated", "2099-01-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z");
    expect(idOf([broken, dated])).toBe("dated");
  });
});
