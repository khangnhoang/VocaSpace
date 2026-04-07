import { z } from "zod";

// --- BƯỚC 1: Tách riêng để ép Zod phải chạy .refine() độc lập ---
const step1Schema = z.object({
  username: z.string().min(3, "Tên tài khoản phải từ 3 ký tự trở lên"),
  email: z.email("Email này không đúng định dạng"),
  password: z.string().min(6, "Mật khẩu ít nhất 6 ký tự cho an toàn"),
  confirmPassword: z.string().min(1, "Vui lòng xác nhận lại mật khẩu"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

// --- BƯỚC 2: Các trường thông tin cá nhân ---
const step2Schema = z.object({
  full_name: z.string().min(2, "Vui lòng nhập họ và tên"),
  phone: z.string().regex(/^[0-9]+$/, "Số điện thoại chỉ được chứa số").min(10, "Số điện thoại không hợp lệ").max(11, "Số điện thoại quá dài"),
  dob: z.date({
    message: "Vui lòng chọn ngày sinh hợp lệ",
  }),
  gender: z.enum(["nam", "nữ", "other"] as const, {
    message: "Vui lòng chọn giới tính",
  }),
});

// --- GOM LẠI THÀNH 1 SCHEMA TỔNG CHO TOÀN BỘ FORM ---
export const registerSchema = z.intersection(step1Schema, step2Schema);

// --- FORM LOGIN (Giữ nguyên) ---
export const loginSchema = z.object({
  email: z.email("Email không đúng định dạng"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export const adminUserSchema = z.object({
  email: z.email("Email không đúng định dạng"),
  username: z.string().min(3, "Username ít nhất 3 ký tự"),
  full_name: z.string().min(2, "Vui lòng nhập họ và tên"),
  phone: z.string()
  .regex(/^[0-9]+$/, "Số điện thoại chỉ được chứa số")
  .min(10, "SĐT không hợp lệ")
  .max(11, "SĐT không hợp lệ")
  .optional()
  .or(z.literal("")),
  role: z.enum(["admin", "teacher", "student"], {
  message: "Vui lòng chọn vai trò", // <-- Chỉ cần đổi required_error thành message ở đây
}),
});

export type AdminUserInput = z.infer<typeof adminUserSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;