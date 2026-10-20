// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { createCheckoutSession } from "@/app/actions/payment";
import { PublicCourseEnrollmentCard } from "@/app/(client)/courses/_components/PublicCourseEnrollmentCard";
import type { ResumeCheckoutResult } from "@/lib/schemas/payment";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

// Test plan:
// - Mục tiêu: FEAT6 AC11 trên trang khóa học - vào bằng "Tiếp tục thanh toán" thì modal thanh toán thật mở thẳng bước QR cho khoản pending có sẵn.
// - Loại test: component interaction trong jsdom với PublicCourseEnrollmentCard và PublicCoursePaymentModal thật; action, Supabase realtime, confetti và toast được mock.
// - Đối tượng: PublicCourseEnrollmentCard (prop resume), PublicCoursePaymentModal (openAtQr).
// - Case thành công: có khoản pending còn hạn -> modal mở ở bước QR với đồng hồ đếm ngược chạy, không click, createCheckoutSession không được gọi; tham số bị gỡ đúng một lần.
// - Case thất bại: không có khoản đủ điều kiện -> không modal, toast "Khoản thanh toán này không còn chờ", không tạo thanh toán; người chưa đăng nhập không có toast.
// - Bảo mật/phân quyền: việc xác định đủ điều kiện thuộc resumePendingCheckout (kiểm riêng); ở đây chỉ chắc chắn giao diện không tự tạo thanh toán.
// - Ổn định/resilience: sau khi tham số bị gỡ và trang render lại, đóng modal rồi render lại vẫn đóng; chạy lại effect không bắn toast hay replace lần hai.
// - Invariant cần giữ: luồng mua thường (không có resume) vẫn mở modal ở bước chọn mã giảm giá khi bấm nút, và không đụng tới URL.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/public-course-resume-payment.test.tsx`.

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
    push: mocks.push,
  }),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/app/actions/payment", () => ({
  createCheckoutSession: vi.fn(),
  cancelCheckoutSession: vi.fn(),
  checkPaymentStatus: vi.fn(),
}));
vi.mock("@/app/actions/discount", () => ({ validateDiscountPreview: vi.fn() }));
vi.mock("@/app/actions/course-navigation", () => ({
  getFirstTopicSlugByCourseSlug: vi.fn(),
}));
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  }),
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const NOW = Date.parse("2026-10-20T10:00:00.000Z");
const COURSE: Pick<
  PublicCourseDetail,
  "id" | "title" | "slug" | "price" | "thumbnail_url" | "is_enrolled" | "learner_progress"
> = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "TOEIC nền tảng",
  slug: "toeic-nen-tang",
  price: 250000,
  thumbnail_url: null,
  is_enrolled: false,
  learner_progress: null,
};

function resumeResult(): ResumeCheckoutResult {
  return {
    status: "resume",
    paymentId: "payment-1",
    data: {
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=QR",
      amount: 250000,
      orderId: "100001",
      bankMessage: "VOCASPACE 100001",
      accountNumber: "Quét mã QR tại cổng PayOS để hiển thị số tài khoản",
      // Còn đúng 10 phút so với đồng hồ giả.
      expiresAt: new Date(NOW + 600_000).toISOString(),
    },
  };
}

const DIALOG = { name: "Đăng ký và thanh toán khóa học" };

describe("PublicCourseEnrollmentCard resume entry (AC11)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens the real payment modal at the QR stage with a running countdown, without a click or a new payment", async () => {
    render(<PublicCourseEnrollmentCard course={COURSE} resume={resumeResult()} />);

    // Hộp thoại chỉ có trong cây truy cập khi đang mở (aria-hidden khi đóng).
    expect(screen.getByRole("dialog", DIALOG)).toBeTruthy();
    expect(screen.getByAltText("QR Code").getAttribute("src")).toContain("api.qrserver.com");
    expect(screen.getByText("10:00")).toBeTruthy();
    // Bước chọn mã giảm giá bị khóa (inert), bước QR đang hiển thị.
    expect(screen.queryByRole("button", { name: /Tiếp tục|Thanh toán/ })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("09:57")).toBeTruthy();

    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    // Tham số được gỡ đúng một lần, về URL chuẩn của khóa học.
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/courses/toeic-nen-tang");
  });

  it("removes only the thanh-toan parameter and keeps other parameters and the hash", () => {
    window.history.pushState(null, "", "/courses/toeic-nen-tang?thanh-toan=tiep-tuc&x=1#section");
    try {
      render(<PublicCourseEnrollmentCard course={COURSE} resume={resumeResult()} />);

      expect(mocks.replace).toHaveBeenCalledTimes(1);
      expect(mocks.replace).toHaveBeenCalledWith("/courses/toeic-nen-tang?x=1#section");
    } finally {
      window.history.pushState(null, "", "/");
    }
  });

  it("shows a toast and no modal when no pending payment is eligible, and creates nothing", async () => {
    render(
      <PublicCourseEnrollmentCard
        course={COURSE}
        resume={{ status: "none", reason: "unavailable" }}
      />,
    );

    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith("Khoản thanh toán này không còn chờ");
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/courses/toeic-nen-tang");
    // Trang vẫn hiện bình thường với nút mua.
    expect(screen.getByRole("button", { name: "Đăng ký khóa học" })).toBeTruthy();
  });

  it("gives a signed-out visitor no toast and no modal, but still removes the parameter", () => {
    render(
      <PublicCourseEnrollmentCard
        course={COURSE}
        resume={{ status: "none", reason: "unauthenticated" }}
      />,
    );

    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("runs once: after the parameter is gone and the page re-renders, closing the modal leaves it closed", async () => {
    const { rerender } = render(
      <PublicCourseEnrollmentCard course={COURSE} resume={resumeResult()} />,
    );
    expect(screen.getByRole("dialog", DIALOG)).toBeTruthy();

    // Máy chủ render lại trang sau router.replace: không còn resume, modal vẫn mở (state giữ nguyên).
    rerender(<PublicCourseEnrollmentCard course={COURSE} />);
    expect(screen.getByRole("dialog", DIALOG)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Đóng cửa sổ đăng ký" }));
    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();

    rerender(<PublicCourseEnrollmentCard course={COURSE} />);
    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("keeps the normal buy flow unchanged: the modal opens on click at the coupon stage and the URL is untouched", () => {
    render(<PublicCourseEnrollmentCard course={COURSE} />);

    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Đăng ký khóa học" }));

    expect(screen.getByRole("dialog", DIALOG)).toBeTruthy();
    // Bước QR vẫn bị khóa và chưa có mã QR; chưa có thanh toán nào được tạo.
    expect(screen.queryByAltText("QR Code")).toBeNull();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });
});
