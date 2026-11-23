import React from "react";
import { renderToStaticMarkup } from "@/__tests__/support/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEnrolledCourseOverview } from "@/app/actions/enrolled-course-overview";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import EnrolledCourseOverviewPage from "@/app/(client)/learn/[course-slug]/page";
import LearningWorkspacePage from "@/app/(client)/learn/[course-slug]/[topic-slug]/page";
import type { EnrolledCourseOverviewData } from "@/lib/schemas/enrolled-course-overview";

// Test plan:
// - Mục tiêu: FEAT3 AC6/AC7/AC10 - trang tổng quan khóa và trang workspace đọc chuỗi ngày học riêng, truyền xuống đúng, và khi đọc lỗi
//   vẫn render đầy đủ; tổng quan "no-content" không hiện khối.
// - Loại test: route orchestration với action boundary mock; thành phần nặng (workspace) được thay bằng stub ghi lại prop.
// - Đối tượng: EnrolledCourseOverviewPage (+ EnrolledCourseOverview), LearningWorkspacePage.
// - Case thành công: tổng quan hiện khối chuỗi + chủ đề gần đây; workspace nhận đúng kết quả đọc theo `courseId` của dữ liệu.
// - Case thất bại: đọc chuỗi lỗi -> tổng quan vẫn render đủ kèm trạng thái "chưa tải được"; workspace vẫn được render với kết quả lỗi.
// - Bảo mật/phân quyền: không đọc chuỗi khi overview/workspace không thành công (feedback, auth, not found).
// - Invariant cần giữ: dữ liệu chuỗi đi qua prop riêng `learningSummary`, không nằm trong dữ liệu overview/workspace.
// - Kết quả verify gần nhất: xem milestone FEAT3 CP2 trong progress.md.

vi.mock("@/app/actions/enrolled-course-overview", () => ({ getEnrolledCourseOverview: vi.fn() }));
vi.mock("@/app/actions/learning-workspace", () => ({ getLearningWorkspace: vi.fn() }));
vi.mock("@/app/actions/learning-activity", () => ({ getCourseLearningSummary: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace", () => ({
  default: ({ data, learningSummary }: { data: { courseId: string }; learningSummary: unknown }) => (
    <div data-testid="workspace" data-course-id={data.courseId} data-summary={JSON.stringify(learningSummary)} />
  ),
}));

const mockedOverview = vi.mocked(getEnrolledCourseOverview);
const mockedWorkspace = vi.mocked(getLearningWorkspace);
const mockedSummary = vi.mocked(getCourseLearningSummary);
const COURSE_ID = "c0c0c0c0-0000-4000-8000-000000000001";

function overview(overrides: Partial<EnrolledCourseOverviewData> = {}): EnrolledCourseOverviewData {
  return {
    courseId: COURSE_ID,
    courseSlug: "toeic-nen-tang",
    courseTitle: "TOEIC nền tảng",
    courseThumbnailUrl: null,
    totalTopicCount: 2,
    completedTopicCount: 1,
    progressPercentage: 50,
    status: "in-progress",
    nextTopic: { slug: "bai-2", title: "Bài 2", chapterTitle: "Chương 1" },
    lastTopic: { slug: "bai-1", title: "Bài 1", chapterTitle: "Chương 1" },
    chapters: [
      {
        id: "chapter-one",
        title: "Chương 1",
        topics: [
          { id: "topic-one", slug: "bai-1", title: "Bài 1", isCompleted: true },
          { id: "topic-two", slug: "bai-2", title: "Bài 2", isCompleted: false },
        ],
      },
    ],
    ...overrides,
  };
}

const summarySuccess = {
  success: true as const,
  data: {
    streak: 4,
    studiedToday: false,
    recentTopics: [
      { topicId: "d0d0d0d0-0000-4000-8000-000000000001", slug: "bai-1", title: "Bài 1", lastActivityAt: "2026-03-10T01:00:00+00:00", daysAgo: 1 },
    ],
  },
};

async function renderOverview() {
  return renderToStaticMarkup(await EnrolledCourseOverviewPage({ params: Promise.resolve({ "course-slug": "toeic-nen-tang" }) }));
}

describe("FEAT3 on /learn/[course-slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the course streak and recent topics, read by the overview course id", async () => {
    mockedOverview.mockResolvedValue({ status: "success", data: overview() });
    mockedSummary.mockResolvedValue(summarySuccess);

    const html = await renderOverview();

    expect(mockedSummary).toHaveBeenCalledExactlyOnceWith(COURSE_ID);
    expect(html).toContain("Chuỗi 4 ngày học khóa này");
    expect(html).toContain('href="/learn/toeic-nen-tang/bai-1"');
    expect(html).toContain("Hôm qua");
  });

  it("still renders the whole overview with a quiet unavailable state when the summary cannot be read", async () => {
    mockedOverview.mockResolvedValue({ status: "success", data: overview() });
    mockedSummary.mockResolvedValue({ success: false, error: "x" });

    const html = await renderOverview();

    expect(html).toContain("TOEIC nền tảng");
    expect(html).toContain("Chưa tải được chuỗi ngày học của khóa này");
    expect(html).not.toContain('role="alert"');
  });

  it("hides the block for a course with no learnable content", async () => {
    mockedOverview.mockResolvedValue({
      status: "success",
      data: overview({ status: "no-content", totalTopicCount: 0, completedTopicCount: 0, progressPercentage: 0, nextTopic: null, lastTopic: null, chapters: [] }),
    });
    mockedSummary.mockResolvedValue(summarySuccess);

    const html = await renderOverview();

    expect(html).not.toContain("ngày học khóa này");
    expect(html).not.toContain("HỌC GẦN ĐÂY");
  });

  it("does not read the summary when the overview is not a success", async () => {
    mockedOverview.mockResolvedValue({ status: "error", error: "internal" } as never);

    await renderOverview();

    expect(mockedSummary).not.toHaveBeenCalled();
  });
});

describe("FEAT3 on the learning workspace page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = Promise.resolve({ "course-slug": "toeic-nen-tang", "topic-slug": "bai-1" });

  it("passes the course summary read by the workspace course id to the workspace, including an unavailable one", async () => {
    mockedWorkspace.mockResolvedValue({
      status: "success",
      data: {
        courseId: COURSE_ID,
        courseSlug: "toeic-nen-tang",
        currentTopic: { slug: "bai-1" },
        flashcards: [],
        unseenCardIds: [],
        unratedCardIds: [],
        dueCardIds: [],
      },
    } as never);

    mockedSummary.mockResolvedValueOnce(summarySuccess);
    let html = renderToStaticMarkup(await LearningWorkspacePage({ params }));
    expect(mockedSummary).toHaveBeenCalledExactlyOnceWith(COURSE_ID);
    expect(html).toContain(`data-course-id="${COURSE_ID}"`);
    expect(html).toContain("&quot;streak&quot;:4");

    mockedSummary.mockResolvedValueOnce({ success: false, error: "x" });
    html = renderToStaticMarkup(await LearningWorkspacePage({ params }));
    expect(html).toContain("&quot;success&quot;:false");
  });

  it("does not read the summary when the workspace is not a success", async () => {
    mockedWorkspace.mockResolvedValue({ status: "error", error: "internal" } as never);

    await LearningWorkspacePage({ params });

    expect(mockedSummary).not.toHaveBeenCalled();
  });
});
