// lib/schemas/exercise.ts
import { z } from "zod";

// ============================================================================
// 1. CÁC ZOD SCHEMAS CHỐT CHẶN DỮ LIỆU ĐẦU VÀO
// ============================================================================

// Tầng 4: Option (Đáp án)
export const optionSchema = z.object({
  id: z.string().optional(), 
  content: z.string().min(1, "Vui lòng nhập nội dung đáp án"),
  is_correct: z.boolean(),
});

// Tầng 3: Question (Câu hỏi)
export const questionSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, "Vui lòng nhập nội dung câu hỏi"),
  explanation: z.string().optional(),
  options: z.array(optionSchema).min(2, "Phải có ít nhất 2 đáp án")
    .refine((opts) => opts.some((opt) => opt.is_correct), {
      message: "Phải chọn nhất 1 đáp án đúng",
    }),
});

// Tầng 2: Question Group (Nhóm câu hỏi / Ngữ liệu)
export const questionGroupSchema = z.object({
  id: z.string().optional(),
  passage_text: z.string().optional(),
  audio_url: z.string().optional(),
  image_url: z.string().optional(),
  questions: z.array(questionSchema).min(1, "Phải có ít nhất 1 câu hỏi"),
});

// Tầng 1: Exercise (Bài tập tổng)
export const exerciseSchema = z.object({
  title: z.string().min(4, "Tên bài tập phải dài hơn 3 ký tự"),
  part_type: z.string().min(1, "Vui lòng chọn Part (VD: part7)"),
  order_index: z.number(),
  groups: z.array(questionGroupSchema).min(1, "Bài tập phải có ít nhất 1 nhóm câu hỏi"),
});

// Chế độ Nhập hàng loạt bài tập nâng cao
export const bulkExerciseSchema = z.object({
  title: z.string().min(4, "Tên bài tập phải dài hơn 3 ký tự"),
  part_type: z.string().min(1, "Vui lòng chọn Part (VD: part7)"),
  bulkText: z.string().min(1, "Vui lòng nhập nội dung văn bản theo cấu trúc Aiken"),
});

// ============================================================================
// 2. TRÍCH XUẤT TYPE ĐỘNG PHỤC VỤ TẦNG FORM (CLIENT-SIDE)
// ============================================================================
export type ExerciseFormValues = z.infer<typeof exerciseSchema>;
export type BulkExerciseFormValues = z.infer<typeof bulkExerciseSchema>;

// ============================================================================
// 3. TRÍCH XUẤT TYPE ĐỘNG 4 TẦNG CÓ ID TỪ DB (Thay thế hoàn toàn file type.ts cũ)
// Đảm bảo dữ liệu từ DB đổ lên bắt buộc phải có ID (string) để Render UI không bị lỗi
// ============================================================================
export type FullExerciseOption = z.infer<typeof optionSchema> & { id: string };

export type FullExerciseQuestion = Omit<z.infer<typeof questionSchema>, "options"> & {
  id: string;
  options: FullExerciseOption[];
};

export type FullExerciseGroup = Omit<z.infer<typeof questionGroupSchema>, "questions"> & {
  id: string;
  questions: FullExerciseQuestion[];
};

export type FullExercise = Omit<z.infer<typeof exerciseSchema>, "groups"> & {
  id: string;
  groups: FullExerciseGroup[];
};