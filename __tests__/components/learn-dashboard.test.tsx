import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "@/__tests__/support/intl";
import { describe, expect, it, vi } from "vitest";
import LearnDashboardClient from "@/app/(client)/learn/_components/LearnDashboardClient";
import CourseRow, {
  CourseThumbnail,
} from "@/app/(client)/learn/_components/CourseRow";
import {
  filterRemainingCourses,
  getInProgressCourses,
  getRemainingCourses,
  paginateCourses,
} from "@/app/(client)/learn/_components/learning-dashboard-state";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import type {
  LearnDashboardCourse,
  LearnDashboardResult,
  PendingPaymentSummary,
  ReviewSummary,
} from "@/lib/schemas/learn-dashboard";

// Test plan:
// - Mục tiêu: bảo vệ Option A responsive, trạng thái course/payment và workspace route seam.
// - Loại test: component static render, helper thuần và source contract không thể quan sát qua DOM.
// - Đối tượng: LearnDashboardClient, CourseThumbnail và LearningWorkspace.
// - Case thành công: phân nhóm/pagination/fast-path CTA/overview entry/thumbnail/payment đúng contract và route.
// - Case thất bại: error, empty, no-content và thumbnail null.
// - Bảo mật/phân quyền: auth redirect được bảo vệ ở action/page test.
// - Ổn định/resilience: hai cột Desktop độc lập, thẻ thanh toán chỉ một khoản và workspace không nội dung không throw.
// - Invariant cần giữ: thứ tự DTO không đổi; remaining loại in-progress; Desktop không dùng row-span; workspace navigation dùng URL chuẩn.
// - Kết quả verify gần nhất: focused Vitest 5 files / 55 tests đạt; payment geometry/capability đã kiểm tra browser local.

vi.mock("server-only", () => ({}));
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
      index === 0 ? "2099-07-25T00:00:00.000Z" : null,
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

  it("includes independent desktop columns in the server-rendered layout", () => {
    const html = renderDashboard(successResult());

    expect(html).toContain("flow-root");
    expect(html).toContain("lg:float-left");
    expect(html).toContain("lg:clear-left");
    expect(html).toContain("lg:float-right");
    expect(html).not.toContain("row-span");
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
    expect(html.match(/>Xem tổng quan<\/a>/g)).toHaveLength(4);
    expect(html).toContain('href="/learn/toeic-foundation/topic-two"');
    expect(html).toContain(
      'href="/learn/course-not-started/topic-two"',
    );
    expect(html).toContain(
      'href="/learn/course-completed/topic-three"',
    );
    for (const courseSlug of [
      "toeic-foundation",
      "course-not-started",
      "course-completed",
      "course-no-content",
    ]) {
      expect(html).toContain(`href="/learn/${courseSlug}"`);
    }
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

  it("renders a single payment card for the nearest deadline, with the +N link, and hides it at zero", () => {
    const html = renderDashboard(
      successResult({ pendingPayments: buildPayments(4) }),
    );

    expect(html).toContain("Khóa học thanh toán 1");
    expect(html).not.toContain("Khóa học thanh toán 2");
    expect(html).not.toContain("Khóa học thanh toán 4");
    expect(html).toContain('href="/courses/payment-course-1?thanh-toan=tiep-tuc"');
    expect(html).toContain("+3 khoản khác · Xem trong hồ sơ");
    expect(html).toContain('href="/profile?tab=payments"');
    expect(html).not.toContain("Xem tất cả");
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

});

describe("LearningWorkspace route ownership", () => {
  const syllabus = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Chương 1",
      orderIndex: 1,
      topics: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Bài đầu",
          slug: "topic-one",
          orderIndex: 1,
          chapterId: "11111111-1111-4111-8111-111111111111",
          isCompleted: false,
        },
      ],
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      title: "Chương 2",
      orderIndex: 2,
      topics: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          title: "Bài theo URL",
          slug: "topic-two",
          orderIndex: 1,
          chapterId: "33333333-3333-4333-8333-333333333333",
          isCompleted: false,
        },
      ],
    },
  ];

  const data = {
    courseId: "c0c0c0c0-0000-4000-8000-000000000001",
    courseSlug: "toeic-foundation",
    courseTitle: "TOEIC Foundation",
    syllabus,
    currentTopic: syllabus[1].topics[0],
    flashcards: [],
    exercises: [],
    memoryCheck: null,
    isMemoryCheckPassed: true,
    unseenCardIds: [],
    unratedCardIds: [],
    memoryGateClearedCardIds: null,
    dueCardIds: [],
    answers: {},
    progress: null,
  };

  it("renders the exact route topic and canonical course/topic links", () => {
    const html = renderToStaticMarkup(
      <LearningWorkspace data={data} />,
    );

    expect(html).toContain("Bài theo URL");
    expect(html).toContain('href="/learn/toeic-foundation"');
    // The course outline opens on demand (D8-LUI), so only the neighbor
    // navigation is in the first paint; the outline links are covered by the
    // interaction test that opens it.
    expect(html).toContain('href="/learn/toeic-foundation/topic-one"');
    expect(html).toContain("Bài trước");
    expect(html).toContain('aria-label="Mở danh sách chương và bài học"');
    expect(html).not.toContain('href="/learn/toeic-foundation/topic-two"');
  });

  it("keeps an available topic with no content explicit and stable", () => {
    const html = renderToStaticMarkup(<LearningWorkspace data={data} />);

    expect(html).toContain("Bài học này chưa có nội dung");
  });

  it("does not keep a parallel client-owned topic route", () => {
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
    expect(source).not.toContain("getTopicContent");
    expect(source).not.toContain("getTopicLearningHistory");
  });
});

// FEAT3 AC5/AC10: thẻ chuỗi ngày học nằm trong cột phải cùng `Ôn tập hôm nay`; thất bại không làm mất phần còn lại của trang.
describe("FEAT3 learning streak card on /learn", () => {
  const summary = {
    streak: 3,
    studiedToday: true,
    days: Array.from({ length: 7 }, (_, index) => ({ date: `2026-03-${String(5 + index).padStart(2, "0")}`, studied: index >= 4 })),
    weekStudyMinutes: 80,
  };

  it("shows the streak card in the aside next to the review card and keeps the course list", () => {
    const html = renderToStaticMarkup(
      <LearnDashboardClient result={successResult()} learningSummary={{ success: true, data: summary }} />,
    );

    const aside = html.slice(html.indexOf("<aside"));
    expect(aside).toContain("Ôn tập hôm nay");
    expect(aside).toContain("3 ngày liên tiếp");
    expect(aside).toContain("khoảng 1 giờ 20 phút");
    expect(html.indexOf("Ôn tập hôm nay")).toBeLessThan(html.indexOf("3 ngày liên tiếp"));
    expect(html).toContain('href="/learn/toeic-foundation/topic-two"');
  });

  it("shows a quiet unavailable card and still renders the courses, review and memory cards when the summary failed", () => {
    const html = renderToStaticMarkup(
      <LearnDashboardClient
        result={successResult()}
        learningSummary={{ success: false, error: "Không thể tải chuỗi ngày học lúc này." }}
      />,
    );

    expect(html).toContain("Chưa tải được chuỗi ngày học");
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Ôn tập hôm nay");
    expect(html).toContain("NHỊP GHI NHỚ");
    expect(html).toContain('href="/learn/toeic-foundation/topic-two"');
  });

  it("shows no streak card when the page passed no summary", () => {
    expect(renderDashboard(successResult())).not.toContain("CHUỖI NGÀY HỌC");
  });
});
