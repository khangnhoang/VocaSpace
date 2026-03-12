import { z } from "zod";

export const registerSchema = z
  .object({
    username: z.string().min(3, "Tên tài khoản phải từ 3 ký tự trở lên"),
    full_name: z.string().min(1, "Vui lòng nhập họ và tên"), // Nên có để hiển thị trên profile
    email: z.email("Email này không đúng định dạng rồi Ú ơi"),
    password: z.string().min(6, "Mật khẩu ít nhất 6 ký tự cho an toàn"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận lại mật khẩu"),
    phone: z.string().regex(/^[0-9]+$/, "Số điện thoại chỉ được chứa số"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp rồi Ú ơi",
    path: ["confirmPassword"], // Lỗi sẽ hiện ở ô confirmPassword
  });

// Định nghĩa quy tắc cho form Đăng nhập
export const loginSchema = z.object({
  // Ú dùng z.email() theo lời con IDE xúi để triệt tiêu cái warning màu vàng nhé
  email: z.email("Email không đúng định dạng rồi Ú ơi!"),
  // (Lưu ý: Nếu z.string().email() vẫn bị gạch vàng, Ú đổi thẳng thành: z.email("Email không đúng định dạng") theo đúng cú pháp bản mới của nó)

  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  // Lúc login thì chỉ cần check user có nhập hay không thôi (min: 1),
  // không cần check độ dài min 6 như lúc đăng ký để tránh báo lỗi làm rối User.
});

// Xuất type ra để ông FE dùng làm Type cho cái Form
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
