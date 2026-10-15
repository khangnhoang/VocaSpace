/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitCardReview } from "@/app/actions/review";
import { resetCardReviewQueueForTests } from "@/hooks/use-card-review-queue";
import { CARDS_REQUIRED, CARDS_REQUIRED_ERROR } from "@/lib/memory-check";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: bảo vệ stage memory check D3 (H6) trong learning workspace.
// - Loại test: component interaction test qua action boundary mock.
// - Case thành công: câu sai quay lại cuối hàng; hết hàng (server báo đã qua) thì mở bài tập.
// - Case thất bại: lỗi server giữ câu và lựa chọn hiện tại; MEMORY_CHECK_REQUIRED đưa về memory check.
// - Ổn định/resilience: hàng đợi sau khi tải lại dựng từ map `answers` server trả (option đổi/xóa thì câu quay lại hàng).
// - Invariant cần giữ: bài tập khóa kèm lý do + CTA tới khi qua; topic không có memory check giữ flow cũ.
// - Đổi giai đoạn khi đang chờ phản hồi: mỗi câu dựng lại từ lần gửi của nó (đang chờ thì khóa, đã có kết quả thì hiện phản hồi), kể cả câu bị xếp lại sau; kết quả đạt đến lúc vắng mặt được áp dụng khi quay lại và vẫn chờ người học bấm tiếp; không gửi lần hai.
// - LF3 (AC6): server từ chối với CARDS_REQUIRED (thẻ mới thêm sau khi tải trang) thì về bước Từ vựng, báo lỗi, xin server tải lại; trang đổi key theo dữ liệu thẻ nên workspace dựng lại và thẻ mới vào hàng đợi, câu trả lời không bị ghi.
// - LF3 (AC8): khi kết quả trả lời báo memory check đã qua thì bước memory check đánh dấu đã xong ngay, bài tập mở ngay; phản hồi của câu vẫn hiện và việc chuyển sang bài tập chỉ xảy ra khi học viên bấm.
// - LF4 (AC1): toast "Đã hoàn thành memory check!" đúng một lần ở bước chưa qua -> qua theo kết quả của chính câu trả lời; không toast khi chưa qua, khi memory check đã qua lúc tải trang, và khi chính câu trả lời đó làm bài học hoàn thành (chỉ còn toast hoàn thành bài).
// - LF4 QA fix: sau CARDS_REQUIRED chỉ có MỘT toast thông tin "Bài học vừa có thêm N thẻ mới..." (N = số thẻ chưa xem sau khi tải lại), không toast lỗi và không toast "Bạn còn N thẻ chưa học" ở lần remount đó; tải lại không còn thẻ chưa xem thì không toast gì; lần tải trang sau (F5) báo thường lệ.
// - LF5 (AC6/AC9): memory check đang đạt thì không còn hộp "Bạn đã trả lời đúng hết memory check" mà có danh sách chỉ đọc theo thứ tự: mỗi câu đánh dấu đáp án đã lưu của học viên kèm giải thích khi có; đầy đủ cả sau khi tải lại (giải thích từ loader) lẫn ngay sau khi đạt trong cùng phiên không tải lại (giải thích giữ từ kết quả trả lời), không ghi gì.
// - LF5 (AC7): còn câu bài tập chưa đúng thì phản hồi cuối giữ nút "Mở bài tập"; không còn bài tập mở (không có bài tập hoặc mọi câu đã đúng) thì không có nút "Hoàn thành memory check"/"Mở bài tập", workspace tự chuyển tiếp sau phản hồi tới bước đầu tiên còn phải làm hoặc, khi vừa hoàn thành chủ đề, tới màn hình hoàn thành có chuỗi chuyển động; không toast hoàn thành bài lẫn toast memory check.
// - LF6 (AC1, tương tác LF5): rời memory check bằng thanh tiến trình trong lúc chờ tự chuyển thì đồng hồ cũ không kéo học viên về, "Xem kết quả chủ đề" còn và lần vào đầu tiên chạy chuỗi một lần; quay lại memory check vừa đạt thì phục hồi phản hồi đạt và bắt đầu một lần chờ mới (không phải bản xem lại); câu đang chờ phản hồi vẫn bị khóa khi rời sang Từ vựng và quay lại bằng thanh, kết quả đến vẫn hiện và không gửi hai lần.
// - Kết quả verify gần nhất: xem plan D3 §10; LF3 CP4 chạy lại toàn file (2026-10-11); LF5 CP4 (2026-10-12).

