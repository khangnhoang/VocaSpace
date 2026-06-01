import { z } from "zod";

// Validate dữ liệu client gửi lên
export const checkoutInputSchema = z.object({
  courseId: z.string().min(1, { message: "ID khóa học không được để trống" }),
});

// Validate dữ liệu hệ thống trả về cho Client
export const checkoutResponseSchema = z.object({
  qrCodeUrl: z.url({ message: "Đường dẫn mã QR không hợp lệ" }),
  amount: z.number().positive({ message: "Số tiền thanh toán phải lớn hơn 0" }),
  orderId: z.string().min(1, { message: "Mã đơn hàng không hợp lệ" }),
  bankMessage: z
    .string()
    .min(1, { message: "Nội dung chuyển khoản không được để trống" }),
  accountNumber: z.string().min(1, { message: "Số tài khoản không hợp lệ" }),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
