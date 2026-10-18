import { z } from "zod";
import { ExerciseSchema, FlashcardSchema, QuestionSchema } from "@/lib/schemas/learn";
import { publicCourseSlugSchema } from "@/lib/schemas/public-course";

export const learningWorkspaceCourseSlugSchema = publicCourseSlugSchema;
export const learningWorkspaceTopicSlugSchema = publicCourseSlugSchema;

export const questionAnswerInputSchema = z.strictObject({
  questionId: z.uuid(),
  selectedOptionId: z.uuid(),
});

export const learningWorkspaceTopicSchema = z.strictObject({
  id: z.uuid(),
  slug: publicCourseSlugSchema,
  title: z.string().trim().min(1),
  orderIndex: z.number().int().nonnegative(),
  chapterId: z.uuid(),
});

// D4: the learner's own stored completion, so the sidebar can mark finished topics.
export const learningWorkspaceSyllabusTopicSchema =
  learningWorkspaceTopicSchema.extend({
    isCompleted: z.boolean(),
  });

export const learningWorkspaceChapterSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1),
  orderIndex: z.number().int().nonnegative(),
  topics: z.array(learningWorkspaceSyllabusTopicSchema).min(1),
});

export const learningWorkspaceProgressSchema = z.strictObject({
  isFlashcardCompleted: z.boolean(),
  isExerciseCompleted: z.boolean(),
  isTopicCompleted: z.boolean(),
});

// D4: server-derived topic progress returned after a learner write. Stage flags
// are the current snapshot; only `isTopicCompleted` is sticky.
export const topicProgressSchema = learningWorkspaceProgressSchema.extend({
  isMemoryCheckPassed: z.boolean(),
  newlyCompleted: z.boolean(),
});

export const topicProgressRpcResultSchema = z
  .strictObject({
    is_flashcard_completed: z.boolean(),
    is_memory_check_passed: z.boolean(),
    is_exercise_completed: z.boolean(),
    is_topic_completed: z.boolean(),
    newly_completed: z.boolean(),
  })
  .transform((row) => ({
    isFlashcardCompleted: row.is_flashcard_completed,
    isMemoryCheckPassed: row.is_memory_check_passed,
    isExerciseCompleted: row.is_exercise_completed,
    isTopicCompleted: row.is_topic_completed,
    newlyCompleted: row.newly_completed,
  }));

// LF2: kết quả thô của RPC `lf2_submit_question_answer`. Trạng thái thất bại không mang dữ liệu nào khác;
// `progress` được parse riêng bằng `topicProgressRpcResultSchema` để progress hỏng không làm mất đáp án đã lưu (D4 H4).
export const questionAnswerRpcFailureStatusSchema = z.enum([
  "auth_required",
  "unavailable",
  "not_enrolled",
  "option_unavailable",
  "memory_locked",
  "cards_locked",
  "save_failed",
]);

export const questionAnswerRpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    is_correct: z.boolean(),
    explanation: z.string().nullable(),
    is_memory_check: z.boolean(),
    progress: z.unknown(),
    memory_check_passed: z.boolean().nullable().catch(null),
  }),
  z.object({ status: questionAnswerRpcFailureStatusSchema }),
]);

// LF2: kết quả thô của RPC `lf2_submit_card_review`.
export const cardReviewRpcResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), progress: z.unknown() }),
  z.object({ status: z.literal("mutation_failed") }),
]);

// D3: optional per-topic memory check; no answer key before answering.
// LF5: `explanation` chỉ có mặt ở câu mà đáp án đã lưu đang đúng (loader quyết định); câu khác không có khóa này.
export const learningWorkspaceMemoryCheckSchema = z.strictObject({
  id: z.uuid(),
  questions: z.array(QuestionSchema).min(1),
});

export const learningWorkspaceDataSchema = z.strictObject({
  courseSlug: publicCourseSlugSchema,
  courseTitle: z.string().trim().min(1),
  syllabus: z.array(learningWorkspaceChapterSchema),
  currentTopic: learningWorkspaceTopicSchema,
  flashcards: z.array(FlashcardSchema),
  // LF3: tính từ dòng user_flashcards của chính học viên (xem lib/card-progress.ts): thẻ chưa có dòng nào và thẻ chưa Ổn/Dễ.
  unseenCardIds: z.array(z.uuid()),
  unratedCardIds: z.array(z.uuid()),
  // LF9: null là chưa vượt cổng lần đầu; chỉ server ghi nhận tập id đã đạt.
  memoryGateClearedCardIds: z.array(z.uuid()).nullable(),
  // LF4: thẻ đã xem nhưng đến hạn FSRS hoặc chưa Ổn/Dễ; chỉ dùng cho lời mời ôn lại ở màn hình kết thúc.
  dueCardIds: z.array(z.uuid()),
  exercises: z.array(ExerciseSchema),
  memoryCheck: learningWorkspaceMemoryCheckSchema.nullable(),
  isMemoryCheckPassed: z.boolean(),
  answers: z.record(z.uuid(), z.uuid()),
  progress: learningWorkspaceProgressSchema.nullable(),
});

const learningWorkspaceCourseIdentitySchema = z.strictObject({
  slug: publicCourseSlugSchema,
  title: z.string().trim().min(1),
});

export const learningWorkspaceResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("auth_required") }),
  z.strictObject({ status: z.literal("not_found") }),
  z.strictObject({
    status: z.literal("unenrolled"),
    course: learningWorkspaceCourseIdentitySchema,
  }),
  z.strictObject({
    status: z.literal("topic_unavailable"),
    course: learningWorkspaceCourseIdentitySchema,
  }),
  z.strictObject({
    status: z.literal("success"),
    data: learningWorkspaceDataSchema,
  }),
  z.strictObject({
    status: z.literal("error"),
    errorCode: z.enum(["QUERY_FAILED", "INVALID_DATA"]),
    error: z.string().min(1),
  }),
]);

export type LearningWorkspaceData = z.infer<
  typeof learningWorkspaceDataSchema
>;
export type LearningWorkspaceResult = z.infer<
  typeof learningWorkspaceResultSchema
>;
export type TopicProgress = z.infer<typeof topicProgressSchema>;
