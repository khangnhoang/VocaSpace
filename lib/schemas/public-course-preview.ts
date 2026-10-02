import { z } from "zod";
import { publicCourseSlugSchema } from "@/lib/schemas/public-course";

const previewFlashcardFrontSchema = z.strictObject({
  word: z.string(),
  pos: z.string().nullable().optional(),
  phonetic: z.string().nullable().optional(),
});

const previewFlashcardBackSchema = z.strictObject({
  translation: z.string(),
  example: z.string().nullable().optional(),
  exampleTranslation: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  hint: z.string().nullable().optional(),
});

const previewOptionSchema = z.strictObject({
  id: z.uuid(),
  content: z.string(),
  label: z.string().nullable(),
  order_index: z.number().int().nonnegative(),
});

const previewQuestionSchema = z.strictObject({
  id: z.uuid(),
  content: z.string(),
  order_index: z.number().int().nonnegative(),
  options: z.array(previewOptionSchema),
});

const previewQuestionGroupSchema = z.strictObject({
  id: z.uuid(),
  passage_text: z.string().nullable(),
  audio_url: z.string().nullable(),
  image_url: z.string().nullable(),
  order_index: z.number().int().nonnegative(),
  questions: z.array(previewQuestionSchema),
});

const previewExerciseFields = {
  id: z.uuid(),
  title: z.string(),
  order_index: z.number().int().nonnegative(),
  questions: z.array(previewQuestionSchema),
  groups: z.array(previewQuestionGroupSchema),
};

// D3: a memory check is a separate activity stage and never carries a TOEIC part.
const previewExerciseSchema = z.discriminatedUnion("activity_stage", [
  z.strictObject({
    ...previewExerciseFields,
    activity_stage: z.literal("exercise"),
    part_type: z.string(),
  }),
  z.strictObject({
    ...previewExerciseFields,
    activity_stage: z.literal("memory_check"),
    part_type: z.null(),
  }),
]);

const previewFlashcardSchema = z.strictObject({
  id: z.uuid(),
  front_content: previewFlashcardFrontSchema,
  back_content: previewFlashcardBackSchema,
  audio_url: z.string().nullable(),
  image_url: z.string().nullable(),
  order_index: z.number().int().nonnegative(),
});

export const publicCoursePreviewParamsSchema = z.strictObject({
  courseSlug: publicCourseSlugSchema,
  topicSlug: publicCourseSlugSchema,
});

export const publicCoursePreviewAnswerInputSchema = z.strictObject({
  courseSlug: publicCourseSlugSchema,
  topicSlug: publicCourseSlugSchema,
  questionId: z.uuid(),
  selectedOptionId: z.uuid(),
});

export const publicCoursePreviewAnswerRpcSchema = z.strictObject({
  is_correct: z.boolean(),
  explanation: z.string().nullable(),
});

export const publicCoursePreviewRpcSchema = z.strictObject({
  course: z.strictObject({
    slug: publicCourseSlugSchema,
    title: z.string(),
  }),
  topic: z.strictObject({
    id: z.uuid(),
    slug: publicCourseSlugSchema,
    title: z.string(),
    description: z.string().nullable(),
  }),
  flashcards: z.array(previewFlashcardSchema),
  exercises: z.array(previewExerciseSchema),
});

export type PublicCoursePreview = z.output<typeof publicCoursePreviewRpcSchema>;
export type PublicCoursePreviewAnswerInput = z.output<
  typeof publicCoursePreviewAnswerInputSchema
>;
