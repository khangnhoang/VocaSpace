/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import QuestionNavigator, {
  type QuestionNavigatorSection,
} from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/QuestionNavigator";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: bảo vệ bộ điều hướng câu hỏi "Xem lại câu hỏi" và các thay đổi trạng thái phản hồi của vùng trả lời (D8-LUI follow-up 3).
// - Loại test: component test trong jsdom; Server Action được mock ở ranh giới, không gọi server thật.
// - Danh sách: nhóm theo bài tập/nhóm ngữ liệu; mỗi dòng có số, nội dung rút gọn và trạng thái bằng biểu tượng cùng chữ (đang xem, đã đúng, chưa đúng, chưa trả lời), không chỉ màu.
// - Nhảy câu: chọn dòng đóng danh sách, đưa focus vào tiêu đề câu đó, giữ nguyên ngữ liệu khi cùng nhóm, đổi ngữ liệu khi sang nhóm khác; dòng bị khóa là nút vô hiệu kèm lý do và không gọi onSelect.
// - Màn hình rộng dùng Popover, màn hình hẹp dùng Sheet; cả hai dùng chung một danh sách.
// - Không còn hộp "Bạn đã trả lời đúng câu này"/"Chính xác!" hiển thị: trạng thái đúng nằm ở lựa chọn xanh, phần giải thích (nếu có) hiện tại chỗ, thông báo cho trình đọc màn hình vẫn có.
// - "Câu tiếp theo"/"Câu sau" chỉ hiện khi còn câu sau; câu cuối đã đúng đưa tới "Làm câu còn thiếu" hoặc "Hoàn thành bài tập"; màn hình hoàn thành có "Xem lại câu hỏi" thay cho "Xem lại câu cuối".
// - Phân quyền: bài tập đang khóa sau memory check không có nút điều hướng; trong Preview chỉ dùng state cục bộ (xem public-course-preview.test.tsx).
// - Kết quả verify gần nhất: xem báo cáo checkpoint D8-LUI follow-up 3 (chạy `npx vitest run __tests__/components/question-navigator.test.tsx`).

vi.mock("@/app/actions/progress", () => ({
  submitQuestionAnswer: vi.fn(),
}));

vi.mock("@/app/actions/review", () => ({
  submitCardReview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedSubmit = vi.mocked(submitQuestionAnswer);
const mockedUseRouter = vi.mocked(useRouter);

const ids = {
  exerciseA: "a0000000-0000-4000-8000-000000000001",
  exerciseB: "a0000000-0000-4000-8000-000000000002",
  groupA: "b0000000-0000-4000-8000-000000000001",
  groupB: "b0000000-0000-4000-8000-000000000002",
  standalone: "c0000000-0000-4000-8000-000000000001",
  groupedA: "c0000000-0000-4000-8000-000000000002",
  groupedB1: "c0000000-0000-4000-8000-000000000003",
  groupedB2: "c0000000-0000-4000-8000-000000000004",
  memory: "d0000000-0000-4000-8000-000000000001",
  memoryQuestion: "d0000000-0000-4000-8000-000000000002",
};
const right = (questionId: string) => `${questionId.slice(0, 35)}a`;
const wrong = (questionId: string) => `${questionId.slice(0, 35)}b`;

function question(id: string, content: string, order = 1) {
  return {
    id,
    content,
    explanation: null,
    order_index: order,
    options: [
      { id: right(id), content: `Đúng ${content}`, label: "A", order_index: 1 },
      { id: wrong(id), content: `Sai ${content}`, label: "B", order_index: 2 },
    ],
  };
}

const exerciseA = {
  id: ids.exerciseA,
  title: "Bài tập A",
  part_type: "part_5",
  order_index: 1,
  questions: [question(ids.standalone, "Câu đơn")],
  groups: [
    {
      id: ids.groupA,
      passage_text: "Đoạn văn A",
      order_index: 1,
      questions: [question(ids.groupedA, "Câu nhóm A")],
    },
  ],
};
const exerciseB = {
  id: ids.exerciseB,
  title: "Bài tập B",
  part_type: "part_6",
  order_index: 2,
  questions: [],
  groups: [
    {
      id: ids.groupB,
      passage_text: "Đoạn văn B",
      order_index: 1,
      questions: [
        question(ids.groupedB1, "Câu B một", 1),
        question(ids.groupedB2, "Câu B hai", 2),
      ],
    },
  ],
};

function workspaceData(overrides: Partial<LearningWorkspaceData> = {}): LearningWorkspaceData {
  const topic = {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "topic-one",
    title: "Bài một",
    orderIndex: 1,
    chapterId: "11111111-1111-4111-8111-111111111111",
  };
  return {
    courseSlug: "toeic-foundation",
    courseTitle: "TOEIC Foundation",
    syllabus: [
      { id: topic.chapterId, title: "Chương một", orderIndex: 1, topics: [{ ...topic, isCompleted: false }] },
    ],
    currentTopic: topic,
    flashcards: [],
    exercises: [exerciseA, exerciseB],
    memoryCheck: null,
    isMemoryCheckPassed: true,
    answers: {},
    progress: null,
    ...overrides,
  };
}

async function submitExerciseAnswer(optionContent: string) {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(optionContent) }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
  });
}

