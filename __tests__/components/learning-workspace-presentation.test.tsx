/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Rating } from "ts-fsrs";
import { toast } from "sonner";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitCardReview } from "@/app/actions/review";
import LearningWorkspace from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: bảo vệ presentation D8-LUI của learning workspace: lật thẻ, nhóm ngữ liệu theo Part, chọn đáp án và dòng các bước.
// - Loại test: component interaction test qua action boundary mock.
// - Đối tượng: LearningWorkspace với FlashcardStage, ExerciseContext, ChoiceGroup và danh sách chương.
// - Case thành công: lật thẻ chỉ lộ mặt sau đang active; sau khi chấm thành công thẻ lật về với đáp án vừa xem cho tới lần hiện đáp án kế; Part 1 có ảnh phóng to; audio giữ nguyên node khi đổi câu cùng nhóm.
// - Case thất bại: chấm thẻ lỗi thì giữ mặt sau và các nút chấm; media thiếu hiện thông báo thay vì ô trống; ảnh lỗi cho tải lại cục bộ.
// - Bảo mật/phân quyền: lựa chọn chưa chấm không mang trạng thái đúng/sai; DOM không có đáp án đúng trước khi server trả kết quả.
// - Ổn định/resilience: bàn phím mũi tên đổi lựa chọn trong radiogroup; Again/Hard xếp lại cuối hàng đợi, ba thẻ cùng chấm Lại/Khó vẫn còn đủ ba thẻ (không báo xong).
// - Mặt sau thẻ: chọn bố cục căn giữa (giống thẻ ôn D6) khi vừa khung cố định, bố cục đọc cuộn khi tràn; đo lại khi đổi kích thước; mặt active và nội dung đọc được giống nhau ở cả hai.
// - LF1 (AC3): bước "Từ vựng" theo kết quả server cả hai chiều; sau một lần Lại, lối tắt "Tới Bài tập" vẫn còn (điều hướng không đổi) và, khi rời giai đoạn mà server vẫn báo chưa xong, dòng các bước không còn ghi "đã xong".
// - Invariant cần giữ: dòng các bước chỉ gồm giai đoạn có thật và không phải điều khiển; danh sách chương mở theo yêu cầu.
// - LF3 (AC6/AC8): bước đã xong vẫn ghi "đã xong" khi đang là bước hiện tại (cả ba bước); memory check khóa tới khi mọi thẻ có dòng của học viên (Lại/Khó cũng là đã xem), mở ngay khi thẻ cuối được chấm; nhắc số thẻ còn cần Ổn/Dễ; về memory check đang khóa thì có panel khóa và lối về Từ vựng.
// - Kết quả verify gần nhất: xem lần chạy LF3 CP4 (2026-10-11) bằng `npx vitest run __tests__/components/learning-workspace-presentation.test.tsx`.

