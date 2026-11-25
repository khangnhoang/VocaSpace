// lib/schemas/payment.ts

import { z } from "zod";
import type { PaymentStatus } from "@/types/database";

import { discountCouponSchema } from "@/lib/schemas/discount";
import { wrongType } from "./issue-keys";

// English localization U5 (H4): message là khóa trong namespace `validation`, `createCheckoutSession` dịch theo ngôn ngữ đang
// dùng; lỗi sai kiểu giữ văn bản mặc định của Zod qua `wrongType`.
export const checkoutInputSchema = z.object(
  {
    courseId: z.string({ error: wrongType("string") }).min(1, { message: "payment.courseIdRequired" }),
    couponCode: discountCouponSchema.shape.code.optional(),
  },
  { error: wrongType("object") },
);

// Validate dữ liệu hệ thống trả về cho Client
export const checkoutResponseSchema = z.object({
  qrCodeUrl: z.url({ message: "Đường dẫn mã QR không hợp lệ" }),
  amount: z.number().positive({ message: "Số tiền thanh toán phải lớn hơn 0" }),
  orderId: z.string().min(1, { message: "Mã đơn hàng không hợp lệ" }),
  bankMessage: z
    .string()
    .min(1, { message: "Nội dung chuyển khoản không được để trống" }),
  accountNumber: z.string().min(1, { message: "Số tài khoản không hợp lệ" }),
  expiresAt: z.iso.datetime({
  message: "Thời gian hết hạn thanh toán không hợp lệ",
}),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const paymentStatusSchema = z.enum([
  "creating",
  "pending",
  "paid",
  "failed",
  "expired",
  "cancelled",
] satisfies [PaymentStatus, ...PaymentStatus[]]);

export interface PaymentRealtimePayload {
  new: {
    status?: PaymentStatus;
  };
}

// FEAT6 AC11: kết quả mở lại mã QR của khoản `pending` còn hạn. Không bao giờ tạo thanh toán mới (G8).
export const resumeCheckoutInputSchema = z.strictObject({
  courseId: z.string().min(1),
});

export type ResumeCheckoutResult =
  | { status: "resume"; paymentId: string; data: CheckoutResponse }
  | { status: "none"; reason: "unauthenticated" | "unavailable" };
