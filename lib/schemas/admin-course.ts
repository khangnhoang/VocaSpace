import { z } from "zod";

export const adminCourseFilterSchema = z.object({
  status: z.enum(["all", "draft", "pending", "published"]).optional(),
  q: z
    .string()
    .trim()
    .max(100, "Từ khóa tìm kiếm không được vượt quá 100 ký tự.")
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sort: z
    .enum(["newest", "oldest", "submitted_desc", "submitted_asc"])
    .optional(),
});

export const acceptCourseSchema = z.object({
  courseId: z.string().uuid("ID khóa học không hợp lệ."),
});

export const rejectCourseSchema = z.object({
  courseId: z.string().uuid("ID khóa học không hợp lệ."),
  rejectMessage: z
    .string()
    .trim()
    .min(10, "Lý do từ chối phải có ít nhất 10 ký tự.")
    .max(1000, "Lý do từ chối không được vượt quá 1000 ký tự."),
});

export const submitCourseReviewSchema = z.object({
  courseId: z.string().uuid("ID khóa học không hợp lệ."),
});

export type RejectCourseInput = z.infer<typeof rejectCourseSchema>;
