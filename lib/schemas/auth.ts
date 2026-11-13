import { z } from "zod";
import { GENDER_VALUES } from "./gender";

// --- BƯỚC 1: Tài khoản. Mật khẩu được đặt sau khi xác minh email (A1, setPasswordSchema). ---
const step1Schema = z.object({
  username: z.string().min(3, "Tên tài khoản phải từ 3 ký tự trở lên"),
  email: z.email("Email này không đúng định dạng"),
});

// --- BƯỚC 2: Các trường thông tin cá nhân ---
const step2Schema = z.object({
  full_name: z.string().min(2, "Vui lòng nhập họ và tên"),
  phone: z.string().regex(/^[0-9]+$/, "Số điện thoại chỉ được chứa số").min(10, "Số điện thoại không hợp lệ").max(11, "Số điện thoại quá dài"),
  dob: z.date({
    message: "Vui lòng chọn ngày sinh hợp lệ",
  }),
  gender: z.enum(GENDER_VALUES, {
    message: "Vui lòng chọn giới tính",
  }),
});

// --- GOM LẠI THÀNH 1 SCHEMA TỔNG CHO TOÀN BỘ FORM ---
export const registerSchema = z.intersection(step1Schema, step2Schema);

// --- ẢNH ĐẠI DIỆN KHI ĐĂNG KÝ ---
// Server Action của Next.js chặn request trên 1 MB (bodySizeLimit mặc định) trước khi action chạy, nên trình duyệt thu
// ảnh về 512×512 rồi mới gửi (lib/auth/avatar-image.ts). Giới hạn 900 KB chừa chỗ cho các trường khác trong FormData;
// server vẫn kiểm lại vì client có thể bị bỏ qua. Loại khai báo không chứng minh nội dung tệp thật.
export const AVATAR_MAX_DIMENSION = 512;
export const AVATAR_MAX_BYTES = 900 * 1024;
export const AVATAR_FILE_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const AVATAR_TYPES: readonly string[] = Object.keys(AVATAR_FILE_EXTENSIONS);
export const AVATAR_INVALID_MESSAGE = "Ảnh đại diện chưa hợp lệ. Hãy chọn ảnh JPG, PNG hoặc WebP khác.";

export const avatarFileSchema = z
  .instanceof(File, { message: AVATAR_INVALID_MESSAGE })
  .refine((file) => file.size > 0 && file.size <= AVATAR_MAX_BYTES, AVATAR_INVALID_MESSAGE)
  .refine((file) => AVATAR_TYPES.includes(file.type), AVATAR_INVALID_MESSAGE)
  .transform((file) => ({ file, type: file.type as keyof typeof AVATAR_FILE_EXTENSIONS }));

// --- ĐẶT MẬT KHẨU SAU KHI XÁC MINH EMAIL (A1) — giữ luật mật khẩu cũ của form đăng ký ---
export const setPasswordSchema = z.object({
  password: z.string().min(6, "Mật khẩu ít nhất 6 ký tự cho an toàn"),
  confirmPassword: z.string().min(1, "Vui lòng xác nhận lại mật khẩu"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

export const resendSignupConfirmationSchema = z.object({
  email: z.email("Email này không đúng định dạng"),
});

export const passwordRecoveryRequestSchema = resendSignupConfirmationSchema;

// Các link email dùng chung /auth/confirm; recovery có bằng chứng session riêng để bảo vệ G8.
export const emailConfirmationParamsSchema = z.object({
  token_hash: z.string().trim().min(1),
  type: z.enum(["email", "signup", "recovery"]),
});

// Callback OAuth chỉ cần `code`; mọi tham số khác trên URL (kể cả `next`) không được đọc.
export const oauthCallbackCodeSchema = z.string().trim().min(1);

// U3 G1: trang đích sau đăng nhập chỉ là pathname nội bộ thuộc ba vùng proxy tự chặn. Mỗi đoạn path chỉ gồm
// ký tự an toàn hoặc %XX; cấm `.`/`..` và mọi %XX giải mã thành `/`, `\`, `.` hay ký tự điều khiển, vì trình
// duyệt hoặc server có thể giải mã chúng thành đường dẫn khác (open redirect, vượt thư mục).
const RETURN_PATH_PATTERN = /^\/(?:teacher|profile|admin)(?:\/[A-Za-z0-9._~%-]+)*$/;
const RETURN_PATH_FORBIDDEN_ENCODING = /%(?:2f|5c|2e|[01][0-9a-f]|7f)/i;

export const returnPathSchema = z
  .string()
  .max(512)
  .regex(RETURN_PATH_PATTERN)
  .refine((path) => !RETURN_PATH_FORBIDDEN_ENCODING.test(path))
  .refine((path) => path.split("/").every((segment) => segment !== "." && segment !== ".."));

export const lastSignInMethodSchema = z.enum(["email", "google"]);
export type LastSignInMethod = z.infer<typeof lastSignInMethodSchema>;

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

export const adminUserIdSchema = z.string().uuid("ID tài khoản không hợp lệ.").toLowerCase();
export const adminUserUpdateSchema = adminUserSchema.omit({ email: true });
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type PasswordRecoveryRequestInput = z.infer<typeof passwordRecoveryRequestSchema>;
