// File: lib/schemas/chapter.ts
import { z } from "zod";

export const chapterSchema = z.object({
  title: z
    .string()
    .min(3, "Tên chương phải có ít nhất 3 ký tự")
    .max(100, "Tên chương không được quá 100 ký tự"),
  order_index: z
    .number({
      message: "Vui lòng nhập số thứ tự hợp lệ", // SỬA Ở DÒNG NÀY LÀ XONG!
    })
    .min(1, "Thứ tự phải lớn hơn 0")
    .int("Vui lòng nhập số nguyên"),
});

// Trích xuất Type ra để dùng cho Form
export type ChapterFormValues = z.infer<typeof chapterSchema>;