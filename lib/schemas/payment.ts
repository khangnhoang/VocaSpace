// lib/schemas/payment.ts

import { z } from "zod";
import type { PaymentStatus } from "@/types/database";

import { discountCouponSchema } from "@/lib/schemas/discount";

export const checkoutInputSchema = z.object({
  courseId: z.string().min(1, { message: "ID khóa học không được để trống" }),
  couponCode: discountCouponSchema.shape.code.optional(),
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