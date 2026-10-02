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

export const learningWorkspaceChapterSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1),
  orderIndex: z.number().int().nonnegative(),
  topics: z.array(learningWorkspaceTopicSchema).min(1),
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

// D3: optional per-topic memory check; no answer key or explanation before answering.
export const learningWorkspaceMemoryCheckSchema = z.strictObject({
  id: z.uuid(),
  questions: z.array(QuestionSchema.omit({ explanation: true })).min(1),
});

export const learningWorkspaceDataSchema = z.strictObject({
  courseSlug: publicCourseSlugSchema,
  courseTitle: z.string().trim().min(1),
  syllabus: z.array(learningWorkspaceChapterSchema),
  currentTopic: learningWorkspaceTopicSchema,
  flashcards: z.array(FlashcardSchema),
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
