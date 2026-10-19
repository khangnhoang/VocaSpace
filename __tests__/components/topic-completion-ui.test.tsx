/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitCardReview } from "@/app/actions/review";
import { resetCardReviewQueueForTests } from "@/hooks/use-card-review-queue";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import TopicCompletionPanel from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/TopicCompletionPanel";
import type { LearningWorkspaceData, TopicProgress } from "@/lib/schemas/learning-workspace";

// Test plan:
// - LF9 r7 (Owner QA 2026-10-18): không còn "Câu trước"/"Câu sau"; chỉ "Danh sách câu hỏi" chuyển giữa các câu bài tập.
// - LF9 r7: câu trả lời làm hoàn thành chủ đề (câu cuối hay câu thiếu ở giữa) luôn có nút "Hoàn thành" mở màn hình hoàn thành; không có đồng hồ tự chuyển nào, kể cả khi chủ đề đã hoàn thành từ trước.
// - LF9 Owner QA: Memory check cuối mở kết quả chủ đề ngay khi server xác nhận, không chờ timer.
// - Mục tiêu: bảo vệ UI hoàn thành topic D4 (H6/G7) trong learning workspace.
// - Loại test: component interaction test qua action boundary mock.
// - Đối tượng: LearningWorkspace (thẻ, bài tập qua QuestionResponse) và MemoryCheckStage.
// - AC7 (ứng viên chờ Owner duyệt): đúng thì hiện "Câu tiếp theo" (khi còn câu sau) và không tự chuyển câu; sai thì giải thích nằm tại chỗ với "Thử lại"; lỗi lưu giữ nguyên lựa chọn và không bị hiểu là đáp án sai; kết quả trễ của câu cũ không đánh dấu câu mới.
// - Case thành công: câu standalone hiển thị trước group, không có passage và không có nhãn nhóm (group đánh số không tính phần standalone); khi server báo `newlyCompleted` thì không còn toast hoàn thành mà màn hình hoàn thành hiện (LF5 AC4).
// - Case thất bại: `progressError` hiện toast nhưng không chặn việc học tiếp.
// - Ổn định/resilience: câu cuối không có "Câu tiếp theo"; trả lời đúng câu cuối khi còn câu thiếu thì CTA "Làm câu còn thiếu" đưa tới câu đầu tiên còn thiếu.
// - Invariant cần giữ: trả lời đúng câu cuối của exercise 1 không báo hoàn thành; UI không tự suy ra hoàn thành topic.
// - Trạng thái bền: topic đã hoàn thành (theo `progress` hoặc kết quả server) có nhãn "Đã hoàn thành" ở header,
//   dấu tích trong danh sách chương, và "Bài sau"/"Về tổng quan khóa học" thành nút chính ở các bước (còn ở màn hình hoàn thành thì là nút phụ); không còn nút "Hoàn thành bài học".
// - LF5 (AC4): chấm thẻ cuối, trả lời câu bài tập làm hoàn thành, hoặc câu đúng cuối của memory check làm bài học hoàn thành thì không có toast nào (cả toast hoàn thành bài lẫn toast chuyển bước/memory check) và màn hình hoàn thành thay cho bước; chưa hoàn thành thì vẫn có toast chuyển bước.
// - LF6 (AC1): rời câu bài tập vừa làm hoàn thành bằng thanh tiến trình thì không bị kéo sang màn hình hoàn thành, không gửi lần hai, và lần vào đầu tiên từ "Xem kết quả chủ đề" vẫn chạy chuỗi.
// - FEAT12 (AC1-AC7): chủ đề đã hoàn thành mà còn câu bài tập hoặc câu Memory check chưa đúng thì màn hình hoàn thành có hộp "Bài học vừa được cập nhật" trước thanh tiến độ; "Làm ngay" đi theo cổng (thẻ chờ -> Từ vựng, memory chưa qua -> Memory check ở câu chưa đúng đầu tiên, còn lại -> câu bài tập chưa đúng đầu tiên), không ghi tiến độ, không đổi trạng thái hoàn thành; hết việc hoặc `queueProgressUnavailable` thì không có hộp.
// - FEAT12 Decision 41: chủ đề đã hoàn thành từ trước, câu trả lời đúng đóng câu mở cuối cùng (không phải câu cuối danh sách) chỉ còn nút "Hoàn thành" mở màn hình hoàn thành đã ổn định, không hộp, không chuỗi chuyển động; sai, còn câu mở khác, hay đã chuyển câu thì giữ nút như cũ.
// - FEAT12 Owner QA: vào bước bài tập tự động (xong memory check, "Làm bài tập" ở bản xem lại, hết hàng đợi thẻ) mở câu đầu tiên chưa đúng thay vì câu 1; không còn câu nào thì luồng cũ giữ nguyên.
// - Kết quả verify gần nhất: FEAT12 CP1 (2026-10-19) passed 40/40 bằng `npx vitest run __tests__/components/topic-completion-ui.test.tsx`; các nhóm D8-LUI/LF trước đó xem báo cáo checkpoint D8-LUI CP2.

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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockedSubmit = vi.mocked(submitQuestionAnswer);
const mockedReview = vi.mocked(submitCardReview);
const mockedUseRouter = vi.mocked(useRouter);
const mockedToast = vi.mocked(toast);

