// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, renderSwitchable, screen, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitCardReview } from "@/app/actions/review";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { resetCardReviewQueueForTests } from "@/hooks/use-card-review-queue";
import { recordedTranslations } from "@/lib/i18n/message-ref";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: English localization U3 CP4 (AC1/AC3/AC4/AC5/AC6) - memory check (đang làm, đã qua, đổi giữa chừng) và câu bài tập (chọn,
//   kiểm tra, đúng, sai, lỗi lưu) hiện tiếng Anh khi ngôn ngữ là en, không còn chữ giao diện tiếng Việt và không lộ khóa catalog thô.
// - Loại test: component interaction trong jsdom với provider next-intl và catalog thật; Server Action `submitQuestionAnswer` thay tại
//   ranh giới nhưng đi qua wrapper `submitQuestionAnswerLocalized` thật, nên ngôn ngữ và khóa từng trường (`error`, `explanation`,
//   `progressError`) được ghi như ở server.
// - Case chính: số câu có phân tách nghìn ở en (1,234) và chữ số thường ở vi, số ít/số nhiều của "câu hỏi", lời nhắc mặc định của câu sai,
//   giải thích do tác giả viết luôn hiện đúng như đã viết, đổi ngôn ngữ khi thông báo còn trên trang (lỗi lưu, giải thích mặc định,
//   cảnh báo tiến độ), request đáp lại sau khi đã đổi ngôn ngữ hoặc cookie đổi ở tab khác, và toast hoàn thành memory check phát bằng
//   ngôn ngữ LÚC phát.
// - Giới hạn: nội dung câu hỏi, lựa chọn và giải thích của giáo viên là dữ liệu nên không dịch; thông báo hệ thống của từng đường lỗi
//   của action do __tests__/actions/progress-english.test.ts giữ.

vi.mock("@/app/actions/progress", () => ({ submitQuestionAnswer: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockedSubmit = vi.mocked(submitQuestionAnswer);
const mockedToast = vi.mocked(toast);
const mockedUseRouter = vi.mocked(useRouter);
void submitCardReview;

const ids = {
  memory: "66666666-6666-4666-8666-666666666666",
  first: "66666666-6666-4666-8666-666666666601",
  second: "66666666-6666-4666-8666-666666666602",
  exercise: "77777777-7777-4777-8777-777777777777",
  group: "77777777-7777-4777-8777-777777777701",
  exerciseQuestion: "77777777-7777-4777-8777-777777777702",
  rightExerciseOption: "77777777-7777-4777-8777-777777777703",
  wrongExerciseOption: "77777777-7777-4777-8777-777777777704",
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

function workspaceData(overrides: Partial<LearningWorkspaceData> = {}): LearningWorkspaceData {
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
                options: [
                  { id: ids.rightExerciseOption, content: "Lựa chọn đúng", label: "A", order_index: 1 },
                  { id: ids.wrongExerciseOption, content: "Lựa chọn sai", label: "B", order_index: 2 },
                ],
              },
            ],
          },
        ],
      },
    ],
    memoryCheck: { id: ids.memory, questions: [memoryQuestion(ids.first, 1), memoryQuestion(ids.second, 2)] },
    isMemoryCheckPassed: false,
    unseenCardIds: [],
    unratedCardIds: [],
    memoryGateClearedCardIds: null,
    dueCardIds: [],
    answers: {},
    progress: null,
    ...overrides,
  };
}

// Chủ đề không có thẻ và không có memory check: mở thẳng tới bài tập.
const exerciseOnly = (overrides: Partial<LearningWorkspaceData> = {}) =>
  workspaceData({ memoryCheck: null, isMemoryCheckPassed: true, ...overrides });

// Một câu memory check duy nhất: đúng câu đó là qua.
const singleMemory = (overrides: Partial<LearningWorkspaceData> = {}) =>
  workspaceData({ memoryCheck: { id: ids.memory, questions: [memoryQuestion(ids.first, 1)] }, ...overrides });

