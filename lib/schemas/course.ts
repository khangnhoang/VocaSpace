// File: lib/schemas/course.ts
import { z } from "zod";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const courseSchema = z.object({
  title: z.string().min(5, "Tên khóa học phải có ít nhất 5 ký tự"),
  slug: z.string()
    .min(3, "Đường dẫn ít nhất 3 ký tự")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Đường dẫn chỉ được chứa chữ cái thường, số và dấu gạch ngang (VD: toeic-800)"),
  description: z.string().min(10, "Mô tả khóa học ít nhất 10 ký tự"),
  price: z.string()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Giá tiền phải là một số hợp lệ lớn hơn hoặc bằng 0")
    .optional()
    .or(z.literal("")),
  thumbnail_file: z.any()
    .refine((file) => {
      if (!file) return true; // Cho phép bỏ trống ảnh
      return file.size <= MAX_FILE_SIZE;
    }, "Kích thước ảnh tối đa là 2MB.")
    .refine((file) => {
      if (!file) return true;
      return ACCEPTED_IMAGE_TYPES.includes(file.type);
    }, "Chỉ chấp nhận định dạng .jpg, .jpeg, .png và .webp")
    .optional()
    .nullable(),
});

export type CourseFormValues = z.infer<typeof courseSchema>;