import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LearnDashboardClient from "@/app/(client)/learn/_components/LearnDashboardClient";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import type {
  LearnDashboardCourse,
  LearnDashboardResult,
  PendingPaymentSummary,
} from "@/lib/schemas/learn-dashboard";

// Test plan:
// - Mục tiêu: kiểm tra trạng thái và CTA quan trọng của /learn cùng initial topic route seam.
// - Loại test: component static render và source contract.
// - Đối tượng: LearnDashboardClient và LearningWorkspace.
// - Case thành công: CTA course/payment đúng route; URL topic hợp lệ mở đúng bài.
// - Case thất bại: error, no-course, no-content và invalid topic có fallback an toàn.
// - Bảo mật/phân quyền: auth redirect được bảo vệ ở action/page test.
// - Ổn định/resilience: default payment chỉ hiện ba item và workspace rỗng không throw.
// - Invariant cần giữ: B2 không đồng bộ URL khi đổi topic trong workspace.
// - Kết quả verify gần nhất: passed bằng `npm run test:run -- __tests__/utils/learn-dashboard.test.ts __tests__/utils/learn-navigation.test.ts __tests__/actions/learn-dashboard.test.ts __tests__/components/learn-dashboard.test.tsx`.

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
}: {
  courses?: LearnDashboardCourse[];
  pendingPayments?: PendingPaymentSummary[];
} = {}): LearnDashboardResult {
  return {
    success: true,
    data: {
      courses,
      reviewSummary: {
        totalCardCount: 8,
        learningCardCount: 3,
        dueCardCount: 2,
      },
      pendingPayments,
      pendingPaymentCount: pendingPayments.length,
    },
  };
}

function renderDashboard(result: LearnDashboardResult) {
  return renderToStaticMarkup(<LearnDashboardClient result={result} />);
}

describe("LearnDashboardClient", () => {
  it("places the course journey before review and payments, with in-progress learning first", () => {
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
      successResult({ courses: [completedCourse, baseCourse] }),
    );

    expect(html.indexOf("Khóa học đang tham gia")).toBeLessThan(
      html.indexOf("Nhịp ôn tập hôm nay"),
    );
    expect(html.indexOf("Nhịp ôn tập hôm nay")).toBeLessThan(
      html.indexOf("Thanh toán đang chờ"),
    );
    expect(html.indexOf("TOEIC Foundation")).toBeLessThan(
      html.indexOf("Khóa học đã hoàn thành"),
    );
  });

  it("renders the next-topic CTA for an incomplete course", () => {
    const html = renderDashboard(successResult());

    expect(html).toContain("Tiếp tục học");
    expect(html).toContain(
      'href="/learn/toeic-foundation/topic-two"',
    );
  });

  it("renders the final-topic review CTA for a completed course", () => {
    const html = renderDashboard(
      successResult({
        courses: [
          {
            ...baseCourse,
            completedTopicCount: 3,
            progressPercentage: 100,
            status: "completed",
            nextTopic: null,
          },
        ],
      }),
    );

    expect(html).toContain("Đã hoàn thành");
    expect(html).toContain("Xem lại bài học cuối");
    expect(html).toContain(
      'href="/learn/toeic-foundation/topic-three"',
    );
  });

  it("does not render a learning CTA for a course without eligible content", () => {
    const html = renderDashboard(
      successResult({
        courses: [
          {
            ...baseCourse,
            totalTopicCount: 0,
            completedTopicCount: 0,
            progressPercentage: null,
            status: "no-content",
            nextTopic: null,
            lastTopic: null,
          },
        ],
      }),
    );

    expect(html).toContain("chưa có nội dung học khả dụng");
    expect(html).not.toContain("Tiếp tục học");
    expect(html).not.toContain("Xem lại bài học cuối");
  });

  it("renders a learner-focused empty state and safe error state", () => {
    expect(renderDashboard(successResult({ courses: [] }))).toContain(
      "Bạn chưa có khóa học để tiếp tục",
    );
    expect(
      renderDashboard({
        success: false,
        errorCode: "QUERY_FAILED",
        error: "Không thể tải dashboard học tập lúc này.",
      }),
    ).toContain("Chưa thể tải dashboard học tập");
  });

  it("shows only three newest payment reminders by default with canonical course links", () => {
    const pendingPayments = Array.from({ length: 4 }, (_, index) => ({
      paymentId: `payment-${index + 1}`,
      courseId: `course-${index + 1}`,
      courseSlug: `course-${index + 1}`,
      courseTitle: `Khóa học thanh toán ${index + 1}`,
      status: "pending" as const,
      createdAt: `2026-07-0${4 - index}T00:00:00.000Z`,
      expiresAt: null,
    }));
    const html = renderDashboard(successResult({ pendingPayments }));

    expect(html).toContain("Khóa học thanh toán 1");
    expect(html).toContain("Khóa học thanh toán 3");
    expect(html).not.toContain("Khóa học thanh toán 4");
    expect(html).toContain('href="/courses/course-1"');
    expect(html).toContain("Xem tất cả thanh toán đang chờ (4)");
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