vi.mock("@/app/actions/progress", () => ({ submitQuestionAnswer: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedSubmit = vi.mocked(submitQuestionAnswer);
const mockedReview = vi.mocked(submitCardReview);
const mockedToast = vi.mocked(toast);

const chapterId = "11111111-1111-4111-8111-111111111111";
const topic = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "topic-one",
  title: "Bài một",
  orderIndex: 1,
  chapterId,
};

const cardA = {
  id: "e0000000-0000-4000-8000-00000000000a",
  front_content: { word: "reliable", pos: "adj", phonetic: "/rɪˈlaɪəbl/" },
  back_content: { translation: "đáng tin cậy", example: "A reliable partner" },
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

function option(questionId: string, index: number, content: string) {
  return {
    id: `${questionId.slice(0, 35)}${index}`,
    content,
    label: String.fromCharCode(64 + index),
    order_index: index,
  };
}

function question(id: string, content: string, order: number, optionCount = 3) {
  return {
    id,
    content,
    explanation: null,
    order_index: order,
    options: Array.from({ length: optionCount }, (_, i) =>
      option(id, i + 1, `${content} lựa chọn ${i + 1}`),
    ),
  };
}

const q = (n: number) => `c0000000-0000-4000-8000-00000000000${n}`;

function exercise(
  partType: string,
  group: Record<string, unknown>,
  questions = [question(q(1), "Câu một", 1)],
) {
  return {
    id: "a0000000-0000-4000-8000-000000000001",
    title: `Bài tập ${partType}`,
    part_type: partType,
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
        ...group,
      },
    ],
  };
}

function data(overrides: Partial<LearningWorkspaceData> = {}): LearningWorkspaceData {
  return {
    courseSlug: "toeic-foundation",
    courseTitle: "TOEIC Foundation",
    syllabus: [
      {
        id: chapterId,
        title: "Chương một",
        orderIndex: 1,
        topics: [{ ...topic, isCompleted: false }],
      },
    ],
    currentTopic: topic,
    flashcards: [],
    exercises: [],
    memoryCheck: null,
    isMemoryCheckPassed: true,
    unseenCardIds: [],
    unratedCardIds: [],
    answers: {},
    progress: null,
    ...overrides,
  };
}

describe("D8-LUI learning workspace presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("flashcards", () => {
    it("exposes only the active face and moves focus with the reveal", () => {
      const { container } = render(<LearningWorkspace data={data({ flashcards: [cardA] })} />);
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));

      const inertFaces = Array.from(container.querySelectorAll("[inert]"));
      expect(inertFaces).toHaveLength(1);
      expect(inertFaces[0].textContent).toContain("reliable");
      expect(screen.queryByRole("button", { name: "Hiện đáp án" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lại" }));
    });

    it("turns the same card back with the answer it just showed, then reveals the new answer", async () => {
      const { container } = render(
        <LearningWorkspace data={data({ flashcards: [cardA, cardB] })} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({ success: true });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
      });

      // The next front is live immediately; the hidden back still holds the old answer.
      expect(screen.getByRole("button", { name: "Hiện đáp án" })).not.toBeNull();
      expect(screen.getByText("improve")).not.toBeNull();
      const inertBack = container.querySelector("[inert]");
      expect(inertBack?.textContent).toContain("đáng tin cậy");
      expect(inertBack?.textContent).not.toContain("cải thiện");

      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      expect(screen.getByText("cải thiện")).not.toBeNull();
      expect(container.querySelector("[inert]")?.textContent).toContain("improve");
    });

    it("keeps the revealed card and the ratings when saving the rating fails", async () => {
      render(<LearningWorkspace data={data({ flashcards: [cardA] })} />);
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({ error: "fail" });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
      });

      expect(mockedToast.error).toHaveBeenCalledWith("Lỗi đồng bộ tiến độ học!");
      expect(screen.getByRole("button", { name: "Ổn" })).not.toBeNull();
      expect(screen.queryByRole("button", { name: "Hiện đáp án" })).toBeNull();
    });

    it("requeues Again at the end and reports the unique card total", async () => {
      render(<LearningWorkspace data={data({ flashcards: [cardA, cardB] })} />);
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({ success: true });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Lại" }));
      });

      expect(mockedReview).toHaveBeenCalledWith(cardA.id, Rating.Again);
      // Both cards are still due and the bar reads the unique total.
      expect(screen.getByText("2 / 2")).not.toBeNull();
      const bar = screen.getByRole("progressbar", { name: "Tiến độ từ vựng" });
      expect(bar.getAttribute("aria-valuemax")).toBe("2");
      expect(bar.getAttribute("aria-valuenow")).toBe("0");
    });

    it.each([
      ["Lại", Rating.Again],
      ["Khó", Rating.Hard],
    ])("keeps all three cards queued after %s on each of them", async (label, rating) => {
      const cardC = { ...cardB, id: "e0000000-0000-4000-8000-00000000000c", front_content: { word: "retain" } };
      render(<LearningWorkspace data={data({ flashcards: [cardA, cardB, cardC] })} />);

      for (const expected of ["reliable", "improve", "retain"]) {
        expect(screen.getByText(expected, { exact: true })).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        mockedReview.mockResolvedValueOnce({ success: true });
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: label }));
        });
        expect(mockedReview).toHaveBeenLastCalledWith(expect.any(String), rating);
      }

      // Nothing was graduated: the stage keeps going and the first card is due again.
      expect(screen.queryByRole("heading", { name: "Bạn đã ôn xong từ vựng" })).toBeNull();
      expect(mockedToast.success).not.toHaveBeenCalled();
      expect(screen.getByText("3 / 3")).not.toBeNull();
      expect(screen.getByText("reliable", { exact: true })).not.toBeNull();
      expect(screen.getByRole("button", { name: "Hiện đáp án" })).not.toBeNull();
    });

    it("stops showing the flashcard step as done once the server reports a later Again", async () => {
      const finished = { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false };
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA],
            exercises: [exercise("part5", {})],
            progress: finished,
          })}
        />,
      );
      const flashcardStep = () =>
        within(screen.getByRole("list", { name: "Các bước của bài học" }))
          .getAllByRole("listitem")[0].textContent?.replace(/^\d/, "");

      // Stored as done: the learner can skip ahead, and the thread shows it done once they have left.
      fireEvent.click(screen.getByRole("button", { name: "Tới Bài tập" }));
      expect(flashcardStep()).toBe("Từ vựng (đã xong)");

      // Back to the flashcards and press Lại: the server says the stage is no longer done.
      fireEvent.click(screen.getByRole("button", { name: "Về Từ vựng" }));
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({
        success: true,
        topicProgress: { ...finished, isMemoryCheckPassed: true, newlyCompleted: false, isFlashcardCompleted: false },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Lại" }));
      });
      // Điều hướng không đổi: người học vẫn đi tiếp được dù server báo giai đoạn chưa xong.
      expect(screen.getByRole("button", { name: "Tới Bài tập" })).toBeTruthy();

      // The queue empties while the server still reports the stage as not done (another card
      // was rated Again elsewhere): the learner moves on, but the thread must not claim "done".
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({
        success: true,
        topicProgress: { ...finished, isMemoryCheckPassed: true, newlyCompleted: false, isFlashcardCompleted: false },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
      });
      expect(flashcardStep()).toBe("Từ vựng (chưa mở)");

      // A server result that says done turns it back on.
      fireEvent.click(screen.getByRole("button", { name: "Về Từ vựng" }));
      fireEvent.click(screen.getByRole("button", { name: "Ôn lại từ vựng" }));
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({
        success: true,
        topicProgress: { ...finished, isMemoryCheckPassed: true, newlyCompleted: false },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Dễ" }));
      });
      expect(flashcardStep()).toBe("Từ vựng (đã xong)");
    });

    describe("back face presentation", () => {
      const proto = HTMLElement.prototype;
      const scrollHeight = Object.getOwnPropertyDescriptor(proto, "scrollHeight");
      const clientHeight = Object.getOwnPropertyDescriptor(proto, "clientHeight");
      let overflowing = false;
      let resizeCallback: (() => void) | null = null;

      beforeEach(() => {
        overflowing = false;
        resizeCallback = null;
        Object.defineProperty(proto, "scrollHeight", { configurable: true, get: () => (overflowing ? 500 : 120) });
        Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => 300 });
        vi.stubGlobal(
          "ResizeObserver",
          class {
            constructor(callback: () => void) {
              resizeCallback = callback;
            }
            observe() {}
            disconnect() {}
          },
        );
      });

      afterEach(() => {
        vi.unstubAllGlobals();
        if (scrollHeight) Object.defineProperty(proto, "scrollHeight", scrollHeight);
        else delete (proto as unknown as Record<string, unknown>).scrollHeight;
        if (clientHeight) Object.defineProperty(proto, "clientHeight", clientHeight);
        else delete (proto as unknown as Record<string, unknown>).clientHeight;
      });

      const richCard = {
        ...cardA,
        back_content: {
          translation: "đáng tin cậy",
          example: "A reliable partner",
          exampleTranslation: "Một đối tác đáng tin cậy",
        },
      };
      const variantOf = (container: HTMLElement) =>
        container.querySelector("[data-flashcard-back]")?.getAttribute("data-variant");

      it("centers a back that fits the fixed face", () => {
        const { container } = render(<LearningWorkspace data={data({ flashcards: [richCard] })} />);
        expect(variantOf(container)).toBe("centered");
      });

      it("keeps the left-aligned scrolling layout when the centered back would overflow", () => {
        overflowing = true;
        const { container } = render(<LearningWorkspace data={data({ flashcards: [richCard] })} />);
        expect(variantOf(container)).toBe("reading");
      });

      it("re-measures when the face is resized", () => {
        const { container } = render(<LearningWorkspace data={data({ flashcards: [richCard] })} />);
        expect(variantOf(container)).toBe("centered");
        overflowing = true;
        act(() => resizeCallback?.());
        expect(variantOf(container)).toBe("reading");
        overflowing = false;
        act(() => resizeCallback?.());
        expect(variantOf(container)).toBe("centered");
      });

      it("exposes the same active face and spoken content in both variants", () => {
        const readOnce = (isOverflowing: boolean) => {
          overflowing = isOverflowing;
          const { container, unmount } = render(
            <LearningWorkspace data={data({ flashcards: [richCard] })} />,
          );
          fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
          const inert = container.querySelectorAll("[inert]");
          const back = container.querySelector("[data-flashcard-back]")?.parentElement;
          const result = {
            inertCount: inert.length,
            inertIsFront: inert[0]?.textContent?.includes("reliable"),
            backHidden: back?.hasAttribute("aria-hidden"),
            backText: back?.textContent,
          };
          unmount();
          return result;
        };

        const centered = readOnce(false);
        const reading = readOnce(true);
        expect(centered).toEqual(reading);
        expect(centered.inertCount).toBe(1);
        expect(centered.inertIsFront).toBe(true);
        expect(centered.backHidden).toBe(false);
        expect(centered.backText).toContain("Nghĩa: đáng tin cậy");
        expect(centered.backText).toContain("A reliable partner");
        expect(centered.backText).toContain("Một đối tác đáng tin cậy");
      });
    });

    it("offers a restart instead of an empty stage after the last card", async () => {
      render(<LearningWorkspace data={data({ flashcards: [cardB] })} />);
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({ success: true });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Dễ" }));
      });

      expect(screen.getByRole("heading", { name: "Bạn đã ôn xong từ vựng" })).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Ôn lại từ vựng" }));
      expect(screen.getByRole("button", { name: "Hiện đáp án" })).not.toBeNull();
    });
  });

  describe("exercise material by part", () => {
    it("shows the Part 1 picture uncropped with an enlarge control and the audio player", () => {
      render(
        <LearningWorkspace
          data={data({
            exercises: [
              exercise("part1", {
                image_url: "/api/question-group-media/b/image",
                audio_url: "/api/question-group-media/b/audio",
              }),
            ],
          })}
        />,
      );

      const image = screen.getByAltText("Hình ảnh của nhóm câu hỏi");
      expect(image.getAttribute("src")).toBe("/api/question-group-media/b/image");
      expect(image.className).toContain("object-contain");
      expect(image.className).not.toContain("object-cover");
      expect(screen.getByLabelText("Âm thanh của nhóm câu hỏi")).not.toBeNull();
      // The enlarge control appears once the picture has loaded.
      expect(screen.queryByRole("button", { name: "Phóng to hình ảnh" })).toBeNull();
      fireEvent.load(image);
      fireEvent.click(screen.getByRole("button", { name: "Phóng to hình ảnh" }));
      expect(screen.getByRole("dialog", { name: "Hình ảnh của nhóm câu hỏi" })).not.toBeNull();
    });

    it("shows a local failed state in the enlarged view and reports the failure, with a reload", () => {
      render(
        <LearningWorkspace
          data={data({
            exercises: [exercise("part1", { image_url: "/api/question-group-media/b/image" })],
          })}
        />,
      );
      fireEvent.load(screen.getByAltText("Hình ảnh của nhóm câu hỏi"));
      fireEvent.click(screen.getByRole("button", { name: "Phóng to hình ảnh" }));
      const dialog = screen.getByRole("dialog", { name: "Hình ảnh của nhóm câu hỏi" });

      fireEvent.error(within(dialog).getByAltText("Hình ảnh của nhóm câu hỏi"));
      expect(within(dialog).getByText("Không tải được hình ảnh.")).not.toBeNull();
      // The inline picture is untouched.
      expect(screen.getAllByAltText("Hình ảnh của nhóm câu hỏi")).toHaveLength(1);

      fireEvent.click(within(dialog).getByRole("button", { name: "Tải lại hình ảnh" }));
      expect(within(dialog).getByAltText("Hình ảnh của nhóm câu hỏi")).not.toBeNull();
    });

    it("offers a local reload for a failed image without touching the answer", () => {
      render(
        <LearningWorkspace
          data={data({
            exercises: [exercise("part1", { image_url: "/img", audio_url: "/aud" })],
          })}
        />,
      );
      fireEvent.error(screen.getByAltText("Hình ảnh của nhóm câu hỏi"));

      expect(screen.getByText("Không tải được hình ảnh.")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Tải lại hình ảnh" }));
      expect(screen.getByAltText("Hình ảnh của nhóm câu hỏi")).not.toBeNull();
      expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("names missing required material instead of leaving an empty region", () => {
      render(<LearningWorkspace data={data({ exercises: [exercise("part2", {})] })} />);
      expect(screen.getByText(/đang thiếu âm thanh/)).not.toBeNull();
      expect(screen.queryByLabelText("Âm thanh của nhóm câu hỏi")).toBeNull();
    });

    it("keeps the same audio element across questions of one group and replaces it for a new group", () => {
      const questions = [question(q(1), "Câu một", 1), question(q(2), "Câu hai", 2)];
      const base = exercise("part3", { audio_url: "/aud-1" }, questions);
      const second = {
        ...base.groups[0],
        id: "b0000000-0000-4000-8000-000000000002",
        order_index: 2,
        audio_url: "/aud-2",
        questions: [question(q(3), "Câu ba", 1)],
      };
      render(
        <LearningWorkspace
          data={data({ exercises: [{ ...base, groups: [base.groups[0], second] }] })}
        />,
      );

      const audio = screen.getByLabelText("Âm thanh của nhóm câu hỏi");
      fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));
      expect(screen.getByText("Câu hai")).not.toBeNull();
      expect(screen.getByLabelText("Âm thanh của nhóm câu hỏi")).toBe(audio);

      fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));
      expect(screen.getByText("Câu ba")).not.toBeNull();
      const next = screen.getByLabelText("Âm thanh của nhóm câu hỏi");
      expect(next).not.toBe(audio);
      expect(next.getAttribute("src")).toBe("/aud-2");
    });

    it("keeps passage line breaks for a reading group", () => {
      render(
        <LearningWorkspace
          data={data({ exercises: [exercise("part7", { passage_text: "Dòng một\nDòng hai" })] })}
        />,
      );
      const passage = screen.getByText(/Dòng một/);
      expect(passage.textContent).toBe("Dòng một\nDòng hai");
      expect(passage.className).toContain("whitespace-pre-wrap");
    });
  });

  describe("choosing an answer", () => {
    const items = () => [exercise("part5", {}, [question(q(1), "Câu một", 1, 4)])];

    it("lets the arrow keys move the single choice without grading it", () => {
      render(<LearningWorkspace data={data({ exercises: items() })} />);
      const radios = within(screen.getByRole("radiogroup")).getAllByRole("radio");
      expect(radios).toHaveLength(4);
      expect(radios.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);

      radios[0].focus();
      fireEvent.click(radios[0]);
      fireEvent.keyDown(radios[0], { key: "ArrowDown" });
      expect(radios[1].getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(radios[1]);
      fireEvent.keyDown(radios[1], { key: "ArrowUp" });
      fireEvent.keyDown(radios[0], { key: "ArrowUp" });
      expect(radios[3].getAttribute("aria-checked")).toBe("true");

      // Selection alone never carries a correctness signal.
      expect(screen.queryByText(/bạn chọn đúng|bạn chọn chưa đúng/)).toBeNull();
      expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("marks only the graded choice and locks the options", async () => {
      render(<LearningWorkspace data={data({ exercises: items() })} />);
      fireEvent.click(screen.getByRole("radio", { name: /lựa chọn 2/ }));
      mockedSubmit.mockResolvedValueOnce({
        success: true,
        isCorrect: false,
        explanation: "Vì thì.",
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
      });

      const chosen = screen.getByRole("radio", { name: /lựa chọn 2/ });
      expect(chosen.textContent).toContain("bạn chọn chưa đúng");
      for (const radio of screen.getAllByRole("radio")) {
        expect(radio.hasAttribute("disabled")).toBe(true);
        if (radio !== chosen) expect(radio.textContent).not.toMatch(/bạn chọn/);
      }
    });
  });

  describe("stage thread and outline", () => {
    it("lists only the stages the topic really has", () => {
      const { rerender } = render(
        <LearningWorkspace
          data={data({ flashcards: [cardA], exercises: [exercise("part5", {})] })}
        />,
      );
      const thread = screen.getByRole("list", { name: "Các bước của bài học" });
      expect(
        within(thread)
          .getAllByRole("listitem")
          .map((item) => item.textContent?.replace(/^\d/, "")),
      ).toEqual(["Từ vựng (đang học)", "Bài tập (chưa mở)"]);

      rerender(<LearningWorkspace data={data({ flashcards: [cardA] })} />);
      expect(
        within(screen.getByRole("list", { name: "Các bước của bài học" })).getAllByRole(
          "listitem",
        ),
      ).toHaveLength(1);
    });

    it("shows the exercise step as locked until the memory check is passed", () => {
      render(
        <LearningWorkspace
          data={data({
            exercises: [exercise("part5", {})],
            isMemoryCheckPassed: false,
            memoryCheck: {
              id: "d0000000-0000-4000-8000-000000000001",
              questions: [question("d0000000-0000-4000-8000-000000000002", "Câu nhớ", 1)],
            },
          })}
        />,
      );
      const items = within(
        screen.getByRole("list", { name: "Các bước của bài học" }),
      ).getAllByRole("listitem");
      expect(items.map((item) => item.textContent?.replace(/^\d/, ""))).toEqual([
        "Memory check (đang học)",
        "Bài tập (đang khóa)",
      ]);
      expect(items[0].getAttribute("aria-current")).toBe("step");
      // The exercise question is not reachable while the gate is closed.
      expect(screen.queryByText("Câu một")).toBeNull();
    });

    it("opens the course outline on demand as a dialog", () => {
      render(<LearningWorkspace data={data({ flashcards: [cardA] })} />);
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Mở danh sách chương và bài học" }));

      const dialog = screen.getByRole("dialog", { name: "Duyệt chương học" });
      expect(within(dialog).getByText("Chương một")).not.toBeNull();
    });
  });

  describe("LF3 stage thread done state and the cards gate", () => {
    const memoryCheck = {
      id: "d0000000-0000-4000-8000-000000000001",
      questions: [question("d0000000-0000-4000-8000-000000000002", "Câu nhớ", 1)],
    };
    const finished = {
      isFlashcardCompleted: true,
      isExerciseCompleted: false,
      isTopicCompleted: false,
      isMemoryCheckPassed: false,
      newlyCompleted: false,
    };
    const steps = () =>
      within(screen.getByRole("list", { name: "Các bước của bài học" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent?.replace(/^\d/, ""));

    it("shows a stage as done while it is still the current stage (AC8)", () => {
      // Từ vựng: server báo xong, không còn thẻ nào chưa Ổn/Dễ.
      const { unmount } = render(
        <LearningWorkspace data={data({ flashcards: [cardA], progress: { ...finished } })} />,
      );
      expect(steps()).toEqual(["Từ vựng (đã xong, đang học)"]);
      expect(
        within(screen.getByRole("list", { name: "Các bước của bài học" }))
          .getAllByRole("listitem")[0]
          .getAttribute("aria-current"),
      ).toBe("step");
      unmount();

      // Bài tập: mọi câu đã có đáp án, người học đang ở bước bài tập.
      const answered = render(
        <LearningWorkspace
          data={data({
            exercises: [exercise("part5", {})],
            answers: { [q(1)]: "any-option" },
          })}
        />,
      );
      expect(steps()).toEqual(["Bài tập (đã xong, đang học)"]);
      answered.unmount();

      // Memory check: đã qua, người học mở lại bước này.
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA],
            memoryCheck,
            isMemoryCheckPassed: true,
            progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
          })}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Tới Memory check" }));
      expect(steps()).toEqual(["Từ vựng (đã xong)", "Memory check (đã xong, đang học)"]);
    });

    it("keeps the memory check locked until every card has a row, and unlocks as the cards are rated", async () => {
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA, cardB],
            memoryCheck,
            isMemoryCheckPassed: false,
            progress: { ...finished },
            unseenCardIds: [cardA.id, cardB.id],
            unratedCardIds: [cardA.id, cardB.id],
          })}
        />,
      );
      expect(steps()).toEqual(["Từ vựng (đang học)", "Memory check (đang khóa)"]);
      // Server đã lưu "xong" cho Từ vựng nhưng còn thẻ chưa xem: không có lối tắt tới memory check.
      expect(screen.queryByRole("button", { name: "Tới Memory check" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({ success: true, topicProgress: { ...finished } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
      });
      // Thẻ A đã có dòng nhưng thẻ B thì chưa: vẫn khóa.
      expect(steps()[1]).toBe("Memory check (đang khóa)");
      expect(screen.queryByRole("button", { name: "Tới Memory check" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({ success: true, topicProgress: { ...finished } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
      });
      // Hết thẻ chưa xem: memory check mở và được vào ngay.
      expect(screen.getByText("Câu nhớ")).not.toBeNull();
      expect(screen.queryByText("Memory check đang khóa")).toBeNull();
    });

    it("counts a card rated Again as seen but not rated, and says how many cards still need Ổn or Dễ", async () => {
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA],
            memoryCheck,
            isMemoryCheckPassed: false,
            unseenCardIds: [cardA.id],
            unratedCardIds: [cardA.id],
          })}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({
        success: true,
        topicProgress: { ...finished, isFlashcardCompleted: false },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Lại" }));
      });
      // Thẻ đã có dòng nên memory check mở (cổng chỉ hỏi dòng tồn tại); thẻ Lại vẫn là thẻ chưa Ổn/Dễ.
      expect(steps()[1]).not.toMatch(/đang khóa/);
      expect(steps()[0]).not.toMatch(/đã xong/);
    });

    it("shows the unrated hint once every card has a row but some still need Ổn or Dễ", () => {
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA, cardB],
            exercises: [exercise("part5", {})],
            progress: { ...finished },
            unseenCardIds: [],
            unratedCardIds: [cardB.id],
          })}
        />,
      );
      // Đang ở hàng đợi thẻ: chưa nhắc. Rời bước Từ vựng thì nhắc, và bước Từ vựng không ghi "đã xong".
      expect(screen.queryByText(/thẻ cần chấm Ổn hoặc Dễ/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Tới Bài tập" }));
      expect(screen.getByText("Còn 1 thẻ cần chấm Ổn hoặc Dễ để hoàn thành bước Từ vựng.")).not.toBeNull();
      expect(steps()[0]).toBe("Từ vựng (chưa mở)");
    });

    it("shows the locked panel when the learner is sent back to a memory check whose cards are unseen", async () => {
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA],
            exercises: [exercise("part5", {})],
            memoryCheck,
            isMemoryCheckPassed: true,
            progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
            unseenCardIds: [cardA.id],
            unratedCardIds: [cardA.id],
          })}
        />,
      );
      // Đã qua memory check từ trước nên bước này không bị khóa lại, kể cả khi có thẻ mới chưa xem.
      expect(steps()[1]).toBe("Memory check (đã xong)");

      // Server báo bài tập cần memory check (bộ câu đổi): về memory check đang khóa vì thẻ chưa xem.
      fireEvent.click(screen.getByRole("button", { name: "Tới Bài tập" }));
      mockedSubmit.mockResolvedValueOnce({
        error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.",
        errorCode: "MEMORY_CHECK_REQUIRED",
      });
      fireEvent.click(screen.getAllByRole("radio")[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
      });

      expect(screen.getByText("Memory check đang khóa")).not.toBeNull();
      expect(screen.getByText(/Còn 1 thẻ chưa học/)).not.toBeNull();
      expect(steps()[1]).toBe("Memory check (đang khóa)");
      fireEvent.click(screen.getAllByRole("button", { name: "Về Từ vựng" })[0]);
      expect(screen.getByRole("button", { name: "Hiện đáp án" })).not.toBeNull();
    });
  });
});
