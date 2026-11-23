// @vitest-environment jsdom
import React from "react";
import { screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EnrolledCourseOverviewLoading from "@/app/(client)/learn/[course-slug]/loading";
import EnrolledCourseOverview from "@/app/(client)/learn/[course-slug]/_components/EnrolledCourseOverview";
import EnrolledCourseOverviewFeedback from "@/app/(client)/learn/[course-slug]/_components/EnrolledCourseOverviewFeedback";
import EnrolledCourseOverviewRetryButton from "@/app/(client)/learn/[course-slug]/_components/EnrolledCourseOverviewRetryButton";
import {
  render,
  renderSwitchable,
  renderToStaticMarkup,
} from "@/__tests__/support/intl";
import type { EnrolledCourseOverviewData } from "@/lib/schemas/enrolled-course-overview";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

// Test plan:
// - Mục tiêu: English localization U3 AC1/AC5 (CP2) - tổng quan khóa học đã ghi danh, trạng thái lỗi/chưa ghi danh, nút thử lại, loading
//   và khối chuỗi ngày học hiện chữ tiếng Anh theo ngôn ngữ đang dùng, không còn chữ giao diện tiếng Việt và không lộ khóa thô.
// - Loại test: component/static render với provider next-intl thật (bản test dùng catalog thật).
// - Đối tượng: EnrolledCourseOverview (cả ba trạng thái tiến độ và no-content), EnrolledCourseOverviewFeedback, RetryButton, Loading.
// - Case chính: nhãn trạng thái chủ đề, số đã hoàn thành có phân tách nghìn ở en và chữ số thường ở vi (1234), aria-label/valuetext,
//   chủ đề học gần nhất với `daysAgo` > 1 (RecentTopicsList), trạng thái "chưa tải được", đổi ngôn ngữ khi đang hiện.
// - Giới hạn: tiêu đề khóa/chủ đề/chương là nội dung của giáo viên nên giữ nguyên; thông báo `error` do server dựng sẵn nên chỉ đổi
//   ngôn ngữ ở lần render server kế tiếp (router.refresh), không đổi trong test này.

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  useRouter: vi.fn(),
}));

const mockedUseRouter = vi.mocked(useRouter);

function overviewData(overrides: Partial<EnrolledCourseOverviewData> = {}): EnrolledCourseOverviewData {
  return {
    courseId: "c0c0c0c0-0000-4000-8000-000000000001",
    courseSlug: "toeic-nen-tang",
    courseTitle: "TOEIC Foundations",
    courseThumbnailUrl: null,
    totalTopicCount: 3,
    completedTopicCount: 1,
    progressPercentage: 33,
    status: "in-progress",
    nextTopic: { slug: "lesson-2", title: "Lesson 2", chapterTitle: "Chapter one" },
    lastTopic: { slug: "lesson-3", title: "Lesson 3", chapterTitle: "Chapter two" },
    chapters: [
      {
        id: "chapter-one",
        title: "Chapter one",
        topics: [
          { id: "topic-one", slug: "lesson-1", title: "Lesson 1", isCompleted: true },
          { id: "topic-two", slug: "lesson-2", title: "Lesson 2", isCompleted: false },
        ],
      },
      {
        id: "chapter-two",
        title: "Chapter two",
        topics: [{ id: "topic-three", slug: "lesson-3", title: "Lesson 3", isCompleted: false }],
      },
    ],
    ...overrides,
  } as EnrolledCourseOverviewData;
}

const VIETNAMESE_CHROME = [
  "Không gian học tập",
  "chủ đề đã hoàn thành",
  "Tiếp tục học",
  "Sắp tới",
  "LỘ TRÌNH HỌC",
  "CHƯƠNG",
];

