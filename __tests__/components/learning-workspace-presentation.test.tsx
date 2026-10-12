/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Rating } from "ts-fsrs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CARDS_REQUIRED, CARDS_REQUIRED_ERROR } from "@/lib/memory-check";
import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";
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
// - Invariant cần giữ: dòng các bước chỉ gồm giai đoạn có thật (bước hiện tại không phải nút, các bước còn lại là nút chỉ gọi đổi bước); danh sách chương mở theo yêu cầu.
// - LF3 (AC6/AC8): bước đã xong vẫn ghi "đã xong" khi đang là bước hiện tại (cả ba bước); memory check khóa tới khi mọi thẻ có dòng của học viên (Lại/Khó cũng là đã xem), mở ngay khi thẻ cuối được chấm (kể cả khi mọi thẻ Lại/Khó và hàng đợi chưa rỗng) và không có ngoại lệ cho memory check đã qua (bài tập vẫn mở theo luật LF2); nhắc số thẻ còn cần Ổn/Dễ ngay khi đủ dòng cho mọi thẻ; về memory check đang khóa thì có panel khóa và lối về Từ vựng.
// - LF4 (AC3/AC4/AC5/AC6): vào trang chỉ xếp thẻ chưa xem (bộ đếm theo lượt) và báo số thẻ chưa học đúng một lần (không báo khi mọi thẻ đều chưa xem, không báo hai lần dưới StrictMode); đã xem hết thì có màn hình kết thúc; lời mời "Ôn ngay N thẻ" chỉ hiện khi có thẻ đến hạn thuộc bài (id lạ bị bỏ qua), Ổn/Dễ trong phiên đưa thẻ ra và Lại/Khó đưa vào; "Ôn lại từ vựng" dựng lại toàn bộ thẻ; bước hiện tại của dòng các bước không phải nút; bài không có thẻ không có toast chưa học.
// - LF4 QA fix: màn hình kết thúc có nút "Tới Memory check" cạnh "Ôn lại từ vựng" (nút chính khi không có thẻ đến hạn, thứ tự Ôn ngay -> Ôn lại -> Tới Memory check), thanh trên không lặp nút này khi hàng đợi rỗng nhưng vẫn có khi đang học thẻ; không hiện khi memory check không phải bước kế tiếp.
// - LF5 (AC1/AC2): vào chủ đề chưa hoàn thành ở bước đầu tiên còn phải làm (thẻ chưa xem hoặc bước Từ vựng chưa xong -> memory check chưa qua -> bài tập còn câu), kể cả khi thẻ đã xem hết mà còn thẻ chưa Ổn/Dễ (màn hình kết thúc kèm lời mời Ôn ngay); chủ đề đã hoàn thành mở màn hình hoàn thành, trừ khi có thẻ mới chưa xem (Từ vựng kèm toast chưa học).
// - LF5 (AC3): màn hình hoàn thành nêu tên chủ đề, tiến độ khóa học và chương là hai thang riêng có progressbar có nhãn, đúng một hành động chính (Ôn ngay khi có thẻ đến hạn, nếu không thì chủ đề kế hoặc tổng quan khóa học ở chủ đề cuối), chân trang thành hành động phụ, nhãn "Chủ đề N"/"Chương N" theo đơn vị kế tiếp, Xem lại chỉ liệt kê bước chủ đề có, và trạng thái từng bước giữ nguyên (không đánh dấu xong bước Từ vựng chưa xong).
// - LF5 (AC4/AC5/AC8, G3): hoàn thành trong phiên (chấm thẻ cuối) thay màn hình kết thúc thẻ bằng màn hình hoàn thành có chuỗi chuyển động, dùng đúng giá trị thanh bên, không toast; reduced motion hiện trạng thái cuối ngay; lần vào sau trong phiên chỉ hiện màn hình ổn định; Xem lại từng bước và lối quay lại; memory check không còn đạt thì mở bước trả lời được và phục hồi khi có thẻ mới.
// - LF6 (AC1/AC2/AC3): mỗi bước không phải bước hiện tại là một nút trong li của nó, mở đúng bước (kể cả chủ đề đã hoàn thành; Từ vựng chỉ mở hàng đợi hiện có, không dựng hàng đợi, không gọi server) và đưa focus về khung bước học; bước khóa không đổi bước mà hiện một dòng lý do ngay dưới thanh (vùng polite), giữ tên "đang khóa", tắt khi đổi bước hoặc khi khóa mở; nút có mục tiêu tối thiểu 24 px, vòng focus và 44 px trên con trỏ thô mà không đổi bố cục dòng.
// - LF6 (AC4): màn hình hoàn thành chỉ có một nút "Xem lại" cùng một dòng giải thích; bấm thì cuộn thanh tiến trình vào (tức thì dưới reduced motion), focus nút đầu tiên dùng được và bật rồi tắt vòng nổi bật khoảng 1 s (không có dưới reduced motion); chủ đề không có bước nào thì không có nút lẫn dòng.
// - LF6 (AC10): hết hàng đợi ôn thẻ đến hạn/ôn lại từ vựng có toast riêng; chủ đề đã hoàn thành (đọc lúc hết hàng, kể cả kết quả của chính lần chấm) thì về màn hình hoàn thành đã ổn định, chưa hoàn thành thì ở lại màn hình kết thúc từ vựng và không sang memory check hay bài tập; Lại/Khó xếp lại không đổi loại hàng đợi; lần chấm hoàn thành chủ đề vẫn chạy chuỗi LF5 một lần không toast; hàng đợi lúc vào trang giữ toast và bước chuyển cũ; chấm đang lưu mà rời bước không mất kết quả và không gửi hai lần.
// - LF6 (AC5): bốn nút tự đánh giá của FlashcardStage dùng đúng lớp Attention/Recall của định nghĩa dùng chung với ReviewSheet, cùng nhãn và thứ tự.
// - Kết quả verify gần nhất: xem lần chạy LF3 CP4 (2026-10-11) bằng `npx vitest run __tests__/components/learning-workspace-presentation.test.tsx`; LF5 CP4 (2026-10-12).

