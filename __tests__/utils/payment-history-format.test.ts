import { describe, expect, it } from "vitest";
import {
  canContinuePayment,
  formatPaymentDate,
  formatPaymentDateTime,
  formatVnd,
  hasLivePaymentDeadline,
} from "@/lib/payment-history-format";

// Test plan:
// - Mục tiêu: chuỗi ngày giờ, tiền và điều kiện "Tiếp tục thanh toán" của FEAT6 (AC3, AC8).
// - Loại test: unit thuần.
// - Đối tượng: formatPaymentDate, formatPaymentDateTime, formatVnd, canContinuePayment.
// - Case thành công: ngày giờ dd/mm/yyyy HH:mm theo Asia/Ho_Chi_Minh kể cả khi UTC còn là ngày hôm trước; tiền có dấu chấm và ₫;
//   creating/pending còn hạn có "Hạn", nhưng chỉ pending còn hạn mới được tiếp tục (creating chưa có mã QR).
// - Case thất bại: chuỗi thời gian lạ cho null; hết hạn, không có hạn, hoặc trạng thái khác không được tiếp tục.
// - Bảo mật/phân quyền: không áp dụng.
// - Ổn định/resilience: mốc "bây giờ" được truyền vào nên kết quả không phụ thuộc đồng hồ.
// - Invariant cần giữ: ngày hiển thị luôn tính theo Asia/Ho_Chi_Minh, không theo múi giờ của máy.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/utils/payment-history-format.test.ts`.

describe("payment history formatting", () => {
  it("formats the date and time in Asia/Ho_Chi_Minh, not UTC", () => {
    // 20:30 UTC ngày 31/10 đã là 03:30 ngày 01/11 ở Việt Nam.
    expect(formatPaymentDateTime("2026-10-31T20:30:00Z")).toBe("01/11/2026 03:30");
    expect(formatPaymentDate("2026-10-31T20:30:00Z")).toBe("01/11/2026");
    expect(formatPaymentDateTime("2026-10-20T00:05:00+07:00")).toBe("20/10/2026 00:05");
  });

  it("returns null for a value that is not a moment in time", () => {
    expect(formatPaymentDateTime("not-a-date")).toBeNull();
    expect(formatPaymentDate("")).toBeNull();
  });

  it("formats VND with a dot separator and the dong sign", () => {
    expect(formatVnd(159000)).toBe("159.000 ₫");
    expect(formatVnd(0)).toBe("0 ₫");
  });

  describe("canContinuePayment", () => {
    const now = Date.parse("2026-10-20T00:00:00Z");

    it("allows a pending payment that has not expired", () => {
      expect(
        canContinuePayment({ status: "pending", expiresAt: "2026-10-21T00:00:00Z" }, now),
      ).toBe(true);
    });

    it("refuses a pending payment on a course the learner is already enrolled in", () => {
      expect(
        canContinuePayment(
          { status: "pending", expiresAt: "2026-10-21T00:00:00Z", isEnrolled: true },
          now,
        ),
      ).toBe(false);
      expect(
        canContinuePayment(
          { status: "pending", expiresAt: "2026-10-21T00:00:00Z", isEnrolled: false },
          now,
        ),
      ).toBe(true);
    });

    it("refuses a pending payment when enrolment is unknown (null), but not when it is absent from the source", () => {
      const live = { status: "pending" as const, expiresAt: "2026-10-21T00:00:00Z" };
      expect(canContinuePayment({ ...live, isEnrolled: null }, now)).toBe(false);
      expect(canContinuePayment(live, now)).toBe(true);
    });

    it("refuses a creating payment even before its deadline, because it has no QR to open", () => {
      expect(
        canContinuePayment({ status: "creating", expiresAt: "2026-10-21T00:00:00Z" }, now),
      ).toBe(false);
    });

    it("refuses an expired deadline, a missing deadline and non-active statuses", () => {
      expect(
        canContinuePayment({ status: "pending", expiresAt: "2026-10-19T00:00:00Z" }, now),
      ).toBe(false);
      expect(canContinuePayment({ status: "pending", expiresAt: null }, now)).toBe(false);
      for (const status of ["paid", "cancelled", "expired", "failed"] as const) {
        expect(
          canContinuePayment({ status, expiresAt: "2099-01-01T00:00:00Z" }, now),
        ).toBe(false);
      }
    });
  });

  describe("hasLivePaymentDeadline", () => {
    const now = Date.parse("2026-10-20T00:00:00Z");

    it.each(["creating", "pending"] as const)("is true for a %s payment before its deadline", (status) => {
      expect(hasLivePaymentDeadline({ status, expiresAt: "2026-10-21T00:00:00Z" }, now)).toBe(true);
    });

    it("is false after the deadline, without a deadline, or for a settled status", () => {
      expect(hasLivePaymentDeadline({ status: "pending", expiresAt: "2026-10-19T00:00:00Z" }, now)).toBe(false);
      expect(hasLivePaymentDeadline({ status: "creating", expiresAt: null }, now)).toBe(false);
      expect(hasLivePaymentDeadline({ status: "paid", expiresAt: "2099-01-01T00:00:00Z" }, now)).toBe(false);
    });
  });
});