function summary(overrides: Partial<Extract<CourseLearningSummaryResult, { success: true }>["data"]> = {}): CourseLearningSummaryResult {
  return {
    success: true,
    data: {
      streak: 3,
      studiedToday: false,
      recentTopics: [
        { topicId: "t1", slug: "lesson-1", title: "Lesson 1", lastActivityAt: "2026-11-23T01:00:00Z", daysAgo: 0 },
        { topicId: "t2", slug: "lesson-2", title: "Lesson 2", lastActivityAt: "2026-11-22T01:00:00Z", daysAgo: 1 },
        { topicId: "t3", slug: "lesson-3", title: "Lesson 3", lastActivityAt: "2026-11-18T01:00:00Z", daysAgo: 5 },
      ],
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
});

describe("enrolled course overview in English", () => {
  it("renders the in-progress overview with English chrome, labels and accessible names", () => {
    const html = renderToStaticMarkup(<EnrolledCourseOverview data={overviewData()} />, { locale: "en" });

    expect(html).toContain("Learning space");
    expect(html).toContain("COURSE SPACE");
    expect(html).toContain("NEXT LESSON");
    expect(html).toContain("Continue where you left off");
    expect(html).toContain("1/3 topics completed");
    expect(html).toContain('aria-label="Progress of the course TOEIC Foundations"');
    expect(html).toContain('aria-valuetext="1 of 3 topics completed"');
    expect(html).toContain("Continue learning");
    expect(html).toContain("NEXT TOPIC");
    expect(html).toContain("LEARNING PATH");
    expect(html).toContain("CHAPTER 1");
    expect(html).toContain("CHAPTER 2");
    expect(html).toContain("Completed");
    expect(html).toContain("Up next");
    expect(html).toContain("Upcoming");
    expect(html).toContain('aria-label="No cover image for the course TOEIC Foundations"');
    for (const text of VIETNAMESE_CHROME) expect(html).not.toContain(text);
    expect(html).not.toMatch(/\b(learn|learning)\.[a-z]/i);
  });

  it("renders the completed, not-started and no-content states in English", () => {
    const completed = renderToStaticMarkup(
      <EnrolledCourseOverview data={overviewData({ status: "completed", completedTopicCount: 3, progressPercentage: 100 })} />,
      { locale: "en" },
    );
    expect(completed).toContain("You&#x27;ve finished the whole path");
    expect(completed).toContain("LESSON TO REVISIT");
    expect(completed).toContain("Review the last lesson");

    const notStarted = renderToStaticMarkup(
      <EnrolledCourseOverview data={overviewData({ status: "not-started", completedTopicCount: 0, progressPercentage: 0 })} />,
      { locale: "en" },
    );
    expect(notStarted).toContain("READY TO START");
    expect(notStarted).toContain("Your first lesson is waiting");
    expect(notStarted).toContain("Start learning");

    const noContent = renderToStaticMarkup(
      <EnrolledCourseOverview
        data={overviewData({ status: "no-content", totalTopicCount: 0, completedTopicCount: 0, progressPercentage: null, nextTopic: null, lastTopic: null, chapters: [] })}
      />,
      { locale: "en" },
    );
    expect(noContent).toContain("This course has no content to start yet");
    expect(noContent).toContain("Back to the learning space");
  });

  it("groups large topic counts in English and keeps plain digits in Vietnamese", () => {
    const data = overviewData({ totalTopicCount: 1234, completedTopicCount: 1 });
    expect(renderToStaticMarkup(<EnrolledCourseOverview data={data} />, { locale: "en" })).toContain("1/1,234 topics completed");
    const vi = renderToStaticMarkup(<EnrolledCourseOverview data={data} />, { locale: "vi" });
    expect(vi).toContain("1/1234 chủ đề đã hoàn thành");
    expect(vi).toContain('aria-valuetext="1 trên 1234 chủ đề đã hoàn thành"');
  });

  it("uses singular wording for a single topic", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverview data={overviewData({ totalTopicCount: 1, completedTopicCount: 0 })} />,
      { locale: "en" },
    );
    expect(html).toContain("0/1 topic completed");
    expect(html).not.toContain("0/1 topics");
  });

  it("shows the course activity card in English, including a recent topic from several days ago", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverview data={overviewData()} learningSummary={summary()} />,
      { locale: "en" },
    );
    expect(html).toContain("3 days studying this course in a row");
    expect(html).toContain("You haven&#x27;t studied this course today.");
    expect(html).toContain("RECENTLY STUDIED");
    expect(html).toContain("Today");
    expect(html).toContain("Yesterday");
    expect(html).toContain("5 days ago");
    expect(html).not.toContain("ngày trước");
  });

  it("shows the quiet unavailable state in English when the summary could not be read", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverview data={overviewData()} learningSummary={{ success: false, error: "x" }} />,
      { locale: "en" },
    );
    expect(html).toContain("Couldn&#x27;t load this course&#x27;s study streak");
    expect(html).toContain("You can keep studying as usual.");
  });

  it("changes language in place when the provider locale changes", () => {
    const { switchLocale } = renderSwitchable(<EnrolledCourseOverview data={overviewData()} />, "vi");
    expect(screen.getByText("Không gian học tập")).toBeTruthy();
    switchLocale("en");
    expect(screen.getByText("Learning space")).toBeTruthy();
    expect(screen.queryByText("Không gian học tập")).toBeNull();
  });
});

describe("enrolled course overview feedback in English", () => {
  it("explains an unenrolled account with the course title kept as content", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverviewFeedback result={{ status: "unenrolled", course: { slug: "toeic-nen-tang", title: "TOEIC nền tảng" } }} />,
      { locale: "en" },
    );
    expect(html).toContain("COURSE ACCESS");
    expect(html).toContain("This account isn&#x27;t enrolled in the course");
    expect(html).toContain("You&#x27;re signed in but don&#x27;t have access to the course “");
    expect(html).toContain("TOEIC nền tảng");
    expect(html).toContain("”. See the course page");
    expect(html).toContain("View course details");
    expect(html).toContain("Back to the learning space");
    expect(html).toContain('role="status"');
  });

  it("shows the server-built error with English chrome and a retry button", () => {
    render(
      <EnrolledCourseOverviewFeedback
        result={{ status: "error", errorCode: "QUERY_FAILED", error: "Couldn't load the course overview right now. Please try again." }}
      />,
      { locale: "en" },
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("COULDN'T LOAD DATA")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Couldn't load the course overview" })).toBeTruthy();
    expect(screen.getByText("Couldn't load the course overview right now. Please try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the learning space" })).toBeTruthy();
  });

  it("labels the retry button in both languages", () => {
    const { unmount } = render(<EnrolledCourseOverviewRetryButton />, { locale: "en" });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    unmount();
    render(<EnrolledCourseOverviewRetryButton />, { locale: "vi" });
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
  });
});

describe("enrolled course overview loading in English", () => {
  it("labels the busy region in the active language", () => {
    expect(renderToStaticMarkup(<EnrolledCourseOverviewLoading />, { locale: "en" })).toContain('aria-label="Loading the course overview"');
    expect(renderToStaticMarkup(<EnrolledCourseOverviewLoading />, { locale: "vi" })).toContain('aria-label="Đang tải tổng quan khóa học"');
  });
});
