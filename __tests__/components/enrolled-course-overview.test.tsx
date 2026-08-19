import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { notFound, redirect, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEnrolledCourseOverview } from "@/app/actions/enrolled-course-overview";
import EnrolledCourseOverviewPage from "@/app/(client)/learn/[course-slug]/page";
import EnrolledCourseOverviewLoading from "@/app/(client)/learn/[course-slug]/loading";
import EnrolledCourseOverview from "@/app/(client)/learn/[course-slug]/_components/EnrolledCourseOverview";
import EnrolledCourseOverviewFeedback from "@/app/(client)/learn/[course-slug]/_components/EnrolledCourseOverviewFeedback";
import type { EnrolledCourseOverviewData } from "@/lib/schemas/enrolled-course-overview";

// Test plan:
// - Mục tiêu: bảo vệ route orchestration và các trạng thái nhìn thấy của C1 overview.
// - Loại test: component/route static render với action boundary mock.
// - Đối tượng: C1 page, overview, feedback và loading components.
// - Case thành công: not-started/in-progress/completed/no-content render CTA, progress và ordered path đúng.
// - Case thất bại: auth/not-found dùng framework flow; query error có persistent retry state.
// - Bảo mật/phân quyền: unenrolled chỉ thấy public-safe identity và exact public/learn CTA.
// - Ổn định/resilience: missing image, loading geometry và nested route boundary vẫn an toàn.
// - Invariant cần giữ: exact overview không auto-redirect sang public detail hoặc topic.
// - Kết quả verify gần nhất: 54/54 test passed bằng focused CP2 Vitest command.

vi.mock("@/app/actions/enrolled-course-overview", () => ({
  getEnrolledCourseOverview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  useRouter: vi.fn(),
}));

const mockedGetOverview = vi.mocked(getEnrolledCourseOverview);
const mockedNotFound = vi.mocked(notFound);
const mockedRedirect = vi.mocked(redirect);
const mockedUseRouter = vi.mocked(useRouter);

