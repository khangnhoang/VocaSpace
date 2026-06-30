// File: lib/schemas/chapter.ts
import { z } from "zod";

const chapterTitleSchema = z
  .string()
  .trim()
  .min(3, "Tên chương phải có ít nhất 3 ký tự")
  .max(100, "Tên chương không được quá 100 ký tự");

export const chapterFormSchema = z.object({
  title: chapterTitleSchema,
});

export const chapterCreateSchema = z.object({
  courseId: z.uuid("ID khóa học không hợp lệ."),
  title: chapterTitleSchema,
});

export const chapterUpdateSchema = z.object({
  chapterId: z.uuid("ID chương không hợp lệ."),
  title: chapterTitleSchema,
});

export const chapterDeleteSchema = z.object({
  chapterId: z.uuid("ID chương không hợp lệ."),
});

export const chapterMoveDirectionSchema = z.enum(["up", "down"], {
  message: "Hướng di chuyển chương không hợp lệ.",
});

export const chapterMoveSchema = z.object({
  chapterId: z.uuid("ID chương không hợp lệ."),
  direction: chapterMoveDirectionSchema,
});

export const chapterSchema = z.object({
  title: z
    .string()
    .min(3, "Tên chương phải có ít nhất 3 ký tự")
    .max(100, "Tên chương không được quá 100 ký tự"),
  order_index: z
    .number({
      message: "Vui lòng nhập số thứ tự hợp lệ",
    })
    .min(1, "Thứ tự phải lớn hơn 0")
    .int("Vui lòng nhập số nguyên"),
});

export type ChapterCreateInput = z.infer<typeof chapterCreateSchema>;
export type ChapterUpdateInput = z.infer<typeof chapterUpdateSchema>;
export type ChapterDeleteInput = z.infer<typeof chapterDeleteSchema>;
export type ChapterMoveInput = z.infer<typeof chapterMoveSchema>;
export type ChapterFormValues = z.infer<typeof chapterSchema>;
export type ChapterMetadataFormValues = z.infer<typeof chapterFormSchema>;
