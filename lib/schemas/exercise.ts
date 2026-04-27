import { z } from "zod";

// 1. Tầng dưới cùng: Option (Đáp án)
export const optionSchema = z.object({
  id: z.string().optional(), // Dùng để update/nhận diện FE
  content: z.string().min(1, "Vui lòng nhập nội dung đáp án"),
  is_correct: z.boolean(),
});

// 2. Tầng thứ 3: Question (Câu hỏi)
export const questionSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, "Vui lòng nhập nội dung câu hỏi"),
  explanation: z.string().optional(),
  // Ép buộc: Phải có 2-4 đáp án và ít nhất 1 đáp án đúng
  options: z.array(optionSchema).min(2, "Phải có ít nhất 2 đáp án")
    .refine((opts) => opts.some((opt) => opt.is_correct), {
      message: "Phải chọn ít nhất 1 đáp án đúng",
    }),
});

// 3. Tầng thứ 2: Question Group (Nhóm câu hỏi / Ngữ liệu)
export const questionGroupSchema = z.object({
  id: z.string().optional(),
  passage_text: z.string().optional(),
  audio_url: z.string().optional(),
  image_url: z.string().optional(),
  // Ép buộc: Mỗi ngữ liệu phải có ít nhất 1 câu hỏi đi kèm
  questions: z.array(questionSchema).min(1, "Phải có ít nhất 1 câu hỏi"),
});

// 4. Tầng cao nhất: Exercise (Bài tập)
export const exerciseSchema = z.object({
  title: z.string().min(4, "Tên bài tập phải dài hơn 3 ký tự"),
  part_type: z.string().min(1, "Vui lòng chọn Part (VD: part7)"),
  order_index: z.number(),
  groups: z.array(questionGroupSchema).min(1, "Bài tập phải có ít nhất 1 nhóm câu hỏi"),
});

export type ExerciseFormValues = z.infer<typeof exerciseSchema>;