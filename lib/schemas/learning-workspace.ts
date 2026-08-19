import { z } from "zod";
import { ExerciseSchema, FlashcardSchema } from "@/lib/schemas/learn";
import { publicCourseSlugSchema } from "@/lib/schemas/public-course";

export const learningWorkspaceCourseSlugSchema = publicCourseSlugSchema;
export const learningWorkspaceTopicSlugSchema = publicCourseSlugSchema;

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

export const learningWorkspaceDataSchema = z.strictObject({
  courseSlug: publicCourseSlugSchema,
  courseTitle: z.string().trim().min(1),
  syllabus: z.array(learningWorkspaceChapterSchema),
  currentTopic: learningWorkspaceTopicSchema,
  flashcards: z.array(FlashcardSchema),
  exercises: z.array(ExerciseSchema),
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