const ids = {
  exerciseA: "a0000000-0000-4000-8000-000000000001",
  exerciseB: "a0000000-0000-4000-8000-000000000002",
  groupA: "b0000000-0000-4000-8000-000000000001",
  groupB: "b0000000-0000-4000-8000-000000000002",
  standalone: "c0000000-0000-4000-8000-000000000001",
  groupedA: "c0000000-0000-4000-8000-000000000002",
  groupedB: "c0000000-0000-4000-8000-000000000003",
  memory: "d0000000-0000-4000-8000-000000000001",
  memoryQuestion: "d0000000-0000-4000-8000-000000000002",
  card: "e0000000-0000-4000-8000-000000000001",
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
      questions: [question(ids.groupedB, "Câu nhóm B")],
    },
  ],
};

function progress(overrides: Partial<TopicProgress> = {}): TopicProgress {
  return {
    isFlashcardCompleted: true,
    isMemoryCheckPassed: true,
    isExerciseCompleted: false,
    isTopicCompleted: false,
    newlyCompleted: false,
    ...overrides,
  };
}

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
    exercises: [exerciseA],
    memoryCheck: null,
    isMemoryCheckPassed: true,
    unseenCardIds: [],
    unratedCardIds: [],
    memoryGateClearedCardIds: (overrides.progress?.isFlashcardCompleted || overrides.progress?.isTopicCompleted
      || ((overrides.unseenCardIds?.length ?? 0) === 0 && (overrides.unratedCardIds?.length ?? 0) === 0))
      ? (overrides.flashcards ?? []).filter((card) => !(overrides.unseenCardIds ?? []).includes(card.id)).map((card) => card.id) : null,
    dueCardIds: [],
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

