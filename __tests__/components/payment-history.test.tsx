// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaymentHistory from "@/app/(client)/profile/_components/payment-history";
import type {
  PaymentHistoryItem,
  PaymentHistoryResult,
} from "@/lib/schemas/payment-history";

// Test plan:
// - Mục tiêu: danh sách lịch sử thanh toán trong /profile theo FEAT6 AC3-AC6 và G6.
// - Loại test: component interaction trong jsdom; Server Action getPaymentHistory được mock (DB/RLS kiểm ở integration test).
// - Đối tượng: PaymentHistory.
// - Case thành công: nhãn và huy hiệu của cả sáu trạng thái; dòng giảm giá; link khóa học; ngày giờ dd/mm/yyyy HH:mm theo
//   Asia/Ho_Chi_Minh; chỉ hàng creating/pending còn hạn có "Hạn" và "Tiếp tục thanh toán"; chip đổi về trang 1;
//   Trước/Sau và "Trang n/m"; trang bị kẹp về trang cuối thật; Thử lại sau lỗi.
// - Case thất bại: khóa học không đọc được thì không có link; trống hoàn toàn và trống theo nhóm; đọc lỗi (kết quả lỗi lẫn ném ngoại lệ).
// - Bảo mật/phân quyền: không áp dụng ở tầng này; giao diện chỉ gửi bộ lọc và trang.
// - Ổn định/resilience: hai phản hồi về ngược thứ tự thì giữ kết quả của yêu cầu mới nhất; danh sách cũ còn hiển thị khi trang mới đang tải;
//   Trước rồi Sau rất nhanh kết thúc đúng trang.
// - Invariant cần giữ: danh sách, chip và "Trang n/m" luôn thuộc cùng một yêu cầu.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/payment-history.test.tsx`.

const mocks = vi.hoisted(() => ({ getPaymentHistory: vi.fn() }));
vi.mock("@/app/actions/payment-history", () => ({
  getPaymentHistory: mocks.getPaymentHistory,
}));

const FUTURE = "2099-06-15T08:00:00+00:00";
const PAST = "2020-01-01T00:00:00+00:00";

function item(overrides: Partial<PaymentHistoryItem> & { paymentId: string }): PaymentHistoryItem {
  return {
    status: "paid",
    amountOriginal: 200000,
    amountDiscount: 0,
    amountFinal: 200000,
    currency: "VND",
    orderCode: `order-${overrides.paymentId}`,
    createdAt: "2026-10-01T08:00:00+00:00",
    expiresAt: null,
    course: {
      slug: `course-${overrides.paymentId}`,
      title: `Khóa ${overrides.paymentId}`,
    },
    ...overrides,
  };
}

