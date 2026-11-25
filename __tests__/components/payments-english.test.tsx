// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PendingPaymentCard } from "@/app/(client)/learn/_components/PendingPayments";
import PaymentHistory from "@/app/(client)/profile/_components/payment-history";
import { formatPaymentDateIn, formatPaymentDateTimeIn, formatPaymentDate, formatPaymentDateTime } from "@/lib/payment-history-format";
import type { PendingPaymentSummary } from "@/lib/schemas/learn-dashboard";
import type { PaymentHistoryItem, PaymentHistoryResult } from "@/lib/schemas/payment-history";

// Test plan:
// - Mục tiêu: English localization U5 CP1 - thẻ thanh toán chờ ở /learn, lịch sử thanh toán ở /profile và thông báo của
//   getPaymentHistory hiện tiếng Anh khi ngôn ngữ là en, còn tiếng Việt giữ nguyên (AC2, AC3, AC5, AC6).
// - Loại test: component trong jsdom với provider dùng chung; getPaymentHistory thay ở ranh giới. Thông báo của action ở
//   __tests__/actions/payment-history-english.test.ts.
// - Case chính: hạn, nhãn trợ năng và dòng "+N" của thẻ chờ (số đếm có dấu phân cách ở en); chip lọc, nhãn trạng thái, mã đơn, số
//   tiền VND, dòng giảm giá, hạn và link tiếp tục, khóa học không còn khả dụng, trạng thái rỗng, lỗi, phân trang; ngày ở en có tên
//   tháng và vẫn theo Asia/Ho_Chi_Minh, ngày ở vi giống hệt hàm cũ.
// - Khoảng trống đã biết: chữ tiếng Việt nguyên văn của giao diện do payment-history.test.tsx và learn-dashboard-*.test.tsx giữ.

const mocks = vi.hoisted(() => ({ getPaymentHistory: vi.fn() }));
vi.mock("@/app/actions/payment-history", () => ({ getPaymentHistory: mocks.getPaymentHistory }));

const FUTURE = "2099-01-04T00:00:00+00:00";
const hasVietnamese = (text: string | null) => /[ăâđêôơưáàảãạéèíìóòúùýỳ]/i.test(text ?? "");

function pending(index: number, overrides: Partial<PendingPaymentSummary> = {}): PendingPaymentSummary {
  return {
    paymentId: `pay-${index}`,
    courseId: `course-${index}`,
    courseSlug: `course-${index}`,
    courseTitle: `Khóa ${index}`,
    status: "pending",
    createdAt: "2026-07-10T08:00:00+00:00",
    expiresAt: FUTURE,
    ...overrides,
  };
}

function item(overrides: Partial<PaymentHistoryItem> & { paymentId: string }): PaymentHistoryItem {
  return {
    status: "paid",
    amountOriginal: 200000,
    amountDiscount: 0,
    amountFinal: 1234000,
    currency: "VND",
    orderCode: `order-${overrides.paymentId}`,
    createdAt: "2026-10-31T20:30:00Z",
    expiresAt: null,
    course: { slug: `course-${overrides.paymentId}`, title: `Khóa ${overrides.paymentId}` },
    hiddenCourseTitle: null,
    isEnrolled: false,
    ...overrides,
  };
}

const ok = (items: PaymentHistoryItem[], total = items.length, page = 1): PaymentHistoryResult => ({
  success: true,
  data: { items, total, page, pageSize: 5 },
});

afterEach(() => {
  cleanup();
});

describe("payment date formatting (AC6)", () => {
  it("keeps the Vietnamese output of the existing helpers and names the month in English", () => {
    const value = "2026-10-31T20:30:00Z";
    expect(formatPaymentDateIn("vi", value)).toBe(formatPaymentDate(value));
    expect(formatPaymentDateTimeIn("vi", value)).toBe(formatPaymentDateTime(value));
    // 20:30 UTC là 03:30 ngày 1/11 ở Asia/Ho_Chi_Minh: tiếng Anh vẫn đổi múi giờ như tiếng Việt.
    expect(formatPaymentDateIn("en", value)).toBe("Nov 1, 2026");
    expect(formatPaymentDateTimeIn("en", value)).toBe("Nov 1, 2026, 03:30");
    expect(formatPaymentDateIn("en", "not-a-date")).toBeNull();
  });
});

