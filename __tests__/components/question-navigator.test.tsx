/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import QuestionNavigator, {
  type QuestionNavigatorSection,
} from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/QuestionNavigator";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: bảo vệ bộ điều hướng câu hỏi "Danh sách câu hỏi" và các thay đổi trạng thái phản hồi của vùng trả lời (D8-LUI follow-up 3).
// - Loại test: component test trong jsdom; Server Action được mock ở ranh giới, không gọi server thật.
// - Danh sách: nhóm theo bài tập/nhóm ngữ liệu; mỗi dòng có số, nội dung rút gọn và trạng thái bằng biểu tượng cùng chữ (đang xem, đã đúng, chưa đúng, chưa trả lời), không chỉ màu.
// - Nhảy câu: chọn dòng đóng danh sách, đưa focus vào tiêu đề câu đó, giữ nguyên ngữ liệu khi cùng nhóm, đổi ngữ liệu khi sang nhóm khác; dòng bị khóa là nút vô hiệu kèm lý do và không gọi onSelect.
// - Màn hình rộng dùng Popover, màn hình hẹp dùng Sheet; cả hai dùng chung một danh sách.
// - Không còn hộp "Bạn đã trả lời đúng câu này"/"Chính xác!" hiển thị: trạng thái đúng nằm ở lựa chọn xanh và thông báo cho trình đọc màn hình vẫn có. Riêng câu đúng có giải thích hiện hộp cùng cấu trúc với hộp sai (tiêu đề "Chính xác" + giải thích, token growth) và tiêu đề đó thay cho thông báo ẩn; câu đúng không có giải thích không hiện hộp (LF1).
// - "Câu tiếp theo"/"Câu sau" chỉ hiện khi còn câu sau; câu cuối đã đúng đưa tới "Làm câu còn thiếu" hoặc, khi đã đủ, "Bài tiếp theo" (đúng đích của "Bài sau"; bài cuối thì "Về tổng quan khóa học"); không còn nút/màn hình "Hoàn thành bài tập" trung gian.
// - Bố cục LF9: câu đầu ẩn "Câu trước"; nút điều hướng đơn dùng outline khác nút chính, cả hai full width; khi có đủ trước/sau thì chung một hàng. Cột câu hỏi cạnh ngữ liệu dài chỉ dính (`data-sticky`) khi vừa chiều cao viewport (đo bằng `offsetHeight` giả lập); ở bố cục xếp chồng có "Tới câu hỏi" cuộn (smooth, hoặc auto khi reduced motion) và đưa focus vào tiêu đề; đổi câu cùng nhóm giữ nguyên node ngữ liệu.
// - Phân quyền: bài tập đang khóa sau memory check không có nút điều hướng; trong Preview chỉ dùng state cục bộ (xem public-course-preview.test.tsx).
// - Câu đang chờ phản hồi khi người học rời câu: quay lại vẫn thấy lựa chọn và trạng thái chờ, không gửi lần hai; kết quả đến muộn (đúng, sai, lỗi lưu) xuất hiện đúng ở màn hình đang xem và danh sách câu hỏi khớp với kết quả server.
// - Kết quả verify gần nhất: 21/21 passed (2026-10-10) bằng `npx vitest run __tests__/components/question-navigator.test.tsx`.

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
    unseenCardIds: [],
    unratedCardIds: [],
    memoryGateClearedCardIds: null,
    dueCardIds: [],
    answers: {},
    progress: null,
    ...overrides,
  };
}

// The same workspace with a following topic, so the last question can lead on to it.
function withNextTopic(overrides: Partial<LearningWorkspaceData> = {}) {
  const base = workspaceData();
  const current = base.currentTopic;
  return workspaceData({
    syllabus: [
      {
        ...base.syllabus[0],
        topics: [
          { ...current, isCompleted: false },
          {
            ...current,
            id: "22222222-2222-4222-8222-333333333333",
            slug: "topic-two",
            title: "Bài hai",
            orderIndex: 2,
            isCompleted: false,
          },
        ],
      },
    ],
    ...overrides,
  });
}

async function submitExerciseAnswer(optionContent: string) {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(optionContent) }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
  });
}

