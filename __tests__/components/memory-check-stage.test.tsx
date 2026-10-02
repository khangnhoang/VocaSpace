/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: bảo vệ stage memory check D3 (H6) trong learning workspace.
// - Loại test: component interaction test qua action boundary mock.
// - Case thành công: câu sai quay lại cuối hàng; hết hàng (server báo đã qua) thì mở bài tập.
// - Case thất bại: lỗi server giữ câu và lựa chọn hiện tại; MEMORY_CHECK_REQUIRED đưa về memory check.
// - Ổn định/resilience: hàng đợi sau khi tải lại dựng từ map `answers` server trả (option đổi/xóa thì câu quay lại hàng).
// - Invariant cần giữ: bài tập khóa kèm lý do + CTA tới khi qua; topic không có memory check giữ flow cũ.
// - Kết quả verify gần nhất: xem plan D3 §10.

vi.mock("@/app/actions/progress", () => ({
  submitQuestionAnswer: vi.fn(),
  updateStageProgress: vi.fn(),
}));

vi.mock("@/app/actions/review", () => ({
  submitCardReview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

const mockedSubmit = vi.mocked(submitQuestionAnswer);
const mockedUseRouter = vi.mocked(useRouter);

const ids = {
  memory: "66666666-6666-4666-8666-666666666666",
  first: "66666666-6666-4666-8666-666666666601",
  second: "66666666-6666-4666-8666-666666666602",
  exercise: "77777777-7777-4777-8777-777777777777",
  group: "77777777-7777-4777-8777-777777777701",
  exerciseQuestion: "77777777-7777-4777-8777-777777777702",
  exerciseOption: "77777777-7777-4777-8777-777777777703",
};
const rightOption = (order: number) => `aaaaaaaa-0000-4000-8000-00000000000${order}`;
const wrongOption = (order: number) => `bbbbbbbb-0000-4000-8000-00000000000${order}`;

function memoryQuestion(id: string, order: number) {
  return {
    id,
    content: `Câu nhớ ${order}`,
    explanation: `Giải thích ${order}`,
    order_index: order,
    options: [
      { id: rightOption(order), content: `Đúng ${order}`, label: "A", order_index: 1 },
      { id: wrongOption(order), content: `Sai ${order}`, label: "B", order_index: 2 },
    ],
  };
}

function workspaceData(
  overrides: Partial<LearningWorkspaceData> = {},
): LearningWorkspaceData {
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
      { id: topic.chapterId, title: "Chương một", orderIndex: 1, topics: [topic] },
    ],
    currentTopic: topic,
    flashcards: [],
    exercises: [
      {
        id: ids.exercise,
        title: "Bài tập Part 5",
        part_type: "part_5",
        order_index: 1,
        groups: [
          {
            id: ids.group,
            passage_text: null,
            order_index: 1,
            questions: [
              {
                id: ids.exerciseQuestion,
                content: "Câu bài tập",
                explanation: null,
                order_index: 1,
                options: [{ id: ids.exerciseOption, content: "Lựa chọn", label: "A", order_index: 1 }],
              },
            ],
          },
        ],
      },
    ],
    memoryCheck: {
      id: ids.memory,
      questions: [memoryQuestion(ids.first, 1), memoryQuestion(ids.second, 2)],
    },
    isMemoryCheckPassed: false,
    answers: {},
    progress: null,
    ...overrides,
  };
}

async function answer(optionName: string) {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(optionName) }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
  });
}

function questionHeading() {
  return screen.getByRole("heading", { level: 2 }).textContent;
}

