import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LearnDashboardClient from "@/app/(client)/learn/_components/LearnDashboardClient";
import CourseRow, {
  CourseThumbnail,
} from "@/app/(client)/learn/_components/CourseRow";
import {
  filterRemainingCourses,
  getInProgressCourses,
  getPaymentPreviewLimit,
  getRemainingCourses,
  paginateCourses,
} from "@/app/(client)/learn/_components/learning-dashboard-state";
import { PaymentRow } from "@/app/(client)/learn/_components/PendingPayments";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import type {
  LearnDashboardCourse,
  LearnDashboardResult,
  PendingPaymentSummary,
  ReviewSummary,
} from "@/lib/schemas/learn-dashboard";

// Test plan:
// - Mục tiêu: bảo vệ Option A responsive, trạng thái course/payment và initial topic route seam.
// - Loại test: component static render, helper thuần và source contract không thể quan sát qua DOM.
// - Đối tượng: LearnDashboardClient, CourseThumbnail, PaymentRow và LearningWorkspace.
// - Case thành công: phân nhóm/pagination/CTA/thumbnail/payment đúng contract và route.
// - Case thất bại: error, empty, no-content, thumbnail null và invalid topic có fallback an toàn.
// - Bảo mật/phân quyền: auth redirect được bảo vệ ở action/page test.
// - Ổn định/resilience: hai cột Desktop độc lập, payment mobile preview một item và workspace rỗng không throw.
// - Invariant cần giữ: thứ tự DTO không đổi; remaining loại in-progress; Desktop không dùng row-span; B2 không đồng bộ URL khi đổi topic.
// - Kết quả verify gần nhất: 22/22 test passed khi chạy cùng bộ interaction bằng Vitest.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const baseCourse: LearnDashboardCourse = {
  enrollmentId: "enrollment-one",
  courseId: "course-one",
  courseSlug: "toeic-foundation",
  courseTitle: "TOEIC Foundation",
  courseThumbnailUrl: null,
  totalTopicCount: 3,
  completedTopicCount: 1,
  progressPercentage: 33,
  status: "in-progress",
  nextTopic: {
    slug: "topic-two",
    title: "Bài 2",
    chapterTitle: "Chương 1",
  },
  lastTopic: {
    slug: "topic-three",
    title: "Bài 3",
    chapterTitle: "Chương 2",
  },
};

function successResult({
  courses = [baseCourse],
  pendingPayments = [],
  reviewSummary = {
    totalCardCount: 8,
    learningCardCount: 3,
    dueCardCount: 2,
  },
}: {
  courses?: LearnDashboardCourse[];
  pendingPayments?: PendingPaymentSummary[];
  reviewSummary?: ReviewSummary;
} = {}): LearnDashboardResult {
  return {
    success: true,
    data: {
      courses,
      reviewSummary,
      pendingPayments,
      pendingPaymentCount: pendingPayments.length,
    },
  };
}

function renderDashboard(result: LearnDashboardResult) {
  return renderToStaticMarkup(<LearnDashboardClient result={result} />);
}

function buildPayments(count: number): PendingPaymentSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    paymentId: `payment-${index + 1}`,
    courseId: `payment-course-${index + 1}`,
    courseSlug: `payment-course-${index + 1}`,
    courseTitle: `Khóa học thanh toán ${index + 1}`,
    status: index === 1 ? ("creating" as const) : ("pending" as const),
    createdAt: `2026-07-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`,
    expiresAt:
      index === 0 ? "2026-07-25T00:00:00.000Z" : null,
  }));
}

