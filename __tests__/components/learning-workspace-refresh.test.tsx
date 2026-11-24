// @vitest-environment jsdom
import React, { useEffect, useState } from "react";
import { act, cleanup, fireEvent, renderSwitchable, screen, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "next/navigation";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitCardReview } from "@/app/actions/review";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { resetCardReviewQueueForTests } from "@/hooks/use-card-review-queue";
import { recordedTranslations } from "@/lib/i18n/message-ref";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import { TopicViewStateProvider } from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/topic-view-state";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: ENLOC-004 (AC1-AC6) - sau khi học viên chấm thẻ và trả lời câu hỏi, `router.refresh()` (đổi ngôn ngữ) làm key của trang đổi
//   và workspace dựng lại; bước, câu, lựa chọn, kết quả và giải thích vẫn hiện, chữ đổi theo ngôn ngữ mới.
// - Loại test: component trong jsdom. Host giả lập trang: giữ `data` và key theo công thức của page.tsx, bọc trong TopicViewStateProvider
//   như layout `[topic-slug]`; đổi ngôn ngữ dùng provider next-intl thật. Server Action thay tại ranh giới.
// - Case chính: câu bài tập sai và đúng, câu memory sai (AC1/AC2); thẻ đổi id thì dựng lại như LF3 AC6 (AC3); hàng đợi, tập due và
//   bước khóa lấy từ dữ liệu mới (AC4); store mới (rời URL chủ đề hay F5) thì vào như thường (AC5); lần gửi đang chờ không mang qua và
//   không kẹt khi kết quả về sau (AC6); chủ đề hoặc id câu hỏi khác thì không khôi phục (G3).
// - Giới hạn: page.tsx là server component không render trong jsdom nên công thức key được sao chép ở đây; việc layout giữ nguyên qua
//   `router.refresh()` và dựng lại khi đổi chủ đề do kiểm tra trình duyệt ở Final của kế hoạch chứng minh.

vi.mock("@/app/actions/progress", () => ({ submitQuestionAnswer: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockedSubmit = vi.mocked(submitQuestionAnswer);
const mockedUseRouter = vi.mocked(useRouter);
void submitCardReview;

const topic = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "topic-one",
  title: "Bài một",
  orderIndex: 1,
  chapterId: "11111111-1111-4111-8111-111111111111",
};
const otherTopic = { ...topic, id: "22222222-2222-4222-8222-333333333333", slug: "topic-two", title: "Bài hai", orderIndex: 2 };
const card = {
  id: "e0000000-0000-4000-8000-00000000000a",
  front_content: { word: "reliable" },
  back_content: { translation: "đáng tin cậy" },
  audio_url: null,
  image_url: null,
};
const newCard = { ...card, id: "e0000000-0000-4000-8000-00000000000b", front_content: { word: "improve" } };

const ids = {
  memory: "66666666-6666-4666-8666-666666666666",
  memoryQuestion: "66666666-6666-4666-8666-666666666601",
  exercise: "77777777-7777-4777-8777-777777777777",
  group: "77777777-7777-4777-8777-777777777701",
  question: "77777777-7777-4777-8777-777777777702",
  otherQuestion: "77777777-7777-4777-8777-777777777799",
  right: "77777777-7777-4777-8777-777777777703",
  wrong: "77777777-7777-4777-8777-777777777704",
};

function exerciseQuestion(id: string) {
  return {
    id,
    content: "Câu bài tập",
    explanation: null,
    order_index: 1,
    options: [
      { id: ids.right, content: "Lựa chọn đúng", label: "A", order_index: 1 },
      { id: ids.wrong, content: "Lựa chọn sai", label: "B", order_index: 2 },
    ],
  };
}

const memoryCheck = {
  id: ids.memory,
  questions: [
    {
      id: ids.memoryQuestion,
      content: "Câu nhớ",
      explanation: "Giải thích nhớ",
      order_index: 1,
      options: [
        { id: "aaaaaaaa-0000-4000-8000-000000000001", content: "Đúng 1", label: "A", order_index: 1 },
        { id: "bbbbbbbb-0000-4000-8000-000000000001", content: "Sai 1", label: "B", order_index: 2 },
      ],
    },
  ],
};

/** Dữ liệu của một chủ đề đã học xong thẻ: lần chấm thẻ trong phiên làm `unratedCardIds`/`dueCardIds` đổi giữa hai lần tải. */
function workspaceData(overrides: Partial<LearningWorkspaceData> = {}): LearningWorkspaceData {
  const flashcards = overrides.flashcards ?? [card];
  return {
    courseId: "c0c0c0c0-0000-4000-8000-000000000001",
    courseSlug: "toeic-foundation",
    courseTitle: "TOEIC Foundation",
    syllabus: [{ id: topic.chapterId, title: "Chương một", orderIndex: 1, topics: [{ ...topic, isCompleted: false }] }],
    currentTopic: topic,
    flashcards,
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
            questions: [exerciseQuestion(ids.question)],
          },
        ],
      },
    ],
    memoryCheck: null,
    isMemoryCheckPassed: true,
    unseenCardIds: [],
    unratedCardIds: flashcards.map((item) => item.id),
    memoryGateClearedCardIds: flashcards.map((item) => item.id),
    dueCardIds: [],
    answers: {},
    progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
    ...overrides,
  };
}