vi.mock("@/app/actions/progress", () => ({ submitQuestionAnswer: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

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

// LF4: mặc định là lần học đầu (mọi thẻ chưa xem) nên hàng đợi mở trang là toàn bộ thẻ; test về trạng thái đã xem truyền `unseenCardIds`.
function data(overrides: Partial<LearningWorkspaceData> = {}): LearningWorkspaceData {
  const flashcards = overrides.flashcards ?? [];
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
    unseenCardIds: flashcards.map((card) => card.id),
    unratedCardIds: [],
    dueCardIds: [],
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

    it("rates with the shared Attention and Recall classes in label order (LF6 AC5)", () => {
      render(<LearningWorkspace data={data({ flashcards: [cardA] })} />);
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      FLASHCARD_RATINGS.forEach(({ label, className }) => {
        const classes = screen.getByRole("button", { name: label }).className.split(/\s+/);
        for (const token of className.split(/\s+/)) expect(classes).toContain(token);
      });
      expect(FLASHCARD_RATINGS.map(({ label }) => label)).toEqual(["Lại", "Khó", "Ổn", "Dễ"]);
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
      // LF6 AC10: the full review ends on the finished screen (not completed topic), so the step is both current and done.
      expect(flashcardStep()).toBe("Từ vựng (đã xong, đang học)");
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
            unseenCardIds: [],
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

    it("shows the unrated hint as soon as every card has a row but some still need Ổn or Dễ", () => {
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
      // LF5: server báo bước Từ vựng xong và còn câu bài tập nên vào thẳng Bài tập. Nhắc có ở mọi bước, và bước Từ vựng không ghi "đã xong".
      const hint = "Còn 1 thẻ cần chấm Ổn hoặc Dễ để hoàn thành bước Từ vựng.";
      expect(screen.getByText(hint)).not.toBeNull();
      expect(steps()[0]).toBe("Từ vựng (chưa mở)");
      fireEvent.click(screen.getByRole("button", { name: "Về Từ vựng" }));
      expect(screen.getByText(hint)).not.toBeNull();
      expect(steps()[0]).toBe("Từ vựng (đang học)");
    });

    it("offers the memory check route once every card has a row even when the learner rated every card Lại or Khó", async () => {
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA, cardB],
            memoryCheck,
            isMemoryCheckPassed: false,
            unseenCardIds: [cardA.id, cardB.id],
            unratedCardIds: [cardA.id, cardB.id],
          })}
        />,
      );
      expect(screen.queryByRole("button", { name: "Tới Memory check" })).toBeNull();
      for (const rating of ["Lại", "Khó"]) {
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        mockedReview.mockResolvedValueOnce({
          success: true,
          topicProgress: { ...finished, isFlashcardCompleted: false },
        });
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: rating }));
        });
      }
      // Cả hai thẻ đã có dòng nhưng đều quay lại hàng đợi: hàng đợi chưa rỗng, memory check vẫn phải vào được.
      expect(screen.getByText("Còn 2 thẻ cần chấm Ổn hoặc Dễ để hoàn thành bước Từ vựng.")).not.toBeNull();
      expect(steps()).toEqual(["Từ vựng (đang học)", "Memory check (chưa mở)"]);
      fireEvent.click(screen.getByRole("button", { name: "Tới Memory check" }));
      expect(screen.getByText("Câu nhớ")).not.toBeNull();
    });

    it("locks the memory check on unseen cards even after it was passed, while exercises stay open", () => {
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
      // AC6 không có ngoại lệ cho memory check đã qua; bài tập vẫn theo luật LF2 nên không bị khóa.
      expect(steps()).toEqual(["Từ vựng (đang học)", "Memory check (đã xong, đang khóa)", "Bài tập (chưa mở)"]);
      // AC6: bước đang khóa hiện ổ khóa, không hiện dấu xong; "đã xong" chỉ còn trong tên truy cập.
      const memoryIcon = within(
        within(screen.getByRole("list", { name: "Các bước của bài học" })).getAllByRole("listitem")[1],
      ).getByText((_, el) => el?.tagName.toLowerCase() === "svg");
      expect(memoryIcon.getAttribute("class")).toContain("lucide-lock");
      expect(memoryIcon.getAttribute("class")).not.toMatch(/lucide-circle-check|lucide-check-circle/);
      expect(screen.queryByRole("button", { name: "Tới Memory check" })).toBeNull();
      expect(screen.getByRole("button", { name: "Tới Bài tập" })).not.toBeNull();
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
      // Đã qua memory check từ trước nhưng có thẻ mới chưa xem: bước này khóa (AC6 không có ngoại lệ).
      expect(steps()[1]).toBe("Memory check (đã xong, đang khóa)");

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

  describe("LF4 queue start, finished screen and due offer", () => {
    const finishedScreen = () => screen.queryByRole("heading", { name: "Bạn đã ôn xong từ vựng" });
    const counter = () => screen.getByText(/^\d+ \/ \d+$/).textContent;
    async function rate(name: string) {
      fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
      mockedReview.mockResolvedValueOnce({ success: true });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: name }));
      });
    }

    it("queues only the unseen cards, counts the session total and tells the learner how many are unseen once", () => {
      render(
        <React.StrictMode>
          <LearningWorkspace data={data({ flashcards: [cardA, cardB], unseenCardIds: [cardB.id] })} />
        </React.StrictMode>,
      );
      expect(screen.getByText("improve")).not.toBeNull();
      expect(screen.queryByText("reliable")).toBeNull();
      expect(counter()).toBe("1 / 1");
      expect(mockedToast.info).toHaveBeenCalledTimes(1);
      expect(mockedToast.info).toHaveBeenCalledWith("Bạn còn 1 thẻ chưa học trong bài học này");
    });

    it("does not announce unseen cards when every card is unseen or the topic has no cards", () => {
      const { unmount } = render(<LearningWorkspace data={data({ flashcards: [cardA, cardB] })} />);
      expect(counter()).toBe("2 / 2");
      unmount();
      render(<LearningWorkspace data={data({ exercises: [exercise("part5", {})] })} />);
      expect(mockedToast.info).not.toHaveBeenCalled();
    });

    it("shows the finished screen without a due offer when every card was seen and none is due", () => {
      render(<LearningWorkspace data={data({ flashcards: [cardA, cardB], unseenCardIds: [] })} />);
      expect(finishedScreen()).not.toBeNull();
      expect(screen.queryByRole("button", { name: /^Ôn ngay/ })).toBeNull();
      expect(screen.queryByText(/thẻ đến hạn/)).toBeNull();
      expect(mockedToast.info).not.toHaveBeenCalled();
      // Chủ đề chỉ có một bước nên bước hiện tại là bước duy nhất và không phải nút.
      expect(
        within(screen.getByRole("list", { name: "Các bước của bài học" })).queryAllByRole("button"),
      ).toHaveLength(0);
    });

    it("offers to review only the due cards and ignores ids that are not active cards", () => {
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA, cardB],
            unseenCardIds: [],
            dueCardIds: [cardB.id, "e0000000-0000-4000-8000-0000000000ff"],
          })}
        />,
      );
      expect(screen.getByText("Bạn có 1 thẻ đến hạn thuộc bài học này")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Ôn ngay 1 thẻ" }));
      expect(finishedScreen()).toBeNull();
      expect(screen.getByText("improve")).not.toBeNull();
      expect(counter()).toBe("1 / 1");
    });

    it("rebuilds the whole topic for Ôn lại từ vựng even when only some cards are due", () => {
      render(
        <LearningWorkspace
          data={data({ flashcards: [cardA, cardB], unseenCardIds: [], dueCardIds: [cardA.id] })}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Ôn lại từ vựng" }));
      expect(counter()).toBe("2 / 2");
      expect(screen.getByText("reliable")).not.toBeNull();
    });

    it("moves cards in and out of the due offer by the ratings given in this session", async () => {
      render(
        <LearningWorkspace
          data={data({ flashcards: [cardA, cardB], unseenCardIds: [cardB.id], dueCardIds: [cardA.id] })}
        />,
      );
      // Thẻ B chấm Khó rồi Ổn nên không ở lại tập đến hạn; thẻ A vẫn đến hạn theo dữ liệu server.
      await rate("Khó");
      await rate("Ổn");
      expect(finishedScreen()).not.toBeNull();
      expect(screen.getByText("Bạn có 1 thẻ đến hạn thuộc bài học này")).not.toBeNull();

      // Ôn ngay thẻ đến hạn và chấm Dễ thì không còn thẻ đến hạn.
      fireEvent.click(screen.getByRole("button", { name: "Ôn ngay 1 thẻ" }));
      await rate("Dễ");
      expect(finishedScreen()).not.toBeNull();
      expect(screen.queryByRole("button", { name: /^Ôn ngay/ })).toBeNull();
    });

    it("keeps the empty queue when the learner returns to the flashcard step", () => {
      render(
        <LearningWorkspace
          data={data({
            flashcards: [cardA],
            unseenCardIds: [],
            exercises: [exercise("part5", {})],
            progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
          })}
        />,
      );
      // LF5: cả thẻ lẫn bước Từ vựng đã xong và còn câu bài tập nên vào thẳng Bài tập.
      expect(finishedScreen()).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Về Từ vựng" }));
      expect(finishedScreen()).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Tới Bài tập" }));
      fireEvent.click(screen.getByRole("button", { name: "Về Từ vựng" }));
      expect(finishedScreen()).not.toBeNull();
    });

    describe("memory check shortcut on the finished screen", () => {
      const memoryCheck = {
        id: "d0000000-0000-4000-8000-000000000001",
        questions: [question("d0000000-0000-4000-8000-000000000002", "Câu nhớ", 1)],
      };
      const memoryButtons = () => screen.queryAllByRole("button", { name: "Tới Memory check" });
      const finishedRow = () =>
        within(screen.getByRole("heading", { name: "Bạn đã ôn xong từ vựng" }).closest("section")!);

      it("offers the memory check next to Ôn lại từ vựng, once, and opens the memory stage", () => {
        render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA],
              unseenCardIds: [],
              memoryCheck,
              isMemoryCheckPassed: false,
            })}
          />,
        );
        // Chỉ một nút, nằm trong màn hình kết thúc chứ không lặp ở thanh trên.
        expect(memoryButtons()).toHaveLength(1);
        const restart = finishedRow().getByRole("button", { name: "Ôn lại từ vựng" });
        const memory = finishedRow().getByRole("button", { name: "Tới Memory check" });
        expect(restart.parentElement).toBe(memory.parentElement);
        // Không có thẻ đến hạn: memory check là nút chính, ôn lại là nút viền.
        expect(memory.getAttribute("data-variant")).toBe("default");
        expect(restart.getAttribute("data-variant")).toBe("outline");

        fireEvent.click(memory);
        expect(screen.getByText("Câu nhớ")).not.toBeNull();
        expect(finishedScreen()).toBeNull();
      });

      it("keeps Ôn ngay primary and orders the buttons Ôn ngay, Ôn lại, Tới Memory check when cards are due", () => {
        render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA, cardB],
              unseenCardIds: [],
              dueCardIds: [cardA.id],
              memoryCheck,
              isMemoryCheckPassed: false,
            })}
          />,
        );
        const buttons = finishedRow().getAllByRole("button");
        expect(buttons.map((button) => button.textContent)).toEqual([
          "Ôn ngay 1 thẻ",
          "Ôn lại từ vựng",
          "Tới Memory check",
        ]);
        expect(buttons.map((button) => button.getAttribute("data-variant"))).toEqual([
          "default",
          "outline",
          "outline",
        ]);
        expect(memoryButtons()).toHaveLength(1);
      });

      it("keeps the header shortcut while cards are being studied and moves it to the finished screen once the queue is empty", async () => {
        render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA, cardB],
              unseenCardIds: [],
              memoryCheck,
              isMemoryCheckPassed: false,
            })}
          />,
        );
        expect(finishedRow().getByRole("button", { name: "Tới Memory check" })).not.toBeNull();
        expect(memoryButtons()).toHaveLength(1);

        // Ôn lại từ vựng: đang học thẻ nên nút nằm ở thanh trên, không còn màn hình kết thúc.
        fireEvent.click(screen.getByRole("button", { name: "Ôn lại từ vựng" }));
        expect(finishedScreen()).toBeNull();
        expect(memoryButtons()).toHaveLength(1);

        // LF6 AC10: hết hàng đợi ôn lại thì ở lại màn hình kết thúc (chủ đề chưa hoàn thành), có toast ôn lại và đúng một nút.
        for (let i = 0; i < 2; i += 1) await rate("Dễ");
        expect(screen.queryByText("Câu nhớ")).toBeNull();
        expect(mockedToast.success).toHaveBeenCalledWith("Đã ôn lại xong từ vựng!");
        expect(finishedScreen()).not.toBeNull();
        expect(memoryButtons()).toHaveLength(1);
        expect(finishedRow().getByRole("button", { name: "Tới Memory check" })).not.toBeNull();
      });

      it("shows no memory shortcut when the memory check is not the next stage", () => {
        // Đã qua memory check và còn bài tập: bước kế tiếp là Bài tập.
        const { unmount } = render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA],
              unseenCardIds: [],
              exercises: [exercise("part5", {})],
              memoryCheck,
              isMemoryCheckPassed: true,
              progress: { isFlashcardCompleted: true, isExerciseCompleted: false, isTopicCompleted: false },
            })}
          />,
        );
        // LF5: vào thẳng Bài tập; về Từ vựng đi qua Memory check đã qua.
        expect(finishedScreen()).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Về Memory check" }));
        fireEvent.click(screen.getByRole("button", { name: "Về Từ vựng" }));
        expect(finishedScreen()).not.toBeNull();
        expect(memoryButtons()).toHaveLength(0);
        expect(screen.getByRole("button", { name: "Tới Bài tập" })).not.toBeNull();
        unmount();

        // Bài không có memory check.
        render(<LearningWorkspace data={data({ flashcards: [cardA], unseenCardIds: [] })} />);
        expect(finishedScreen()).not.toBeNull();
        expect(memoryButtons()).toHaveLength(0);
      });
    });
  });

  describe("LF5 landing stage, completion screen and review", () => {
    const memoryQuestionId = "d0000000-0000-4000-8000-000000000002";
    const memoryCheck = {
      id: "d0000000-0000-4000-8000-000000000001",
      questions: [question(memoryQuestionId, "Câu nhớ", 1)],
    };
    const memoryAnswers = { [memoryQuestionId]: `${memoryQuestionId.slice(0, 35)}1` };
    const exerciseAnswers = { [q(1)]: `${q(1).slice(0, 35)}1` };
    const done = { isFlashcardCompleted: true, isExerciseCompleted: true, isTopicCompleted: true };
    const doneProgress = {
      ...done,
      isMemoryCheckPassed: true,
      newlyCompleted: true,
    };
    const completionHeading = () => screen.queryByRole("heading", { name: /^Đã hoàn thành chủ đề/ });
    const panel = () => completionHeading()?.closest("section") as HTMLElement;
    const finishedScreen = () => screen.queryByRole("heading", { name: "Bạn đã ôn xong từ vựng" });
    const steps = () =>
      within(screen.getByRole("list", { name: "Các bước của bài học" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent?.replace(/^\d/, ""));
    const primaries = () => Array.from(document.querySelectorAll('[data-variant="default"]'));

    const topicTwo = {
      id: "22222222-2222-4222-8222-222222222223",
      slug: "topic-two",
      title: "Bài hai",
      orderIndex: 2,
      chapterId,
    };
    const chapterTwoId = "11111111-1111-4111-8111-111111111112";
    const topicThree = {
      id: "22222222-2222-4222-8222-222222222224",
      slug: "topic-three",
      title: "Bài ba",
      orderIndex: 3,
      chapterId: chapterTwoId,
    };
    // The current topic is the last one of its chapter, so the next unit is the next chapter.
    const chapterEndSyllabus = (previousCompleted: boolean) => [
      {
        id: chapterId,
        title: "Chương một",
        orderIndex: 1,
        topics: [
          { ...topicTwo, isCompleted: previousCompleted },
          { ...topic, isCompleted: false },
        ],
      },
      {
        id: chapterTwoId,
        title: "Chương hai",
        orderIndex: 2,
        topics: [{ ...topicThree, isCompleted: false }],
      },
    ];
    const threeTopicSyllabus = (secondCompleted: boolean) => [
      {
        id: chapterId,
        title: "Chương một",
        orderIndex: 1,
        topics: [
          { ...topic, isCompleted: false },
          { ...topicTwo, isCompleted: secondCompleted },
        ],
      },
      {
        id: chapterTwoId,
        title: "Chương hai",
        orderIndex: 2,
        topics: [{ ...topicThree, isCompleted: false }],
      },
    ];
    const completedTopic = (overrides: Partial<LearningWorkspaceData> = {}) =>
      data({
        flashcards: [cardA, cardB],
        unseenCardIds: [],
        memoryCheck,
        isMemoryCheckPassed: true,
        exercises: [exercise("part5", {})],
        answers: { ...memoryAnswers, ...exerciseAnswers },
        progress: { ...done },
        ...overrides,
      });

    describe("landing on a topic that is not completed (AC1)", () => {
      const notDone = { isFlashcardCompleted: false, isExerciseCompleted: false, isTopicCompleted: false };

      it("opens Từ vựng when a card is unseen", () => {
        render(
          <LearningWorkspace
            data={data({ flashcards: [cardA, cardB], memoryCheck, isMemoryCheckPassed: false, progress: notDone })}
          />,
        );
        expect(screen.getByRole("button", { name: "Hiện đáp án" })).not.toBeNull();
      });

      it("opens the finished screen with the review offer when every card is seen but one still needs Ổn or Dễ", () => {
        render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA, cardB],
              unseenCardIds: [],
              unratedCardIds: [cardA.id],
              dueCardIds: [cardA.id],
              memoryCheck,
              isMemoryCheckPassed: false,
              progress: notDone,
            })}
          />,
        );
        expect(finishedScreen()).not.toBeNull();
        expect(screen.getByRole("button", { name: "Ôn ngay 1 thẻ" })).not.toBeNull();
      });

      it("opens the memory check when the cards are done and it is not passed, even though exercises exist", () => {
        render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA],
              unseenCardIds: [],
              memoryCheck,
              isMemoryCheckPassed: false,
              exercises: [exercise("part5", {})],
              progress: { ...notDone, isFlashcardCompleted: true },
            })}
          />,
        );
        expect(screen.getByText("Câu nhớ")).not.toBeNull();
        expect(steps()).toEqual([
          "Từ vựng (đã xong)",
          "Memory check (đang học)",
          "Bài tập (đang khóa)",
        ]);
      });

      it("opens Bài tập when the earlier stages are done and a question is not answered", () => {
        render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA],
              unseenCardIds: [],
              memoryCheck,
              isMemoryCheckPassed: true,
              answers: memoryAnswers,
              exercises: [exercise("part5", {})],
              progress: { ...notDone, isFlashcardCompleted: true },
            })}
          />,
        );
        expect(screen.getByText("Câu một")).not.toBeNull();
      });

      it("opens a topic with no cards and no memory check on its exercises", () => {
        render(<LearningWorkspace data={data({ exercises: [exercise("part5", {})] })} />);
        expect(screen.getByText("Câu một")).not.toBeNull();
      });
    });

    describe("landing on a completed topic (AC2, AC3)", () => {
      it("opens the completion screen and names the topic", () => {
        render(<LearningWorkspace data={completedTopic()} />);
        expect(completionHeading()?.textContent).toBe("Đã hoàn thành chủ đề “Bài một”");
        expect(screen.queryByRole("button", { name: "Hiện đáp án" })).toBeNull();
        // A landing never plays the sequence, takes focus or toasts.
        expect(panel().getAttribute("data-motion")).toBe("settled");
        expect(document.activeElement).not.toBe(completionHeading());
        expect(mockedToast.success).not.toHaveBeenCalled();
      });

      it("opens Từ vựng with the unseen toast when a card was added after completion", () => {
        render(<LearningWorkspace data={completedTopic({ unseenCardIds: [cardB.id] })} />);
        expect(completionHeading()).toBeNull();
        expect(screen.getByText("improve")).not.toBeNull();
        expect(mockedToast.info).toHaveBeenCalledWith("Bạn còn 1 thẻ chưa học trong bài học này");
      });

      it("keeps the stage thread's own state: a completed topic whose flashcard step is not done is not shown as done", () => {
        render(
          <LearningWorkspace
            data={completedTopic({ progress: { ...done, isFlashcardCompleted: false } })}
          />,
        );
        expect(completionHeading()).not.toBeNull();
        expect(steps()).toEqual([
          "Từ vựng (chưa mở)",
          "Memory check (đã xong)",
          "Bài tập (đã xong)",
        ]);
      });

      it("makes the next topic the only primary action, with the footer subordinate, when no card is due", () => {
        render(<LearningWorkspace data={completedTopic({ syllabus: threeTopicSyllabus(false) })} />);
        // Owner Q8: one line, no second line and no chevron; the next topic is named in the hint above.
        const nextLink = within(panel()).getByRole("link", { name: "Chủ đề tiếp theo" });
        expect(nextLink.getAttribute("href")).toBe("/learn/toeic-foundation/topic-two");
        expect(nextLink.textContent).toBe("Chủ đề tiếp theo");
        expect(nextLink.querySelector("svg")).toBeNull();
        expect(within(panel()).getByText("Tiếp theo: Chủ đề 2 · Bài hai")).not.toBeNull();
        expect(primaries()).toEqual([nextLink]);
        expect(within(panel()).queryByRole("button", { name: /^Ôn ngay/ })).toBeNull();

        const footer = within(screen.getByRole("navigation", { name: "Điều hướng bài học" }));
        expect(footer.getByRole("link", { name: "Bài sau" }).getAttribute("data-variant")).toBe("ghost");
      });

      it("makes Ôn ngay the only primary action and the next topic subordinate when cards are due, and starts the due queue", () => {
        render(
          <LearningWorkspace
            data={completedTopic({ syllabus: threeTopicSyllabus(false), dueCardIds: [cardA.id, "ffffffff-ffff-4fff-8fff-ffffffffffff"] })}
          />,
        );
        // Owner Q10/Q13: a small context line over the larger action; the accessible name keeps both.
        const review = within(panel()).getByRole("button", { name: "Có 1 thẻ đến hạn, Ôn ngay" });
        expect(primaries()).toEqual([review]);
        const lines = Array.from(review.querySelectorAll("[data-due-line]"));
        expect(lines.map((line) => line.textContent)).toEqual(["Có 1 thẻ đến hạn", "Ôn ngay"]);
        // Owner Q12: the small line is the 12px caption token, and both lines sit in one left-aligned block that the
        // button centres, so they start at the same x.
        expect(lines[0].className).toContain("text-xs");
        expect(lines[1].className).toContain("text-lg");
        expect(lines[0].parentElement).toBe(lines[1].parentElement);
        expect(lines[0].parentElement?.className).toContain("items-start");
        expect(lines[0].parentElement?.className).toContain("text-left");
        // Small line keeps full contrast: the hierarchy comes from size and weight only (no opacity).
        expect(lines[0].className).not.toContain("opacity");
        // Owner Q13: stacked in every input mode, one action per row: the filled full-width primary over the
        // full-width outline subordinate action.
        expect(review.className).toContain("w-full");
        expect(review.parentElement?.className).toBe("flex flex-col gap-3");
        const nextLink = within(panel()).getByRole("link", { name: "Chủ đề tiếp theo" });
        expect(nextLink.getAttribute("data-variant")).toBe("outline");
        expect(nextLink.className).toContain("w-full");
        expect(nextLink.className).toContain("min-h-12");
        const footer = within(screen.getByRole("navigation", { name: "Điều hướng bài học" }));
        expect(footer.getByRole("link", { name: "Bài sau" }).getAttribute("data-variant")).toBe("ghost");

        fireEvent.click(review);
        expect(completionHeading()).toBeNull();
        expect(screen.getByText("reliable")).not.toBeNull();
        expect(screen.getByText("1 / 1")).not.toBeNull();
      });

      it("offers the course overview as the only primary action on the last topic", () => {
        render(<LearningWorkspace data={completedTopic()} />);
        const overview = within(panel()).getByRole("link", { name: "Về tổng quan khóa học" });
        expect(overview.getAttribute("href")).toBe("/learn/toeic-foundation");
        expect(within(panel()).queryByRole("link", { name: "Chủ đề tiếp theo" })).toBeNull();
        expect(primaries()).toEqual([overview]);
        // The footer keeps the destination, but as a subordinate action.
        const footer = within(screen.getByRole("navigation", { name: "Điều hướng bài học" }));
        expect(footer.getByRole("link", { name: "Về tổng quan khóa học" }).getAttribute("data-variant")).toBe("ghost");
      });

      it("shows the course overview as the same full-width outline action on the last topic when cards are due", () => {
        render(<LearningWorkspace data={completedTopic({ dueCardIds: [cardA.id] })} />);
        const review = within(panel()).getByRole("button", { name: "Có 1 thẻ đến hạn, Ôn ngay" });
        expect(primaries()).toEqual([review]);
        const overview = within(panel()).getByRole("link", { name: "Về tổng quan khóa học" });
        expect(overview.getAttribute("data-variant")).toBe("outline");
        expect(overview.className).toContain("w-full");
      });

      it("keeps the completion screen for a completed topic whose active content was all removed", () => {
        render(
          <LearningWorkspace
            data={completedTopic({
              flashcards: [],
              unseenCardIds: [],
              memoryCheck: null,
              isMemoryCheckPassed: false,
              exercises: [],
              answers: {},
            })}
          />,
        );
        expect(completionHeading()).not.toBeNull();
        expect(screen.queryByText("Bài học này chưa có nội dung")).toBeNull();
        // Nothing to review, but the destination is still there as the only primary action.
        expect(within(panel()).queryByRole("button", { name: "Xem lại" })).toBeNull();
        expect(within(panel()).queryByText("Chọn một bước ở thanh tiến trình để xem lại.")).toBeNull();
        const overview = within(panel()).getByRole("link", { name: "Về tổng quan khóa học" });
        expect(overview.getAttribute("href")).toBe("/learn/toeic-foundation");
        expect(primaries()).toEqual([overview]);
      });

      it("shows the next-unit context for every kind of next step", () => {
        // Last topic of the course: the overview.
        const { unmount } = render(<LearningWorkspace data={completedTopic()} />);
        expect(within(panel()).getByText("Tiếp theo: Tổng quan khóa học")).not.toBeNull();
        unmount();
        // A next topic in the same chapter (the chapter is not finished yet).
        render(<LearningWorkspace data={completedTopic({ syllabus: threeTopicSyllabus(false) })} />);
        expect(within(panel()).getByText("Tiếp theo: Chủ đề 2 · Bài hai")).not.toBeNull();
      });

      it("shows course and chapter progress as separate labelled scales, and the next chapter once this chapter is finished", () => {
        render(<LearningWorkspace data={completedTopic({ syllabus: chapterEndSyllabus(true) })} />);
        const course = within(panel()).getByRole("progressbar", { name: "Tiến độ khóa học" });
        expect(course.getAttribute("aria-valuenow")).toBe("2");
        expect(course.getAttribute("aria-valuemax")).toBe("3");
        expect(within(panel()).getByText("2/3 chủ đề")).not.toBeNull();
        const chapter = within(panel()).getByRole("progressbar", { name: "Chương 1 · Chương một" });
        expect(chapter.getAttribute("aria-valuenow")).toBe("2");
        expect(chapter.getAttribute("aria-valuemax")).toBe("2");
        expect(within(panel()).getByText("Đã hoàn thành chương này")).not.toBeNull();
        // The next unit is the next chapter; the hint names it and its first topic.
        expect(within(panel()).getByText("Tiếp theo: Chương 2 · Chương hai — Chủ đề 1 · Bài ba")).not.toBeNull();
        const nextLink = within(panel()).getByRole("link", { name: "Chủ đề tiếp theo" });
        expect(nextLink.getAttribute("href")).toBe("/learn/toeic-foundation/topic-three");
      });

      it("shows one Xem lại button and one explanation line instead of a button per stage (LF6 AC4)", () => {
        render(<LearningWorkspace data={data({ flashcards: [cardA], unseenCardIds: [], progress: { ...done } })} />);
        const review = within(panel()).getByRole("button", { name: "Xem lại" });
        expect(review.getAttribute("data-variant")).toBe("outline");
        expect(within(panel()).getByText("Chọn một bước ở thanh tiến trình để xem lại.")).not.toBeNull();
        expect(within(panel()).queryByRole("group", { name: "Xem lại các bước" })).toBeNull();
        expect(within(panel()).queryByRole("button", { name: /^Xem lại .+/ })).toBeNull();
      });
    });

    describe("Xem lại and the return action (AC5)", () => {
      it("opens the finished screen from the thread's Từ vựng step without starting a queue, and the return action brings the completion screen back without replaying (LF6 AC1)", () => {
        render(<LearningWorkspace data={completedTopic({ dueCardIds: [cardA.id] })} />);
        expect(screen.queryByRole("button", { name: "Xem kết quả chủ đề" })).toBeNull();

        fireEvent.click(within(screen.getByRole("list", { name: "Các bước của bài học" })).getByRole("button", { name: /^Từ vựng/ }));
        expect(completionHeading()).toBeNull();
        // The queue is the empty one built on entry: the finished screen with its own actions, no counter, no server call.
        expect(finishedScreen()).not.toBeNull();
        expect(screen.queryByText(/^\d+ \/ \d+$/)).toBeNull();
        expect(mockedReview).not.toHaveBeenCalled();
        // A subordinate action, not a second primary.
        const back = screen.getByRole("button", { name: "Xem kết quả chủ đề" });
        expect(back.getAttribute("data-variant")).toBe("outline");

        // Owner Q14: while a stage of the completed topic is shown the footer destination is the filled primary; on touch
        // input it still gets a visible border (it used to stay transparent).
        const footerPrimary = within(screen.getByRole("navigation", { name: "Điều hướng bài học" })).getByRole("link", {
          name: /^(Bài sau|Về tổng quan khóa học)$/,
        });
        expect(footerPrimary.getAttribute("data-variant")).toBe("default");
        expect(footerPrimary.className).toContain("coarse-input:border-action");

        fireEvent.click(back);
        expect(completionHeading()).not.toBeNull();
        expect(panel().getAttribute("data-motion")).toBe("settled");
      });

      it("gives Xem lại an equal-width touch target, keeps the stage thread on one line and gives the footer a touch outline (Owner Q14)", () => {
        render(<LearningWorkspace data={completedTopic({ dueCardIds: [cardA.id] })} />);
        const review = within(panel()).getByRole("button", { name: "Xem lại" });
        expect(review.className).toContain("w-full");
        expect(review.className).toContain("min-h-11");
        // The thread never wraps, so no connector can start a line.
        const thread = screen.getByRole("list", { name: "Các bước của bài học" });
        expect(thread.className).toContain("flex-nowrap");
        expect(thread.className).not.toMatch(/(^| )flex-wrap( |$)/);
        // Footer destinations get a visible border and background on touch-primary input, chosen by input capability.
        const footer = within(screen.getByRole("navigation", { name: "Điều hướng bài học" }));
        const overview = footer.getByRole("link", { name: "Về tổng quan khóa học" });
        expect(overview.className).toContain("coarse-input:border-border");
        expect(overview.className).toContain("coarse-input:bg-background");
        expect(footer.getByRole("button", { name: "Bài trước" }).className).toContain("coarse-input:bg-background");
      });

      it("opens the passed memory check as a read-only review without writing", () => {
        render(<LearningWorkspace data={completedTopic()} />);
        fireEvent.click(screen.getByRole("button", { name: /^Memory check/ }));

        expect(screen.getByRole("heading", { name: "Xem lại Memory check" })).not.toBeNull();
        expect(screen.getByRole("radio", { name: /Câu nhớ lựa chọn 1/ }).getAttribute("aria-checked")).toBe("true");
        expect(mockedSubmit).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Xem kết quả chủ đề" })).not.toBeNull();
      });

      it("opens the exercises as they already render answered questions", () => {
        render(<LearningWorkspace data={completedTopic()} />);
        fireEvent.click(screen.getByRole("button", { name: /^Bài tập/ }));
        expect(screen.getByText("Câu một")).not.toBeNull();
        expect(screen.getByRole("radio", { name: /Câu một lựa chọn 1/ }).getAttribute("aria-checked")).toBe("true");
        expect(screen.queryByRole("button", { name: "Xác nhận đáp án" })).toBeNull();
      });

      it("opens the answerable memory stage when the memory check is no longer passed, and recovers from a card added meanwhile", async () => {
        const refresh = vi.fn();
        vi.mocked(useRouter).mockReturnValue({ refresh } as never);
        render(
          <LearningWorkspace
            data={completedTopic({ isMemoryCheckPassed: false, answers: exerciseAnswers })}
          />,
        );
        fireEvent.click(screen.getByRole("button", { name: /^Memory check/ }));
        expect(screen.queryByRole("heading", { name: "Xem lại Memory check" })).toBeNull();
        expect(screen.getByText("Câu nhớ")).not.toBeNull();

        mockedSubmit.mockResolvedValueOnce({ error: CARDS_REQUIRED_ERROR, errorCode: CARDS_REQUIRED });
        fireEvent.click(screen.getByRole("radio", { name: /Câu nhớ lựa chọn 1/ }));
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
        });
        expect(refresh).toHaveBeenCalledTimes(1);
        // The answer was not written; back on Từ vựng (the refresh remounts it with the new card in the queue).
        expect(finishedScreen()).not.toBeNull();
      });
    });

    describe("clickable stage thread (LF6 AC1, AC2, AC3)", () => {
      const inProgress = { isFlashcardCompleted: false, isExerciseCompleted: false, isTopicCompleted: false };
      const unpassedMemory = (overrides: Partial<LearningWorkspaceData> = {}) =>
        data({
          flashcards: [cardA, cardB],
          unseenCardIds: [],
          memoryCheck,
          isMemoryCheckPassed: false,
          exercises: [exercise("part5", {})],
          progress: inProgress,
          ...overrides,
        });
      const thread = () => within(screen.getByRole("list", { name: "Các bước của bài học" }));
      const stepButton = (name: RegExp) => thread().getByRole("button", { name });
      const plane = () => screen.getByRole("main");
      const liveRegion = () => document.querySelector('[aria-live="polite"]') as HTMLElement;
      const rateOnce = async (name: string) => {
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        mockedReview.mockResolvedValueOnce({ success: true });
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name }));
        });
      };

      it("makes every step except the current one a native button and leaves the current step as plain text", () => {
        render(<LearningWorkspace data={completedTopic()} />);
        const items = thread().getAllByRole("listitem");
        expect(items).toHaveLength(3);
        // The completed topic lands on the completion screen, so no thread step is current: all three are buttons.
        expect(thread().getAllByRole("button")).toHaveLength(3);
        for (const button of thread().getAllByRole("button")) {
          expect(button.tagName).toBe("BUTTON");
          expect(button.getAttribute("type")).toBe("button");
          expect(items.some((item) => item.contains(button))).toBe(true);
        }

        fireEvent.click(stepButton(/^Memory check/));
        const current = thread()
          .getAllByRole("listitem")
          .find((item) => item.getAttribute("aria-current") === "step")!;
        expect(current.textContent).toContain("Memory check");
        expect(within(current).queryByRole("button")).toBeNull();
        expect(thread().getAllByRole("button")).toHaveLength(2);
        // The visual state text is unchanged by the control.
        expect(current.textContent?.replace(/^\d/, "")).toBe("Memory check (đã xong, đang học)");
      });

      it("opens each stage of a completed topic from the thread and moves focus to the stage plane", () => {
        render(<LearningWorkspace data={completedTopic({ dueCardIds: [cardA.id] })} />);

        fireEvent.click(stepButton(/^Memory check/));
        expect(screen.getByRole("heading", { name: "Xem lại Memory check" })).not.toBeNull();
        expect(document.activeElement).toBe(plane());

        fireEvent.click(stepButton(/^Bài tập/));
        expect(screen.getByText("Câu một")).not.toBeNull();
        expect(document.activeElement).toBe(plane());

        // Từ vựng shows the finished screen with its own actions; no queue starts and nothing is sent.
        fireEvent.click(stepButton(/^Từ vựng/));
        expect(finishedScreen()).not.toBeNull();
        expect(screen.getByRole("button", { name: "Ôn ngay 1 thẻ" })).not.toBeNull();
        expect(screen.getByRole("button", { name: "Ôn lại từ vựng" })).not.toBeNull();
        expect(screen.queryByText(/^\d+ \/ \d+$/)).toBeNull();
        expect(mockedReview).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(plane());
      });

      it("opens the answerable memory stage and an exercise's empty state of a topic that is not completed, with focus on the plane", () => {
        const { unmount } = render(<LearningWorkspace data={unpassedMemory()} />);
        fireEvent.click(stepButton(/^Memory check/));
        expect(screen.getByText("Câu nhớ")).not.toBeNull();
        expect(document.activeElement).toBe(plane());
        unmount();

        render(
          <LearningWorkspace
            data={unpassedMemory({
              isMemoryCheckPassed: true,
              exercises: [exercise("part5", {}, [])],
              progress: { ...inProgress, isFlashcardCompleted: true },
            })}
          />,
        );
        fireEvent.click(stepButton(/^Bài tập/));
        expect(screen.getByText("Bài tập này chưa có câu hỏi để làm.")).not.toBeNull();
        expect(document.activeElement).toBe(plane());
      });

      it("returns to Từ vựng with the current queue instead of starting or replacing one", async () => {
        render(<LearningWorkspace data={unpassedMemory({ dueCardIds: [cardA.id, cardB.id] })} />);
        fireEvent.click(screen.getByRole("button", { name: "Ôn ngay 2 thẻ" }));
        await rateOnce("Ổn");
        expect(screen.getByText("1 / 2")).not.toBeNull();
        expect(screen.getByText("improve", { exact: true })).not.toBeNull();

        fireEvent.click(stepButton(/^Memory check/));
        expect(screen.getByText("Câu nhớ")).not.toBeNull();
        fireEvent.click(stepButton(/^Từ vựng/));

        // Same remaining card, same counter, and the one rating was the only server call.
        expect(screen.getByText("improve", { exact: true })).not.toBeNull();
        expect(screen.getByText("1 / 2")).not.toBeNull();
        expect(finishedScreen()).toBeNull();
        expect(mockedReview).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(plane());
      });

      it("explains a locked Memory check under the thread, keeps the stage and the state text, and clears the line when the gate opens", async () => {
        render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA],
              memoryCheck,
              isMemoryCheckPassed: false,
              exercises: [exercise("part5", {})],
            })}
          />,
        );
        const locked = stepButton(/^Memory check\s*\(đang khóa\)/);
        expect(liveRegion().textContent).toBe("");

        fireEvent.click(locked);
        expect(liveRegion().textContent).toBe("Học hết flashcard của bài này để mở memory check. Còn 1 thẻ chưa học.");
        // Same stage, same card; the line sits right under the thread.
        expect(screen.getByRole("button", { name: "Hiện đáp án" })).not.toBeNull();
        expect(screen.queryByText("Câu nhớ")).toBeNull();
        expect(
          liveRegion().previousElementSibling?.contains(screen.getByRole("list", { name: "Các bước của bài học" })),
        ).toBe(true);
        expect(document.activeElement).not.toBe(plane());

        // Lại saves the last unseen card, which opens the gate while the stage stays: the line goes with the lock.
        await rateOnce("Lại");
        expect(liveRegion().textContent).toBe("");
        expect(stepButton(/^Memory check\s*\(chưa mở\)/)).not.toBeNull();
      });

      it("explains a locked Bài tập with the memory check wording, never opens it and clears the line on a stage change", () => {
        render(<LearningWorkspace data={unpassedMemory()} />);
        fireEvent.click(stepButton(/^Memory check/));
        expect(screen.getByText("Câu nhớ")).not.toBeNull();

        fireEvent.click(stepButton(/^Bài tập\s*\(đang khóa\)/));
        expect(liveRegion().textContent).toBe("Trả lời đúng hết memory check để mở khóa phần bài tập.");
        expect(screen.getByText("Câu nhớ")).not.toBeNull();
        expect(screen.queryByText("Câu một")).toBeNull();
        expect(mockedToast.error).not.toHaveBeenCalled();

        fireEvent.click(stepButton(/^Từ vựng/));
        expect(liveRegion().textContent).toBe("");
        // The line does not come back by itself when the learner returns.
        fireEvent.click(stepButton(/^Memory check/));
        expect(liveRegion().textContent).toBe("");
      });

      it("loses no result and sends nothing twice when the learner jumps away while a card rating on a completed topic is saving", async () => {
        render(<LearningWorkspace data={completedTopic({ dueCardIds: [cardA.id] })} />);
        fireEvent.click(within(panel()).getByRole("button", { name: "Có 1 thẻ đến hạn, Ôn ngay" }));
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        let settle: (value: unknown) => void = () => {};
        mockedReview.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)) as never);
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
        });

        // Away while the rating is still saving.
        fireEvent.click(stepButton(/^Memory check/));
        expect(screen.getByRole("heading", { name: "Xem lại Memory check" })).not.toBeNull();
        await act(async () => {
          settle({ success: true });
        });

        // The result landed: one call, the card left the due list, and the review ended as a due review.
        expect(mockedReview).toHaveBeenCalledTimes(1);
        expect(mockedReview).toHaveBeenCalledWith(cardA.id, Rating.Good);
        expect(mockedToast.success).toHaveBeenCalledWith("Đã ôn xong thẻ đến hạn!");
        expect(mockedToast.success).toHaveBeenCalledTimes(1);
        expect(completionHeading()).not.toBeNull();
        expect(within(panel()).queryByRole("button", { name: /Ôn ngay/ })).toBeNull();
        // The flashcard queue is consistent: it is the empty one, shown as the finished screen with no due offer.
        fireEvent.click(stepButton(/^Từ vựng/));
        expect(finishedScreen()).not.toBeNull();
        expect(screen.queryByRole("button", { name: /^Ôn ngay/ })).toBeNull();
      });

      it("makes every non-current step a native, focusable button, locked ones included", () => {
        render(<LearningWorkspace data={unpassedMemory({ dueCardIds: [] })} />);
        const buttons = thread().getAllByRole("button");
        expect(buttons.length).toBeGreaterThanOrEqual(2);
        for (const button of buttons) {
          expect(button.tagName).toBe("BUTTON");
          expect(button.getAttribute("type")).toBe("button");
          expect((button as HTMLButtonElement).disabled).toBe(false);
          expect(button.getAttribute("tabindex")).not.toBe("-1");
        }
        expect(buttons.some((button) => button.hasAttribute("data-step-locked"))).toBe(true);
        // Target size, the 44 px touch hit area, the single line and the focus ring are CSS: the topic-completion smoke measures them.
      });
    });

    describe("Xem lại on the completion screen points at the thread (LF6 AC4)", () => {
      const scrollIntoView = vi.fn();
      const highlight = () => document.querySelector("[data-thread-highlight]") as HTMLElement;
      const threadButtons = () =>
        within(screen.getByRole("list", { name: "Các bước của bài học" })).getAllByRole("button");
      const reduceMotion = () => {
        const original = window.matchMedia;
        window.matchMedia = ((query: string) => ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        })) as unknown as typeof window.matchMedia;
        return () => {
          window.matchMedia = original;
        };
      };

      beforeEach(() => {
        scrollIntoView.mockClear();
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
      });
      afterEach(() => {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      });

      it("scrolls the thread into view smoothly, focuses its first enabled button and shows then removes a ring", () => {
        render(<LearningWorkspace data={completedTopic()} />);
        expect(highlight().getAttribute("data-active")).toBe("false");

        fireEvent.click(within(panel()).getByRole("button", { name: "Xem lại" }));
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
        expect(document.activeElement).toBe(threadButtons()[0]);
        // The ring shows and lasts about a second in total; that it only fades (no movement) is measured in the smoke.
        expect(highlight().getAttribute("data-active")).toBe("true");
        // The completion screen stays where it was.
        expect(completionHeading()).not.toBeNull();
        act(() => {
          vi.advanceTimersByTime(700);
        });
        expect(highlight().getAttribute("data-active")).toBe("true");
        act(() => {
          vi.advanceTimersByTime(100);
        });
        expect(highlight().getAttribute("data-active")).toBe("false");
      });

      it("skips the smooth scroll and the ring under reduced motion but still moves focus", () => {
        const restore = reduceMotion();
        try {
          render(<LearningWorkspace data={completedTopic()} />);
          fireEvent.click(within(panel()).getByRole("button", { name: "Xem lại" }));
          expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
          expect(document.activeElement).toBe(threadButtons()[0]);
          expect(highlight().getAttribute("data-active")).toBe("false");
        } finally {
          restore();
        }
      });

      it("focuses the first stage the topic has when Từ vựng is not one of them", () => {
        render(<LearningWorkspace data={completedTopic({ flashcards: [], dueCardIds: [], unseenCardIds: [] })} />);
        fireEvent.click(within(panel()).getByRole("button", { name: "Xem lại" }));
        const buttons = threadButtons();
        expect(buttons.map((button) => button.textContent?.replace(/^\d/, ""))).toEqual([
          "Memory check (đã xong)",
          "Bài tập (đã xong)",
        ]);
        expect(document.activeElement).toBe(buttons[0]);
      });
    });

    describe("the end of a review queue (LF6 AC10)", () => {
      const inProgress = { isFlashcardCompleted: false, isExerciseCompleted: false, isTopicCompleted: false };
      const notCompleted = (overrides: Partial<LearningWorkspaceData> = {}) =>
        data({
          flashcards: [cardA],
          unseenCardIds: [],
          dueCardIds: [cardA.id],
          memoryCheck,
          isMemoryCheckPassed: false,
          exercises: [exercise("part5", {})],
          progress: inProgress,
          ...overrides,
        });
      const successToasts = () => mockedToast.success.mock.calls.map(([message]) => message);
      async function rate(name: string, result: unknown = { success: true }) {
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        mockedReview.mockResolvedValueOnce(result as never);
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name }));
        });
      }

      it("ends a due review on a topic that is not completed with its own toast and stays on the finished screen", async () => {
        render(<LearningWorkspace data={notCompleted()} />);
        fireEvent.click(screen.getByRole("button", { name: "Ôn ngay 1 thẻ" }));
        await rate("Ổn");

        expect(successToasts()).toEqual(["Đã ôn xong thẻ đến hạn!"]);
        expect(finishedScreen()).not.toBeNull();
        expect(screen.queryByText("Câu nhớ")).toBeNull();
        expect(completionHeading()).toBeNull();
      });

      it("ends a full review on a topic that is not completed with its own toast and stays on the finished screen", async () => {
        render(<LearningWorkspace data={notCompleted({ isMemoryCheckPassed: true, answers: memoryAnswers })} />);
        fireEvent.click(screen.getByRole("button", { name: "Ôn lại từ vựng" }));
        await rate("Ổn");

        expect(successToasts()).toEqual(["Đã ôn lại xong từ vựng!"]);
        expect(finishedScreen()).not.toBeNull();
        // Neither memory check nor exercise was opened, although both are available.
        expect(screen.queryByText("Câu một")).toBeNull();
        expect(screen.queryByRole("heading", { name: "Xem lại Memory check" })).toBeNull();
      });

      it("returns a due review on a completed topic to the settled completion screen", async () => {
        render(<LearningWorkspace data={completedTopic({ dueCardIds: [cardA.id] })} />);
        fireEvent.click(within(panel()).getByRole("button", { name: "Có 1 thẻ đến hạn, Ôn ngay" }));
        expect(completionHeading()).toBeNull();
        await rate("Ổn");

        expect(successToasts()).toEqual(["Đã ôn xong thẻ đến hạn!"]);
        expect(completionHeading()).not.toBeNull();
        expect(panel().getAttribute("data-motion")).toBe("settled");
      });

      it("returns a full review on a completed topic to the settled completion screen, even after a Lại requeue", async () => {
        render(<LearningWorkspace data={completedTopic()} />);
        fireEvent.click(within(screen.getByRole("list", { name: "Các bước của bài học" })).getByRole("button", { name: /^Từ vựng/ }));
        fireEvent.click(screen.getByRole("button", { name: "Ôn lại từ vựng" }));
        await rate("Lại");
        // The requeue keeps the review kind: the card comes back and nothing ends yet.
        expect(successToasts()).toEqual([]);
        await rate("Ổn");
        await rate("Ổn");

        expect(successToasts()).toEqual(["Đã ôn lại xong từ vựng!"]);
        expect(completionHeading()).not.toBeNull();
        expect(panel().getAttribute("data-motion")).toBe("settled");
      });

      it("keeps a requeued due review a due review until its last card leaves", async () => {
        render(<LearningWorkspace data={notCompleted({ flashcards: [cardA, cardB], dueCardIds: [cardA.id, cardB.id] })} />);
        fireEvent.click(screen.getByRole("button", { name: "Ôn ngay 2 thẻ" }));
        await rate("Lại");
        await rate("Ổn");
        expect(successToasts()).toEqual([]);
        await rate("Ổn");

        expect(successToasts()).toEqual(["Đã ôn xong thẻ đến hạn!"]);
        expect(finishedScreen()).not.toBeNull();
      });

      it("runs the LF5 completion entry once, with neither review nor first-learning toast, when a review rating completes the topic", async () => {
        render(<LearningWorkspace data={notCompleted()} />);
        fireEvent.click(screen.getByRole("button", { name: "Ôn ngay 1 thẻ" }));
        await rate("Ổn", { success: true, topicProgress: { ...doneProgress } });

        expect(successToasts()).toEqual([]);
        expect(completionHeading()).not.toBeNull();
        expect(panel().getAttribute("data-motion")).toBe("sequence");
      });

      it("reads a completion confirmed by the last result of a review started on a topic that was not completed, and lands on the settled screen", async () => {
        render(<LearningWorkspace data={notCompleted()} />);
        fireEvent.click(screen.getByRole("button", { name: "Ôn ngay 1 thẻ" }));
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        let settle: (value: unknown) => void = () => {};
        mockedReview.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)) as never);
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
        });
        // The rating started on a topic that was not completed; the stored result says it is, without `newlyCompleted`.
        await act(async () => {
          settle({ success: true, topicProgress: { ...doneProgress, newlyCompleted: false } });
        });

        expect(successToasts()).toEqual(["Đã ôn xong thẻ đến hạn!"]);
        expect(completionHeading()).not.toBeNull();
        expect(panel().getAttribute("data-motion")).toBe("settled");
      });

      it("keeps the first-learning toasts and stage moves for the queue built on page entry", async () => {
        render(
          <LearningWorkspace
            data={data({
              flashcards: [cardA],
              memoryCheck,
              isMemoryCheckPassed: false,
              exercises: [exercise("part5", {})],
              progress: inProgress,
            })}
          />,
        );
        await rate("Ổn");

        expect(successToasts()).toEqual(["Đã nạp xong từ vựng! Chuyển sang memory check."]);
        expect(screen.getByText("Câu nhớ")).not.toBeNull();
      });
    });

    describe("a topic completed in this session (AC4, AC8, G3)", () => {
      const inProgress = { isFlashcardCompleted: false, isExerciseCompleted: false, isTopicCompleted: false };
      const lastCard = () =>
        data({
          flashcards: [cardA],
          syllabus: chapterEndSyllabus(true),
          memoryCheck,
          isMemoryCheckPassed: true,
          exercises: [exercise("part5", {})],
          answers: { ...memoryAnswers, ...exerciseAnswers },
          progress: inProgress,
        });
      async function completeWithLastCard() {
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        mockedReview.mockResolvedValueOnce({ success: true, topicProgress: { ...doneProgress } });
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
        });
      }

      it("replaces the finished flashcards screen with the completion screen, plays the sequence and uses the live sidebar values", async () => {
        render(<LearningWorkspace data={lastCard()} />);
        await completeWithLastCard();

        expect(finishedScreen()).toBeNull();
        expect(completionHeading()).not.toBeNull();
        expect(panel().getAttribute("data-motion")).toBe("sequence");
        // G3: the current topic counts as completed at once, the same as the sidebar.
        const course = within(panel()).getByRole("progressbar", { name: "Tiến độ khóa học" });
        expect(course.getAttribute("aria-valuenow")).toBe("2");
        const chapter = within(panel()).getByRole("progressbar", { name: "Chương 1 · Chương một" });
        expect(chapter.getAttribute("aria-valuenow")).toBe("2");
        expect(within(panel()).getByText("Tiếp theo: Chương 2 · Chương hai — Chủ đề 1 · Bài ba")).not.toBeNull();
        // Focus goes to the confirmation because the learner arrived by an action.
        expect(document.activeElement).toBe(completionHeading());
        expect(mockedToast.success).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Mở danh sách chương và bài học" }));
        expect(screen.getByRole("link", { name: /^Bài một\s*\(Đã hoàn thành\)$/ })).not.toBeNull();
      });

      it("tints only the gained segment during the sequence and drops it once settled, with equal-height tracks", async () => {
        render(<LearningWorkspace data={lastCard()} />);
        await completeWithLastCard();

        const course = within(panel()).getByRole("progressbar", { name: "Tiến độ khóa học" });
        const chapter = within(panel()).getByRole("progressbar", { name: "Chương 1 · Chương một" });
        expect(panel().querySelectorAll("[data-completion-gain]")).toHaveLength(2);
        expect(course.querySelector("[data-completion-gain]")).not.toBeNull();
        expect(chapter.querySelector("[data-completion-gain]")).not.toBeNull();
        // Both tracks share one height; the labels and scales stay separate.
        expect(course.className).toContain("h-2.5");
        expect(chapter.className).toContain("h-2.5");

        fireEvent.click(screen.getByRole("button", { name: /^Memory check/ }));
        fireEvent.click(screen.getByRole("button", { name: "Xem kết quả chủ đề" }));
        expect(panel().getAttribute("data-motion")).toBe("settled");
        expect(panel().querySelectorAll("[data-completion-gain]")).toHaveLength(0);
      });

      it("shows the settled screen on every later entry in the same session", async () => {
        render(<LearningWorkspace data={lastCard()} />);
        await completeWithLastCard();
        expect(panel().getAttribute("data-motion")).toBe("sequence");

        fireEvent.click(screen.getByRole("button", { name: /^Memory check/ }));
        expect(screen.getByRole("heading", { name: "Xem lại Memory check" })).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Xem kết quả chủ đề" }));
        expect(panel().getAttribute("data-motion")).toBe("settled");
      });

      it("shows the final state at once under reduced motion", async () => {
        const original = window.matchMedia;
        window.matchMedia = ((query: string) => ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        })) as unknown as typeof window.matchMedia;
        try {
          render(<LearningWorkspace data={lastCard()} />);
          await completeWithLastCard();
          expect(completionHeading()).not.toBeNull();
          expect(panel().getAttribute("data-motion")).toBe("settled");
          const course = within(panel()).getByRole("progressbar", { name: "Tiến độ khóa học" });
          expect(course.getAttribute("aria-valuenow")).toBe("2");
          expect(within(panel()).getByText("Tiếp theo: Chương 2 · Chương hai — Chủ đề 1 · Bài ba")).not.toBeNull();
        } finally {
          window.matchMedia = original;
        }
      });

      it("keeps the finished flashcards screen and the old toasts when the last rating does not complete the topic", async () => {
        render(<LearningWorkspace data={data({ flashcards: [cardA], progress: inProgress })} />);
        fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
        mockedReview.mockResolvedValueOnce({
          success: true,
          topicProgress: { ...doneProgress, isTopicCompleted: false, newlyCompleted: false },
        });
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
        });
        expect(finishedScreen()).not.toBeNull();
        expect(completionHeading()).toBeNull();
        expect(mockedToast.success).toHaveBeenCalledWith("Đã nạp xong từ vựng!");
      });
    });
  });
});