function overviewData(
  overrides: Partial<EnrolledCourseOverviewData> = {},
): EnrolledCourseOverviewData {
  return {
    courseSlug: "toeic-nen-tang",
    courseTitle: "TOEIC nền tảng",
    courseThumbnailUrl: null,
    totalTopicCount: 3,
    completedTopicCount: 1,
    progressPercentage: 33,
    status: "in-progress",
    nextTopic: {
      slug: "bai-2",
      title: "Bài 2",
      chapterTitle: "Chương 1",
    },
    lastTopic: {
      slug: "bai-3",
      title: "Bài 3",
      chapterTitle: "Chương 2",
    },
    chapters: [
      {
        id: "chapter-one",
        title: "Chương 1",
        topics: [
          {
            id: "topic-one",
            slug: "bai-1",
            title: "Bài 1",
            isCompleted: true,
          },
          {
            id: "topic-two",
            slug: "bai-2",
            title: "Bài 2",
            isCompleted: false,
          },
        ],
      },
      {
        id: "chapter-two",
        title: "Chương 2",
        topics: [
          {
            id: "topic-three",
            slug: "bai-3",
            title: "Bài 3",
            isCompleted: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function pageProps(courseSlug = "toeic-nen-tang") {
  return { params: Promise.resolve({ "course-slug": courseSlug }) };
}

describe("C1 enrolled course overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  it("renders in-progress hierarchy, progress and ordered topic states", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverview data={overviewData()} />,
    );

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("TOEIC nền tảng");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="33"');
    expect(html).toContain("1/3 chủ đề đã hoàn");
    expect(html).toContain('href="/learn/toeic-nen-tang/bai-2"');
    expect(html).toContain("Tiếp tục học");
    expect(html).toContain("Đã hoàn thành");
    expect(html).toContain("Học tiếp");
    const learningPathHtml = html.slice(html.indexOf("learning-path-title"));
    expect(learningPathHtml.indexOf("Bài 1")).toBeLessThan(
      learningPathHtml.indexOf("Bài 2"),
    );
    expect(learningPathHtml.indexOf("Bài 2")).toBeLessThan(
      learningPathHtml.indexOf("Bài 3"),
    );
  });

  it("renders a first-topic CTA for a not-started course", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverview
        data={overviewData({
          completedTopicCount: 0,
          progressPercentage: 0,
          status: "not-started",
          nextTopic: {
            slug: "bai-1",
            title: "Bài 1",
            chapterTitle: "Chương 1",
          },
          chapters: overviewData().chapters.map((chapter) => ({
            ...chapter,
            topics: chapter.topics.map((topic) => ({
              ...topic,
              isCompleted: false,
            })),
          })),
        })}
      />,
    );

    expect(html).toContain("Bắt đầu học");
    expect(html).toContain('href="/learn/toeic-nen-tang/bai-1"');
    expect(html).toContain('aria-valuenow="0"');
  });

  it("renders completed progress and a review CTA to the final topic", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverview
        data={overviewData({
          completedTopicCount: 3,
          progressPercentage: 100,
          status: "completed",
          nextTopic: null,
          chapters: overviewData().chapters.map((chapter) => ({
            ...chapter,
            topics: chapter.topics.map((topic) => ({
              ...topic,
              isCompleted: true,
            })),
          })),
        })}
      />,
    );

    expect(html).toContain("100%");
    expect(html).toContain("Xem lại bài học cuối");
    expect(html).toContain('href="/learn/toeic-nen-tang/bai-3"');
    expect(html).not.toContain("Học tiếp");
  });

  it("renders a no-content state without fake progress or topic links", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverview
        data={overviewData({
          totalTopicCount: 0,
          completedTopicCount: 0,
          progressPercentage: null,
          status: "no-content",
          nextTopic: null,
          lastTopic: null,
          chapters: [],
        })}
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Khóa học chưa có nội dung để bắt đầu");
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toMatch(/href="\/learn\/toeic-nen-tang\//);
    expect(html).toContain('href="/learn"');
  });

  it("keeps an unenrolled learner on a public-safe access state", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverviewFeedback
        result={{
          status: "unenrolled",
          course: { slug: "toeic-nen-tang", title: "TOEIC nền tảng" },
        }}
      />,
    );

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('role="status"');
    expect(html).toContain("Tài khoản này chưa đăng ký khóa học");
    expect(html).toContain('href="/courses/toeic-nen-tang"');
    expect(html).toContain('href="/learn"');
    expect(html.indexOf('href="/courses/toeic-nen-tang"')).toBeLessThan(
      html.indexOf('href="/learn"'),
    );
    expect(html).not.toContain("Bài 1");
    expect(html).not.toContain("Tiến độ");
  });

  it("renders a recoverable error distinct from access and not-found states", () => {
    const html = renderToStaticMarkup(
      <EnrolledCourseOverviewFeedback
        result={{
          status: "error",
          errorCode: "QUERY_FAILED",
          error: "Không thể tải tổng quan khóa học lúc này. Vui lòng thử lại.",
        }}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Chưa thể tải tổng quan khóa học");
    expect(html).toContain(">Thử lại</button>");
    expect(html).not.toContain("chưa đăng ký khóa học");
  });

  it("orchestrates success without redirecting away from the overview", async () => {
    mockedGetOverview.mockResolvedValue({
      status: "success",
      data: overviewData(),
    });

    const html = renderToStaticMarkup(
      await EnrolledCourseOverviewPage(pageProps("  toeic-nen-tang  ")),
    );

    expect(mockedGetOverview).toHaveBeenCalledWith("  toeic-nen-tang  ");
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(mockedNotFound).not.toHaveBeenCalled();
    expect(html).toContain("TOEIC nền tảng");
  });

  it("uses framework control flow only for auth and not-found", async () => {
    mockedGetOverview.mockResolvedValueOnce({ status: "auth_required" });
    await expect(EnrolledCourseOverviewPage(pageProps())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mockedRedirect).toHaveBeenCalledWith("/login");

    mockedGetOverview.mockResolvedValueOnce({ status: "not_found" });
    await expect(EnrolledCourseOverviewPage(pageProps())).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mockedNotFound).toHaveBeenCalledOnce();
  });

  it("keeps loading geometry accessible and preserves the nested route file", () => {
    const html = renderToStaticMarkup(<EnrolledCourseOverviewLoading />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Đang tải tổng quan khóa học");
    expect(html).not.toContain("<main");
    expect(
      existsSync(
        join(
          process.cwd(),
          "app/(client)/learn/[course-slug]/[topic-slug]/page.tsx",
        ),
      ),
    ).toBe(true);

    const pageSource = readFileSync(
      join(process.cwd(), "app/(client)/learn/[course-slug]/page.tsx"),
      "utf8",
    );
    expect(pageSource).not.toContain("getPublicCourseDetailPath");
    expect(pageSource).not.toContain("permanentRedirect");
  });
});
