// lib/schemas/profile.ts
import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
  username: z.string().min(3, "Username phải từ 3 ký tự trở lên").optional(),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  // Không validate trường phone vì chỉ dùng để hiển thị (Read-only)
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, "Mật khẩu quá ngắn"),
    newPassword: z.string().min(6, "Mật khẩu mới phải từ 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

// Xuất type để dùng cho form
export type ProfileFormValues = z.infer<typeof profileSchema>;
export type PasswordFormValues = z.infer<typeof passwordSchema>;