// The question list is the only way to jump between exercise questions.
function goTo(questionNumber: number) {
  fireEvent.click(screen.getByRole("button", { name: "Danh sách câu hỏi" }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Câu ${questionNumber}: `) }));
}

function successToasts() {
  return mockedToast.success.mock.calls.map(([message]) => message);
}

function completionHeading() {
  return screen.queryByRole("heading", { name: /^Đã hoàn thành chủ đề/ });
}

describe("D4 topic completion UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  afterEach(() => {
    resetCardReviewQueueForTests();
    vi.useRealTimers();
  });

  it("shows standalone questions first without a passage or group label, then the groups", () => {
    render(<LearningWorkspace data={workspaceData()} />);

    expect(screen.queryByText(/Câu hỏi độc lập|ngữ liệu/)).toBeNull();
    expect(screen.getByText("Câu đơn")).not.toBeNull();
    expect(screen.queryByText("Đoạn văn A")).toBeNull();
    expect(screen.queryByText(/^Nhóm \d/)).toBeNull();

    goTo(2);
    expect(screen.getByText("Câu nhóm A")).not.toBeNull();
    expect(screen.getByText("Đoạn văn A")).not.toBeNull();
    // Groups are numbered without the standalone segment.
    expect(screen.getByText("Nhóm 1/1")).not.toBeNull();
  });

  it("does not announce completion after the last question of the first exercise", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          exercises: [exerciseA, exerciseB],
          answers: { [ids.standalone]: right(ids.standalone) },
        })}
      />,
    );
    goTo(2);
    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, topicProgress: progress() });
    await submitExerciseAnswer("Đúng Câu nhóm A");

    // The result stays inline and nothing advances on its own (AC7 candidate).
    expect(successToasts()).toEqual([]);
    expect(screen.getByText("Chính xác!")).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Câu nhóm A")).not.toBeNull();
    expect(screen.queryByText("Câu nhóm B")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Câu tiếp theo" }));
    expect(screen.getByText("Câu nhóm B")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps an incorrect answer inline with a retry that clears the choice", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: false,
      explanation: "Xem lại thì của động từ.",
    });
    await submitExerciseAnswer("Sai Câu đơn");

    expect(screen.getByText("Chưa chính xác")).not.toBeNull();
    expect(screen.getByText("Xem lại thì của động từ.")).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(screen.queryByText("Chưa chính xác")).toBeNull();
    expect(
      screen.getByRole("radio", { name: /Sai Câu đơn/ }).getAttribute("aria-checked"),
    ).toBe("false");
    expect(screen.getByRole("button", { name: "Xác nhận đáp án" }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps the choice and offers a resend when saving the answer fails", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    mockedSubmit.mockResolvedValueOnce({ error: "Không thể lưu đáp án lúc này." });
    await submitExerciseAnswer("Đúng Câu đơn");

    // A failed save is not an incorrect answer.
    expect(screen.getByRole("alert").textContent).toContain("Không thể lưu đáp án lúc này.");
    expect(screen.queryByText("Chưa chính xác")).toBeNull();
    expect(
      screen.getByRole("radio", { name: /Đúng Câu đơn/ }).getAttribute("aria-checked"),
    ).toBe("true");

    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, topicProgress: progress() });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    });
    expect(screen.getByText("Chính xác!")).not.toBeNull();
    expect(mockedSubmit).toHaveBeenCalledTimes(2);
  });

  it("ignores a late result after the learner moved to another question", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    let resolveSubmit: (value: { success: true; isCorrect: true }) => void = () => {};
    mockedSubmit.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }) as never,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Đúng Câu đơn/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    });
    goTo(2);
    expect(screen.getByText("Câu nhóm A")).not.toBeNull();

    await act(async () => {
      resolveSubmit({ success: true, isCorrect: true });
    });
    // The result belongs to the previous question and must not mark this one.
    expect(screen.queryByText("Chính xác!")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Xác nhận đáp án" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("moves between exercise questions only through the question list", () => {
    render(<LearningWorkspace data={workspaceData({
      exercises: [exerciseA, exerciseB],
      memoryCheck: { id: ids.memory, questions: [question(ids.memoryQuestion, "Câu nhớ")] },
      answers: { [ids.memoryQuestion]: right(ids.memoryQuestion) },
    })} />);
    expect(screen.getByText("Câu đơn")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Về Memory check" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Xác nhận đáp án" }).getAttribute("data-variant")).toBe("default");
    expect(screen.queryByRole("button", { name: /^Câu (trước|sau)$/ })).toBeNull();
    goTo(3);
    expect(screen.getByText("Câu nhóm B")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /^Câu (trước|sau)$/ })).toBeNull();
    goTo(1);
    expect(screen.getByText("Câu đơn")).not.toBeNull();
  });

  it("offers the first missing question after the last one is answered, instead of a next that leads nowhere", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          exercises: [exerciseA, exerciseB],
          answers: { [ids.groupedA]: right(ids.groupedA) },
        })}
      />,
    );
    goTo(3);
    expect(screen.getByText("Câu nhóm B")).not.toBeNull();

    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, topicProgress: progress() });
    await submitExerciseAnswer("Đúng Câu nhóm B");
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hoàn thành" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Làm câu còn thiếu" }));

    expect(screen.getByText("Câu đơn")).not.toBeNull();
    expect(successToasts()).toEqual([]);
    expect(completionHeading()).toBeNull();
  });

  it("keeps the learner on the answer that completes the topic until they press Hoàn thành", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({ answers: { [ids.standalone]: right(ids.standalone) } })}
      />,
    );
    goTo(2);
    expect(screen.queryByText("Đã hoàn thành")).toBeNull();
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true }),
    });
    await submitExerciseAnswer("Đúng Câu nhóm A");

    // LF5: no toast, and the completed state shows at once without a reload.
    expect(successToasts()).toEqual([]);
    expect(screen.getByText("Đã hoàn thành")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
    // LF9 r7: nothing moves on its own; the feedback stays until the learner presses Hoàn thành.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(completionHeading()).toBeNull();
    expect(screen.getByText("Chính xác!")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
    expect(completionHeading()?.textContent).toBe("Đã hoàn thành chủ đề “Bài một”");
    expect(completionHeading()?.closest("section")?.getAttribute("data-motion")).toBe("sequence");
    expect(screen.queryByText("Câu nhóm A")).toBeNull();
    // This is the last topic: the screen's primary action and the footer both lead to the overview.
    const overviewLinks = screen.getAllByRole("link", { name: "Về tổng quan khóa học" });
    expect(overviewLinks).toHaveLength(2);
    overviewLinks.forEach((link) => expect(link.getAttribute("href")).toBe("/learn/toeic-foundation"));
    expect(successToasts()).toEqual([]);
  });

  it("also ends with Hoàn thành when the topic was already complete and the last answer leaves no question open", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          answers: { [ids.standalone]: right(ids.standalone) },
          progress: progress({ isExerciseCompleted: true, isTopicCompleted: true }),
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Bài tập/ }));
    goTo(2);
    expect(screen.getByText("Câu nhóm A")).not.toBeNull();
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true }),
    });
    await submitExerciseAnswer("Đúng Câu nhóm A");

    expect(screen.getByText("Chính xác!")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Bài tiếp theo" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(completionHeading()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
    expect(completionHeading()).not.toBeNull();
  });

  it("keeps a pending completion when the learner leaves by the thread, and plays it from Xem kết quả chủ đề", async () => {
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
          flashcards: [card],
          answers: { [ids.standalone]: right(ids.standalone) },
        })}
      />,
    );
    const threadStep = (name: RegExp) =>
      within(screen.getByRole("list", { name: "Các bước của bài học" })).getByRole("button", { name });
    // The card still needs Ổn or Dễ, so the learner lands on Từ vựng and opens the exercises from the thread.
    fireEvent.click(threadStep(/^Bài tập/));
    goTo(2);
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true }),
    });
    await submitExerciseAnswer("Đúng Câu nhóm A");
    expect(screen.getByText("Chính xác!")).not.toBeNull();

    fireEvent.click(threadStep(/^Từ vựng/));
    expect(completionHeading()).toBeNull();
    expect(screen.getByRole("heading", { name: "Bạn đã ôn xong từ vựng" })).not.toBeNull();
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
    expect(mockedToast.success).not.toHaveBeenCalled();

    // The pending completion survived and plays its sequence on the first entry.
    fireEvent.click(screen.getByRole("button", { name: "Xem kết quả chủ đề" }));
    expect(completionHeading()?.closest("section")?.getAttribute("data-motion")).toBe("sequence");
  });

  it("shows Hoàn thành on a saved last question of a completed topic, and never moves the learner by itself", () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          answers: { [ids.standalone]: right(ids.standalone), [ids.groupedA]: right(ids.groupedA) },
          progress: progress({ isExerciseCompleted: true, isTopicCompleted: true }),
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Bài tập/ }));
    goTo(2);
    expect(screen.getByText("Câu nhóm A")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(completionHeading()).toBeNull();
    expect(screen.getByText("Câu nhóm A")).not.toBeNull();
    // Only the footer leads to the overview; the question's own end action opens the completion screen.
    expect(screen.getAllByRole("link", { name: "Về tổng quan khóa học" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
    expect(completionHeading()).not.toBeNull();
  });

  it("ends with Hoàn thành, not Câu tiếp theo, when an earlier missed question completes the topic", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          exercises: [exerciseA, exerciseB],
          answers: { [ids.groupedA]: right(ids.groupedA), [ids.groupedB]: right(ids.groupedB) },
        })}
      />,
    );
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true }),
    });
    await submitExerciseAnswer("Đúng Câu đơn");

    expect(successToasts()).toEqual([]);
    expect(completionHeading()).toBeNull();
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
    expect(completionHeading()).not.toBeNull();
    expect(screen.queryByText("Câu đơn")).toBeNull();
  });

  it("shows stored completion in the header and sidebar and promotes the next topic", () => {
    const current = workspaceData().currentTopic;
    const nextTopic = {
      ...current,
      id: "22222222-2222-4222-8222-333333333333",
      slug: "topic-two",
      title: "Bài hai",
      orderIndex: 2,
    };
    const laterTopic = {
      ...current,
      id: "22222222-2222-4222-8222-444444444444",
      slug: "topic-three",
      title: "Bài ba",
      orderIndex: 3,
    };
    render(
      <LearningWorkspace
        data={workspaceData({
          syllabus: [
            {
              id: current.chapterId,
              title: "Chương một",
              orderIndex: 1,
              topics: [
                // Stale syllabus flag: the current topic follows `progress` instead.
                { ...current, isCompleted: false },
                { ...nextTopic, isCompleted: true },
                { ...laterTopic, isCompleted: false },
              ],
            },
          ],
          progress: {
            isFlashcardCompleted: true,
            isExerciseCompleted: true,
            isTopicCompleted: true,
          },
        })}
      />,
    );

    expect(screen.getByText("Đã hoàn thành")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Hoàn thành bài học" })).toBeNull();
    const navigation = screen.getByRole("navigation", { name: "Điều hướng bài học" });
    const nextLinks = Array.from(navigation.querySelectorAll("a")).filter(
      (link) => link.textContent === "Bài sau",
    );
    expect(nextLinks).toHaveLength(1);
    expect(nextLinks[0].getAttribute("href")).toBe("/learn/toeic-foundation/topic-two");
    // LF5 AC3: a completed topic opens the completion screen, which owns the only primary action.
    expect(completionHeading()).not.toBeNull();
    expect(nextLinks[0].getAttribute("data-variant")).toBe("ghost");
    // Reviewing a stage brings back the footer's own promotion of the next topic.
    fireEvent.click(screen.getByRole("button", { name: /^Bài tập/ }));
    expect(completionHeading()).toBeNull();
    const promoted = Array.from(navigation.querySelectorAll("a")).filter(
      (link) => link.textContent === "Bài sau",
    );
    expect(promoted[0].getAttribute("data-variant")).toBe("default");
    // Owner Q14: the promoted footer link also gets a visible border on touch or coarse input, chosen by input capability.
    expect(promoted[0].className).toContain("coarse-input:border-action");

    fireEvent.click(screen.getByRole("button", { name: "Mở danh sách chương và bài học" }));
    expect(
      screen.getByRole("link", { name: /^Bài một\s*\(Đã hoàn thành\)$/ }).getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("link", { name: /^Bài hai\s*\(Đã hoàn thành\)$/ })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Bài ba" })).not.toBeNull();
  });

  it("keeps the topic unmarked and navigation secondary until the server reports completion", () => {
    render(<LearningWorkspace data={workspaceData()} />);

    expect(screen.queryByText("Đã hoàn thành")).toBeNull();
    expect(screen.queryByRole("button", { name: "Hoàn thành bài học" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Về tổng quan khóa học" })).toBeNull();
  });

  it("surfaces a progress sync failure without blocking the answer feedback", async () => {
    render(<LearningWorkspace data={workspaceData()} />);
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: false,
      explanation: "Xem lại thì của động từ.",
      progressError: "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    });
    await submitExerciseAnswer("Sai Câu đơn");

    expect(mockedToast.error).toHaveBeenCalledWith(
      "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    );
    expect(screen.getByText("Xem lại thì của động từ.")).not.toBeNull();
    expect(successToasts()).toEqual([]);
  });

  it("uses the card review result for completion and sync failures", async () => {
    const card = {
      id: ids.card,
      front_content: { word: "reliable" },
      back_content: { translation: "đáng tin cậy" },
      audio_url: null,
      image_url: null,
    };
    const data = workspaceData({ flashcards: [card], exercises: [], unseenCardIds: [card.id] });
    const { unmount } = render(<LearningWorkspace data={data} />);

    mockedReview.mockResolvedValueOnce({
      success: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    });
    // LF5: the completion screen replaces both the topic toast and the finished-flashcards screen.
    expect(successToasts()).toEqual([]);
    expect(completionHeading()).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Bạn đã ôn xong từ vựng" })).toBeNull();
    unmount();

    vi.clearAllMocks();
    render(<LearningWorkspace data={data} />);
    mockedReview.mockResolvedValueOnce({
      success: true,
      progressError: "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    });
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    });
    expect(mockedToast.error).toHaveBeenCalledWith(
      "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    );
    expect(successToasts()).toEqual([]);
    expect(screen.getByRole("button", { name: "Tải lại tiến độ" })).not.toBeNull();
  });

  it("opens the completion screen with no toast when the last card rating completes the topic with exercises still ahead", async () => {
    const card = {
      id: ids.card,
      front_content: { word: "reliable" },
      back_content: { translation: "đáng tin cậy" },
      audio_url: null,
      image_url: null,
    };
    const data = workspaceData({ flashcards: [card], unseenCardIds: [card.id] });
    const { unmount } = render(<LearningWorkspace data={data} />);

    mockedReview.mockResolvedValueOnce({
      success: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    });
    expect(successToasts()).toEqual([]);
    expect(completionHeading()).not.toBeNull();
    unmount();

    vi.clearAllMocks();
    render(<LearningWorkspace data={data} />);
    mockedReview.mockResolvedValueOnce({ success: true, topicProgress: progress() });
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    });
    expect(successToasts()).toEqual(["Đã nạp xong từ vựng! Chuyển sang bài tập."]);
  });

  it("announces completion and sync failures from the memory check", async () => {
    const data = workspaceData({
      exercises: [],
      isMemoryCheckPassed: false,
      memoryCheck: { id: ids.memory, questions: [question(ids.memoryQuestion, "Câu nhớ")] },
    });
    const answerMemory = async () => {
      fireEvent.click(screen.getByRole("radio", { name: /Đúng Câu nhớ/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
      });
    };
    const { unmount } = render(<LearningWorkspace data={data} />);

    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      isMemoryCheckPassed: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true }),
    });
    await answerMemory();
    // Memory check cuối chuyển ngay, màn hình hoàn thành thay cho toast.
    expect(successToasts()).toEqual([]);
    expect(screen.getByText("Đã hoàn thành")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Xem kết quả chủ đề" })).toBeNull();
    expect(completionHeading()).not.toBeNull();
    expect(successToasts()).toEqual([]);
    unmount();

    vi.clearAllMocks();
    render(<LearningWorkspace data={data} />);
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      progressError: "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    });
    await answerMemory();
    expect(mockedToast.error).toHaveBeenCalledWith(
      "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    );
    expect(screen.getByText("Chính xác!")).not.toBeNull();
    expect(mockedToast.success).not.toHaveBeenCalled();
  });
});

describe("FEAT12 catch-up prompt on the completion screen", () => {
  const panelProps = {
    topicTitle: "Bài một",
    course: { completed: 1, total: 2, previous: 1 },
    chapter: { title: "Chương 1 · Chương một", completed: 1, total: 2, previous: 1 },
    nextHint: "Chủ đề 2 · Bài hai",
    animate: false,
    focusOnEntry: false,
    dueCount: 0,
    onReviewDue: vi.fn(),
    next: { kind: "overview" as const, href: "/learn/toeic-foundation" },
  };
  const completedProgress = () => progress({ isExerciseCompleted: true, isTopicCompleted: true });
  const memoryQuestionB = "d0000000-0000-4000-8000-000000000003";
  const catchUpTitle = () => screen.queryByRole("heading", { name: "Bài học vừa được cập nhật" });
  const courseProgress = () => screen.getByRole("progressbar", { name: "Tiến độ khóa học" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  afterEach(() => {
    resetCardReviewQueueForTests();
    vi.useRealTimers();
  });

  describe("TopicCompletionPanel", () => {
    it("shows no box when the catch-up prop is absent or both counts are zero", () => {
      const { rerender } = render(<TopicCompletionPanel {...panelProps} />);
      expect(catchUpTitle()).toBeNull();

      rerender(<TopicCompletionPanel {...panelProps} catchUp={{ memoryCount: 0, exerciseCount: 0, onStart: vi.fn() }} />);
      expect(catchUpTitle()).toBeNull();
      expect(screen.queryByRole("button", { name: /Làm ngay/ })).toBeNull();
    });

    it.each([
      [{ memoryCount: 0, exerciseCount: 3 }, "Còn 3 câu bài tập cần làm"],
      [{ memoryCount: 2, exerciseCount: 0 }, "Còn 2 câu Memory check cần làm"],
      [{ memoryCount: 1, exerciseCount: 2 }, "Còn 1 câu Memory check và 2 câu bài tập cần làm"],
    ])("names what is left for %o and puts the count in the button's accessible name", (counts, line) => {
      const onStart = vi.fn();
      render(<TopicCompletionPanel {...panelProps} catchUp={{ ...counts, onStart }} />);

      expect(screen.getByRole("heading", { name: "Bài học vừa được cập nhật" })).not.toBeNull();
      expect(screen.getByText(line)).not.toBeNull();
      const button = screen.getByRole("button", { name: `${line}, Làm ngay` });
      expect(button.textContent).toBe("Làm ngay");
      fireEvent.click(button);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it("announces the box after the completion heading and before the progress bars", () => {
      render(<TopicCompletionPanel {...panelProps} catchUp={{ memoryCount: 0, exerciseCount: 1, onStart: vi.fn() }} />);

      const heading = screen.getByRole("heading", { name: /^Đã hoàn thành chủ đề/ });
      const title = screen.getByRole("heading", { name: "Bài học vừa được cập nhật" });
      const [firstBar] = screen.getAllByRole("progressbar");
      expect(heading.tagName).toBe("H2");
      expect(title.tagName).toBe("H3");
      expect(heading.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(title.compareDocumentPosition(firstBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe("LearningWorkspace", () => {
    it("lands on the completion screen with the box, and Làm ngay opens the first question that is not correct without any progress write", () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            exercises: [exerciseA, exerciseB],
            answers: { [ids.standalone]: right(ids.standalone), [ids.groupedB]: right(ids.groupedB) },
            progress: completedProgress(),
          })}
        />,
      );

      expect(completionHeading()).not.toBeNull();
      expect(screen.getByText("Còn 1 câu bài tập cần làm")).not.toBeNull();
      expect(screen.getByText("Đã hoàn thành")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Còn 1 câu bài tập cần làm, Làm ngay/ }));

      // The open question is the later one, not question 1.
      expect(completionHeading()).toBeNull();
      expect(screen.getByText("Câu nhóm A")).not.toBeNull();
      expect(screen.queryByText("Câu đơn")).toBeNull();
      expect(screen.getByText("Đã hoàn thành")).not.toBeNull();
      expect(mockedSubmit).not.toHaveBeenCalled();
      expect(mockedReview).not.toHaveBeenCalled();
    });

    it("counts every exercise question without a correct answer and opens the first of them", () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            exercises: [exerciseA, exerciseB],
            answers: { [ids.groupedA]: right(ids.groupedA) },
            progress: completedProgress(),
          })}
        />,
      );

      expect(screen.getByText("Còn 2 câu bài tập cần làm")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));
      // The first open question is question 1; the answered question 2 is not what the button opens.
      expect(screen.getByText("Câu đơn")).not.toBeNull();
      expect(screen.queryByText("Câu nhóm A")).toBeNull();
    });

    it("leaves the completion screen exactly as before when nothing is left", () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            answers: { [ids.standalone]: right(ids.standalone), [ids.groupedA]: right(ids.groupedA) },
            progress: completedProgress(),
          })}
        />,
      );

      expect(completionHeading()).not.toBeNull();
      expect(catchUpTitle()).toBeNull();
      expect(screen.queryByRole("button", { name: /Làm ngay/ })).toBeNull();
      expect(courseProgress().getAttribute("aria-valuenow")).toBe("1");
    });

    it("opens the memory check, not a locked exercise step, while it is not passed", () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            isMemoryCheckPassed: false,
            memoryCheck: { id: ids.memory, questions: [question(ids.memoryQuestion, "Câu nhớ")] },
            answers: { [ids.standalone]: right(ids.standalone) },
            progress: completedProgress(),
          })}
        />,
      );

      expect(screen.getByText("Còn 1 câu Memory check và 1 câu bài tập cần làm")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));

      expect(screen.getByRole("heading", { name: "Câu nhớ" })).not.toBeNull();
      expect(screen.queryByRole("heading", { name: "Bài tập đang khóa" })).toBeNull();
      expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("opens the memory check when only exercises are counted but a re-keyed memory check locked them", () => {
      render(
        <LearningWorkspace
          data={workspaceData({
            isMemoryCheckPassed: false,
            memoryCheck: { id: ids.memory, questions: [question(ids.memoryQuestion, "Câu nhớ")] },
            answers: { [ids.memoryQuestion]: right(ids.memoryQuestion) },
            progress: completedProgress(),
          })}
        />,
      );

      expect(screen.getByText("Còn 2 câu bài tập cần làm")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));
      // Every memory answer is correct, so the memory step has no question left to show and names the change instead.
      expect(completionHeading()).toBeNull();
      expect(screen.getByRole("heading", { name: "Memory check vừa thay đổi" })).not.toBeNull();
      expect(screen.queryByRole("heading", { name: "Bài tập đang khóa" })).toBeNull();
      expect(screen.queryByText("Câu đơn")).toBeNull();
    });

    it("opens the vocabulary step, not the locked memory screen, while memory cards are pending", () => {
      const card = {
        id: ids.card,
        front_content: { word: "reliable" },
        back_content: { translation: "đáng tin cậy" },
        audio_url: null,
        image_url: null,
      };
      render(
        <LearningWorkspace
          data={workspaceData({
            flashcards: [card],
            unseenCardIds: [card.id],
            isMemoryCheckPassed: false,
            memoryCheck: { id: ids.memory, questions: [question(ids.memoryQuestion, "Câu nhớ")] },
            answers: { [ids.standalone]: right(ids.standalone), [ids.groupedA]: right(ids.groupedA) },
            progress: completedProgress(),
          })}
        />,
      );

      // The unseen card lands on Từ vựng; the learner reaches the completion screen by the result button.
      fireEvent.click(screen.getByRole("button", { name: "Xem kết quả chủ đề" }));
      expect(screen.getByText("Còn 1 câu Memory check cần làm")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));

      expect(screen.getByRole("button", { name: "Hiện đáp án" })).not.toBeNull();
      expect(screen.queryByRole("heading", { name: "Memory check đang khóa" })).toBeNull();
      expect(completionHeading()).toBeNull();
    });

    describe("closing the last open question of a completed topic (Decision 41)", () => {
      const middleOpen = () =>
        workspaceData({
          exercises: [exerciseA, exerciseB],
          answers: { [ids.standalone]: right(ids.standalone), [ids.groupedB]: right(ids.groupedB) },
          progress: completedProgress(),
        });
      const openMiddleQuestion = () => {
        fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));
        expect(screen.getByText("Câu nhóm A")).not.toBeNull();
      };
      const answerCorrectly = () => {
        mockedSubmit.mockResolvedValueOnce({
          success: true,
          isCorrect: true,
          topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: false }),
        });
        return submitExerciseAnswer("Đúng Câu nhóm A");
      };

      it("offers only Hoàn thành after the answer that closes the last open question, and opens the settled screen without a box", async () => {
        render(<LearningWorkspace data={middleOpen()} />);
        expect(courseProgress().getAttribute("aria-valuenow")).toBe("1");
        openMiddleQuestion();
        await answerCorrectly();

        expect(mockedSubmit).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
        // Nothing moves on its own.
        act(() => {
          vi.advanceTimersByTime(10_000);
        });
        expect(completionHeading()).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
        expect(completionHeading()?.closest("section")?.getAttribute("data-motion")).toBe("settled");
        expect(catchUpTitle()).toBeNull();
        expect(courseProgress().getAttribute("aria-valuenow")).toBe("1");
        expect(screen.getByText("Đã hoàn thành")).not.toBeNull();
      });

      it("keeps Thử lại after a wrong answer and offers Hoàn thành only once the retry is correct", async () => {
        render(<LearningWorkspace data={middleOpen()} />);
        openMiddleQuestion();
        mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: false, explanation: "Xem lại." });
        await submitExerciseAnswer("Sai Câu nhóm A");

        expect(screen.getByRole("button", { name: "Thử lại" })).not.toBeNull();
        expect(screen.queryByRole("button", { name: "Hoàn thành" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
        await answerCorrectly();
        expect(screen.getByRole("button", { name: "Hoàn thành" })).not.toBeNull();
      });

      it("keeps Câu tiếp theo while another question is still open", async () => {
        render(
          <LearningWorkspace
            data={workspaceData({
              exercises: [exerciseA, exerciseB],
              answers: { [ids.groupedB]: right(ids.groupedB) },
              progress: completedProgress(),
            })}
          />,
        );
        expect(screen.getByText("Còn 2 câu bài tập cần làm")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));
        mockedSubmit.mockResolvedValueOnce({
          success: true,
          isCorrect: true,
          topicProgress: progress({ isExerciseCompleted: false, isTopicCompleted: true }),
        });
        await submitExerciseAnswer("Đúng Câu đơn");

        expect(screen.getByRole("button", { name: "Câu tiếp theo" })).not.toBeNull();
        expect(screen.queryByRole("button", { name: "Hoàn thành" })).toBeNull();
      });

      it("returns to Câu tiếp theo on other questions after the learner moves away", async () => {
        render(<LearningWorkspace data={middleOpen()} />);
        openMiddleQuestion();
        await answerCorrectly();
        expect(screen.getByRole("button", { name: "Hoàn thành" })).not.toBeNull();

        goTo(1);
        expect(screen.getByText("Câu đơn")).not.toBeNull();
        expect(screen.getByRole("button", { name: "Câu tiếp theo" })).not.toBeNull();
        expect(screen.queryByRole("button", { name: "Hoàn thành" })).toBeNull();
      });
    });

    it("hides the box while the workspace already knows its local progress is unconfirmed", async () => {
      const card = {
        id: ids.card,
        front_content: { word: "reliable" },
        back_content: { translation: "đáng tin cậy" },
        audio_url: null,
        image_url: null,
      };
      render(
        <LearningWorkspace
          data={workspaceData({
            flashcards: [card],
            unseenCardIds: [card.id],
            memoryGateClearedCardIds: null,
            isMemoryCheckPassed: false,
            memoryCheck: { id: ids.memory, questions: [question(ids.memoryQuestion, "Câu nhớ")] },
            progress: completedProgress(),
          })}
        />,
      );
      mockedReview.mockResolvedValueOnce({ success: true, progressError: "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học." });
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
      });
      expect(screen.getByRole("button", { name: "Tải lại tiến độ" })).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Xem kết quả chủ đề" }));
      expect(completionHeading()).not.toBeNull();
      expect(catchUpTitle()).toBeNull();
    });

    describe("automatic entry into the exercise step (Owner QA)", () => {
      const middleOpen = {
        exercises: [exerciseA, exerciseB],
        answers: { [ids.standalone]: right(ids.standalone), [ids.groupedB]: right(ids.groupedB) },
      };
      const memoryCheckOne = { id: ids.memory, questions: [question(ids.memoryQuestion, "Câu nhớ")] };

      it("opens the open middle question, not question 1, after the last memory answer on a completed topic", async () => {
        render(
          <LearningWorkspace
            data={workspaceData({
              ...middleOpen,
              isMemoryCheckPassed: false,
              memoryCheck: memoryCheckOne,
              progress: completedProgress(),
            })}
          />,
        );
        fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));
        mockedSubmit.mockResolvedValueOnce({
          success: true,
          isCorrect: true,
          isMemoryCheckPassed: true,
          topicProgress: progress({ isExerciseCompleted: false, isTopicCompleted: true }),
        });
        fireEvent.click(screen.getByRole("radio", { name: /Đúng Câu nhớ/ }));
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
        });

        expect(screen.getByText("Câu nhóm A")).not.toBeNull();
        expect(screen.queryByText("Câu đơn")).toBeNull();
        expect(mockedSubmit).toHaveBeenCalledTimes(1);
      });

      it("keeps today's flow when no exercise question is left after the last memory answer", async () => {
        render(
          <LearningWorkspace
            data={workspaceData({
              answers: { [ids.standalone]: right(ids.standalone), [ids.groupedA]: right(ids.groupedA) },
              isMemoryCheckPassed: false,
              memoryCheck: memoryCheckOne,
              progress: completedProgress(),
            })}
          />,
        );
        fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));
        mockedSubmit.mockResolvedValueOnce({
          success: true,
          isCorrect: true,
          isMemoryCheckPassed: true,
          topicProgress: completedProgress(),
        });
        fireEvent.click(screen.getByRole("radio", { name: /Đúng Câu nhớ/ }));
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
        });

        expect(completionHeading()).not.toBeNull();
        expect(catchUpTitle()).toBeNull();
      });

      it("opens the open middle question from the passed memory check's Làm bài tập", () => {
        render(
          <LearningWorkspace
            data={workspaceData({
              ...middleOpen,
              memoryCheck: memoryCheckOne,
              answers: { ...middleOpen.answers, [ids.memoryQuestion]: right(ids.memoryQuestion) },
            })}
          />,
        );
        const thread = within(screen.getByRole("list", { name: "Các bước của bài học" }));
        fireEvent.click(thread.getByRole("button", { name: /^Memory check/ }));
        fireEvent.click(screen.getByRole("button", { name: "Làm bài tập" }));

        expect(screen.getByText("Câu nhóm A")).not.toBeNull();
        expect(screen.queryByText("Câu đơn")).toBeNull();
      });

      it("opens the open middle question when the last card rating moves on to the exercises", async () => {
        const card = {
          id: ids.card,
          front_content: { word: "reliable" },
          back_content: { translation: "đáng tin cậy" },
          audio_url: null,
          image_url: null,
        };
        render(
          <LearningWorkspace
            data={workspaceData({ ...middleOpen, flashcards: [card], unseenCardIds: [card.id] })}
          />,
        );
        mockedReview.mockResolvedValueOnce({
          success: true,
          topicProgress: progress({ isFlashcardCompleted: true, isExerciseCompleted: false }),
        });
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
        });

        expect(screen.getByText("Câu nhóm A")).not.toBeNull();
        expect(screen.queryByText("Câu đơn")).toBeNull();
      });
    });

    describe("memory check entry", () => {
      const twoQuestions = () =>
        workspaceData({
          exercises: [],
          isMemoryCheckPassed: false,
          memoryCheck: {
            id: ids.memory,
            questions: [question(ids.memoryQuestion, "Câu nhớ một", 1), question(memoryQuestionB, "Câu nhớ hai", 2)],
          },
          progress: completedProgress(),
        });

      it("opens at the first question that is not correct when the learner left a correct result without continuing", async () => {
        render(<LearningWorkspace data={twoQuestions()} />);
        expect(screen.getByText("Còn 2 câu Memory check cần làm")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));
        expect(screen.getByRole("heading", { name: "Câu nhớ một" })).not.toBeNull();

        mockedSubmit.mockResolvedValueOnce({
          success: true,
          isCorrect: true,
          isMemoryCheckPassed: false,
          topicProgress: progress({ isMemoryCheckPassed: false, isTopicCompleted: true }),
        });
        fireEvent.click(screen.getByRole("radio", { name: /Đúng Câu nhớ một/ }));
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
        });
        // The correct result is on screen and the learner leaves without pressing "Câu tiếp theo".
        expect(screen.getByRole("button", { name: "Câu tiếp theo" })).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Xem kết quả chủ đề" }));

        expect(screen.getByText("Còn 1 câu Memory check cần làm")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));

        expect(screen.getByRole("heading", { name: "Câu nhớ hai" })).not.toBeNull();
        expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
        expect(mockedSubmit).toHaveBeenCalledTimes(1);
      });

      it("keeps a pending attempt when the learner opens the memory check from Làm ngay", async () => {
        render(<LearningWorkspace data={twoQuestions()} />);
        fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));
        mockedSubmit.mockReturnValueOnce(new Promise(() => {}) as never);
        fireEvent.click(screen.getByRole("radio", { name: /Đúng Câu nhớ một/ }));
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
        });
        expect(screen.getByRole("button", { name: "Đang kiểm tra..." })).not.toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Xem kết quả chủ đề" }));
        expect(screen.getByText("Còn 2 câu Memory check cần làm")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Làm ngay/ }));

        expect(screen.getByRole("heading", { name: "Câu nhớ một" })).not.toBeNull();
        expect(screen.getByRole("button", { name: "Đang kiểm tra..." }).hasAttribute("disabled")).toBe(true);
        expect(mockedSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });
});
