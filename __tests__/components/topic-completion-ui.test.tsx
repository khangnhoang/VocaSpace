/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitCardReview } from "@/app/actions/review";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import { TOPIC_COMPLETED_MESSAGE } from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/topic-progress-feedback";
import type { LearningWorkspaceData, TopicProgress } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: bảo vệ UI hoàn thành topic D4 (H6/G7) trong learning workspace.
// - Loại test: component interaction test qua action boundary mock.
// - Đối tượng: LearningWorkspace (thẻ, bài tập qua QuestionResponse) và MemoryCheckStage.
// - AC7 (ứng viên chờ Owner duyệt): đúng thì hiện "Câu tiếp theo" (khi còn câu sau) và không tự chuyển câu; sai thì giải thích nằm tại chỗ với "Thử lại"; lỗi lưu giữ nguyên lựa chọn và không bị hiểu là đáp án sai; kết quả trễ của câu cũ không đánh dấu câu mới.
// - Case thành công: câu standalone hiển thị trước group, không có passage và không có nhãn nhóm (group đánh số không tính phần standalone); toast hoàn thành khi server báo `newlyCompleted`.
// - Case thất bại: `progressError` hiện toast nhưng không chặn việc học tiếp.
// - Ổn định/resilience: câu cuối không có "Câu tiếp theo"/"Câu sau"; trả lời đúng câu cuối khi còn câu thiếu thì CTA "Làm câu còn thiếu" đưa tới câu đầu tiên còn thiếu, khi đã đủ thì "Hoàn thành bài tập" mở màn hình hoàn thành có "Xem lại câu hỏi".
// - Invariant cần giữ: trả lời đúng câu cuối của exercise 1 không báo hoàn thành; UI không tự suy ra hoàn thành topic.
// - Trạng thái bền: topic đã hoàn thành (theo `progress` hoặc kết quả server) có nhãn "Đã hoàn thành" ở header,
//   dấu tích trong danh sách chương, và "Bài sau"/"Về tổng quan khóa học" thành nút chính; không còn nút "Hoàn thành bài học".
// - Kết quả verify gần nhất: xem báo cáo checkpoint D8-LUI CP2 (chạy `npx vitest run __tests__/components/topic-completion-ui.test.tsx`).

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

// A saved-correct question offers "Câu tiếp theo" instead of the skip link "Câu sau".
function next() {
  fireEvent.click(screen.getByRole("button", { name: /^(Câu sau|Câu tiếp theo)$/ }));
}

function successToasts() {
  return mockedToast.success.mock.calls.map(([message]) => message);
}

describe("D4 topic completion UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows standalone questions first without a passage or group label, then the groups", () => {
    render(<LearningWorkspace data={workspaceData()} />);

    expect(screen.queryByText(/Câu hỏi độc lập|ngữ liệu/)).toBeNull();
    expect(screen.getByText("Câu đơn")).not.toBeNull();
    expect(screen.queryByText("Đoạn văn A")).toBeNull();
    expect(screen.queryByText(/^Nhóm \d/)).toBeNull();

    next();
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
    next();
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
    next();
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

  it("offers the first missing question after the last one is answered, instead of a next that leads nowhere", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          exercises: [exerciseA, exerciseB],
          answers: { [ids.groupedA]: right(ids.groupedA) },
        })}
      />,
    );
    next();
    next();
    expect(screen.getByText("Câu nhóm B")).not.toBeNull();
    // There is no later question: no skip link, and nothing named "next".
    expect(screen.queryByRole("button", { name: "Câu sau" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();

    mockedSubmit.mockResolvedValueOnce({ success: true, isCorrect: true, topicProgress: progress() });
    await submitExerciseAnswer("Đúng Câu nhóm B");
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Làm câu còn thiếu" }));

    expect(screen.getByText("Câu đơn")).not.toBeNull();
    expect(successToasts()).not.toContain(TOPIC_COMPLETED_MESSAGE);
  });

  it("announces completion only when the server reports the topic newly completed", async () => {
    render(
      <LearningWorkspace
        data={workspaceData({ answers: { [ids.standalone]: right(ids.standalone) } })}
      />,
    );
    next();
    expect(screen.queryByText("Đã hoàn thành")).toBeNull();
    mockedSubmit.mockResolvedValueOnce({
      success: true,
      isCorrect: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true }),
    });
    await submitExerciseAnswer("Đúng Câu nhóm A");

    expect(successToasts()).toContain(TOPIC_COMPLETED_MESSAGE);
    // The completed state shows immediately, without reloading the page.
    expect(screen.getByText("Đã hoàn thành")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Về tổng quan khóa học" }).getAttribute("href")).toBe(
      "/learn/toeic-foundation",
    );
    // Finishing is an explicit step on the last question (no auto-advance, no "next").
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành bài tập" }));
    expect(screen.getByRole("status").textContent).toBe("Bạn đã trả lời đúng hết bài tập.");
    expect(screen.getByRole("button", { name: "Xem lại câu hỏi" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Xem lại câu cuối" })).toBeNull();
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
    expect(nextLinks[0].getAttribute("data-variant")).toBe("default");

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
    expect(successToasts()).not.toContain(TOPIC_COMPLETED_MESSAGE);
  });

  it("uses the card review result for completion and sync failures", async () => {
    const card = {
      id: ids.card,
      front_content: { word: "reliable" },
      back_content: { translation: "đáng tin cậy" },
      audio_url: null,
      image_url: null,
    };
    const data = workspaceData({ flashcards: [card], exercises: [] });
    const { unmount } = render(<LearningWorkspace data={data} />);

    mockedReview.mockResolvedValueOnce({
      success: true,
      topicProgress: progress({ isExerciseCompleted: true, isTopicCompleted: true, newlyCompleted: true }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    });
    expect(successToasts()).toEqual([TOPIC_COMPLETED_MESSAGE]);
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
    expect(successToasts()).toEqual(["Đã nạp xong từ vựng!"]);
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
    expect(successToasts()).toEqual([TOPIC_COMPLETED_MESSAGE]);
    expect(screen.getByText("Đã hoàn thành")).not.toBeNull();
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