describe("D3 memory check stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  it("starts at the memory check when the topic has no cards and requeues a wrong answer", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    expect(questionHeading()).toBe("Câu nhớ 1");
    expect(screen.getByText("Đã đúng 0/2")).not.toBeNull();

    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: false,
      explanation: "Giải thích 1",
      isMemoryCheckPassed: false,
    });
    await answer("Sai 1");

    expect(mockedSubmit).toHaveBeenCalledWith(ids.first, wrongOption(1));
    expect(screen.getByText("Chưa chính xác")).not.toBeNull();
    expect(screen.getByText("Giải thích 1")).not.toBeNull();
    expect(screen.getByText("Câu này sẽ quay lại sau các câu còn lại.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(questionHeading()).toBe("Câu nhớ 2");

    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, isMemoryCheckPassed: false });
    await answer("Đúng 2");
    expect(screen.getByText("Chính xác!")).not.toBeNull();
    expect(screen.getByText("Đã đúng 1/2")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(questionHeading()).toBe("Câu nhớ 1");
  });

  it("rebuilds the queue from server answers after reload", () => {
    // Câu 1 có option đã chọn bị đổi/xóa nên server không đưa vào `answers`.
    render(
      <LearningWorkspace
        data={workspaceData({ answers: { [ids.second]: rightOption(2) } })}
      />,
    );
    expect(questionHeading()).toBe("Câu nhớ 1");
    expect(screen.getByText("Đã đúng 1/2")).not.toBeNull();
  });

  it("unlocks exercises once the server reports the memory check passed", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({ answers: { [ids.first]: rightOption(1) } })}
      />,
    );
    expect(questionHeading()).toBe("Câu nhớ 2");

    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, isMemoryCheckPassed: true });
    await answer("Đúng 2");
    fireEvent.click(screen.getByRole("button", { name: "Mở bài tập" }));

    expect(screen.getByText("Bài tập Part 5")).not.toBeNull();
    expect(screen.getByText("Câu bài tập")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Về Memory check/ })).not.toBeNull();
  });

  it("keeps the current question and choice on a server error and blocks double submit", async () => {
    render(<LearningWorkspace data={workspaceData()} />);

    let resolveSubmit: (value: { error: string }) => void = () => {};
    mockedSubmit.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }) as never,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Đúng 1/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
    });

    const pendingButton = screen.getByRole("button", { name: "Đang kiểm tra..." });
    expect(pendingButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(pendingButton);
    expect(mockedSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit({ error: "Không thể lưu đáp án lúc này." });
    });

    expect(screen.getByRole("alert").textContent).toBe("Không thể lưu đáp án lúc này.");
    expect(questionHeading()).toBe("Câu nhớ 1");
    expect(
      screen.getByRole("radio", { name: /Đúng 1/ }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Kiểm tra đáp án" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("shows the lock reason with a route back while exercises are locked", () => {
    render(<LearningWorkspace data={workspaceData()} />);

    fireEvent.click(screen.getByRole("button", { name: /Tới Bài tập/ }));
    expect(screen.getByText("Bài tập đang khóa")).not.toBeNull();
    expect(screen.queryByText("Câu bài tập")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Làm memory check" }));
    expect(questionHeading()).toBe("Câu nhớ 1");
  });

  it("sends the learner back to the memory check on MEMORY_CHECK_REQUIRED", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          isMemoryCheckPassed: true,
          answers: { [ids.first]: rightOption(1), [ids.second]: rightOption(2) },
        })}
      />,
    );
    // Đã qua và topic không có card: vào thẳng bài tập.
    expect(screen.getByText("Câu bài tập")).not.toBeNull();

    mockedSubmit.mockResolvedValueOnce({
      error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.",
      errorCode: "MEMORY_CHECK_REQUIRED",
    });
    fireEvent.click(screen.getByRole("button", { name: /Lựa chọn/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    });

    // Bộ câu đã đổi từ lúc tải trang: learner được mời tải lại để làm câu còn thiếu.
    expect(screen.queryByText("Câu bài tập")).toBeNull();
    expect(screen.getByText("Memory check vừa thay đổi")).not.toBeNull();
    // router.refresh() giữ nguyên state client nên CTA phải tải lại toàn trang.
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("keeps the old flow for a topic without a memory check", () => {
    render(
      <LearningWorkspace
        data={workspaceData({ memoryCheck: null, isMemoryCheckPassed: true })}
      />,
    );
    expect(screen.getByText("Câu bài tập")).not.toBeNull();
    expect(screen.queryByText(/memory check/i)).toBeNull();
  });
});