describe("LearnDashboardClient", () => {
  it("keeps the mobile DOM order and separates in-progress from remaining courses", () => {
    const completedCourse: LearnDashboardCourse = {
      ...baseCourse,
      enrollmentId: "enrollment-completed",
      courseId: "course-completed",
      courseSlug: "completed-course",
      courseTitle: "Khóa học đã hoàn thành",
      completedTopicCount: 3,
      progressPercentage: 100,
      status: "completed",
      nextTopic: null,
    };
    const html = renderDashboard(
      successResult({
        courses: [completedCourse, baseCourse],
        pendingPayments: buildPayments(1),
      }),
    );

    expect(html.indexOf("Học tiếp")).toBeLessThan(
      html.indexOf("Ôn tập hôm nay"),
    );
    expect(html.indexOf("Ôn tập hôm nay")).toBeLessThan(
      html.indexOf("NHỊP GHI NHỚ"),
    );
    expect(html.indexOf("NHỊP GHI NHỚ")).toBeLessThan(
      html.indexOf("Thanh toán cần xử lý"),
    );
    expect(html.indexOf("Thanh toán cần xử lý")).toBeLessThan(
      html.indexOf("Các khóa học còn lại"),
    );
    expect(html.indexOf("TOEIC Foundation")).toBeLessThan(
      html.indexOf("Khóa học đã hoàn thành"),
    );
    expect(html).toContain("Chưa bắt đầu học");
    expect(html).toContain(
      "Các khóa học bạn đã đăng ký nhưng chưa bắt đầu, đã hoàn thành hoặc chưa có nội dung.",
    );
    expect(html).not.toContain("<main");
  });

  it("keeps desktop course sections in an independent left column", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "app/(client)/learn/_components/LearnDashboardClient.tsx",
      ),
      "utf8",
    );

    expect(source).toContain(
      'className="col-span-8 min-w-0 space-y-10"',
    );
    expect(source).toContain(
      'className={isDesktop ? "col-span-4" : undefined}',
    );
    expect(source).not.toContain("lg:row-span-2");
    expect(source).not.toContain("lg:row-start-");
  });

  it("renders the exact CTA for every supported course state", () => {
    const courses: LearnDashboardCourse[] = [
      baseCourse,
      {
        ...baseCourse,
        enrollmentId: "enrollment-not-started",
        courseId: "course-not-started",
        courseSlug: "course-not-started",
        courseTitle: "Khóa học chưa bắt đầu",
        completedTopicCount: 0,
        progressPercentage: 0,
        status: "not-started",
      },
      {
        ...baseCourse,
        enrollmentId: "enrollment-completed",
        courseId: "course-completed",
        courseSlug: "course-completed",
        courseTitle: "Khóa học hoàn thành",
        completedTopicCount: 3,
        progressPercentage: 100,
        status: "completed",
        nextTopic: null,
      },
      {
        ...baseCourse,
        enrollmentId: "enrollment-no-content",
        courseId: "course-no-content",
        courseSlug: "course-no-content",
        courseTitle: "Khóa học chưa có nội dung",
        totalTopicCount: 0,
        completedTopicCount: 0,
        progressPercentage: null,
        status: "no-content",
        nextTopic: null,
        lastTopic: null,
      },
    ];
    const html = renderDashboard(successResult({ courses }));

    expect(html).toContain("Tiếp tục học");
    expect(html).toContain("Bắt đầu học");
    expect(html).toContain("Đã hoàn thành");
    expect(html).toContain("Xem lại bài học cuối");
    expect(html).toContain('href="/learn/toeic-foundation/topic-two"');
    expect(html).toContain(
      'href="/learn/course-not-started/topic-two"',
    );
    expect(html).toContain(
      'href="/learn/course-completed/topic-three"',
    );
    expect(html).toContain("Nội dung đang được cập nhật");
    expect(html).not.toContain('href="/learn/course-no-content/');

    const completedHtml = renderToStaticMarkup(
      <CourseRow course={courses[2]} />,
    );
    expect(completedHtml).toContain('data-variant="outline"');
    expect(completedHtml).not.toContain("bg-blue-600");
  });

  it("renders factual memory counts, compact review completion, empty and error states", () => {
    const completedReviewHtml = renderDashboard(
      successResult({
        reviewSummary: {
          totalCardCount: 64,
          learningCardCount: 28,
          dueCardCount: 0,
        },
      }),
    );

    expect(completedReviewHtml).toContain(
      "28 thẻ đang học · 64 thẻ tổng cộng",
    );
    expect(completedReviewHtml).toContain("Hôm nay chưa có thẻ cần ôn");
    expect(completedReviewHtml).toContain("Không có thẻ đến hạn");
    expect(completedReviewHtml).not.toContain(
      "Đã hoàn thành ôn tập hôm nay",
    );
    expect(completedReviewHtml).not.toContain("Ôn ngay");
    const emptyHtml = renderDashboard(successResult({ courses: [] }));
    expect(emptyHtml).toContain("Bạn chưa có khóa học để tiếp tục");
    expect(emptyHtml).toContain('href="/courses"');
    expect(emptyHtml).not.toContain("Các khóa học còn lại");
    expect(emptyHtml).not.toContain("Học tiếp");
    expect(
      renderDashboard({
        success: false,
        errorCode: "QUERY_FAILED",
        error: "Không thể tải dashboard học tập lúc này.",
      }),
    ).toContain("Chưa thể tải không gian học tập");
  });

  it("uses a one-item mobile payment preview and hides the section at zero", () => {
    const html = renderDashboard(
      successResult({ pendingPayments: buildPayments(4) }),
    );

    expect(html).toContain("Khóa học thanh toán 1");
    expect(html).not.toContain("Khóa học thanh toán 2");
    expect(html).not.toContain("Khóa học thanh toán 4");
    expect(html).toContain('href="/courses/payment-course-1"');
    expect(html).toContain("Xem tất cả 4 khoản thanh toán");
    expect(renderDashboard(successResult())).not.toContain(
      "Thanh toán cần xử lý",
    );
  });

  it("paginates three courses on the server/mobile snapshot", () => {
    const courses = Array.from({ length: 4 }, (_, index) => ({
      ...baseCourse,
      enrollmentId: `enrollment-${index + 1}`,
      courseId: `course-${index + 1}`,
      courseSlug: `course-${index + 1}`,
      courseTitle: `Khóa học đang học ${index + 1}`,
    }));
    const html = renderDashboard(successResult({ courses }));

    expect(html).toContain("Khóa học đang học 1");
    expect(html).toContain("Khóa học đang học 3");
    expect(html).not.toContain("Khóa học đang học 4");
    expect(html).toContain("Hiển thị 1–3 / 4 khóa học đang học");
  });
});

