export type LandingStage = "flashcard" | "memory" | "exercise" | "complete";

export interface LandingStageInput {
  /** Số thẻ active của chủ đề. */
  flashcardCount: number;
  /** Có thẻ chưa có dòng của học viên (thẻ chưa xem). */
  hasUnseenCard: boolean;
  hasPendingMemoryCards?: boolean;
  /** Server báo bước Từ vựng đã xong (lần chấm gần nhất của mọi thẻ là Ổn/Dễ). */
  isFlashcardCompleted: boolean;
  hasMemoryCheck: boolean;
  isMemoryCheckPassed: boolean;
  /** Số bài tập (exercise) của chủ đề; chỉ dùng cho luật dự phòng. */
  exerciseCount: number;
  /** Số câu hỏi bài tập chưa được tính là đúng. */
  remainingExerciseQuestions: number;
  /** Hoàn thành "dính" của chủ đề (D4). */
  isTopicCompleted: boolean;
}

/**
 * LF5: bước đầu tiên học viên còn phải làm khi mở (hoặc rời bước hiện tại của) một chủ đề, chỉ từ dữ liệu server đã có.
 * Chủ đề đã hoàn thành mở màn hình hoàn thành, trừ khi có thẻ mới chưa xem. Nếu mọi bước đều xong mà chủ đề chưa hoàn thành,
 * dùng luật cũ: thẻ, rồi memory check, rồi bài tập.
 */
export function resolveLandingStage(input: LandingStageInput): LandingStage {
  const hasCards = input.flashcardCount > 0;
  if (input.isTopicCompleted) {
    return hasCards && (input.hasUnseenCard || input.hasPendingMemoryCards) ? "flashcard" : "complete";
  }
  if (hasCards && (input.hasUnseenCard || input.hasPendingMemoryCards || !input.isFlashcardCompleted)) return "flashcard";
  if (input.hasMemoryCheck && !input.isMemoryCheckPassed) return "memory";
  if (input.remainingExerciseQuestions > 0) return "exercise";

  if (hasCards) return "flashcard";
  if (input.hasMemoryCheck && (!input.isMemoryCheckPassed || input.exerciseCount === 0)) return "memory";
  if (input.exerciseCount > 0) return "exercise";
  return "flashcard";
}

// Sau một giai đoạn vừa kết thúc, nội dung còn thiếu thắng cờ hoàn thành lịch sử.
// null giữ lỗi đồng bộ hiện rõ: không được suy ra kết quả chủ đề chỉ vì hàng đợi local đã rỗng.
export function resolveNextUnfinishedStage(
  input: Pick<LandingStageInput, "hasMemoryCheck" | "isMemoryCheckPassed" | "remainingExerciseQuestions" | "isTopicCompleted">,
): Exclude<LandingStage, "flashcard"> | null {
  if (input.hasMemoryCheck && !input.isMemoryCheckPassed) return "memory";
  if (input.remainingExerciseQuestions > 0) return "exercise";
  return input.isTopicCompleted ? "complete" : null;
}