const VIETNAMESE_CHROME = [
  "Kiểm tra đáp án",
  "Xác nhận đáp án",
  "Đã đúng",
  "Câu tiếp theo",
  "Thử lại",
  "Chưa chính xác",
  "Giải thích",
  "Câu hỏi 1",
  "Tải lại",
  "Xem lại Memory check",
];

const TEXT = {
  defaultExplanation: {
    vi: "Đáp án chưa chính xác. Bạn hãy thử lại nhé!",
    en: "That answer isn't correct. Give it another try!",
  },
  progressSync: {
    vi: "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    en: "Your answer was saved, but your lesson progress couldn't be recorded.",
  },
  saveFailed: {
    vi: "Không thể lưu câu trả lời lúc này.",
    en: "Couldn't save your answer right now.",
  },
  progressNotice: {
    vi: "Đã lưu câu trả lời, nhưng chưa ghi nhận được tiến độ bài học.",
    en: "Your answer was saved, but your lesson progress couldn't be recorded.",
  },
  memoryPassed: { vi: "Đã hoàn thành memory check!", en: "You've completed the memory check!" },
} as const;

type Fields = { error?: string; explanation?: string; progressError?: string };

/** Một câu trả lời của action như server dựng: mỗi trường qua bộ dịch ghi nhận của riêng nó (như `submitQuestionAnswer`). */
async function systemReply(parts: {
  error?: "saveFailed";
  defaultExplanation?: boolean;
  authored?: string;
  progressSync?: boolean;
  isCorrect?: boolean;
  isMemoryCheckPassed?: boolean;
}) {
  const te = await recordedTranslations("learn", "error");
  const tx = await recordedTranslations("learn", "explanation");
  const tp = await recordedTranslations("learn", "progressError");
  const fields: Fields = {};
  if (parts.error) fields.error = te(`actions.progress.${parts.error}`);
  if (parts.defaultExplanation) fields.explanation = tx("actions.progress.defaultExplanation");
  if (parts.authored) fields.explanation = parts.authored;
  if (parts.progressSync) fields.progressError = tp("actions.progress.progressSync");
  if (fields.error) return { error: fields.error } as never;
  return {
    success: true,
    isCorrect: parts.isCorrect ?? false,
    ...(fields.explanation ? { explanation: fields.explanation } : {}),
    ...(fields.progressError ? { progressError: fields.progressError } : {}),
    ...(parts.isMemoryCheckPassed === undefined ? {} : { isMemoryCheckPassed: parts.isMemoryCheckPassed }),
  } as never;
}

const hold = () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release: () => release() };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedSubmit.mockReset();
  mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  setServerTestLocale("vi");
});

afterEach(() => {
  cleanup();
  resetCardReviewQueueForTests();
  setServerTestLocale("vi");
});

const openMemoryStep = (listName: string) =>
  fireEvent.click(within(screen.getByRole("list", { name: listName })).getByRole("button", { name: /^Memory check/ }));

const checkAnswer = async (option: RegExp, button: string) => {
  fireEvent.click(screen.getByRole("radio", { name: option }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: button }));
  });
};