const openNavigator = () => fireEvent.click(screen.getByRole("button", { name: "Xem lại câu hỏi" }));
const rowOf = (text: RegExp) => screen.getByRole("button", { name: text });

describe("QuestionNavigator list", () => {
  const sections: QuestionNavigatorSection[] = [
    {
      id: "s1",
      title: "Bài tập A",
      groups: [
        {
          id: "g0",
          items: [
            { id: "q1", number: 1, text: "Câu một", status: "correct", current: false },
            { id: "q2", number: 2, text: "Câu hai", status: "incorrect", current: true },
          ],
        },
        {
          id: "g1",
          label: "Nhóm 1/1",
          items: [{ id: "q3", number: 3, text: "Câu ba", status: "unanswered", current: false }],
        },
      ],
    },
  ];

  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it("groups the questions and states each state in words, with the current one marked", () => {
    render(<QuestionNavigator sections={sections} onSelect={() => {}} />);
    openNavigator();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Bài tập A" })).not.toBeNull();
    expect(within(dialog).getByText("Nhóm 1/1")).not.toBeNull();
    expect(within(dialog).getByText("Đã trả lời đúng 1/3 câu")).not.toBeNull();

    expect(rowOf(/Câu 1: Câu một\s*Đã trả lời đúng/)).not.toBeNull();
    const current = rowOf(/Câu 2: Câu hai\s*Đang xem · Trả lời chưa đúng/);
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(rowOf(/Câu 3: Câu ba\s*Chưa trả lời/).getAttribute("aria-current")).toBeNull();
  });

  it("reports a pick and closes; a locked row is disabled with the reason and never reports", () => {
    const onSelect = vi.fn();
    const locked: QuestionNavigatorSection[] = [
      {
        id: "s1",
        title: "Bài tập A",
        groups: [
          {
            id: "g0",
            items: [
              { id: "q1", number: 1, text: "Câu một", status: "unanswered", current: false },
              {
                id: "q2",
                number: 2,
                text: "Câu hai",
                status: "unanswered",
                current: false,
                disabledReason: "Trả lời đúng hết memory check để mở khóa phần bài tập.",
              },
            ],
          },
        ],
      },
    ];
    render(<QuestionNavigator sections={locked} onSelect={onSelect} />);
    openNavigator();

    const lockedRow = rowOf(/Câu 2: Câu hai\s*Đang khóa/);
    expect(lockedRow.hasAttribute("disabled")).toBe(true);
    expect(
      within(screen.getByRole("dialog")).getByText(
        "Trả lời đúng hết memory check để mở khóa phần bài tập.",
      ),
    ).not.toBeNull();
    fireEvent.click(lockedRow);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(rowOf(/Câu 1: Câu một/));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("q1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens as a popover on wide screens and shows the same list", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const onSelect = vi.fn();
    render(<QuestionNavigator sections={sections} onSelect={onSelect} />);
    openNavigator();

    const popover = screen.getByRole("dialog", { name: "Câu hỏi của bài tập" });
    expect(popover.getAttribute("data-slot")).toBe("popover-content");
    fireEvent.click(within(popover).getByRole("button", { name: /Câu 3: Câu ba/ }));
    expect(onSelect).toHaveBeenCalledWith("q3");
  });
});

describe("question navigator in the learning workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  it("shows the answered, wrong and untouched questions and jumps to one, moving focus to its heading", async () => {
    render(<LearningWorkspace data={workspaceData({ answers: { [ids.groupedA]: right(ids.groupedA) } })} />);
    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: false, explanation: "Xem lại." });
    await submitExerciseAnswer("Sai Câu đơn");

    openNavigator();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Bài tập A" })).not.toBeNull();
    expect(within(dialog).getByRole("heading", { name: "Bài tập B" })).not.toBeNull();
    // Each exercise numbers its own passage groups.
    expect(within(dialog).getAllByText("Nhóm 1/1")).toHaveLength(2);
    // Numbered across the whole topic, not per group.
    expect(rowOf(/Câu 1: Câu đơn\s*Đang xem · Trả lời chưa đúng/)).not.toBeNull();
    expect(rowOf(/Câu 2: Câu nhóm A\s*Đã trả lời đúng/)).not.toBeNull();
    expect(rowOf(/Câu 3: Câu B một\s*Chưa trả lời/)).not.toBeNull();

    fireEvent.click(rowOf(/Câu 4: Câu B hai/));
    expect(screen.queryByRole("dialog")).toBeNull();
    const heading = screen.getByRole("heading", { name: "Câu B hai" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("Đoạn văn B")).not.toBeNull();
    expect(screen.getByText("Câu hỏi 4/4")).not.toBeNull();
  });

  it("keeps the material in place when the jump stays inside the same group", () => {
    render(<LearningWorkspace data={workspaceData()} />);
    openNavigator();
    fireEvent.click(rowOf(/Câu 3: Câu B một/));
    const passage = screen.getByText("Đoạn văn B");

    openNavigator();
    fireEvent.click(rowOf(/Câu 4: Câu B hai/));
    expect(screen.getByText("Đoạn văn B")).toBe(passage);

    // Another group replaces the material.
    openNavigator();
    fireEvent.click(rowOf(/Câu 2: Câu nhóm A/));
    expect(screen.queryByText("Đoạn văn B")).toBeNull();
    expect(screen.getByText("Đoạn văn A")).not.toBeNull();
  });

  it("updates a wrong question to answered once it is retried right", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: false, explanation: "Xem lại." });
    await submitExerciseAnswer("Sai Câu đơn");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true });
    await submitExerciseAnswer("Đúng Câu đơn");

    openNavigator();
    expect(rowOf(/Câu 1: Câu đơn\s*Đang xem · Đã trả lời đúng/)).not.toBeNull();
  });

  it("does not offer the navigator while the exercises are locked behind the memory check", () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          isMemoryCheckPassed: false,
          memoryCheck: { id: ids.memory, questions: [question(ids.memoryQuestion, "Câu nhớ")] },
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tới Bài tập" }));

    expect(screen.getByText("Bài tập đang khóa")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Xem lại câu hỏi" })).toBeNull();
    expect(screen.queryByText("Câu đơn")).toBeNull();
  });

  it("drops the redundant correct box but keeps the green option, a live announcement and any explanation", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      explanation: "Vì sao câu này đúng.",
    });
    await submitExerciseAnswer("Đúng Câu đơn");

    expect(screen.getByRole("radio", { name: /bạn chọn đúng/ })).not.toBeNull();
    const announcement = screen.getByText("Chính xác!");
    expect(announcement.className).toContain("sr-only");
    expect(screen.getByText("Vì sao câu này đúng.")).not.toBeNull();
    expect(screen.queryByText("Bạn đã trả lời đúng câu này")).toBeNull();
  });

  it("shows a revisited right answer with no state box or announcement at all", () => {
    render(<LearningWorkspace data={workspaceData({ answers: { [ids.standalone]: right(ids.standalone) } })} />);

    expect(screen.getByRole("radio", { name: /bạn chọn đúng/ })).not.toBeNull();
    expect(screen.queryByText("Bạn đã trả lời đúng câu này")).toBeNull();
    expect(screen.queryByText("Chính xác!")).toBeNull();
    // The saved radio does not carry the motion marker: it was not validated in this view.
    expect(screen.getByRole("radio", { name: /bạn chọn đúng/ }).getAttribute("data-motion")).toBeNull();
  });

  it("marks a fresh wrong answer for the nudge once, and clears it on retry", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: false, explanation: "Xem lại." });
    await submitExerciseAnswer("Sai Câu đơn");

    expect(screen.getByRole("radio", { name: /bạn chọn chưa đúng/ }).getAttribute("data-motion")).toBe(
      "corrective",
    );
    expect(screen.getByText("Xem lại.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      screen.getAllByRole("radio").every((radio) => radio.getAttribute("data-motion") === null),
    ).toBe(true);
  });

  it("offers a next question only while one exists and finishes from the last one", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          answers: {
            [ids.standalone]: right(ids.standalone),
            [ids.groupedA]: right(ids.groupedA),
            [ids.groupedB1]: right(ids.groupedB1),
          },
        })}
      />,
    );
    // First question is answered: "Câu tiếp theo" leads on.
    expect(screen.getByRole("button", { name: "Câu tiếp theo" })).not.toBeNull();

    openNavigator();
    fireEvent.click(rowOf(/Câu 4: Câu B hai/));
    // The last question has no next and no skip link.
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Câu sau" })).toBeNull();

    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true });
    await submitExerciseAnswer("Đúng Câu B hai");
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành bài tập" }));
    expect(screen.getByRole("status").textContent).toBe("Bạn đã trả lời đúng hết bài tập.");
    expect(screen.queryByRole("button", { name: "Xem lại câu cuối" })).toBeNull();

    // The completion view reviews through the same list and jumps back into a question.
    openNavigator();
    expect(screen.queryByRole("button", { name: /Đang xem/ })).toBeNull();
    fireEvent.click(rowOf(/Câu 1: Câu đơn/));
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Câu đơn" }));
  });
});
