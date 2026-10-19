// lib/schemas/payment-history.ts
// FEAT6: hợp đồng đọc lịch sử thanh toán của chính học viên (Server Action `getPaymentHistory`).

import { z } from "zod";
import { paymentStatusSchema } from "@/lib/schemas/payment";

export const PAYMENT_HISTORY_PAGE_SIZE = 10;

export const paymentHistoryFilterSchema = z.enum([
  "all",
  "paid",
  "pending",
  "other",
]);

// Nhóm trạng thái của từng chip lọc. `all` không có danh sách vì không lọc theo trạng thái.
export const PAYMENT_HISTORY_FILTER_STATUSES = {
  paid: ["paid"],
  pending: ["creating", "pending"],
  other: ["cancelled", "expired", "failed"],
} as const satisfies Record<
  Exclude<z.infer<typeof paymentHistoryFilterSchema>, "all">,
  readonly z.infer<typeof paymentStatusSchema>[]
>;

// Chặn trên chỉ để phép tính offset (page - 1) * pageSize luôn nằm trong số nguyên an toàn; không phải giới hạn nghiệp vụ.
const MAX_PAGE = 100_000;

export const paymentHistoryInputSchema = z.strictObject({
  page: z.int().min(1).max(MAX_PAGE),
  filter: paymentHistoryFilterSchema,
});

// Chỉ những trường giao diện cần. Không có gateway_metadata, discount_id, user_id hay dữ liệu giao dịch của cổng (AC7).
export const paymentHistoryItemSchema = z.strictObject({
  paymentId: z.string().min(1),
  status: paymentStatusSchema,
  amountOriginal: z.number().min(0),
  amountDiscount: z.number().min(0),
  amountFinal: z.number().min(0),
  currency: z.string().min(1),
  orderCode: z.string().min(1),
  createdAt: z.string().min(1),
  expiresAt: z.string().nullable(),
  course: z
    .strictObject({ slug: z.string().min(1), title: z.string().min(1) })
    .nullable(),
});

export const paymentHistoryDataSchema = z.strictObject({
  items: z.array(paymentHistoryItemSchema).max(PAYMENT_HISTORY_PAGE_SIZE),
  total: z.int().min(0),
  page: z.int().min(1),
  pageSize: z.literal(PAYMENT_HISTORY_PAGE_SIZE),
});

export const paymentHistoryErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "INVALID_INPUT",
  "QUERY_FAILED",
  "INVALID_DATA",
]);

export const paymentHistoryResultSchema = z.discriminatedUnion("success", [
  z.strictObject({
    success: z.literal(true),
    data: paymentHistoryDataSchema,
  }),
  z.strictObject({
    success: z.literal(false),
    errorCode: paymentHistoryErrorCodeSchema,
    error: z.string().min(1),
  }),
]);

export type PaymentHistoryFilter = z.infer<typeof paymentHistoryFilterSchema>;
export type PaymentHistoryInput = z.input<typeof paymentHistoryInputSchema>;
export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;
export type PaymentHistoryData = z.infer<typeof paymentHistoryDataSchema>;
export type PaymentHistoryResult = z.infer<typeof paymentHistoryResultSchema>;