vi.mock("@/app/actions/progress", () => ({
  submitQuestionAnswer: vi.fn(),
}));

vi.mock("@/app/actions/review", () => ({
  submitCardReview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockedSubmit = vi.mocked(submitQuestionAnswer);
const mockedUseRouter = vi.mocked(useRouter);
const mockedReview = vi.mocked(submitCardReview);
const mockedToast = vi.mocked(toast);

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

function memoryQuestion(id: string, order: number, explanation: string | null = `Giải thích ${order}`) {
  return {
    id,
    content: `Câu nhớ ${order}`,
    explanation,
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
      {
        id: topic.chapterId,
        title: "Chương một",
        orderIndex: 1,
        topics: [{ ...topic, isCompleted: false }],
      },
    ],
    currentTopic: topic,
    flashcards: [],
    exercises: [
      {
        id: ids.exercise,
        title: "Bài tập Part 5",
        part_type: "part_5",
        order_index: 1,
        questions: [],
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
    unseenCardIds: [],
    unratedCardIds: [],
    dueCardIds: [],
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

  afterEach(() => {
    resetCardReviewQueueForTests();
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

  it("marks the memory step done as soon as the server reports it passed, while the last answer's feedback stays", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({ answers: { [ids.first]: rightOption(1) } })}
      />,
    );
    const stepTexts = () =>
      within(screen.getByRole("list", { name: "Các bước của bài học" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent?.replace(/^\d/, ""));
    expect(stepTexts()).toEqual(["Memory check (đang học)", "Bài tập (đang khóa)"]);

    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, isMemoryCheckPassed: true });
    await answer("Đúng 2");

    // Chưa bấm "Mở bài tập": bước đã xong và bài tập đã mở, còn phản hồi của câu vẫn hiện (AC8).
    expect(stepTexts()).toEqual(["Memory check (đã xong, đang học)", "Bài tập (chưa mở)"]);
    expect(screen.getByText("Chính xác!")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Mở bài tập" })).not.toBeNull();
    expect(screen.queryByText("Bạn đã trả lời đúng hết memory check")).toBeNull();

    // Điều hướng là việc riêng: chỉ chuyển sang bài tập khi học viên bấm.
    fireEvent.click(screen.getByRole("button", { name: "Mở bài tập" }));
    expect(screen.getByText("Câu bài tập")).not.toBeNull();
  });

  describe("LF4 memory check completion toast", () => {
    const passedProgress = {
      isFlashcardCompleted: true,
      isMemoryCheckPassed: true,
      isExerciseCompleted: false,
      isTopicCompleted: false,
      newlyCompleted: false,
    };

    it("announces the memory check once when this answer turns it from not passed to passed", async () => {
      render(<LearningWorkspace data={workspaceData({ answers: { [ids.first]: rightOption(1) } })} />);

      mockedSubmit.mockResolvedValueOnce({
        success: true,
        isCorrect: true,
        isMemoryCheckPassed: true,
        topicProgress: passedProgress,
      });
      await answer("Đúng 2");

      expect(mockedToast.success.mock.calls.map(([message]) => message)).toEqual(["Đã hoàn thành memory check!"]);
    });

    it("stays silent for answers that leave the memory check not passed", async () => {
      render(<LearningWorkspace data={workspaceData()} />);
      mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: false, isMemoryCheckPassed: false });
      await answer("Sai 1");
      fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
      mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, isMemoryCheckPassed: false });
      await answer("Đúng 2");

      expect(mockedToast.success).not.toHaveBeenCalled();
    });

    it("stays silent when the memory check was already passed at page load", () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            isMemoryCheckPassed: true,
            answers: { [ids.first]: rightOption(1), [ids.second]: rightOption(2) },
          })}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /^Memory check/ }));

      expect(screen.getByRole("heading", { name: "Xem lại Memory check" })).not.toBeNull();
      expect(mockedToast.success).not.toHaveBeenCalled();
    });

    it("shows no toast at all when the same answer completes the topic (the completion screen replaces them)", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        render(<LearningWorkspace data={workspaceData({ exercises: [], answers: { [ids.first]: rightOption(1) } })} />);
        mockedSubmit.mockResolvedValueOnce({
          success: true,
          isCorrect: true,
          isMemoryCheckPassed: true,
          topicProgress: { ...passedProgress, isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true },
        });
        await answer("Đúng 2");
        await act(async () => {
          vi.advanceTimersByTime(1200);
        });

        expect(mockedToast.success).not.toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: /^Đã hoàn thành chủ đề/ })).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("LF5 read-only review and the pass", () => {
    const reviewHeading = () => screen.queryByRole("heading", { name: "Xem lại Memory check" });
    const radio = (name: RegExp) => screen.getByRole("radio", { name });
    const passed = {
      isFlashcardCompleted: true,
      isMemoryCheckPassed: true,
      isExerciseCompleted: false,
      isTopicCompleted: false,
      newlyCompleted: false,
    };

    it("lists every question in order with the stored answer marked and the explanation that exists, after a reload", () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            isMemoryCheckPassed: true,
            answers: { [ids.first]: rightOption(1), [ids.second]: rightOption(2) },
            memoryCheck: {
              id: ids.memory,
              // Loader: the explanation exists only where the stored answer is correct; the second has none authored.
              questions: [memoryQuestion(ids.first, 1), memoryQuestion(ids.second, 2, null)],
            },
          })}
        />,
      );
      // Passed, with exercises still open: the learner lands on Bài tập and reaches the review from there.
      fireEvent.click(screen.getByRole("button", { name: /Về Memory check/ }));

      expect(reviewHeading()).not.toBeNull();
      expect(screen.queryByText("Bạn đã trả lời đúng hết memory check")).toBeNull();
      expect(
        screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
      ).toEqual(["1.Câu nhớ 1", "2.Câu nhớ 2"]);
      expect(radio(/Đúng 1/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/Sai 1/).getAttribute("aria-checked")).toBe("false");
      expect(radio(/Đúng 2/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/Đúng 1/).matches(":disabled")).toBe(true);
      expect(screen.getByText("Giải thích 1")).not.toBeNull();
      expect(screen.getAllByText("Giải thích")).toHaveLength(1);
      expect(mockedSubmit).not.toHaveBeenCalled();
      // The way to the exercises stays.
      fireEvent.click(screen.getByRole("button", { name: "Làm bài tập" }));
      expect(screen.getByText("Câu bài tập")).not.toBeNull();
    });

    it("lists every question with its explanation right after a multi-question pass in the same session, without a reload or a write", async () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            memoryCheck: {
              id: ids.memory,
              questions: [memoryQuestion(ids.first, 1, null), memoryQuestion(ids.second, 2, null)],
            },
          })}
        />,
      );
      mockedSubmit.mockResolvedValueOnce({
        success: true,
        isCorrect: true,
        explanation: "Vì sao câu một",
        isMemoryCheckPassed: false,
      });
      await answer("Đúng 1");
      fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
      mockedSubmit.mockResolvedValueOnce({
        success: true,
        isCorrect: true,
        explanation: "Vì sao câu hai",
        isMemoryCheckPassed: true,
        topicProgress: passed,
      });
      await answer("Đúng 2");
      // Exercise questions are still open: the pass keeps Mở bài tập.
      fireEvent.click(screen.getByRole("button", { name: "Mở bài tập" }));
      fireEvent.click(screen.getByRole("button", { name: /Về Memory check/ }));

      expect(reviewHeading()).not.toBeNull();
      expect(radio(/Đúng 1/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/Đúng 2/).getAttribute("aria-checked")).toBe("true");
      expect(screen.getByText("Vì sao câu một")).not.toBeNull();
      expect(screen.getByText("Vì sao câu hai")).not.toBeNull();
      expect(mockedSubmit).toHaveBeenCalledTimes(2);
    });

    describe("without an open exercise", () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      });
      afterEach(() => {
        vi.useRealTimers();
      });
      const noButtons = () => {
        expect(screen.queryByRole("button", { name: "Mở bài tập" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Hoàn thành memory check" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Tiếp tục" })).toBeNull();
      };

      it("moves on by itself to the first unfinished stage when the topic has no exercises", async () => {
        const card = {
          id: "e0000000-0000-4000-8000-00000000000a",
          front_content: { word: "reliable" },
          back_content: { translation: "đáng tin cậy" },
          audio_url: null,
          image_url: null,
        };
        render(
          <LearningWorkspace
            data={workspaceData({
              exercises: [],
              flashcards: [card],
              unseenCardIds: [],
              unratedCardIds: [card.id],
              answers: { [ids.first]: rightOption(1) },
              progress: { isFlashcardCompleted: false, isExerciseCompleted: false, isTopicCompleted: false },
            })}
          />,
        );
        // The card still needs Ổn or Dễ, so the learner lands on Từ vựng and opens the memory check from there.
        fireEvent.click(screen.getByRole("button", { name: "Tới Memory check" }));
        mockedSubmit.mockResolvedValueOnce({
          success: true,
          isCorrect: true,
          isMemoryCheckPassed: true,
          topicProgress: { ...passed, isFlashcardCompleted: false },
        });
        await answer("Đúng 2");

        noButtons();
        expect(screen.getByText("Chính xác!")).not.toBeNull();
        // Owner Q14: the correct feedback stays for 1200 ms before the workspace moves on.
        await act(async () => {
          vi.advanceTimersByTime(1100);
        });
        expect(screen.getByText("Chính xác!")).not.toBeNull();
        await act(async () => {
          vi.advanceTimersByTime(100);
        });
        // Not completed: the AC1 rule sends the learner back to Từ vựng (the finished screen with the cards still to rate).
        expect(screen.getByRole("heading", { name: "Bạn đã ôn xong từ vựng" })).not.toBeNull();
        expect(screen.queryByRole("heading", { name: /^Đã hoàn thành chủ đề/ })).toBeNull();
      });

      it("opens the completion screen with its sequence when every exercise question is already correct and the pass completes the topic", async () => {
        render(
          <LearningWorkspace
            data={workspaceData({
              answers: { [ids.first]: rightOption(1), [ids.exerciseQuestion]: ids.exerciseOption },
            })}
          />,
        );
        mockedSubmit.mockResolvedValueOnce({
          success: true,
          isCorrect: true,
          isMemoryCheckPassed: true,
          topicProgress: { ...passed, isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true },
        });
        await answer("Đúng 2");

        noButtons();
        expect(mockedToast.success).not.toHaveBeenCalled();
        await act(async () => {
          vi.advanceTimersByTime(1200);
        });
        const heading = screen.getByRole("heading", { name: /^Đã hoàn thành chủ đề/ });
        expect(heading.closest("section")?.getAttribute("data-motion")).toBe("sequence");
        expect(mockedToast.success).not.toHaveBeenCalled();
      });
    });

    it("keeps the answerable stage, with today's rules, when the memory check is no longer passed", () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            isMemoryCheckPassed: false,
            // A teacher added a question after the topic was completed: only the first is still answered.
            answers: { [ids.first]: rightOption(1) },
            progress: { isFlashcardCompleted: true, isExerciseCompleted: true, isTopicCompleted: true },
            memoryCheck: {
              id: ids.memory,
              questions: [memoryQuestion(ids.first, 1), memoryQuestion(ids.second, 2, null)],
            },
          })}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /^Memory check/ }));

      expect(reviewHeading()).toBeNull();
      expect(questionHeading()).toBe("Câu nhớ 2");
      // No explanation or mark is shown for the question that is not answered correctly.
      expect(screen.queryByText("Giải thích 2")).toBeNull();
      expect(screen.getByRole("button", { name: "Kiểm tra đáp án" })).not.toBeNull();
    });
  });

  it("keeps an answer in flight pending when the learner leaves and returns, and shows its result when it lands", async () => {
    render(<LearningWorkspace data={workspaceData()} />);

    let settle: (value: unknown) => void = () => {};
    mockedSubmit.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }) as never,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Đúng 1/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
    });

    fireEvent.click(screen.getByRole("button", { name: /Tới Bài tập/ }));
    fireEvent.click(screen.getByRole("button", { name: /Về Memory check/ }));

    // The returning view is still waiting: same choice, nothing to submit again.
    expect(questionHeading()).toBe("Câu nhớ 1");
    expect(screen.getByRole("radio", { name: /Đúng 1/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Sai 1/ }).matches(":disabled")).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Đang kiểm tra..." }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => {
      settle({ success: true, isCorrect: true, isMemoryCheckPassed: false });
    });
    expect(screen.getByText("Chính xác!")).not.toBeNull();
    expect(screen.getByText("Đã đúng 1/2")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).not.toBeNull();
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
  });

  describe("LF6 stage thread during an LF5 wait or a write in flight", () => {
    const card = {
      id: "e0000000-0000-4000-8000-00000000000a",
      front_content: { word: "reliable" },
      back_content: { translation: "đáng tin cậy" },
      audio_url: null,
      image_url: null,
    };
    const passed = {
      isFlashcardCompleted: true,
      isMemoryCheckPassed: true,
      isExerciseCompleted: false,
      isTopicCompleted: false,
      newlyCompleted: false,
    };
    const threadStep = (name: RegExp) =>
      within(screen.getByRole("list", { name: "Các bước của bài học" })).getByRole("button", { name });
    const completionHeading = () => screen.queryByRole("heading", { name: /^Đã hoàn thành chủ đề/ });
    // Every exercise question is already correct, so the pass that completes the topic hands over by itself after 1200 ms.
    const allAnswered = () =>
      workspaceData({
        flashcards: [card],
        answers: { [ids.first]: rightOption(1), [ids.exerciseQuestion]: ids.exerciseOption },
      });
    const completingPass = {
      success: true as const,
      isCorrect: true,
      isMemoryCheckPassed: true,
      topicProgress: { ...passed, isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true },
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not pull the learner back after leaving by the thread during the completion wait, and keeps the sequence for the first entry", async () => {
      render(<LearningWorkspace data={allAnswered()} />);
      // The card is not rated Ổn/Dễ yet, so the learner lands on Từ vựng and opens the memory check from the thread.
      fireEvent.click(threadStep(/^Memory check/));
      mockedSubmit.mockResolvedValueOnce(completingPass);
      await answer("Đúng 2");
      expect(screen.getByText("Chính xác!")).not.toBeNull();

      fireEvent.click(threadStep(/^Bài tập/));
      expect(screen.getByText("Câu bài tập")).not.toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      // The old timer is gone with the unmounted stage: still on the exercise, completion not shown, nothing sent twice.
      expect(screen.getByText("Câu bài tập")).not.toBeNull();
      expect(completionHeading()).toBeNull();
      expect(mockedSubmit).toHaveBeenCalledTimes(1);
      expect(mockedToast.success).not.toHaveBeenCalled();

      // The pending completion survived: the way back is offered and the first entry plays the sequence once.
      fireEvent.click(screen.getAllByRole("button", { name: "Xem kết quả chủ đề" })[0]);
      const heading = completionHeading();
      expect(heading?.closest("section")?.getAttribute("data-motion")).toBe("sequence");
      fireEvent.click(threadStep(/^Bài tập/));
      fireEvent.click(screen.getAllByRole("button", { name: "Xem kết quả chủ đề" })[0]);
      expect(completionHeading()?.closest("section")?.getAttribute("data-motion")).toBe("settled");
    });

    it("restores the passing feedback and starts a new wait when the learner returns to a just-passed memory check, never the read-only review", async () => {
      render(<LearningWorkspace data={allAnswered()} />);
      // The card is not rated Ổn/Dễ yet, so the learner lands on Từ vựng and opens the memory check from the thread.
      fireEvent.click(threadStep(/^Memory check/));
      mockedSubmit.mockResolvedValueOnce(completingPass);
      await answer("Đúng 2");

      fireEvent.click(threadStep(/^Bài tập/));
      expect(screen.getByText("Câu bài tập")).not.toBeNull();
      fireEvent.click(threadStep(/^Memory check/));

      expect(screen.getByText("Chính xác!")).not.toBeNull();
      expect(screen.getByText("Đã đúng 2/2")).not.toBeNull();
      expect(screen.queryByRole("heading", { name: "Xem lại Memory check" })).toBeNull();
      expect(completionHeading()).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });
      // The new wait ends like the first one: the pending completion plays its sequence, and the server was asked once.
      expect(completionHeading()?.closest("section")?.getAttribute("data-motion")).toBe("sequence");
      expect(mockedSubmit).toHaveBeenCalledTimes(1);
    });

    it("keeps an answer in flight pending across a jump to Từ vựng and back through the thread, and loses no result", async () => {
      render(<LearningWorkspace data={workspaceData({ flashcards: [card] })} />);
      fireEvent.click(threadStep(/^Memory check/));
      let settle: (value: unknown) => void = () => {};
      mockedSubmit.mockReturnValueOnce(
        new Promise((resolve) => {
          settle = resolve;
        }) as never,
      );
      fireEvent.click(screen.getByRole("radio", { name: /Đúng 1/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
      });

      fireEvent.click(threadStep(/^Từ vựng/));
      expect(screen.queryByText("Câu nhớ 1")).toBeNull();
      fireEvent.click(threadStep(/^Memory check/));
      expect(screen.getByRole("radio", { name: /Đúng 1/ }).getAttribute("aria-checked")).toBe("true");
      expect(
        (screen.getByRole("button", { name: "Đang kiểm tra..." }) as HTMLButtonElement).disabled,
      ).toBe(true);

      await act(async () => {
        settle({ success: true, isCorrect: true, isMemoryCheckPassed: false });
      });
      expect(screen.getByText("Chính xác!")).not.toBeNull();
      expect(screen.getByText("Đã đúng 1/2")).not.toBeNull();
      expect(mockedSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("answers in flight across a stage change", () => {
    function deferSubmit() {
      let settle: (value: unknown) => void = () => {};
      mockedSubmit.mockReturnValueOnce(
        new Promise((resolve) => {
          settle = resolve;
        }) as never,
      );
      return (value: unknown) => settle(value);
    }
    const leave = () => fireEvent.click(screen.getByRole("button", { name: /Tới Bài tập/ }));
    const comeBack = () => fireEvent.click(screen.getByRole("button", { name: /Về Memory check/ }));

    it("keeps a requeued question's late result locked on its own question, never allowing a second submit", async () => {
      render(<LearningWorkspace data={workspaceData()} />);

      // Question 1 is wrong and goes behind question 2.
      mockedSubmit.mockResolvedValueOnce({
        success: true,
        isCorrect: false,
        explanation: "Giải thích 1",
        isMemoryCheckPassed: false,
      });
      await answer("Sai 1");
      fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
      expect(questionHeading()).toBe("Câu nhớ 2");

      // Question 2 is sent, and the learner leaves before it answers.
      const settleSecond = deferSubmit();
      fireEvent.click(screen.getByRole("radio", { name: /Đúng 2/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
      });
      leave();
      comeBack();

      // The new view starts with question 1; answer it right and continue.
      expect(questionHeading()).toBe("Câu nhớ 1");
      mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, isMemoryCheckPassed: false });
      await answer("Đúng 1");
      fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

      // Question 2 is still in flight: locked on its choice.
      expect(questionHeading()).toBe("Câu nhớ 2");
      expect(screen.getByRole("radio", { name: /Sai 2/ }).matches(":disabled")).toBe(true);
      expect(
        (screen.getByRole("button", { name: "Đang kiểm tra..." }) as HTMLButtonElement).disabled,
      ).toBe(true);

      await act(async () => {
        settleSecond({ success: true, isCorrect: true, isMemoryCheckPassed: true });
      });
      // Its result shows as feedback, the choices stay locked and the pass waits for the learner.
      expect(screen.getByText("Chính xác!")).not.toBeNull();
      expect(screen.getByRole("radio", { name: /Sai 2/ }).matches(":disabled")).toBe(true);
      expect(mockedSubmit.mock.calls.filter(([id]) => id === ids.second)).toHaveLength(1);
      expect(mockedSubmit).toHaveBeenCalledTimes(3);

      fireEvent.click(screen.getByRole("button", { name: "Mở bài tập" }));
      expect(screen.getByText("Câu bài tập")).not.toBeNull();
    });

    it("takes in a pass that arrived while away instead of asking for a reload", async () => {
      render(
        <LearningWorkspace data={workspaceData({ answers: { [ids.first]: rightOption(1) } })} />,
      );
      const settle = deferSubmit();
      fireEvent.click(screen.getByRole("radio", { name: /Đúng 2/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
      });

      leave();
      await act(async () => {
        settle({ success: true, isCorrect: true, isMemoryCheckPassed: true });
      });
      comeBack();

      // The confirmed pass is shown with the learner's own continuation, not the stale message.
      expect(screen.queryByText("Memory check vừa thay đổi")).toBeNull();
      expect(screen.getByText("Chính xác!")).not.toBeNull();
      expect(screen.getByText("Đã đúng 2/2")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Mở bài tập" }));
      expect(screen.getByText("Câu bài tập")).not.toBeNull();
      expect(mockedSubmit).toHaveBeenCalledTimes(1);
    });
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
    fireEvent.click(screen.getByRole("radio", { name: /Lựa chọn/ }));
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

  it("recovers from CARDS_REQUIRED: back to the flashcards, refresh, and a rebuilt workspace with the new card", async () => {
    const refresh = vi.fn();
    mockedUseRouter.mockReturnValue({ refresh } as never);
    const oldCard = {
      id: "e0000000-0000-4000-8000-00000000000a",
      front_content: { word: "reliable" },
      back_content: { translation: "đáng tin cậy" },
      audio_url: null,
      image_url: null,
    };
    const newCard = {
      id: "e0000000-0000-4000-8000-00000000000b",
      front_content: { word: "improve" },
      back_content: { translation: "cải thiện" },
      audio_url: null,
      image_url: null,
    };
    const { rerender } = render(
      <LearningWorkspace
        key="before"
        data={workspaceData({
          flashcards: [oldCard],
          unseenCardIds: [oldCard.id],
          unratedCardIds: [oldCard.id],
        })}
      />,
    );

    // Chấm xong thẻ duy nhất thì chuyển sang memory check.
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    mockedReview.mockResolvedValueOnce({
      success: true,
      topicProgress: {
        isFlashcardCompleted: true,
        isExerciseCompleted: false,
        isTopicCompleted: false,
        isMemoryCheckPassed: false,
        newlyCompleted: false,
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    });
    expect(questionHeading()).toBe("Câu nhớ 1");

    // Giảng viên đã thêm một thẻ sau khi tải trang: server không ghi câu trả lời.
    mockedSubmit.mockResolvedValueOnce({ error: CARDS_REQUIRED_ERROR, errorCode: CARDS_REQUIRED });
    await answer("Đúng 1");

    expect(mockedSubmit).toHaveBeenCalledTimes(1);
    // Chưa có toast nào trước khi dữ liệu tải lại (số thẻ mới chưa biết) và không bao giờ có toast lỗi.
    expect(mockedToast.error).not.toHaveBeenCalled();
    expect(mockedToast.info).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Câu nhớ 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Ôn lại từ vựng" })).not.toBeNull();

    // Dữ liệu tải lại có thẻ mới chưa xem: key đổi theo dữ liệu nên state dựng lại, memory check khóa tới khi chấm thẻ mới.
    rerender(
      <LearningWorkspace
        key="after"
        data={workspaceData({
          flashcards: [oldCard, newCard],
          unseenCardIds: [newCard.id],
          unratedCardIds: [newCard.id],
        })}
      />,
    );
    // AC6 (LF4): hàng đợi dựng lại chỉ có thẻ mới chưa xem, kèm toast số thẻ chưa học.
    expect(screen.getByText("improve")).not.toBeNull();
    expect(screen.queryByText("reliable")).toBeNull();
    // Đúng một toast với số thẻ mới; toast số thẻ chưa học thường lệ và toast lỗi đều không hiện.
    expect(mockedToast.info).toHaveBeenCalledTimes(1);
    expect(mockedToast.info).toHaveBeenCalledWith(
      "Bài học vừa có thêm 1 thẻ mới. Học xong rồi làm lại memory check nhé.",
    );
    expect(mockedToast.error).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Tới Memory check" })).toBeNull();
  });

  it("shows no new-cards toast when the refreshed data has no unseen card, and the next plain load announces as usual", async () => {
    const refresh = vi.fn();
    mockedUseRouter.mockReturnValue({ refresh } as never);
    const oldCard = {
      id: "e0000000-0000-4000-8000-00000000000a",
      front_content: { word: "reliable" },
      back_content: { translation: "đáng tin cậy" },
      audio_url: null,
      image_url: null,
    };
    const newCard = { ...oldCard, id: "e0000000-0000-4000-8000-00000000000b", front_content: { word: "improve" } };
    const { rerender, unmount } = render(
      <LearningWorkspace
        key="before"
        data={workspaceData({ flashcards: [oldCard], unseenCardIds: [oldCard.id], unratedCardIds: [oldCard.id] })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    mockedReview.mockResolvedValueOnce({
      success: true,
      topicProgress: {
        isFlashcardCompleted: true,
        isExerciseCompleted: false,
        isTopicCompleted: false,
        isMemoryCheckPassed: false,
        newlyCompleted: false,
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    });
    mockedSubmit.mockResolvedValueOnce({ error: CARDS_REQUIRED_ERROR, errorCode: CARDS_REQUIRED });
    await answer("Đúng 1");

    // Tải lại không còn thẻ chưa xem (ví dụ thẻ mới bị gỡ): không có gì để báo, và không có toast lỗi.
    rerender(
      <LearningWorkspace
        key="after"
        data={workspaceData({ flashcards: [oldCard], unseenCardIds: [], unratedCardIds: [] })}
      />,
    );
    expect(mockedToast.info).not.toHaveBeenCalled();
    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();

    // Dấu đã được tiêu thụ: lần tải trang sau (như F5) báo số thẻ chưa học thường lệ.
    render(
      <LearningWorkspace
        key="reload"
        data={workspaceData({
          flashcards: [oldCard, newCard],
          unseenCardIds: [newCard.id],
          unratedCardIds: [newCard.id],
        })}
      />,
    );
    expect(mockedToast.info).toHaveBeenCalledTimes(1);
    expect(mockedToast.info).toHaveBeenCalledWith("Bạn còn 1 thẻ chưa học trong bài học này");
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