const openNavigator = () => fireEvent.click(screen.getByRole("button", { name: "Danh sách câu hỏi" }));
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
    expect(screen.queryByRole("button", { name: "Tới Bài tập" })).toBeNull();
    fireEvent.click(within(screen.getByRole("list", { name: "Các bước của bài học" })).getByRole("button", { name: /^Bài tập.*đang khóa/ }));
    expect(screen.getByText("Câu nhớ")).not.toBeNull();
    expect(screen.queryByText("Bài tập đang khóa")).toBeNull();
    expect(screen.queryByRole("button", { name: "Danh sách câu hỏi" })).toBeNull();
    expect(screen.queryByText("Câu đơn")).toBeNull();
  });

  it("shows a correct answer's explanation in the same titled box shape as a wrong one, without a second announcement", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      explanation: "Vì sao câu này đúng.",
    });
    await submitExerciseAnswer("Đúng Câu đơn");

    expect(screen.getByRole("radio", { name: /bạn chọn đúng/ })).not.toBeNull();
    const heading = screen.getByText("Chính xác");
    expect(heading.className).toContain("text-growth");
    const box = heading.parentElement!;
    expect(box.className).toContain("border-growth-line");
    expect(box.className).toContain("bg-growth-quiet");
    expect(within(box).getByText("Vì sao câu này đúng.")).not.toBeNull();
    // The heading is the announcement: the sr-only "Chính xác!" is not rendered a second time.
    expect(screen.queryByText("Chính xác!")).toBeNull();
    expect(screen.queryByText("Bạn đã trả lời đúng câu này")).toBeNull();
  });

  it("keeps only the screen-reader announcement and no visible box for a correct answer without an explanation", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true });
    await submitExerciseAnswer("Đúng Câu đơn");

    expect(screen.getByRole("radio", { name: /bạn chọn đúng/ })).not.toBeNull();
    expect(screen.getByText("Chính xác!").className).toContain("sr-only");
    expect(screen.queryByText("Chính xác")).toBeNull();
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

  it("offers a next question only while one exists and leaves for the next topic from the last one", async () => {
    render(
      <LearningWorkspace
        data={withNextTopic({
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

    // Everything is answered: the primary is the next topic, and the learner stays on this question.
    expect(screen.queryByRole("button", { name: "Hoàn thành bài tập" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("heading", { name: "Câu B hai" })).not.toBeNull();
    const nextTopic = screen.getAllByRole("link", { name: "Bài tiếp theo" });
    expect(nextTopic).toHaveLength(1);
    expect(nextTopic[0].getAttribute("href")).toBe("/learn/toeic-foundation/topic-two");

    // The list stays available from the exercise header and jumps back into a question.
    openNavigator();
    fireEvent.click(rowOf(/Câu 1: Câu đơn/));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Câu đơn" }));
  });

  it("primary on the last question is the first missing question while some are unanswered", async () => {
    render(<LearningWorkspace data={workspaceData({ answers: { [ids.standalone]: right(ids.standalone) } })} />);
    openNavigator();
    fireEvent.click(rowOf(/Câu 4: Câu B hai/));
    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true });
    await submitExerciseAnswer("Đúng Câu B hai");

    expect(screen.queryByRole("link", { name: "Bài tiếp theo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Làm câu còn thiếu" }));
    expect(screen.getByRole("heading", { name: "Câu nhóm A" })).not.toBeNull();
  });

  it("hides previous on the first question and distinguishes next from the primary action", () => {
    render(<LearningWorkspace data={workspaceData()} />);
    expect(screen.queryByRole("button", { name: "Câu trước" })).toBeNull();
    const forward = screen.getByRole("button", { name: "Câu sau" });
    const primary = screen.getByRole("button", { name: "Xác nhận đáp án" });
    expect(forward.getAttribute("data-variant")).toBe("outline");
    expect(primary.getAttribute("data-variant")).toBe("default");
  });
});

describe("grouped material layout", () => {
  const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

  function mockColumnHeight(height: number) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => height,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  afterEach(() => {
    if (originalHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalHeight);
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  const openGroupB = () => {
    openNavigator();
    fireEvent.click(rowOf(/Câu 3: Câu B một/));
  };
  const responseColumn = () =>
    screen.getByRole("heading", { name: "Câu B một" }).closest("[data-sticky]") as HTMLElement | null;

  it("pins the question column beside a long passage only while it fits the viewport", () => {
    mockColumnHeight(400);
    render(<LearningWorkspace data={workspaceData()} />);
    openGroupB();
    expect(responseColumn()?.getAttribute("data-sticky")).toBe("true");
    expect(responseColumn()?.className).toContain("lg:data-[sticky=true]:sticky");

    cleanup();
    mockColumnHeight(5000);
    render(<LearningWorkspace data={workspaceData()} />);
    openGroupB();
    // Taller than the viewport: it scrolls normally instead of hiding its lower part.
    expect(responseColumn()?.getAttribute("data-sticky")).toBe("false");
  });

  it("offers a jump from the end of the passage to the question and focuses its heading", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<LearningWorkspace data={workspaceData()} />);
    expect(screen.queryByRole("button", { name: "Tới câu hỏi" })).toBeNull();
    openGroupB();

    fireEvent.click(screen.getByRole("button", { name: "Tới câu hỏi" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Câu B một" }));
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "start", behavior: "smooth" }),
    );
  });

  it("jumps without smooth scrolling under reduced motion", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<LearningWorkspace data={workspaceData()} />);
    openGroupB();
    fireEvent.click(screen.getByRole("button", { name: "Tới câu hỏi" }));

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
  });

  it("keeps the passage in place when moving to another question of the same group", () => {
    render(<LearningWorkspace data={workspaceData()} />);
    openGroupB();
    const passage = screen.getByText("Đoạn văn B");
    fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));
    expect(screen.getByRole("heading", { name: "Câu B hai" })).not.toBeNull();
    expect(screen.getByText("Đoạn văn B")).toBe(passage);
  });
});