function ok(items: PaymentHistoryItem[], total = items.length, page = 1): PaymentHistoryResult {
  return { success: true, data: { items, total, page, pageSize: 5 } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const rows = (count: number, prefix = "p") =>
  Array.from({ length: count }, (_, index) => item({ paymentId: `${prefix}${index + 1}` }));

describe("PaymentHistory", () => {
  beforeEach(() => {
    mocks.getPaymentHistory.mockReset();
  });
  afterEach(() => {
    cleanup();
  });

  it("shows the label of every status with its course link, order code, date and time", async () => {
    mocks.getPaymentHistory.mockResolvedValue(
      ok([
        item({ paymentId: "a", status: "paid" }),
        item({ paymentId: "b", status: "pending", expiresAt: FUTURE }),
        item({ paymentId: "c", status: "creating", expiresAt: FUTURE }),
        item({ paymentId: "d", status: "cancelled" }),
        item({ paymentId: "e", status: "expired" }),
        item({ paymentId: "f", status: "failed" }),
      ]),
    );

    render(<PaymentHistory />);

    for (const label of [
      "Đã thanh toán",
      "Đang chờ thanh toán",
      "Đang tạo thanh toán",
      "Đã hủy",
      "Hết hạn",
      "Thất bại",
    ]) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
    const link = screen.getByRole("link", { name: "Khóa a" });
    expect(link.getAttribute("href")).toBe("/courses/course-a");
    expect(screen.getAllByText(/01\/10\/2026 15:00 · Mã đơn order-a/)).toHaveLength(1);
  });

  it("shows the discount line only for a discounted payment", async () => {
    mocks.getPaymentHistory.mockResolvedValue(
      ok([
        item({ paymentId: "a", amountOriginal: 200000, amountDiscount: 20000, amountFinal: 180000 }),
        item({ paymentId: "b" }),
      ]),
    );

    render(<PaymentHistory />);

    expect(await screen.findByText("180.000 ₫")).toBeTruthy();
    expect(screen.getAllByText(/^Giảm /)).toHaveLength(1);
    expect(screen.getByText("Giảm 20.000 ₫")).toBeTruthy();
  });

  it("offers Hạn and Tiếp tục thanh toán only for creating or pending rows that have not expired", async () => {
    mocks.getPaymentHistory.mockResolvedValue(
      ok([
        item({ paymentId: "live-pending", status: "pending", expiresAt: FUTURE }),
        item({ paymentId: "live-creating", status: "creating", expiresAt: FUTURE }),
        item({ paymentId: "late-pending", status: "pending", expiresAt: PAST }),
        item({ paymentId: "no-deadline", status: "pending", expiresAt: null }),
        item({ paymentId: "paid", status: "paid", expiresAt: FUTURE }),
      ]),
    );

    render(<PaymentHistory />);

    await screen.findByText("Khóa live-pending");
    const continues = screen.getAllByRole("link", { name: "Tiếp tục thanh toán" });
    expect(continues.map((link) => link.getAttribute("href"))).toEqual([
      "/courses/course-live-pending",
      "/courses/course-live-creating",
    ]);
    expect(screen.getAllByText("Hạn 15/06/2099")).toHaveLength(2);
  });

  it("shows a course that can no longer be read without any link", async () => {
    mocks.getPaymentHistory.mockResolvedValue(
      ok([item({ paymentId: "gone", status: "pending", expiresAt: FUTURE, course: null })]),
    );

    render(<PaymentHistory />);

    expect(await screen.findByText("Khóa học không còn khả dụng")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows the empty state when the learner has no paid transactions at all", async () => {
    mocks.getPaymentHistory.mockResolvedValue(ok([]));

    render(<PaymentHistory />);

    expect(await screen.findByText("Bạn chưa có giao dịch thanh toán nào.")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Phân trang lịch sử thanh toán" })).toBeNull();
  });

  it("shows a group-specific empty state when the current filter has no rows", async () => {
    mocks.getPaymentHistory
      .mockResolvedValueOnce(ok(rows(2)))
      .mockResolvedValueOnce(ok([]));

    render(<PaymentHistory />);
    await screen.findByText("Khóa p1");
    fireEvent.click(screen.getByRole("button", { name: "Khác" }));

    expect(await screen.findByText("Không có giao dịch nào trong nhóm này.")).toBeTruthy();
    expect(mocks.getPaymentHistory).toHaveBeenLastCalledWith({ filter: "other", page: 1 });
  });

  it("returns to page 1 when the filter changes and marks the active chip", async () => {
    mocks.getPaymentHistory
      .mockResolvedValueOnce(ok(rows(5), 13, 1))
      .mockResolvedValueOnce(ok(rows(5, "q"), 13, 2))
      .mockResolvedValueOnce(ok(rows(3, "r"), 3, 1));

    render(<PaymentHistory />);
    await screen.findByText("Trang 1/3");
    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));
    await screen.findByText("Trang 2/3");

    fireEvent.click(screen.getByRole("button", { name: "Đã thanh toán" }));

    expect(await screen.findByText("Khóa r1")).toBeTruthy();
    expect(mocks.getPaymentHistory).toHaveBeenLastCalledWith({ filter: "paid", page: 1 });
    expect(
      screen.getByRole("button", { name: "Đã thanh toán" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Tất cả" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("disables Trước on the first page and Sau on the last page, and walks between them", async () => {
    mocks.getPaymentHistory
      .mockResolvedValueOnce(ok(rows(5), 7, 1))
      .mockResolvedValueOnce(ok(rows(2, "q"), 7, 2))
      .mockResolvedValueOnce(ok(rows(5), 7, 1));

    render(<PaymentHistory />);
    await screen.findByText("Trang 1/2");
    const previous = screen.getByRole("button", { name: /Trước/ }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: /Sau/ }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    fireEvent.click(next);
    await screen.findByText("Trang 2/2");
    expect(mocks.getPaymentHistory).toHaveBeenLastCalledWith({ filter: "all", page: 2 });
    expect((screen.getByRole("button", { name: /Sau/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Trước/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: /Trước/ }));
    await screen.findByText("Trang 1/2");
  });

  it("hides the pager when the current filter has five rows or fewer", async () => {
    mocks.getPaymentHistory.mockResolvedValue(ok(rows(5), 5, 1));

    render(<PaymentHistory />);

    await screen.findByText("Khóa p1");
    expect(screen.queryByRole("navigation", { name: "Phân trang lịch sử thanh toán" })).toBeNull();
  });

  it("shows and navigates from the page the server returns when it clamps a past-the-end page", async () => {
    // Học viên ở trang 2/3 bấm Sau để xin trang 3, nhưng tổng đã giảm còn 8 nên server trả trang 2 (trang cuối thật).
    mocks.getPaymentHistory
      .mockResolvedValueOnce(ok(rows(5), 13, 1))
      .mockResolvedValueOnce(ok(rows(5, "q"), 13, 2))
      .mockResolvedValueOnce(ok(rows(3, "r"), 8, 2))
      .mockResolvedValueOnce(ok(rows(5), 8, 1));

    render(<PaymentHistory />);
    await screen.findByText("Trang 1/3");
    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));
    await screen.findByText("Trang 2/3");
    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));

    expect(await screen.findByText("Trang 2/2")).toBeTruthy();
    expect(mocks.getPaymentHistory).toHaveBeenLastCalledWith({ filter: "all", page: 3 });
    expect(screen.queryByText(/Trang 3\//)).toBeNull();
    expect((screen.getByRole("button", { name: /Sau/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Trước/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    // Trước phải đi từ trang server trả về (2 -> 1), không phải từ trang đã xin (3 -> 2).
    fireEvent.click(screen.getByRole("button", { name: /Trước/ }));
    expect(await screen.findByText("Trang 1/2")).toBeTruthy();
    expect(mocks.getPaymentHistory).toHaveBeenLastCalledWith({ filter: "all", page: 1 });
  });

  it("keeps the previous rows visible until the next page arrives", async () => {
    const second = deferred<PaymentHistoryResult>();
    mocks.getPaymentHistory
      .mockResolvedValueOnce(ok(rows(5), 7, 1))
      .mockReturnValueOnce(second.promise);

    render(<PaymentHistory />);
    await screen.findByText("Khóa p1");
    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));

    expect(screen.getByText("Khóa p1")).toBeTruthy();
    expect(screen.getByText("Trang 1/2")).toBeTruthy();

    await act(async () => {
      second.resolve(ok(rows(2, "q"), 7, 2));
    });
    expect(await screen.findByText("Khóa q1")).toBeTruthy();
    expect(screen.queryByText("Khóa p1")).toBeNull();
  });

  it("ignores a slower earlier response so the list matches the latest filter", async () => {
    const all = deferred<PaymentHistoryResult>();
    const paid = deferred<PaymentHistoryResult>();
    mocks.getPaymentHistory
      .mockReturnValueOnce(all.promise)
      .mockReturnValueOnce(paid.promise);

    render(<PaymentHistory />);
    fireEvent.click(screen.getByRole("button", { name: "Đã thanh toán" }));

    await act(async () => {
      paid.resolve(ok([item({ paymentId: "paid-row" })], 1, 1));
    });
    expect(await screen.findByText("Khóa paid-row")).toBeTruthy();

    await act(async () => {
      all.resolve(ok([item({ paymentId: "all-row" })], 1, 1));
    });
    expect(screen.queryByText("Khóa all-row")).toBeNull();
    expect(screen.getByText("Khóa paid-row")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Đã thanh toán" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("ends on the last requested page when Sau and Trước are pressed quickly and answered out of order", async () => {
    const page1 = deferred<PaymentHistoryResult>();
    const page2 = deferred<PaymentHistoryResult>();
    mocks.getPaymentHistory
      .mockResolvedValueOnce(ok(rows(5), 7, 1))
      .mockReturnValueOnce(page2.promise)
      .mockReturnValueOnce(page1.promise);

    render(<PaymentHistory />);
    await screen.findByText("Trang 1/2");
    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));
    fireEvent.click(screen.getByRole("button", { name: /Trước/ }));

    await act(async () => {
      page1.resolve(ok(rows(5, "back"), 7, 1));
    });
    await act(async () => {
      page2.resolve(ok(rows(2, "fwd"), 7, 2));
    });

    expect(await screen.findByText("Khóa back1")).toBeTruthy();
    expect(screen.getByText("Trang 1/2")).toBeTruthy();
    expect(screen.queryByText("Khóa fwd1")).toBeNull();
  });

  it("shows a quiet unavailable state with Thử lại when the read fails, and recovers on retry", async () => {
    mocks.getPaymentHistory
      .mockResolvedValueOnce({
        success: false,
        errorCode: "QUERY_FAILED",
        error: "Không thể tải lịch sử thanh toán lúc này.",
      } satisfies PaymentHistoryResult)
      .mockResolvedValueOnce(ok(rows(1)));

    render(<PaymentHistory />);
    expect(await screen.findByText("Chưa tải được lịch sử thanh toán.")).toBeTruthy();
    expect(screen.queryByText("Không thể tải lịch sử thanh toán lúc này.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("Khóa p1")).toBeTruthy();
    expect(screen.queryByText("Chưa tải được lịch sử thanh toán.")).toBeNull();
  });

  it("treats a thrown action as unavailable instead of crashing", async () => {
    mocks.getPaymentHistory.mockRejectedValueOnce(new Error("network"));

    render(<PaymentHistory />);

    expect(await screen.findByText("Chưa tải được lịch sử thanh toán.")).toBeTruthy();
    await waitFor(() => {
      expect(within(document.body).getByRole("button", { name: "Thử lại" })).toBeTruthy();
    });
  });
});
