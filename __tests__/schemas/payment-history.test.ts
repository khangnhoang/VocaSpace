import { describe, expect, it } from "vitest";
import {
  paymentHistoryDataSchema,
  paymentHistoryInputSchema,
  paymentHistoryItemSchema,
} from "@/lib/schemas/payment-history";

// Test plan:
// - Mục tiêu: hợp đồng vào/ra của lịch sử thanh toán FEAT6 (AC4, AC5, AC7, G2, G3).
// - Loại test: schema.
// - Đối tượng: paymentHistoryInputSchema, paymentHistoryItemSchema, paymentHistoryDataSchema.
// - Case thành công: trang số nguyên dương với bốn bộ lọc đóng; item đủ trường, course null hợp lệ, expiresAt null hợp lệ.
// - Case thất bại: trang 0, âm, thập phân, chuỗi, quá lớn; bộ lọc lạ; trường thừa từ client (user_id).
// - Bảo mật/phân quyền: output strict nên gateway_metadata, discount_id, user_id không lọt qua được schema.
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: client không chọn được trường đặc quyền và output không mang dữ liệu cổng thanh toán.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/schemas/payment-history.test.ts`.

const validItem = {
  paymentId: "payment-1",
  status: "paid",
  amountOriginal: 200000,
  amountDiscount: 20000,
  amountFinal: 180000,
  currency: "VND",
  orderCode: "100001",
  createdAt: "2026-10-01T08:00:00+00:00",
  expiresAt: null,
  course: { slug: "toeic", title: "TOEIC" },
  hiddenCourseTitle: null,
  isEnrolled: false,
};

describe("paymentHistoryInputSchema", () => {
  it.each(["all", "paid", "pending", "other"] as const)(
    "accepts a positive integer page with the %s filter",
    (filter) => {
      expect(
        paymentHistoryInputSchema.safeParse({ page: 3, filter }).success,
      ).toBe(true);
    },
  );

  it.each([0, -1, 1.5, "2", null, Number.NaN, 100_001])(
    "rejects page %s",
    (page) => {
      expect(
        paymentHistoryInputSchema.safeParse({ page, filter: "all" }).success,
      ).toBe(false);
    },
  );

  it("rejects an unknown filter and a client-supplied user_id", () => {
    expect(
      paymentHistoryInputSchema.safeParse({ page: 1, filter: "free" }).success,
    ).toBe(false);
    expect(
      paymentHistoryInputSchema.safeParse({
        page: 1,
        filter: "all",
        user_id: "someone-else",
      }).success,
    ).toBe(false);
  });
});

describe("paymentHistoryItemSchema", () => {
  it("accepts an item with a null course and a null expiry", () => {
    expect(
      paymentHistoryItemSchema.safeParse({ ...validItem, course: null }).success,
    ).toBe(true);
  });

  it("accepts the real title of a hidden course, and rejects an empty or missing one", () => {
    expect(
      paymentHistoryItemSchema.safeParse({
        ...validItem,
        course: null,
        hiddenCourseTitle: "Khóa đã ẩn",
      }).success,
    ).toBe(true);
    expect(
      paymentHistoryItemSchema.safeParse({ ...validItem, hiddenCourseTitle: "" }).success,
    ).toBe(false);
    const withoutHidden: Record<string, unknown> = { ...validItem };
    delete withoutHidden.hiddenCourseTitle;
    expect(paymentHistoryItemSchema.safeParse(withoutHidden).success).toBe(false);
  });

  it("requires isEnrolled to be a boolean or null (unknown)", () => {
    expect(paymentHistoryItemSchema.safeParse({ ...validItem, isEnrolled: true }).success).toBe(true);
    expect(paymentHistoryItemSchema.safeParse({ ...validItem, isEnrolled: null }).success).toBe(true);
    expect(paymentHistoryItemSchema.safeParse({ ...validItem, isEnrolled: "yes" }).success).toBe(false);
    const withoutFlag: Record<string, unknown> = { ...validItem };
    delete withoutFlag.isEnrolled;
    expect(paymentHistoryItemSchema.safeParse(withoutFlag).success).toBe(false);
  });

  it.each(["gateway_metadata", "discount_id", "user_id", "gatewayMetadata"])(
    "rejects an item carrying %s",
    (field) => {
      expect(
        paymentHistoryItemSchema.safeParse({ ...validItem, [field]: "x" })
          .success,
      ).toBe(false);
    },
  );

  it("rejects an unknown status", () => {
    expect(
      paymentHistoryItemSchema.safeParse({ ...validItem, status: "refunded" })
        .success,
    ).toBe(false);
  });
});

describe("paymentHistoryDataSchema", () => {
  it("rejects a page with more than five items", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      ...validItem,
      paymentId: `payment-${index}`,
    }));
    expect(
      paymentHistoryDataSchema.safeParse({
        items,
        total: 6,
        page: 1,
        pageSize: 5,
      }).success,
    ).toBe(false);
  });
});