// Cùng công thức với `workspaceKey` của page.tsx (chủ đề, thẻ, chưa xem, chưa Ổn/Dễ, đến hạn).
const keyOf = (data: LearningWorkspaceData) =>
  [
    `${data.courseSlug}/${data.currentTopic.slug}`,
    data.flashcards.map((item) => item.id).join(","),
    data.unseenCardIds.join(","),
    data.unratedCardIds.join(","),
    data.dueCardIds.join(","),
  ].join("|");

let applyData: (data: LearningWorkspaceData) => void = () => {};
let newStore: () => void = () => {};

function Host({ first }: { first: LearningWorkspaceData }) {
  const [data, setData] = useState(first);
  // Đổi `storeKey` dựng lại provider: như layout bị dựng lại khi rời URL chủ đề hoặc tải lại trang.
  const [storeKey, setStoreKey] = useState(0);
  useEffect(() => {
    applyData = setData;
    newStore = () => setStoreKey((current) => current + 1);
  }, []);
  return (
    <TopicViewStateProvider key={storeKey}>
      <LearningWorkspace key={keyOf(data)} data={data} />
    </TopicViewStateProvider>
  );
}

const refresh = (data: LearningWorkspaceData) =>
  act(() => {
    applyData(data);
  });

const REPLY = {
  incorrect: async () => {
    const tx = await recordedTranslations("learn", "explanation");
    return { success: true, isCorrect: false, explanation: tx("actions.progress.defaultExplanation") } as never;
  },
  correct: async () => ({ success: true, isCorrect: true, explanation: "Vì đây là thì hiện tại hoàn thành." }) as never,
};

const EXPLANATION = {
  en: "That answer isn't correct. Give it another try!",
  vi: "Đáp án chưa chính xác. Bạn hãy thử lại nhé!",
};

const answerExercise = async (option: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: option }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm answer" }));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedSubmit.mockReset();
  mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  setServerTestLocale("en");
});

afterEach(() => {
  cleanup();
  resetCardReviewQueueForTests();
  setServerTestLocale("vi");
});

