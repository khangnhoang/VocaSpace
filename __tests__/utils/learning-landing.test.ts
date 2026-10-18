import { describe, expect, it } from "vitest";
import { resolveLandingStage, resolveNextUnfinishedStage, type LandingStageInput } from "@/lib/learning-landing";

// Test plan:
// - Mục tiêu: chọn bước mở trang (LF5) và phần chưa xong sau một giai đoạn (LF9); cổng thẻ mới được ưu tiên, không dựng kết quả giả.
// - Loại test: unit.
// - Đối tượng: lib/learning-landing.ts.
// - Case thành công: chủ đề chưa hoàn thành mở Từ vựng (thẻ chưa xem hoặc bước chưa xong), rồi Memory check chưa qua, rồi Bài tập còn câu;
//   chủ đề đã hoàn thành mở màn hình hoàn thành, trừ khi có thẻ chưa xem.
// - Case biên: không có thẻ, không có memory check, không có bài tập; chủ đề hoàn thành nhưng `isFlashcardCompleted` sai (Lại sau đó) vẫn mở màn hình hoàn thành.
// - Case thất bại / dự phòng: mọi bước đều xong mà chủ đề chưa hoàn thành dùng luật cũ (thẻ, memory, bài tập).
// - Invariant cần giữ: luật chỉ đọc dữ liệu server; không bao giờ trả "complete" cho chủ đề chưa hoàn thành.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/utils/learning-landing.test.ts`.

const full: LandingStageInput = {
  flashcardCount: 3,
  hasUnseenCard: false,
  isFlashcardCompleted: true,
  hasMemoryCheck: true,
  isMemoryCheckPassed: true,
  exerciseCount: 1,
  remainingExerciseQuestions: 0,
  isTopicCompleted: false,
};
const landing = (overrides: Partial<LandingStageInput>) =>
  resolveLandingStage({ ...full, ...overrides });

describe("resolveLandingStage for a topic that is not completed", () => {
  it("opens Từ vựng when a card is unseen", () => {
    expect(landing({ hasUnseenCard: true, isFlashcardCompleted: false })).toBe("flashcard");
    expect(landing({ hasUnseenCard: true, isFlashcardCompleted: true })).toBe("flashcard");
  });

  it("opens Từ vựng when every card is seen but the step is not done", () => {
    expect(landing({ isFlashcardCompleted: false })).toBe("flashcard");
  });

  it("opens Memory check when cards are done and it is not passed", () => {
    expect(landing({ isMemoryCheckPassed: false, remainingExerciseQuestions: 4 })).toBe("memory");
  });

  it("opens Bài tập when cards and memory check are done and a question remains", () => {
    expect(landing({ remainingExerciseQuestions: 2 })).toBe("exercise");
  });

  it("skips stages the topic does not have", () => {
    expect(
      landing({ flashcardCount: 0, isFlashcardCompleted: false, remainingExerciseQuestions: 2 }),
    ).toBe("exercise");
    expect(
      landing({ flashcardCount: 0, isFlashcardCompleted: false, isMemoryCheckPassed: false }),
    ).toBe("memory");
    expect(
      landing({
        hasMemoryCheck: false,
        isMemoryCheckPassed: false,
        remainingExerciseQuestions: 2,
      }),
    ).toBe("exercise");
    expect(
      landing({
        flashcardCount: 0,
        isFlashcardCompleted: false,
        hasMemoryCheck: false,
        isMemoryCheckPassed: false,
        exerciseCount: 1,
        remainingExerciseQuestions: 3,
      }),
    ).toBe("exercise");
  });

  it("uses the previous initial-stage rule when every stage is already done", () => {
    expect(landing({})).toBe("flashcard");
    expect(landing({ flashcardCount: 0, isFlashcardCompleted: false, exerciseCount: 0 })).toBe(
      "memory",
    );
    expect(
      landing({ flashcardCount: 0, isFlashcardCompleted: false, hasMemoryCheck: false }),
    ).toBe("exercise");
    expect(
      landing({
        flashcardCount: 0,
        isFlashcardCompleted: false,
        hasMemoryCheck: false,
        exerciseCount: 0,
      }),
    ).toBe("flashcard");
  });
});

describe("resolveLandingStage for a completed topic", () => {
  const completed = { isTopicCompleted: true };

  it("opens the completion screen", () => {
    expect(landing(completed)).toBe("complete");
  });

  it("opens the completion screen even with unfinished stages (sticky completion)", () => {
    expect(
      landing({ ...completed, isMemoryCheckPassed: false, remainingExerciseQuestions: 3 }),
    ).toBe("complete");
  });

  it("opens the completion screen when the flashcard step is not done after a later Lại", () => {
    expect(landing({ ...completed, isFlashcardCompleted: false })).toBe("complete");
  });

  it("opens Từ vựng when a card added after completion is unseen", () => {
    expect(landing({ ...completed, hasUnseenCard: true })).toBe("flashcard");
  });

  it("opens the completion screen for a topic without cards", () => {
    expect(
      landing({ ...completed, flashcardCount: 0, isFlashcardCompleted: false, hasUnseenCard: false }),
    ).toBe("complete");
  });

  it("opens Từ vựng when a new card was seen but still has not cleared the memory gate", () => {
    expect(landing({ ...completed, hasUnseenCard: false, hasPendingMemoryCards: true })).toBe("flashcard");
  });
});

describe("LF9 next unfinished content after a stage ends", () => {
  it("prioritizes unfinished memory check and exercises over historical topic completion", () => {
    const state = { hasMemoryCheck: true, isMemoryCheckPassed: false, remainingExerciseQuestions: 2, isTopicCompleted: true };
    expect(resolveNextUnfinishedStage(state)).toBe("memory");
    expect(resolveNextUnfinishedStage({ ...state, isMemoryCheckPassed: true })).toBe("exercise");
    expect(resolveNextUnfinishedStage({ ...state, hasMemoryCheck: false })).toBe("exercise");
    expect(resolveNextUnfinishedStage({ ...state, isMemoryCheckPassed: true, remainingExerciseQuestions: 0 })).toBe("complete");
  });

  it("does not fabricate a result when all local questions are done but the server has not confirmed completion", () => {
    expect(resolveNextUnfinishedStage({ hasMemoryCheck: false, isMemoryCheckPassed: true, remainingExerciseQuestions: 0, isTopicCompleted: false })).toBeNull();
  });
});