describe("an answer in flight when the learner leaves its question", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  function deferSubmit() {
    let settle: (value: unknown) => void = () => {};
    mockedSubmit.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }) as never,
    );
    return (value: unknown) => settle(value);
  }

  async function submitAndComeBack(optionContent: string) {
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(optionContent) }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));
    expect(screen.getByText("Câu hỏi 2/4")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Câu trước/ }));
    expect(screen.getByText("Câu hỏi 1/4")).not.toBeNull();
  }

  it("returns to a pending question that cannot be submitted again, then shows the correct result when it lands", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    const settle = deferSubmit();
    await submitAndComeBack("Đúng Câu đơn");

    // The returning view waits on the same request: the chosen option stays, nothing else can be sent.
    expect(screen.getByRole("radio", { name: /Đúng Câu đơn/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Sai Câu đơn/ }).matches(":disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Đang kiểm tra…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mockedSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle({ success: true, isCorrect: true, explanation: "Vì sao đúng." });
    });

    // The late result reaches the view the learner is looking at, and the wrong option stays locked out.
    expect(screen.getByText("Vì sao đúng.")).not.toBeNull();
    expect(screen.getByRole("radio", { name: /Sai Câu đơn/ }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Câu tiếp theo" })).not.toBeNull();
    expect(mockedSubmit).toHaveBeenCalledTimes(1);

    openNavigator();
    expect(rowOf(/Câu 1: Câu đơn\s*Đang xem · Đã trả lời đúng/)).not.toBeNull();
  });

  it("shows a wrong result with its explanation on the returning view and lets the learner retry", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    const settle = deferSubmit();
    await submitAndComeBack("Sai Câu đơn");

    await act(async () => {
      settle({ success: true, isCorrect: false, explanation: "Đọc lại ngữ liệu." });
    });

    expect(screen.getByText("Chưa chính xác")).not.toBeNull();
    expect(screen.getByText("Đọc lại ngữ liệu.")).not.toBeNull();
    openNavigator();
    expect(rowOf(/Câu 1: Câu đơn\s*Đang xem · Trả lời chưa đúng/)).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(screen.getByRole("radio", { name: /Đúng Câu đơn/ }).matches(":disabled")).toBe(false);
  });

  it("shows a failed save on the returning view and keeps the choice for a retry", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    const settle = deferSubmit();
    await submitAndComeBack("Đúng Câu đơn");

    await act(async () => {
      settle({ error: "Không lưu được." });
    });

    expect(screen.getByText(/Không lưu được\./)).not.toBeNull();
    expect(screen.getByRole("radio", { name: /Đúng Câu đơn/ }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("button", { name: "Xác nhận đáp án" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