describe("learning dashboard presentation helpers", () => {
  const remainingCourses: LearnDashboardCourse[] = [
    { ...baseCourse, enrollmentId: "progress", status: "in-progress" },
    {
      ...baseCourse,
      enrollmentId: "not-started",
      status: "not-started",
    },
    { ...baseCourse, enrollmentId: "completed", status: "completed" },
    { ...baseCourse, enrollmentId: "no-content", status: "no-content" },
  ];

  it("partitions and filters courses without changing DTO-relative order", () => {
    expect(
      getInProgressCourses(remainingCourses).map(
        (course) => course.enrollmentId,
      ),
    ).toEqual(["progress"]);
    const remaining = getRemainingCourses(remainingCourses);
    expect(remaining.map((course) => course.enrollmentId)).toEqual([
      "not-started",
      "completed",
      "no-content",
    ]);
    expect(
      filterRemainingCourses(remaining, "completed").map(
        (course) => course.enrollmentId,
      ),
    ).toEqual(["completed"]);
    expect(
      paginateCourses(remaining, 1, 2).map((course) => course.enrollmentId),
    ).toEqual(["not-started", "completed"]);
  });

  it("uses responsive preview limits from the approved specification", () => {
    expect(getPaymentPreviewLimit(false)).toBe(1);
    expect(getPaymentPreviewLimit(true)).toBe(3);
  });

  it("renders thumbnail fallback and a valid object-cover image", () => {
    const fallbackHtml = renderToStaticMarkup(
      <CourseThumbnail course={baseCourse} />,
    );
    const imageHtml = renderToStaticMarkup(
      <CourseThumbnail
        course={{
          ...baseCourse,
          courseThumbnailUrl: "https://example.com/course.jpg",
        }}
      />,
    );

    expect(fallbackHtml).toContain(
      "Chưa có ảnh bìa cho khóa học TOEIC Foundation",
    );
    expect(imageHtml).toContain("Ảnh bìa khóa học TOEIC Foundation");
    expect(imageHtml).toContain("object-cover");
  });

  it("hides a null deadline and keeps the canonical payment action", () => {
    const withoutDeadline = renderToStaticMarkup(
      <PaymentRow payment={buildPayments(2)[1]} onDismiss={vi.fn()} />,
    );
    const withDeadline = renderToStaticMarkup(
      <PaymentRow payment={buildPayments(1)[0]} onDismiss={vi.fn()} />,
    );

    expect(withoutDeadline).not.toContain("Hạn ");
    expect(withDeadline).toContain("Hạn 25/07/2026");
    expect(withDeadline).toContain(
      'aria-label="Ẩn nhắc nhở này: Khóa học thanh toán 1"',
    );
    expect(withDeadline).toContain(
      'href="/courses/payment-course-1"',
    );
    expect(withDeadline).toContain("Tiếp tục thanh toán");
    expect(withDeadline).toContain("bg-amber-700");
    expect(withDeadline).toContain("text-amber-700");
    expect(withDeadline).not.toContain("bg-blue-600");
  });
});

describe("LearningWorkspace initial topic", () => {
  const syllabus = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Chương 1",
      order_index: 1,
      topics: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Bài đầu",
          slug: "topic-one",
          status: "published",
          order_index: 1,
        },
      ],
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      title: "Chương 2",
      order_index: 2,
      topics: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          title: "Bài theo URL",
          slug: "topic-two",
          status: "published",
          order_index: 1,
        },
      ],
    },
  ];

  it("initializes the requested available topic instead of the first topic", () => {
    const html = renderToStaticMarkup(
      <LearningWorkspace
        courseTitle="TOEIC Foundation"
        syllabus={syllabus}
        initialTopicSlug="topic-two"
      />,
    );

    expect(html).toContain("Bài theo URL");
  });

  it("falls back to the first topic and remains safe with no content", () => {
    const fallbackHtml = renderToStaticMarkup(
      <LearningWorkspace
        courseTitle="TOEIC Foundation"
        syllabus={syllabus}
        initialTopicSlug="missing-topic"
      />,
    );
    const emptyHtml = renderToStaticMarkup(
      <LearningWorkspace
        courseTitle="Khóa học rỗng"
        syllabus={[]}
        initialTopicSlug="missing-topic"
      />,
    );

    expect(fallbackHtml).toContain("Bài đầu");
    expect(emptyHtml).toContain("Bài học này chưa có nội dung");
  });

  it("keeps full URL synchronization deferred", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace.tsx",
      ),
      "utf8",
    );

    expect(source).not.toContain("router.push");
    expect(source).not.toContain("router.replace");
    expect(source).not.toContain("popstate");
  });
});