describe("workspace refresh that changes the page key", () => {
  it("keeps a wrong exercise answer, its explanation and the question after a language switch (AC1)", async () => {
    mockedSubmit.mockImplementation(REPLY.incorrect);
    const view = renderSwitchable(<Host first={workspaceData()} />, "en");
    expect(screen.getByText("Question 1/1")).toBeTruthy();
    await answerExercise(/Lựa chọn sai/);
    expect(screen.getByText("Not quite right")).toBeTruthy();

    // Chấm thẻ trong phiên làm tập chưa Ổn/Dễ đổi: key mới, workspace dựng lại.
    await refresh(workspaceData({ unratedCardIds: [] }));
    await view.switchLocale("vi");

    expect(screen.getByText("Câu bài tập")).toBeTruthy();
    expect(screen.getByText("Chưa chính xác")).toBeTruthy();
    expect(screen.getByText(EXPLANATION.vi)).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Lựa chọn sai/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByText(EXPLANATION.en)).toBeNull();
  });

  it("keeps a correct exercise answer and its authored explanation as written (AC1)", async () => {
    mockedSubmit.mockImplementation(REPLY.correct);
    const view = renderSwitchable(<Host first={workspaceData()} />, "en");
    await answerExercise(/Lựa chọn đúng/);
    expect(screen.getByText("Correct")).toBeTruthy();

    await refresh(workspaceData({ unratedCardIds: [], answers: { [ids.question]: ids.right } }));
    await view.switchLocale("vi");

    expect(screen.getByText("Câu bài tập")).toBeTruthy();
    expect(screen.getByText("Chính xác")).toBeTruthy();
    expect(screen.getByText("Vì đây là thì hiện tại hoàn thành.")).toBeTruthy();
  });

  it("keeps the memory step, the question and a wrong memory answer (AC2)", async () => {
    mockedSubmit.mockImplementation(REPLY.incorrect);
    const memory = (overrides: Partial<LearningWorkspaceData> = {}) =>
      workspaceData({ memoryCheck, isMemoryCheckPassed: false, ...overrides });
    const view = renderSwitchable(<Host first={memory()} />, "en");
    expect(screen.getByText("Câu nhớ")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Sai 1/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    });
    expect(screen.getByText("You'll answer this question again.")).toBeTruthy();

    await refresh(memory({ unratedCardIds: [] }));
    await view.switchLocale("vi");

    expect(screen.getByText("Câu nhớ")).toBeTruthy();
    expect(screen.getByText(EXPLANATION.vi)).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Sai 1/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("rebuilds from the new data when the card ids change, as the cards_locked recovery requires (AC3)", async () => {
    mockedSubmit.mockImplementation(REPLY.incorrect);
    renderSwitchable(<Host first={workspaceData()} />, "en");
    await answerExercise(/Lựa chọn sai/);
    expect(screen.getByText(EXPLANATION.en)).toBeTruthy();

    await refresh(
      workspaceData({
        flashcards: [card, newCard],
        unseenCardIds: [newCard.id],
        unratedCardIds: [card.id, newCard.id],
        memoryGateClearedCardIds: null,
        progress: { isFlashcardCompleted: false, isExerciseCompleted: false, isTopicCompleted: false },
      }),
    );

    expect(screen.queryByText(EXPLANATION.en)).toBeNull();
    expect(screen.queryByText("Not quite right")).toBeNull();
    expect(screen.getByRole("button", { name: "Show answer" })).toBeTruthy();
    expect(screen.getByText("improve")).toBeTruthy();
  });

  it("takes the due set and the gates from the refreshed data, not from the carried state (AC4)", async () => {
    mockedSubmit.mockImplementation(REPLY.incorrect);
    renderSwitchable(<Host first={workspaceData()} />, "en");
    await answerExercise(/Lựa chọn sai/);

    await refresh(workspaceData({ unratedCardIds: [], dueCardIds: [card.id] }));
    expect(screen.getByText(EXPLANATION.en)).toBeTruthy();

    const steps = screen.getByRole("list", { name: "Lesson steps" });
    fireEvent.click(within(steps).getByRole("button", { name: /^Vocabulary/ }));
    expect(screen.getByText("You have 1 card due in this lesson")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review 1 card now" })).toBeTruthy();
  });

  it("does not restore a step that the refreshed data keeps locked (G3)", async () => {
    mockedSubmit.mockImplementation(REPLY.incorrect);
    const locked = (overrides: Partial<LearningWorkspaceData> = {}) =>
      workspaceData({ memoryCheck, isMemoryCheckPassed: true, ...overrides });
    renderSwitchable(<Host first={locked()} />, "en");
    await answerExercise(/Lựa chọn sai/);
    expect(screen.getByText(EXPLANATION.en)).toBeTruthy();

    // Memory check chưa qua trong dữ liệu mới: bước bài tập khóa, nên không khôi phục câu hỏi.
    await refresh(locked({ unratedCardIds: [], isMemoryCheckPassed: false }));

    expect(screen.queryByText(EXPLANATION.en)).toBeNull();
    expect(screen.queryByText("Câu bài tập")).toBeNull();
  });

  it("lands as on a fresh load when the topic store ended, such as after leaving the topic or F5 (AC5)", async () => {
    mockedSubmit.mockImplementation(REPLY.incorrect);
    renderSwitchable(<Host first={workspaceData()} />, "en");
    await answerExercise(/Lựa chọn sai/);
    expect(screen.getByText(EXPLANATION.en)).toBeTruthy();

    await act(async () => {
      newStore();
    });
    await refresh(workspaceData({ unratedCardIds: [] }));

    expect(screen.queryByText(EXPLANATION.en)).toBeNull();
    expect(screen.queryByText("Not quite right")).toBeNull();
    expect(screen.getByRole("button", { name: "Confirm answer" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: /Lựa chọn sai/ }).getAttribute("aria-checked")).not.toBe("true");
  });

  it("does not carry an answer that is still in flight and never leaves the question pending (AC6)", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockedSubmit.mockImplementation(async () => {
      await gate;
      return REPLY.incorrect();
    });
    renderSwitchable(<Host first={workspaceData()} />, "en");
    fireEvent.click(screen.getByRole("radio", { name: /Lựa chọn sai/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm answer" }));
    });
    expect(screen.getByRole("button", { name: "Checking…" })).toBeTruthy();

    await refresh(workspaceData({ unratedCardIds: [] }));
    // Kết quả về sau lần dựng lại rơi vào workspace đã unmount; câu hỏi mới hoạt động như tải mới.
    await act(async () => {
      release();
      await gate;
    });

    expect(screen.queryByRole("button", { name: "Checking…" })).toBeNull();
    expect(screen.getByRole("button", { name: "Confirm answer" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Lựa chọn sai/ }).hasAttribute("disabled")).toBe(false);
  });

  it("does not restore for another topic or another question set (G3)", async () => {
    mockedSubmit.mockImplementation(REPLY.incorrect);
    renderSwitchable(<Host first={workspaceData()} />, "en");
    await answerExercise(/Lựa chọn sai/);
    expect(screen.getByText(EXPLANATION.en)).toBeTruthy();

    await refresh(workspaceData({ unratedCardIds: [], currentTopic: otherTopic }));
    expect(screen.queryByText(EXPLANATION.en)).toBeNull();

    await answerExercise(/Lựa chọn sai/);
    expect(screen.getByText(EXPLANATION.en)).toBeTruthy();
    const base = workspaceData({ currentTopic: otherTopic });
    await refresh({
      ...base,
      unratedCardIds: [],
      exercises: [{ ...base.exercises[0], groups: [{ ...base.exercises[0].groups[0], questions: [exerciseQuestion(ids.otherQuestion)] }] }],
    });
    expect(screen.queryByText(EXPLANATION.en)).toBeNull();
  });
});
