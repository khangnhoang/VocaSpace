// lib/schemas/learn.ts
import { z } from "zod";

// 1. SCHEMAS
export const FlashcardSchema = z.object({
  id: z.string().uuid(),
  front_content: z.object({
    word: z.string(),
    pos: z.string().optional().nullable(),
    phonetic: z.string().optional().nullable(),
  }),
  back_content: z.object({
    translation: z.string(),
    example: z.string().optional().nullable(),
    exampleTranslation: z.string().optional().nullable(), // Khớp chính xác key DB
    explanation: z.string().optional().nullable(),        // Khớp chính xác key DB
    hint: z.string().optional().nullable(),               // Khớp chính xác key DB
  }),
  audio_url: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});

export const QuestionOptionSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  // Tuyệt đối không thêm is_correct ở đây
});

export const QuestionSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  explanation: z.string().nullable().optional(),
  order_index: z.number(),
  options: z.array(QuestionOptionSchema),
});

export const QuestionGroupSchema = z.object({
  id: z.uuid(),
  passage_text: z.string().nullable().optional(),
  audio_url: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  order_index: z.number(),
  questions: z.array(QuestionSchema),
});

export const ExerciseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  part_type: z.string(),
  order_index: z.number(),
  groups: z.array(QuestionGroupSchema),
});

// 2. TYPES INFERENCE (Sinh Type tự động từ Schema)
export type FlashcardDTO = z.infer<typeof FlashcardSchema>;
export type ExerciseDTO = z.infer<typeof ExerciseSchema>;
export type QuestionGroupDTO = z.infer<typeof QuestionGroupSchema>;
export type QuestionDTO = z.infer<typeof QuestionSchema>;
export type QuestionOptionDTO = z.infer<typeof QuestionOptionSchema>;

// Khai báo thêm các Schema & Type cho Syllabus nếu bạn muốn đưa vào Zod luôn
export const TopicSyllabusSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  status: z.string(),
  order_index: z.number(),
  chapterId: z.uuid().optional(),
});
export type TopicSyllabusDTO = z.infer<typeof TopicSyllabusSchema>;

export const ChapterSyllabusSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  order_index: z.number(),
  topics: z.array(TopicSyllabusSchema),
});
export type ChapterSyllabusDTO = z.infer<typeof ChapterSyllabusSchema>;