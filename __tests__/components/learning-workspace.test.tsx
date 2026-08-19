/**
 * @vitest-environment jsdom
 */

import React, { isValidElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { notFound, redirect, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import LearningWorkspacePage from "@/app/(client)/learn/[course-slug]/[topic-slug]/page";
import LearningWorkspaceLoading from "@/app/(client)/learn/[course-slug]/[topic-slug]/loading";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import LearningWorkspaceFeedback from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspaceFeedback";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: bảo vệ orchestration, state phân loại và quyền sở hữu URL/topic của C2 workspace.
// - Loại test: route/component render và interaction test qua action boundary mock.
// - Đối tượng: C2 page, workspace, feedback và loading.
// - Case thành công: exact topic, canonical links và remount theo route key.
// - Case thất bại: auth/not-found dùng framework flow; unavailable/unenrolled/error có route-local state.
// - Bảo mật/phân quyền: unavailable không lộ topic identity; unenrolled chỉ dùng public-safe course identity.
// - Ổn định/resilience: loading có accessible busy state; topic-local card state reset khi route đổi.
// - Invariant cần giữ: route params sở hữu topic; không fallback và không client content/history waterfall.
// - Kết quả verify gần nhất: post-review full C2 Vitest 46 files / 415 tests passed tại CP4.

vi.mock("@/app/actions/learning-workspace", () => ({
  getLearningWorkspace: vi.fn(),
}));

vi.mock("@/app/actions/progress", () => ({
  submitQuestionAnswer: vi.fn(),
  updateStageProgress: vi.fn(),
}));

vi.mock("@/app/actions/review", () => ({
  submitCardReview: vi.fn(),
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

const mockedGetWorkspace = vi.mocked(getLearningWorkspace);
const mockedNotFound = vi.mocked(notFound);
const mockedRedirect = vi.mocked(redirect);
const mockedUseRouter = vi.mocked(useRouter);

function workspaceData(
  overrides: Partial<LearningWorkspaceData> = {},
): LearningWorkspaceData {
  const chapterId = "11111111-1111-4111-8111-111111111111";
  const firstTopic = {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "topic-one",
    title: "Bài một",
    orderIndex: 1,
    chapterId,
  };
  const secondTopic = {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "topic-two",
    title: "Bài hai",
    orderIndex: 2,
    chapterId,
  };

  return {
    courseSlug: "toeic-foundation",
    courseTitle: "TOEIC Foundation",
    syllabus: [
      {
        id: chapterId,
        title: "Chương một",
        orderIndex: 1,
        topics: [firstTopic, secondTopic],
      },
    ],
    currentTopic: firstTopic,
    flashcards: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        front_content: { word: "trustworthy" },
        back_content: { translation: "đáng tin cậy" },
        audio_url: null,
        image_url: null,
      },
    ],
    exercises: [],
    answers: {},
    progress: null,
    ...overrides,
  };
}

function pageProps(courseSlug = "toeic-foundation", topicSlug = "topic-one") {
  return {
    params: Promise.resolve({
      "course-slug": courseSlug,
      "topic-slug": topicSlug,
    }),
  };
}

describe("C2 learning workspace route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  it("passes both raw route params to the trusted read and keys success by route", async () => {
    const data = workspaceData();
    mockedGetWorkspace.mockResolvedValue({ status: "success", data });

    const element = await LearningWorkspacePage(
      pageProps("  toeic-foundation  ", "  topic-one  "),
    );

    expect(mockedGetWorkspace).toHaveBeenCalledWith(
      "  toeic-foundation  ",
      "  topic-one  ",
    );
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(mockedNotFound).not.toHaveBeenCalled();
    expect(isValidElement(element)).toBe(true);
    expect(isValidElement(element) ? element.key : null).toBe(
      "toeic-foundation/topic-one",
    );
  });

  it("uses framework control flow only for auth and course not-found", async () => {
    mockedGetWorkspace.mockResolvedValueOnce({ status: "auth_required" });
    await expect(LearningWorkspacePage(pageProps())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mockedRedirect).toHaveBeenCalledWith("/login");

    mockedGetWorkspace.mockResolvedValueOnce({ status: "not_found" });
    await expect(LearningWorkspacePage(pageProps())).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mockedNotFound).toHaveBeenCalledOnce();
  });

  it("keeps inaccessible topic identity private and offers canonical recovery", () => {
    const html = renderToStaticMarkup(
      <LearningWorkspaceFeedback
        result={{
          status: "topic_unavailable",
          course: {
            slug: "toeic-foundation",
            title: "TOEIC Foundation",
          },
        }}
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Bài học này không khả dụng");
    expect(html).toContain('href="/learn/toeic-foundation"');
    expect(html).toContain('href="/learn"');
    expect(html).not.toContain("topic-secret");
  });

  it("separates unenrolled and recoverable error states", () => {
    const unenrolledHtml = renderToStaticMarkup(
      <LearningWorkspaceFeedback
        result={{
          status: "unenrolled",
          course: {
            slug: "toeic-foundation",
            title: "TOEIC Foundation",
          },
        }}
      />,
    );
    const errorHtml = renderToStaticMarkup(
      <LearningWorkspaceFeedback
        result={{
          status: "error",
          errorCode: "QUERY_FAILED",
          error: "Không thể tải bài học lúc này. Vui lòng thử lại.",
        }}
      />,
    );

    expect(unenrolledHtml).toContain('href="/courses/toeic-foundation"');
    expect(unenrolledHtml).not.toContain("Bài một");
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain(">Thử lại</button>");
  });

  it("resets topic-local card state when the route key changes", () => {
    const first = workspaceData();
    const second = workspaceData({
      currentTopic: workspaceData().syllabus[0].topics[1],
      flashcards: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          front_content: { word: "history" },
          back_content: { translation: "lịch sử" },
          audio_url: null,
          image_url: null,
        },
      ],
    });
    const { rerender } = render(
      <LearningWorkspace key="topic-one" data={first} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    expect(screen.getByText("Nghĩa: đáng tin cậy")).not.toBeNull();

    rerender(<LearningWorkspace key="topic-two" data={second} />);

    expect(screen.queryByText("Nghĩa: đáng tin cậy")).toBeNull();
    expect(screen.getByText("history")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Hiện đáp án" }),
    ).not.toBeNull();
  });

  it("keeps route-transition loading accessible", () => {
    const html = renderToStaticMarkup(<LearningWorkspaceLoading />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Đang tải bài học");
  });
});