describe("PendingPaymentCard in English", () => {
  it("shows the deadline, the continue link and the dismiss button in English", () => {
    render(<PendingPaymentCard payments={[pending(1)]} onDismiss={vi.fn()} />, { locale: "en" });

    const card = screen.getByRole("region", { name: "Payments to complete" });
    expect(within(card).getByText("Due Jan 4, 2099")).toBeTruthy();
    const link = within(card).getByRole("link", { name: "Continue payment for Khóa 1" });
    expect(link.textContent).toBe("Continue payment");
    expect(within(card).getByRole("button", { name: "Dismiss this reminder: Khóa 1" })).toBeTruthy();
  });

  it("counts the other payments with English plurals and separators", () => {
    const { unmount } = render(<PendingPaymentCard payments={[pending(1), pending(2)]} onDismiss={vi.fn()} />, {
      locale: "en",
    });
    expect(screen.getByRole("link", { name: "+1 other payment · View in your profile" })).toBeTruthy();
    unmount();

    const many = Array.from({ length: 1235 }, (_, index) => pending(index + 1));
    render(<PendingPaymentCard payments={many} onDismiss={vi.fn()} />, { locale: "en" });
    expect(screen.getByRole("link", { name: "+1,234 other payments · View in your profile" })).toBeTruthy();
  });

  it("keeps the Vietnamese card text unchanged", () => {
    render(<PendingPaymentCard payments={[pending(1), pending(2)]} onDismiss={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Thanh toán cần xử lý" })).toBeTruthy();
    expect(screen.getByText("Hạn 04/01/2099")).toBeTruthy();
    expect(screen.getByRole("link", { name: "+1 khoản khác · Xem trong hồ sơ" })).toBeTruthy();
  });
});

describe("PaymentHistory in English", () => {
  beforeEach(() => {
    mocks.getPaymentHistory.mockReset();
  });

  it("shows filters, statuses, amounts, the order line and the continue link in English", async () => {
    mocks.getPaymentHistory.mockResolvedValue(
      ok([
        item({ paymentId: "a", amountDiscount: 50000 }),
        item({ paymentId: "b", status: "pending", expiresAt: FUTURE }),
        item({ paymentId: "c", status: "cancelled" }),
        item({ paymentId: "d", status: "failed", course: null, hiddenCourseTitle: "Khóa ẩn" }),
        item({ paymentId: "e", status: "expired", course: null }),
      ]),
    );
    const { container } = render(<PaymentHistory />, { locale: "en" });

    expect(await screen.findByText("Order order-a", { exact: false })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Payment history" })).toBeTruthy();
    const filters = screen.getByRole("group", { name: "Filter payment history" });
    expect(within(filters).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "All",
      "Paid",
      "Pending",
      "Other",
    ]);
    for (const label of ["Paid", "Awaiting payment", "Cancelled", "Failed", "Expired"]) {
      expect(within(screen.getByRole("list")).getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("1,234,000 ₫").length).toBe(5);
    expect(screen.getByText("50,000 ₫ off")).toBeTruthy();
    expect(screen.getAllByText("Nov 1, 2026, 03:30 ·", { exact: false }).length).toBe(5);
    expect(screen.getByText("Due Jan 4, 2099")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue payment" }).getAttribute("href")).toContain("course-b");
    expect(screen.getByText("No longer available")).toBeTruthy();
    expect(screen.getByText("This course is no longer available")).toBeTruthy();
    // Chỉ tên khóa học (dữ liệu của giáo viên) còn chữ Việt.
    const interfaceText = (container.textContent ?? "").replace(/Khóa (ẩn|[a-e])/g, "");
    expect(hasVietnamese(interfaceText)).toBe(false);
  });

  it("shows the empty states in English", async () => {
    mocks.getPaymentHistory.mockResolvedValue(ok([]));
    render(<PaymentHistory />, { locale: "en" });
    expect(await screen.findByText("You don't have any payments yet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Paid" }));
    expect(await screen.findByText("No payments in this group.")).toBeTruthy();
  });

  it("shows the error state and the pager in English", async () => {
    mocks.getPaymentHistory.mockResolvedValueOnce({ success: false, errorCode: "QUERY_FAILED", error: "x" });
    mocks.getPaymentHistory.mockResolvedValue(ok([item({ paymentId: "a" })], 12, 1));
    render(<PaymentHistory />, { locale: "en" });

    expect(await screen.findByText("Couldn't load your payment history.")).toBeTruthy();
    expect(screen.getByText("The rest of your profile still works. Try loading it again.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    const pager = await screen.findByRole("navigation", { name: "Payment history pages" });
    expect(within(pager).getByText("Page 1 of 3")).toBeTruthy();
    expect(within(pager).getByRole("button", { name: "Previous" })).toBeTruthy();
    expect(within(pager).getByRole("button", { name: "Next" })).toBeTruthy();
  });
});
