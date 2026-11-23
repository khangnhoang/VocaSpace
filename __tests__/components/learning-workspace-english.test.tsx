// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, renderSwitchable, screen, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitCardReview } from "@/app/actions/review";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { CARD_REVIEW_RETRY_DELAY_MS, resetCardReviewQueueForTests } from "@/hooks/use-card-review-queue";
import { recordedTranslations } from "@/lib/i18n/message-ref";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import LearningWorkspaceFeedback from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspaceFeedback";
import LearningWorkspaceLoading from "@/app/(client)/learn/[course-slug]/[topic-slug]/loading";
import CourseStreakChip from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/CourseStreakChip";
import { renderToStaticMarkup } from "@/__tests__/support/intl";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: English localization U3 CP3 (AC1/AC3/AC4/AC5/AC6) - không gian học của một chủ đề (thanh bước, khóa, màn hình kết thúc thẻ,
//   màn hình hoàn thành, header, điều hướng chân trang, danh sách câu hỏi, trạng thái lỗi/loading/chuỗi ngày) hiện tiếng Anh khi
//   ngôn ngữ là en, không còn chữ giao diện tiếng Việt và không lộ khóa catalog thô.
// - Loại test: component interaction trong jsdom với provider next-intl và catalog thật; Server Action thay tại ranh giới.
// - Đối tượng: LearningWorkspace (kèm TopicCompletionPanel, QuestionNavigator, ChapterSidebar, CourseStreakChip), Feedback, Loading.
// - Case chính: số thẻ/chủ đề có phân tách nghìn ở en và chữ số thường ở vi (1234), số ít/số nhiều, nhãn "Chương N · …"/"Chủ đề N · …",
//   đổi ngôn ngữ khi đang hiện (provider đổi, state giữ), toast phát sau request chờ dùng ngôn ngữ LÚC phát (cảnh báo tiến độ có khóa,
//   lỗi lưu thẻ do client dựng, lý do khóa bài tập), toast đầu trang về số thẻ chưa học.
// - Giới hạn: tiêu đề chủ đề/chương/khóa là nội dung của giáo viên nên giữ nguyên; chữ của MemoryCheckStage, QuestionResponse và ChoiceGroup
//   (U3 CP4) cùng toast hoàn thành memory check do __tests__/components/learning-memory-english.test.tsx giữ, nên file này không assert chữ của chúng.

vi.mock("@/app/actions/progress", () => ({ submitQuestionAnswer: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockedSubmit = vi.mocked(submitQuestionAnswer);
const mockedReview = vi.mocked(submitCardReview);
const mockedToast = vi.mocked(toast);
const mockedUseRouter = vi.mocked(useRouter);

const chapterId = "11111111-1111-4111-8111-111111111111";
const chapterTwoId = "11111111-1111-4111-8111-222222222222";
const topic = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "topic-one",
  title: "Bài một",
  orderIndex: 1,
  chapterId,
};
const topicTwo = { id: "22222222-2222-4222-8222-333333333333", slug: "topic-two", title: "Bài hai", orderIndex: 2, chapterId };
const topicThree = { id: "22222222-2222-4222-8222-444444444444", slug: "topic-three", title: "Bài ba", orderIndex: 1, chapterId: chapterTwoId };

const cardA = {
  id: "e0000000-0000-4000-8000-00000000000a",
  front_content: { word: "reliable", pos: "adj" },
  back_content: { translation: "đáng tin cậy" },
  audio_url: null,
  image_url: null,
};
const cardB = {
  id: "e0000000-0000-4000-8000-00000000000b",
  front_content: { word: "improve" },
  back_content: { translation: "cải thiện" },
  audio_url: null,
  image_url: null,
};

const q = (n: number) => `c0000000-0000-4000-8000-00000000000${n}`;

function question(id: string, content: string, order: number) {
  return {
    id,
    content,
    explanation: null,
    order_index: order,
    options: [1, 2, 3].map((index) => ({
      id: `${id.slice(0, 35)}${index}`,
      content: `Lựa chọn ${index}`,
      label: String.fromCharCode(64 + index),
      order_index: index,
    })),
  };
}

function exercise(questions = [question(q(1), "Câu một", 1)]) {
  return {
    id: "a0000000-0000-4000-8000-000000000001",
    title: "Bài tập Part 5",
    part_type: "part5",
    order_index: 1,
    questions: [],
    groups: [
      {
        id: "b0000000-0000-4000-8000-000000000001",
        order_index: 1,
        passage_text: null,
        audio_url: null,
        image_url: null,
        questions,
      },
    ],
  };
}

const memoryCheck = {
  id: "d0000000-0000-4000-8000-000000000001",
  questions: [question("d0000000-0000-4000-8000-000000000002", "Câu nhớ", 1)],
};

function data(overrides: Partial<LearningWorkspaceData> = {}): LearningWorkspaceData {
  const flashcards = overrides.flashcards ?? [];
  return {
    courseId: "c0c0c0c0-0000-4000-8000-000000000001",
    courseSlug: "toeic-foundation",
    courseTitle: "TOEIC Foundation",
    syllabus: [
      { id: chapterId, title: "Chương một", orderIndex: 1, topics: [{ ...topic, isCompleted: false }] },
    ],
    currentTopic: topic,
    flashcards: [],
    exercises: [],
    memoryCheck: null,
    isMemoryCheckPassed: true,
    unseenCardIds: flashcards.map((card) => card.id),
    unratedCardIds: overrides.unseenCardIds ?? flashcards.map((card) => card.id),
    memoryGateClearedCardIds:
      overrides.progress?.isFlashcardCompleted ||
      overrides.progress?.isTopicCompleted ||
      (overrides.unseenCardIds?.length === 0 && (overrides.unratedCardIds?.length ?? 0) === 0)
        ? flashcards.filter((card) => !(overrides.unseenCardIds ?? []).includes(card.id)).map((card) => card.id)
        : null,
    dueCardIds: [],
    answers: {},
    progress: null,
    ...overrides,
  };
}

const VIETNAMESE_CHROME = [
  "Các bước của bài học",
  "Từ vựng",
  "Bài tập",
  "Bài trước",
  "Bài sau",
  "Danh sách bài học",
  "Điều hướng bài học",
  "Về tổng quan khóa học",
  "đang khóa",
  "Tải lại",
];

const steps = () =>
  within(screen.getByRole("list", { name: /Lesson steps|Các bước của bài học/ }))
    .getAllByRole("listitem")
    .map((item) => item.textContent?.replace(/^\d/, ""));

beforeEach(() => {
  vi.clearAllMocks();
  mockedSubmit.mockReset();
  mockedReview.mockReset();
  mockedUseRouter.mockReturnValue({ refresh: vi.fn() } as never);
  setServerTestLocale("vi");
});

afterEach(() => {
  cleanup();
  resetCardReviewQueueForTests();
  vi.useRealTimers();
  setServerTestLocale("vi");
});

describe("topic workspace in English", () => {
  it("renders the header, step thread, hint and lesson navigation in English", () => {
    const { container } = render(
      <LearningWorkspace
        data={data({
          flashcards: [cardA, cardB],
          exercises: [exercise()],
          memoryCheck,
          isMemoryCheckPassed: false,
        })}
      />,
      { locale: "en" },
    );

    expect(screen.getByRole("link", { name: "Back to the overview of the course TOEIC Foundation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open the list of chapters and lessons" })).toBeTruthy();
    expect(steps()).toEqual(["Vocabulary (current)", "Memory check (locked)", "Exercises (locked)"]);
    expect(container.querySelector("[data-thread-hint]")?.textContent).toBe(
      "You can jump between sections by selecting them on the progress bar.",
    );
    const nav = screen.getByRole("navigation", { name: "Lesson navigation" });
    expect(within(nav).getByRole("button", { name: "Previous lesson" }).hasAttribute("disabled")).toBe(true);
    expect(within(nav).getByRole("button", { name: "Next lesson" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Show answer" })).toBeTruthy();
    for (const text of VIETNAMESE_CHROME) expect(container.textContent).not.toContain(text);
    expect(container.innerHTML).not.toMatch(/\b(learn|learning)\.[a-z]+\./i);
  });

  it("explains a locked step in English and drops the explanation when the step changes", () => {
    render(
      <LearningWorkspace
        data={data({ flashcards: [cardA, cardB], exercises: [exercise()], memoryCheck, isMemoryCheckPassed: false })}
      />,
      { locale: "en" },
    );
    const list = screen.getByRole("list", { name: "Lesson steps" });
    fireEvent.click(within(list).getByRole("button", { name: /^Memory check/ }));
    expect(screen.getByText("Rate the remaining cards Good or Easy to unlock the Memory check.")).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: /^Exercises/ }));
    expect(screen.getByText("Answer every Memory check question correctly to unlock the exercises.")).toBeTruthy();
    expect(screen.queryByText("Rate the remaining cards Good or Easy to unlock the Memory check.")).toBeNull();
  });

  it("shows the finished-vocabulary screen with singular and plural due counts", () => {
    const cards = [cardA, cardB];
    const finished = (dueCardIds: string[]) =>
      data({ flashcards: cards, unseenCardIds: [], memoryCheck, isMemoryCheckPassed: false, dueCardIds });

    const { unmount } = render(<LearningWorkspace data={finished([cardA.id])} />, { locale: "en" });
    expect(screen.getByRole("heading", { name: "You've finished reviewing the vocabulary" })).toBeTruthy();
    expect(screen.getByText("You have 1 card due in this lesson")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review 1 card now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review the vocabulary again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to Memory check" })).toBeTruthy();
    unmount();

    render(<LearningWorkspace data={finished([cardA.id, cardB.id])} />, { locale: "en" });
    expect(screen.getByText("You have 2 cards due in this lesson")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review 2 cards now" })).toBeTruthy();
  });

  it("offers a progress reload in English after a saved last card without confirmed topic progress", async () => {
    render(<LearningWorkspace data={data({ flashcards: [cardB] })} />, { locale: "en" });
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    mockedReview.mockResolvedValueOnce({ success: true });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Easy" }));
    });
    expect(screen.getByRole("heading", { name: "Couldn't confirm your topic progress" })).toBeTruthy();
    expect(screen.getByText("Reload to confirm your ratings and continue with the part that's still missing.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload progress" })).toBeTruthy();
  });

  it("names the questions list and groups in English, with the empty-question fallback text", () => {
    render(
      <LearningWorkspace
        data={data({
          exercises: [exercise([question(q(1), "", 1), question(q(2), "Câu hai", 2)])],
          progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
        })}
      />,
      { locale: "en" },
    );
    fireEvent.click(screen.getByRole("button", { name: /Question list/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Group 1/1")).toBeTruthy();
    expect(within(dialog).getByText(/Question 1: Choose the correct answer/)).toBeTruthy();
    expect(within(dialog).queryByText(/Nhóm|Chọn đáp án đúng/)).toBeNull();
  });

  it("opens the chapter list with English labels and a completed marker", () => {
    render(
      <LearningWorkspace
        data={data({
          flashcards: [cardA],
          syllabus: [
            {
              id: chapterId,
              title: "Chương một",
              orderIndex: 1,
              topics: [{ ...topic, isCompleted: false }, { ...topicTwo, isCompleted: true }],
            },
          ],
        })}
      />,
      { locale: "en" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Open the list of chapters and lessons" }));
    expect(screen.getByText("Browse chapters")).toBeTruthy();
    expect(screen.getByText("Choose another lesson in this course.")).toBeTruthy();
    expect(screen.getByText("(Completed)")).toBeTruthy();
  });

  it("reports the unseen cards once at page load with English singular and plural wording", () => {
    const { unmount } = render(
      <LearningWorkspace data={data({ flashcards: [cardA, cardB], unseenCardIds: [cardA.id], unratedCardIds: [cardA.id] })} />,
      { locale: "en" },
    );
    expect(mockedToast.info).toHaveBeenCalledWith("You still have 1 card you haven't studied in this lesson");
    unmount();
    mockedToast.info.mockClear();

    const many = Array.from({ length: 1500 }, (_, index) => ({ ...cardB, id: `e0000000-0000-4000-8000-${String(index).padStart(12, "0")}` }));
    render(
      <LearningWorkspace data={data({ flashcards: [cardA, ...many], unseenCardIds: many.map((card) => card.id), unratedCardIds: [] })} />,
      { locale: "en" },
    );
    expect(mockedToast.info).toHaveBeenCalledWith("You still have 1,500 cards you haven't studied in this lesson");
  });

  it("keeps plain digits and the original Vietnamese wording in Vietnamese", () => {
    const many = Array.from({ length: 1500 }, (_, index) => ({ ...cardB, id: `e0000000-0000-4000-8000-${String(index).padStart(12, "0")}` }));
    render(
      <LearningWorkspace data={data({ flashcards: [cardA, ...many], unseenCardIds: many.map((card) => card.id), unratedCardIds: [] })} />,
      { locale: "vi" },
    );
    expect(mockedToast.info).toHaveBeenCalledWith("Bạn còn 1500 thẻ chưa học trong bài học này");
  });

  it("changes the workspace language in place when the provider locale changes", () => {
    const view = renderSwitchable(
      <LearningWorkspace data={data({ flashcards: [cardA, cardB], exercises: [exercise()], memoryCheck, isMemoryCheckPassed: false })} />,
      "vi",
    );
    expect(steps()).toEqual(["Từ vựng (đang học)", "Memory check (đang khóa)", "Bài tập (đang khóa)"]);
    view.switchLocale("en");
    expect(steps()).toEqual(["Vocabulary (current)", "Memory check (locked)", "Exercises (locked)"]);
    expect(screen.getByRole("navigation", { name: "Lesson navigation" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Điều hướng bài học" })).toBeNull();
    view.switchLocale("vi");
    expect(steps()).toEqual(["Từ vựng (đang học)", "Memory check (đang khóa)", "Bài tập (đang khóa)"]);
  });
});

describe("topic completion screen in English", () => {
  const completedProgress = { isFlashcardCompleted: true, isExerciseCompleted: true, isTopicCompleted: true };
  const course = (current = topic) => ({
    syllabus: [
      { id: chapterId, title: "Chương một", orderIndex: 1, topics: [{ ...topic, isCompleted: true }, { ...topicTwo, isCompleted: false }] },
      { id: chapterTwoId, title: "Chương hai", orderIndex: 2, topics: [{ ...topicThree, isCompleted: false }] },
    ],
    currentTopic: current,
  });

  it("shows the earned completion with course and chapter progress and the next topic of the chapter", () => {
    const { container } = render(
      <LearningWorkspace data={data({ ...course(), flashcards: [cardA], unseenCardIds: [], progress: completedProgress, dueCardIds: [cardA.id] })} />,
      { locale: "en" },
    );
    expect(screen.getByRole("heading", { name: "You've completed the topic “Bài một”" })).toBeTruthy();
    expect(screen.getByText("Course progress")).toBeTruthy();
    expect(screen.getByText("1/3 topics")).toBeTruthy();
    expect(screen.getByText("Chapter 1 · Chương một")).toBeTruthy();
    expect(screen.getByText("1/2 topics")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Course progress" }).getAttribute("aria-valuetext")).toBe("1 of 3 topics");
    expect(container.querySelector("[data-completion-hint]")?.textContent).toBe("Up next: Topic 2 · Bài hai");
    expect(screen.getByRole("button", { name: "1 card due, Review now" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Next topic" })).toBeTruthy();
    expect(container.textContent).not.toContain("Chủ đề tiếp theo");
  });

  it("names the next chapter and its first topic, and the overview for the last topic", () => {
    const last = render(
      <LearningWorkspace data={data({ ...course(topicTwo), progress: completedProgress })} />,
      { locale: "en" },
    );
    expect(last.container.querySelector("[data-completion-hint]")?.textContent).toBe(
      "Up next: Chapter 2 · Chương hai — Topic 1 · Bài ba",
    );
    last.unmount();

    const end = render(<LearningWorkspace data={data({ ...course(topicThree), progress: completedProgress })} />, { locale: "en" });
    expect(end.container.querySelector("[data-completion-hint]")?.textContent).toBe("Up next: Course overview");
    expect(screen.getAllByRole("link", { name: "Back to the course overview" }).length).toBeGreaterThan(0);
  });

  it("marks a finished chapter and groups large counts in English only", () => {
    const manyTopics = Array.from({ length: 1234 }, (_, index) => ({
      ...topicThree,
      id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
      slug: `many-${index}`,
      isCompleted: false,
    }));
    const big = {
      syllabus: [{ id: chapterId, title: "Chương một", orderIndex: 1, topics: [{ ...topic, isCompleted: true }] }, { id: chapterTwoId, title: "Chương hai", orderIndex: 2, topics: manyTopics }],
    };
    const en = render(<LearningWorkspace data={data({ ...big, progress: completedProgress })} />, { locale: "en" });
    expect(screen.getByText("You've completed this chapter")).toBeTruthy();
    expect(screen.getByText("1/1,235 topics")).toBeTruthy();
    en.unmount();
    render(<LearningWorkspace data={data({ ...big, progress: completedProgress })} />, { locale: "vi" });
    expect(screen.getByText("1/1235 chủ đề")).toBeTruthy();
    expect(screen.getByText("Đã hoàn thành chương này")).toBeTruthy();
  });

  it("offers the catch-up shortcut with singular and plural English wording", () => {
    render(
      <LearningWorkspace
        data={data({
          ...course(),
          exercises: [exercise([question(q(1), "Câu một", 1), question(q(2), "Câu hai", 2)])],
          memoryCheck,
          isMemoryCheckPassed: true,
          progress: completedProgress,
        })}
      />,
      { locale: "en" },
    );
    expect(screen.getByText("This lesson was just updated")).toBeTruthy();
    expect(screen.getByText("1 Memory check question and 2 exercise questions left to do")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 Memory check question and 2 exercise questions left to do, Do it now" })).toBeTruthy();
  });

  it("keeps the Vietnamese completion screen wording", () => {
    const { container } = render(
      <LearningWorkspace data={data({ ...course(), progress: completedProgress })} />,
      { locale: "vi" },
    );
    expect(screen.getByRole("heading", { name: "Đã hoàn thành chủ đề “Bài một”" })).toBeTruthy();
    expect(container.querySelector("[data-completion-hint]")?.textContent).toBe("Tiếp theo: Chủ đề 2 · Bài hai");
    expect(screen.getByRole("link", { name: "Chủ đề tiếp theo" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Tiến độ khóa học" }).getAttribute("aria-valuetext")).toBe("1 trên 3 chủ đề");
  });
});

describe("topic workspace toasts follow the language shown when they fire", () => {
  const progressSync = {
    vi: "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    en: "The card was saved, but your lesson progress couldn't be recorded.",
  };

  async function rateFirstCard(name: string) {
    fireEvent.click(screen.getByRole("button", { name: /Hiện đáp án|Show answer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
    });
  }

  it("shows the progress warning of a saved rating in the displayed language when the server used the other one", async () => {
    setServerTestLocale("vi");
    mockedReview.mockImplementation(async () => {
      const t = await recordedTranslations("learn", "progressError");
      return { success: true, progressError: t("actions.review.progressSync") } as never;
    });
    render(<LearningWorkspace data={data({ flashcards: [cardA, cardB] })} />, { locale: "en" });
    await rateFirstCard("Good");
    expect(mockedToast.error).toHaveBeenCalledWith(progressSync.en);
  });

  it("uses the language at the time the reply lands when the learner switches while the save is in flight", async () => {
    setServerTestLocale("en");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockedReview.mockImplementation(async () => {
      const t = await recordedTranslations("learn", "progressError");
      await gate;
      return { success: true, progressError: t("actions.review.progressSync") } as never;
    });
    const view = renderSwitchable(<LearningWorkspace data={data({ flashcards: [cardA, cardB] })} />, "en");
    await rateFirstCard("Good");
    expect(mockedToast.error).not.toHaveBeenCalled();
    view.switchLocale("vi");
    await act(async () => {
      release();
    });
    expect(mockedToast.error).toHaveBeenCalledWith(progressSync.vi);
  });

  it("shows the server text as built when it already matches the displayed language, and a system notice when it has no key", async () => {
    setServerTestLocale("en");
    mockedReview.mockImplementation(async () => {
      const t = await recordedTranslations("learn", "progressError");
      return { success: true, progressError: t("actions.review.progressSync") } as never;
    });
    const { unmount } = render(<LearningWorkspace data={data({ flashcards: [cardA, cardB] })} />, { locale: "en" });
    await rateFirstCard("Good");
    expect(mockedToast.error).toHaveBeenCalledWith(progressSync.en);
    unmount();
    mockedToast.error.mockClear();
    resetCardReviewQueueForTests();

    // Server dùng vi và không ghi khóa nào: trang en hiện thông báo hệ thống chung bằng ngôn ngữ của trang.
    setServerTestLocale("vi");
    mockedReview.mockReset();
    mockedReview.mockResolvedValue({ success: true, progressError: "Đánh giá đã lưu, tiến độ bài học chưa đồng bộ." } as never);
    render(<LearningWorkspace data={data({ flashcards: [cardA, cardB] })} />, { locale: "en" });
    await rateFirstCard("Good");
    expect(mockedToast.error).toHaveBeenCalledWith(progressSync.en);
  });

  it("builds the failed-save toast in the language shown when it fires, not when the rating was sent", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mockedReview.mockResolvedValue({ error: "boom" } as never);
    const view = renderSwitchable(<LearningWorkspace data={data({ flashcards: [cardA, cardB] })} />, "en");
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Good" }));
    });
    view.switchLocale("vi");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS);
    });
    expect(mockedToast.error).toHaveBeenCalledWith(
      'Chưa lưu được đánh giá thẻ "reliable". Thẻ được xếp lại để bạn chấm lại.',
    );
  });

  it("explains the memory-check lock in the language shown when the server asks to return to the memory check", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockedSubmit.mockImplementation(async () => {
      await gate;
      return {
        error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.",
        errorCode: "MEMORY_CHECK_REQUIRED",
      } as never;
    });
    const view = renderSwitchable(
      <LearningWorkspace
        data={data({
          flashcards: [cardA],
          exercises: [exercise()],
          memoryCheck,
          isMemoryCheckPassed: true,
          progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
          unseenCardIds: [cardA.id],
          unratedCardIds: [cardA.id],
        })}
      />,
      "vi",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tới Bài tập" }));
    fireEvent.click(screen.getAllByRole("radio")[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    });
    view.switchLocale("en");
    await act(async () => {
      release();
    });
    expect(mockedToast.error).toHaveBeenCalledWith("Answer every Memory check question correctly to unlock the exercises.");
    expect(screen.getByRole("heading", { name: "Memory check is locked" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Back to Vocabulary" }).length).toBeGreaterThan(0);
  });
});

describe("topic workspace feedback, loading and streak chip in English", () => {
  it("explains an unenrolled account and an unavailable lesson, keeping the course title as content", () => {
    const unenrolled = renderToStaticMarkup(
      <LearningWorkspaceFeedback result={{ status: "unenrolled", course: { slug: "toeic", title: "TOEIC nền tảng" } }} />,
      { locale: "en" },
    );
    expect(unenrolled).toContain("COURSE ACCESS");
    expect(unenrolled).toContain("This account isn&#x27;t enrolled in the course");
    expect(unenrolled).toContain("TOEIC nền tảng");
    expect(unenrolled).toContain("View course details");
    expect(unenrolled).toContain("Back to the learning space");

    const unavailable = renderToStaticMarkup(
      <LearningWorkspaceFeedback result={{ status: "topic_unavailable", course: { slug: "toeic", title: "TOEIC" } }} />,
      { locale: "en" },
    );
    expect(unavailable).toContain("LESSON UNAVAILABLE");
    expect(unavailable).toContain("This lesson isn&#x27;t available");
    expect(unavailable).toContain("Back to the course overview");
  });

  it("shows the server error with English chrome and a retry button in both languages", () => {
    const { unmount } = render(
      <LearningWorkspaceFeedback result={{ status: "error", errorCode: "QUERY_FAILED", error: "Couldn't load the lesson right now. Please try again." }} />,
      { locale: "en" },
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("COULDN'T LOAD DATA")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Couldn't load your learning space" })).toBeTruthy();
    expect(screen.getByText("Couldn't load the lesson right now. Please try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    unmount();
    render(
      <LearningWorkspaceFeedback result={{ status: "error", errorCode: "QUERY_FAILED", error: "Không thể tải bài học lúc này. Vui lòng thử lại." }} />,
      { locale: "vi" },
    );
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
  });

  it("labels the busy region in the active language", () => {
    expect(renderToStaticMarkup(<LearningWorkspaceLoading />, { locale: "en" })).toContain('aria-label="Loading the lesson"');
    expect(renderToStaticMarkup(<LearningWorkspaceLoading />, { locale: "vi" })).toContain('aria-label="Đang tải bài học"');
  });

  it("words the course streak chip in English and Vietnamese", () => {
    const summary = (streak: number, studiedToday: boolean) => ({ success: true as const, data: { streak, studiedToday, recentTopics: [] } });
    const en = renderToStaticMarkup(<CourseStreakChip summary={summary(1234, false)} />, { locale: "en" });
    expect(en).toContain("1,234-day streak");
    expect(en).toContain('title="Study today to keep your streak"');
    expect(en).toContain(". Study today to keep your streak.");
    const today = renderToStaticMarkup(<CourseStreakChip summary={summary(3, true)} />, { locale: "en" });
    expect(today).toContain('title="You&#x27;ve studied this course today"');
    expect(renderToStaticMarkup(<CourseStreakChip summary={summary(1234, true)} />, { locale: "vi" })).toContain("Chuỗi 1234 ngày");
    expect(renderToStaticMarkup(<CourseStreakChip summary={{ success: false, error: "x" }} />, { locale: "en" })).toContain(
      "Couldn&#x27;t load your learning streak",
    );
    expect(renderToStaticMarkup(<CourseStreakChip summary={summary(0, false)} />, { locale: "en" })).toBe("");
  });
});
