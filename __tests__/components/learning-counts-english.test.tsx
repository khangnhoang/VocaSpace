// @vitest-environment jsdom
import React from "react";
import { useTranslations } from "next-intl";
import { cleanup, fireEvent, render, screen, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "next/navigation";
import { RecentTopicsList } from "@/components/learning-activity/CourseLearningActivity";
import CoursePagination from "@/app/(client)/learn/_components/CoursePagination";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import { asTranslate } from "@/lib/i18n/translate";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: English localization U3 (AC6, G1) - ba số đếm của màn hình học hiện phân tách nghìn ở en và giữ chữ số trần ở vi:
//   "N ngày trước" của thẻ hoạt động, nhãn nhóm "Nhóm N/M" của danh sách câu hỏi và số trang của CoursePagination (chữ hiển thị và tên truy cập).
// - Loại test: component render với provider next-intl và catalog thật; action/router/toast thay tại ranh giới.
// - Case chính: giá trị 1234 ở cả hai ngôn ngữ; vi phải bằng đúng đầu ra trước U3.
// - Giới hạn: định dạng các số khác của workspace do learning-workspace-english.test.tsx giữ.

vi.mock("@/app/actions/progress", () => ({ submitQuestionAnswer: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockedUseRouter = vi.mocked(useRouter);

beforeEach(() => {
  mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
});

afterEach(() => cleanup());

function RecentTopics({ daysAgo }: { daysAgo: number }) {
  const t = asTranslate(useTranslations("learning"));
  return (
    <RecentTopicsList
      courseSlug="toeic"
      t={t}
      topics={[{ topicId: "d0d0d0d0-0000-4000-8000-000000000001", slug: "bai-1", title: "Bài 1", lastActivityAt: "2026-03-10T01:00:00+00:00", daysAgo }]}
    />
  );
}

describe("relative day in the recent topics list", () => {
  it("groups thousands in English and keeps bare digits in Vietnamese", () => {
    render(<RecentTopics daysAgo={1234} />, { locale: "en" });
    expect(screen.getByText("1,234 days ago")).toBeTruthy();
    cleanup();
    render(<RecentTopics daysAgo={1234} />, { locale: "vi" });
    expect(screen.getByText("1234 ngày trước")).toBeTruthy();
  });
});

describe("course pagination page numbers", () => {
  const pagination = () => (
    <CoursePagination currentPage={1233} itemLabel="courses" onPageChange={() => {}} pageSize={1} totalItems={1234} />
  );

  it("formats the visible page and its accessible name in English", () => {
    render(pagination(), { locale: "en" });
    expect(screen.getByRole("button", { name: "Page 1,233" }).textContent).toBe("1,233");
    expect(screen.getByRole("button", { name: "Page 1,234" }).textContent).toBe("1,234");
  });

  it("keeps bare digits in Vietnamese", () => {
    render(pagination(), { locale: "vi" });
    expect(screen.getByRole("button", { name: "Trang 1233" }).textContent).toBe("1233");
    expect(screen.getByRole("button", { name: "Trang 1234" }).textContent).toBe("1234");
  });
});

describe("exercise group label in the question list", () => {
  const groups = Array.from({ length: 1234 }, (_, index) => {
    const n = String(index + 1).padStart(4, "0");
    return {
      id: `b0000000-0000-4000-8000-00000000${n}`,
      order_index: index + 1,
      passage_text: null,
      audio_url: null,
      image_url: null,
      questions: [
        {
          id: `c0000000-0000-4000-8000-00000000${n}`,
          content: `Câu ${n}`,
          explanation: null,
          order_index: 1,
          options: [1, 2].map((order) => ({
            id: `c1000000-0000-4000-8000-0000000${order}${n}`,
            content: `Lựa chọn ${order}`,
            label: String.fromCharCode(64 + order),
            order_index: order,
          })),
        },
      ],
    };
  });

  function workspaceData(): LearningWorkspaceData {
    const topic = {
      id: "22222222-2222-4222-8222-222222222222",
      slug: "topic-one",
      title: "Bài một",
      orderIndex: 1,
      chapterId: "11111111-1111-4111-8111-111111111111",
    };
    return {
      courseId: "c0c0c0c0-0000-4000-8000-000000000001",
      courseSlug: "toeic-foundation",
      courseTitle: "TOEIC Foundation",
      syllabus: [{ id: topic.chapterId, title: "Chương một", orderIndex: 1, topics: [{ ...topic, isCompleted: false }] }],
      currentTopic: topic,
      flashcards: [],
      exercises: [{ id: "a0000000-0000-4000-8000-000000000001", title: "Bài tập", part_type: "part5", order_index: 1, questions: [], groups }],
      memoryCheck: null,
      isMemoryCheckPassed: true,
      unseenCardIds: [],
      unratedCardIds: [],
      memoryGateClearedCardIds: null,
      dueCardIds: [],
      answers: {},
      progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
    } as unknown as LearningWorkspaceData;
  }

  const openList = (name: RegExp) => {
    fireEvent.click(screen.getByRole("button", { name }));
    return within(screen.getByRole("dialog"));
  };

  it("groups thousands of the group number and total in English", () => {
    render(<LearningWorkspace data={workspaceData()} />, { locale: "en" });
    const dialog = openList(/Question list/);
    expect(dialog.getByText("Group 1/1,234")).toBeTruthy();
    expect(dialog.getByText("Group 1,234/1,234")).toBeTruthy();
    expect(dialog.queryByText("Group 1234/1234")).toBeNull();
  });

  it("keeps bare digits in Vietnamese", () => {
    render(<LearningWorkspace data={workspaceData()} />, { locale: "vi" });
    const dialog = openList(/Danh sách câu hỏi/);
    expect(dialog.getByText("Nhóm 1234/1234")).toBeTruthy();
  });
});
