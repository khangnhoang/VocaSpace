// lib/schemas/exercise.ts
import { z } from "zod";

export const optionSchema = z.object({
  id: z.string().optional(),
  content: z.string(),
  is_correct: z.boolean(),
  label: z.string().optional().nullable(),
  order_index: z.number().optional().nullable(),
});

export const questionSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, "Vui lòng nhập nội dung câu hỏi"),
  explanation: z.string().optional(),
  options: z
    .array(optionSchema)
    .refine((opts) => opts.filter((opt) => opt.content.trim() !== "").length >= 2, {
      message: "Phải có ít nhất 2 đáp án",
    })
    .refine((opts) => opts.some((opt) => opt.content.trim() !== "" && opt.is_correct), {
      message: "Phải chọn nhất 1 đáp án đúng",
    }),
});

export const questionGroupSchema = z.object({
  id: z.string().optional(),
  passage_text: z.string().optional(),
  audio_url: z.string().optional(),
  image_url: z.string().optional(),
  questions: z.array(questionSchema).min(1, "Phải có ít nhất 1 câu hỏi"),
});

export const exerciseSchema = z
  .object({
    title: z.string().min(4, "Tên bài tập phải dài hơn 3 ký tự"),
    part_type: z.string().min(1, "Vui lòng chọn Part (VD: part7)"),
    order_index: z.number().optional(),
    groups: z.array(questionGroupSchema).optional(),
    questions: z.array(questionSchema).optional(),
  })
  .refine(
    (data) =>
      (data.groups && data.groups.length > 0) ||
      (data.questions && data.questions.length > 0),
    {
      message:
        "Bài tập phải có ít nhất 1 nhóm câu hỏi hoặc 1 câu hỏi lẻ hợp lệ!",
      path: ["groups"],
    },
  );

export const bulkExerciseSchema = z.object({
  title: z.string().min(4, "Tên bài tập phải dài hơn 3 ký tự"),
  part_type: z.string().min(1, "Vui lòng chọn Part (VD: part7)"),
  bulkText: z.string().min(1, "Vui lòng nhập nội dung văn bản theo cấu trúc Aiken"),
});

export type ExerciseFormValues = z.infer<typeof exerciseSchema>;
export type BulkExerciseFormValues = z.infer<typeof bulkExerciseSchema>;

export type FullExerciseOption = z.infer<typeof optionSchema> & { id: string };

export type FullExerciseQuestion = Omit<
  z.infer<typeof questionSchema>,
  "options"
> & {
  id: string;
  options: FullExerciseOption[];
};

export type FullExerciseGroup = Omit<
  z.infer<typeof questionGroupSchema>,
  "questions"
> & {
  id: string;
  questions: FullExerciseQuestion[];
};

export type FullExercise = Omit<z.infer<typeof exerciseSchema>, "groups"> & {
  id: string;
  groups: FullExerciseGroup[];
};