describe("memory check in English", () => {
  it("shows the open memory check with English labels, progress and a graded wrong answer", async () => {
    setServerTestLocale("en");
    mockedSubmit.mockImplementation(() => systemReply({ defaultExplanation: true }));
    const { container } = render(<LearningWorkspace data={workspaceData()} />, { locale: "en" });

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Câu nhớ 1");
    // Một nhãn ở thanh bước, một nhãn ở đầu bước memory check.
    expect(screen.getAllByText("Memory check", { selector: "span" }).length).toBe(2);
    expect(screen.getByText("0/2 correct")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Memory check progress" });
    expect(bar.getAttribute("aria-valuetext")).toBe("0 of 2 questions correct");
    expect(screen.getByRole("button", { name: "Check answer" }).hasAttribute("disabled")).toBe(true);

    await checkAnswer(/Sai 1/, "Check answer");
    expect(screen.getByText("Not quite right")).toBeTruthy();
    expect(screen.getByText(TEXT.defaultExplanation.en)).toBeTruthy();
    expect(screen.getByText("This question will come back after the remaining ones.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Sai 1/ }).textContent).toContain("(you chose incorrectly)");
    expect(screen.getByRole("button", { name: "Next question" })).toBeTruthy();
    for (const text of VIETNAMESE_CHROME) expect(container.textContent).not.toContain(text);
    expect(container.innerHTML).not.toMatch(/\b(learn|learning)\.[a-z]+\./i);
  });

  it("says the question will be answered again when it is the only one left, and announces a correct answer", async () => {
    setServerTestLocale("en");
    mockedSubmit.mockImplementationOnce(() => systemReply({ defaultExplanation: true }));
    render(<LearningWorkspace data={singleMemory()} />, { locale: "en" });
    await checkAnswer(/Sai 1/, "Check answer");
    expect(screen.getByText("You'll answer this question again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    mockedSubmit.mockImplementationOnce(() => systemReply({ isCorrect: true }));
    await checkAnswer(/Đúng 1/, "Check answer");
    expect(screen.getByRole("radio", { name: /Đúng 1/ }).textContent).toContain("(you chose correctly)");
    expect(screen.getByText("Correct!")).toBeTruthy();
  });

  it("labels the check button while the answer is being checked", async () => {
    setServerTestLocale("en");
    const gate = hold();
    mockedSubmit.mockImplementation(async () => {
      await gate.gate;
      return systemReply({ isCorrect: true });
    });
    render(<LearningWorkspace data={workspaceData()} />, { locale: "en" });
    await checkAnswer(/Đúng 1/, "Check answer");
    expect(screen.getByRole("button", { name: "Checking..." }).hasAttribute("disabled")).toBe(true);
    await act(async () => {
      gate.release();
    });
    expect(screen.getByRole("button", { name: "Next question" })).toBeTruthy();
  });

  it("groups large counts in English only", () => {
    const many = Array.from({ length: 1234 }, (_, index) => memoryQuestion(`66666666-6666-4666-8666-${String(index).padStart(12, "0")}`, index + 1));
    const view = render(
      <LearningWorkspace data={workspaceData({ memoryCheck: { id: ids.memory, questions: many } })} />,
      { locale: "en" },
    );
    expect(screen.getByText("0/1,234 correct")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("0 of 1,234 questions correct");
    view.unmount();
    render(<LearningWorkspace data={workspaceData({ memoryCheck: { id: ids.memory, questions: many } })} />, { locale: "vi" });
    expect(screen.getByText("Đã đúng 0/1234")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Đã đúng 0 trên 1234 câu");
  });

  it("shows the read-only review of a passed memory check with the saved answers and explanations", () => {
    render(
      <LearningWorkspace
        data={workspaceData({
          isMemoryCheckPassed: true,
          answers: { [ids.first]: rightOption(1), [ids.second]: rightOption(2) },
          progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
        })}
      />,
      { locale: "en" },
    );
    openMemoryStep("Lesson steps");
    expect(screen.getByRole("heading", { name: "Memory check review" })).toBeTruthy();
    expect(screen.getByText("2 questions, your correct answers are marked.")).toBeTruthy();
    expect(screen.getAllByText("Explanation").length).toBe(2);
    expect(screen.getByText("Giải thích 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Do the exercises" })).toBeTruthy();
    expect(screen.getAllByText("(you chose correctly)").length).toBe(2);
  });

  it("words the review of a one-question memory check in the singular, and keeps the Vietnamese wording in Vietnamese", () => {
    const passed = singleMemory({
      isMemoryCheckPassed: true,
      answers: { [ids.first]: rightOption(1) },
      progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
    });
    const view = render(<LearningWorkspace data={passed} />, { locale: "en" });
    openMemoryStep("Lesson steps");
    expect(screen.getByText("1 question, your correct answer is marked.")).toBeTruthy();
    view.unmount();
    render(<LearningWorkspace data={passed} />, { locale: "vi" });
    openMemoryStep("Các bước của bài học");
    expect(screen.getByRole("heading", { name: "Xem lại Memory check" })).toBeTruthy();
    expect(screen.getByText("1 câu, đáp án đúng của bạn được đánh dấu.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Làm bài tập" })).toBeTruthy();
  });

  it("offers a reload when the local queue is empty but the server has not confirmed the pass", () => {
    const stale = workspaceData({ answers: { [ids.first]: rightOption(1), [ids.second]: rightOption(2) } });
    const view = render(<LearningWorkspace data={stale} />, { locale: "en" });
    expect(screen.getByRole("heading", { name: "The Memory check just changed" })).toBeTruthy();
    expect(screen.getByText("Reload to answer the remaining questions before opening the exercises.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    view.unmount();
    render(<LearningWorkspace data={stale} />, { locale: "vi" });
    expect(screen.getByRole("heading", { name: "Memory check vừa thay đổi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tải lại" })).toBeTruthy();
  });
});

describe("exercise questions in English", () => {
  it("shows the question header, the confirm button and a wrong answer with the default explanation", async () => {
    setServerTestLocale("en");
    mockedSubmit.mockImplementation(() => systemReply({ defaultExplanation: true }));
    const { container } = render(<LearningWorkspace data={exerciseOnly()} />, { locale: "en" });

    expect(screen.getByText("Question 1/1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm answer" }).hasAttribute("disabled")).toBe(true);
    await checkAnswer(/Lựa chọn sai/, "Confirm answer");
    expect(screen.getByText("Not quite right")).toBeTruthy();
    expect(screen.getByText(TEXT.defaultExplanation.en)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    for (const text of VIETNAMESE_CHROME) expect(container.textContent).not.toContain(text);
    expect(container.innerHTML).not.toMatch(/\b(learn|learning)\.[a-z]+\./i);
  });

  it("shows an authored explanation as written, a correct result and the lesson progress notice", async () => {
    setServerTestLocale("en");
    mockedSubmit.mockImplementation(() => systemReply({ isCorrect: true, authored: "Vì đây là thì hiện tại hoàn thành.", progressSync: true }));
    render(<LearningWorkspace data={exerciseOnly()} />, { locale: "en" });
    await checkAnswer(/Lựa chọn đúng/, "Confirm answer");
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("Vì đây là thì hiện tại hoàn thành.")).toBeTruthy();
    expect(screen.getByText(TEXT.progressNotice.en)).toBeTruthy();
    expect(mockedToast.error).toHaveBeenCalledWith(TEXT.progressSync.en);
  });

  it("falls back to the generic explanation when the server sent none for a wrong answer", async () => {
    mockedSubmit.mockResolvedValue({ success: true, isCorrect: false } as never);
    render(<LearningWorkspace data={exerciseOnly()} />, { locale: "en" });
    await checkAnswer(/Lựa chọn sai/, "Confirm answer");
    expect(screen.getByText("Sorry, that answer isn't correct. Reread the material and try again!")).toBeTruthy();
  });

  it("keeps the choice and explains a failed save in English, in the singular wording of the result", async () => {
    setServerTestLocale("en");
    mockedSubmit.mockImplementation(() => systemReply({ error: "saveFailed" }));
    render(<LearningWorkspace data={exerciseOnly()} />, { locale: "en" });
    await checkAnswer(/Lựa chọn sai/, "Confirm answer");
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Couldn't save your answer")).toBeTruthy();
    expect(alert.textContent).toContain(`${TEXT.saveFailed.en} Your choice was kept, so try sending it again.`);
    expect(screen.getByRole("radio", { name: /Lựa chọn sai/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("tells the learner a request that threw could not be sent, in the displayed language", async () => {
    mockedSubmit.mockRejectedValue(new Error("network"));
    const view = renderSwitchable(<LearningWorkspace data={exerciseOnly()} />, "en");
    await checkAnswer(/Lựa chọn sai/, "Confirm answer");
    expect(screen.getByRole("alert").textContent).toContain("Couldn't send your answer right now.");
    view.switchLocale("vi");
    expect(screen.getByRole("alert").textContent).toContain("Không thể gửi câu trả lời lúc này.");
    expect(screen.getByRole("alert").textContent).toContain("Chưa lưu được câu trả lời");
  });
});

describe("answer messages follow the language shown", () => {
  it("re-translates an answer error that stays on the page when the learner switches language", async () => {
    mockedSubmit.mockImplementation(() => systemReply({ error: "saveFailed" }));
    const view = renderSwitchable(<LearningWorkspace data={exerciseOnly()} />, "vi");
    await checkAnswer(/Lựa chọn sai/, "Xác nhận đáp án");
    expect(screen.getByRole("alert").textContent).toContain(TEXT.saveFailed.vi);
    view.switchLocale("en");
    expect(screen.getByRole("alert").textContent).toContain(TEXT.saveFailed.en);
    expect(screen.getByRole("alert").textContent).not.toContain(TEXT.saveFailed.vi);
    view.switchLocale("vi");
    expect(screen.getByRole("alert").textContent).toContain(TEXT.saveFailed.vi);
  });

  it("re-translates a memory-check answer error when the learner switches language", async () => {
    mockedSubmit.mockImplementation(() => systemReply({ error: "saveFailed" }));
    const view = renderSwitchable(<LearningWorkspace data={workspaceData()} />, "vi");
    await checkAnswer(/Sai 1/, "Kiểm tra đáp án");
    expect(screen.getByRole("alert").textContent).toContain(TEXT.saveFailed.vi);
    view.switchLocale("en");
    expect(screen.getByRole("alert").textContent).toContain(TEXT.saveFailed.en);
  });

  it("re-translates the default explanation of a wrong answer, keeping a progress notice and its toast in the displayed language", async () => {
    mockedSubmit.mockImplementation(() => systemReply({ defaultExplanation: true, progressSync: true }));
    const view = renderSwitchable(<LearningWorkspace data={exerciseOnly()} />, "vi");
    await checkAnswer(/Lựa chọn sai/, "Xác nhận đáp án");
    expect(screen.getByText(TEXT.defaultExplanation.vi)).toBeTruthy();
    expect(screen.getByText(TEXT.progressNotice.vi)).toBeTruthy();
    expect(mockedToast.error).toHaveBeenCalledWith(TEXT.progressSync.vi);
    view.switchLocale("en");
    expect(screen.getByText(TEXT.defaultExplanation.en)).toBeTruthy();
    expect(screen.queryByText(TEXT.defaultExplanation.vi)).toBeNull();
    expect(screen.getByText(TEXT.progressNotice.en)).toBeTruthy();
  });

  it("keeps an authored explanation as written across a switch while the progress notice changes language", async () => {
    mockedSubmit.mockImplementation(() => systemReply({ authored: "Giải thích của giáo viên.", progressSync: true }));
    const view = renderSwitchable(<LearningWorkspace data={exerciseOnly()} />, "vi");
    await checkAnswer(/Lựa chọn sai/, "Xác nhận đáp án");
    expect(screen.getByText("Giải thích của giáo viên.")).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText("Giải thích của giáo viên.")).toBeTruthy();
    expect(screen.getByText(TEXT.progressNotice.en)).toBeTruthy();
    expect(screen.queryByText(TEXT.progressNotice.vi)).toBeNull();
  });

  it("shows a reply built in the other language (cookie changed in another tab) in the displayed language, and keeps the authored text", async () => {
    setServerTestLocale("vi");
    mockedSubmit.mockImplementation(() => systemReply({ defaultExplanation: true, progressSync: true }));
    const { unmount } = render(<LearningWorkspace data={exerciseOnly()} />, { locale: "en" });
    await checkAnswer(/Lựa chọn sai/, "Confirm answer");
    expect(screen.getByText(TEXT.defaultExplanation.en)).toBeTruthy();
    expect(screen.queryByText(TEXT.defaultExplanation.vi)).toBeNull();
    expect(mockedToast.error).toHaveBeenCalledWith(TEXT.progressSync.en);
    unmount();
    mockedToast.error.mockClear();

    mockedSubmit.mockReset();
    mockedSubmit.mockImplementation(() => systemReply({ authored: "Giải thích của giáo viên.", progressSync: true }));
    render(<LearningWorkspace data={exerciseOnly()} />, { locale: "en" });
    await checkAnswer(/Lựa chọn sai/, "Confirm answer");
    expect(screen.getByText("Giải thích của giáo viên.")).toBeTruthy();
    expect(screen.getByText(TEXT.progressNotice.en)).toBeTruthy();
    expect(mockedToast.error).toHaveBeenCalledWith(TEXT.progressSync.en);
  });

  it("shows an answer error built in the other language in the displayed language", async () => {
    setServerTestLocale("vi");
    mockedSubmit.mockImplementation(() => systemReply({ error: "saveFailed" }));
    render(<LearningWorkspace data={exerciseOnly()} />, { locale: "en" });
    await checkAnswer(/Lựa chọn sai/, "Confirm answer");
    expect(screen.getByRole("alert").textContent).toContain(TEXT.saveFailed.en);
    expect(screen.getByRole("alert").textContent).not.toContain(TEXT.saveFailed.vi);
  });

  it("uses the language at the time the reply lands for the progress toast when the learner switches while the answer is in flight", async () => {
    const gate = hold();
    mockedSubmit.mockImplementation(async () => {
      const reply = await systemReply({ defaultExplanation: true, progressSync: true });
      await gate.gate;
      return reply;
    });
    const view = renderSwitchable(<LearningWorkspace data={exerciseOnly()} />, "vi");
    await checkAnswer(/Lựa chọn sai/, "Xác nhận đáp án");
    expect(mockedToast.error).not.toHaveBeenCalled();
    view.switchLocale("en");
    await act(async () => {
      gate.release();
    });
    expect(mockedToast.error).toHaveBeenCalledWith(TEXT.progressSync.en);
    expect(screen.getByText(TEXT.defaultExplanation.en)).toBeTruthy();
  });

  it("toasts the progress warning in the language shown when a reply lands after the learner left the memory check", async () => {
    const gate = hold();
    mockedSubmit.mockImplementation(async () => {
      const reply = await systemReply({ defaultExplanation: true, progressSync: true });
      await gate.gate;
      return reply;
    });
    const view = renderSwitchable(<LearningWorkspace data={workspaceData()} />, "vi");
    await checkAnswer(/Sai 1/, "Kiểm tra đáp án");
    fireEvent.click(within(screen.getByRole("list", { name: "Các bước của bài học" })).getByRole("button", { name: /^Bài tập/ }));
    expect(screen.queryByRole("button", { name: "Kiểm tra đáp án" })).toBeNull();
    view.switchLocale("en");
    await act(async () => {
      gate.release();
    });
    expect(mockedToast.error).toHaveBeenCalledWith(TEXT.progressSync.en);
    expect(mockedToast.error).not.toHaveBeenCalledWith(TEXT.progressSync.vi);
  });

  it("announces the completed memory check in the language shown when the passing answer lands", async () => {
    const gate = hold();
    mockedSubmit.mockImplementation(async () => {
      await gate.gate;
      return systemReply({ isCorrect: true, isMemoryCheckPassed: true });
    });
    const view = renderSwitchable(<LearningWorkspace data={singleMemory()} />, "vi");
    await checkAnswer(/Đúng 1/, "Kiểm tra đáp án");
    view.switchLocale("en");
    await act(async () => {
      gate.release();
    });
    expect(mockedToast.success).toHaveBeenCalledWith(TEXT.memoryPassed.en);
    expect(mockedToast.success).not.toHaveBeenCalledWith(TEXT.memoryPassed.vi);
  });
});
