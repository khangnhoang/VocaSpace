// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderSwitchable, screen } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { cancelCheckoutSession, checkPaymentStatus, createCheckoutSession } from "@/app/actions/payment";
import { validateDiscountPreview } from "@/app/actions/discount";
import { PublicCourseEnrollmentCardLocalized } from "@/app/(client)/courses/_components/PublicCourseEnrollmentCard";
import PublicCoursePaymentModal from "@/app/(client)/courses/_components/PublicCoursePaymentModal";
import { minPriceParams } from "@/lib/discounts/discount-pricing";
import { recordedTranslations } from "@/lib/i18n/message-ref";
import type { CheckoutResponse, ResumeCheckoutResult } from "@/lib/schemas/payment";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

// Test plan:
// - Mục tiêu: English localization U5 CP2 AC2/AC4/AC4b/AC5/AC6 - hộp thoại đăng ký và thanh toán hiện tiếng Anh ở ba bước, và mọi
//   thông báo (dòng mã giảm giá, toast lỗi tạo phiên, toast hủy, toast thanh toán thành công, câu thay số tài khoản) theo ngôn ngữ
//   đang hiển thị khi đổi VI/EN, khi phản hồi đến sau lúc đổi, và khi cookie đổi ở tab khác.
// - Loại test: component interaction trong jsdom với thẻ đăng ký, hộp thoại và wrapper `*Localized` thật; action gốc được mock và
//   ghi khóa qua `recordedTranslations` như action thật; Supabase realtime, confetti, toast được mock.
// - Case: bản tiếng Anh của bước mã giảm giá, bước miễn phí (số ít/số nhiều) và bước QR; dòng lỗi schema, lỗi server và dòng thành
//   công đổi ngôn ngữ khi đang hiện; phản hồi đến sau khi đổi; server trả tiếng Anh cho trang tiếng Việt; toast lỗi tạo phiên và
//   toast hủy theo ngôn ngữ lúc bật; toast thanh toán thành công đổi theo lần chuyển ngôn ngữ trong 3,5 giây chờ; câu thay số tài
//   khoản của khoản mở lại và của đơn mới đổi VI → EN → VI, đúng ngôn ngữ trang khi cookie đổi ở tab khác; số tài khoản thật giữ nguyên.
// - Khoảng trống đã biết: toast đã hiện giữ chữ cũ đến khi tắt (sonner được mock); trình duyệt thật kiểm ở AC1/AC10.

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: mocks.push }),
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
vi.mock("@/app/actions/course-navigation", () => ({ getFirstTopicSlugByCourseSlug: vi.fn() }));
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const NOW = Date.parse("2026-11-25T03:00:00.000Z");
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

const VI_PENDING = "Quét mã QR tại cổng PayOS để hiển thị số tài khoản";
const EN_PENDING = "Scan the QR code on the PayOS page to see the account number";

function checkout(accountNumber: string): CheckoutResponse {
  return {
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=QR",
    amount: 250000,
    orderId: "100001",
    bankMessage: "VOCASPACE 100001",
    accountNumber,
    expiresAt: new Date(NOW + 600_000).toISOString(),
  };
}

function resumed(accountNumber = VI_PENDING): ResumeCheckoutResult {
  return { status: "resume", paymentId: "payment-1", data: checkout(accountNumber) };
}

function modalProps(coursePrice: number) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    paymentData: null,
    paymentId: null,
    courseId: COURSE.id,
    coursePrice,
    courseTitle: COURSE.title,
    contentSummary: { chapterCount: 2, topicCount: 1 },
    onGeneratePayment: vi.fn().mockResolvedValue(false),
    onSuccess: vi.fn(),
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function applyCoupon(code: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: code } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^(Áp dụng|Apply)$/ }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setServerTestLocale("vi");
});

afterEach(() => {
  cleanup();
  setServerTestLocale("vi");
  vi.useRealTimers();
});

describe("English checkout stages", () => {
  it("renders the discount stage in English with English amounts", () => {
    render(<PublicCoursePaymentModal {...modalProps(250000)} />, { locale: "en" });

    expect(screen.getByRole("dialog", { name: "Enroll in and pay for this course" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close the enrollment window" })).toBeTruthy();
    for (const text of [
      "Confirm your enrollment",
      "Check the details and apply a discount code if you have one.",
      "Course",
      "Lifetime access",
      "FSRS flashcard system",
      "Discount code",
      "Course price",
      "Total",
      "CONTINUE TO PAYMENT",
      "*The amounts here are for display only. The server checks the final price on its own.",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getAllByText("250,000 ₫")).toHaveLength(2);
    expect(screen.getByPlaceholderText("Enter a code (e.g. VOCASPACE100)")).toBeTruthy();
  });

  it("renders the free stage in English with singular and plural counts", () => {
    render(<PublicCoursePaymentModal {...modalProps(0)} />, { locale: "en" });

    expect(screen.getByRole("dialog", { name: "Enroll in this free course" })).toBeTruthy();
    expect(screen.getByText("2 chapters · 1 topic")).toBeTruthy();
    for (const text of ["Once you enroll, you can start learning right away.", "Tuition", "Free", "Enroll for free", "Not now"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it("renders the QR stage in English and keeps the PayOS transfer text and a real account number", () => {
    render(
      <PublicCoursePaymentModal {...modalProps(250000)} paymentData={checkout("0123456789")} paymentId="payment-1" openAtQr />,
      { locale: "en" },
    );

    for (const text of ["SCAN TO PAY", "Order details", "Bank account number", "Amount to pay", "Transfer description", "CANCEL PAYMENT"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    // Bước mã giảm giá (đang inert) cũng có số tiền; kiểm đúng ô số tiền của bước QR.
    expect(screen.getByText("Amount to pay").parentElement?.textContent).toContain("250,000 ₫");
    expect(screen.getByText("VOCASPACE 100001")).toBeTruthy();
    expect(screen.getByText("0123456789")).toBeTruthy();
  });
});

describe("discount lines follow the displayed language (AC4)", () => {
  it("switches a schema error, a server error and a success line while they are shown", async () => {
    const view = renderSwitchable(<PublicCoursePaymentModal {...modalProps(250000)} />, "vi");

    await applyCoupon("SALE-1");
    expect(screen.getByText("Mã giảm giá chỉ bao gồm chữ in hoa và số, không chứa ký tự đặc biệt hoặc khoảng trắng")).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText("Discount codes contain only capital letters and digits, with no special characters or spaces")).toBeTruthy();
    view.switchLocale("vi");

    vi.mocked(validateDiscountPreview).mockImplementation(async () => ({
      error: (await recordedTranslations("payments", "error"))("actions.pricing.expired"),
    }));
    await applyCoupon("SAVE20");
    expect(screen.getByText("Mã giảm giá đã hết hạn sử dụng.")).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText("This discount code has expired.")).toBeTruthy();

    vi.mocked(validateDiscountPreview).mockImplementation(async () => ({
      success: true,
      message: (await recordedTranslations("payments", "message"))("actions.discount.applied"),
      discount: { id: "d1", code: "SAVE20", type: "fixed", value: 50000, maxDiscountAmount: null },
      pricing: { originalAmount: 250000, discountAmount: 50000, finalAmount: 200000 },
    }));
    await applyCoupon("SAVE20");
    expect(screen.getByText("Discount code applied")).toBeTruthy();
    expect(screen.getByText("-50,000 ₫")).toBeTruthy();
    view.switchLocale("vi");
    expect(screen.getByText("Áp dụng mã giảm giá thành công")).toBeTruthy();
  });

  it("shows a response that arrives after the switch, and an English server reply on a Vietnamese page, in the page language", async () => {
    const pending = deferred<void>();
    vi.mocked(validateDiscountPreview).mockImplementation(async () => {
      await pending.promise;
      return { error: (await recordedTranslations("payments", "error"))("actions.pricing.usedUp") };
    });
    const view = renderSwitchable(<PublicCoursePaymentModal {...modalProps(250000)} />, "vi");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "SAVE20" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    view.switchLocale("en");
    await act(async () => pending.resolve());
    expect(await screen.findByText("This discount code has no uses left.")).toBeTruthy();

    view.switchLocale("vi");
    setServerTestLocale("en");
    await applyCoupon("SAVE20");
    expect(screen.getByText("Mã giảm giá đã hết lượt sử dụng.")).toBeTruthy();
  });
});

describe("the minimum-price error keeps the amount format of the displayed language (AC4, AC6)", () => {
  const VI_MIN = `Mã giảm giá chỉ áp dụng cho khóa học từ ${(300000).toLocaleString()}đ.`;
  const EN_MIN = "This discount code only applies to courses from 300,000 ₫.";
  const minPriceError = async () => ({
    error: (await recordedTranslations("payments", "error"))("actions.pricing.minPrice", minPriceParams(300000)),
  });

  it("switches the shown line in both directions and translates a reply from the other language", async () => {
    vi.mocked(validateDiscountPreview).mockImplementation(minPriceError);
    const view = renderSwitchable(<PublicCoursePaymentModal {...modalProps(250000)} />, "vi");

    await applyCoupon("SAVE20");
    expect(screen.getByText(VI_MIN)).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText(EN_MIN)).toBeTruthy();

    setServerTestLocale("en");
    view.switchLocale("vi");
    await applyCoupon("SAVE20");
    expect(screen.getByText(VI_MIN)).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText(EN_MIN)).toBeTruthy();
  });

  it("toasts a checkout error from a Vietnamese request on an English page, and the reverse", async () => {
    vi.mocked(createCheckoutSession).mockImplementation(minPriceError);
    const view = renderSwitchable(<PublicCourseEnrollmentCardLocalized course={COURSE} />, "en");

    fireEvent.click(screen.getByRole("button", { name: "Enroll in the course" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "CONTINUE TO PAYMENT" }));
    });
    expect(toast.error).toHaveBeenLastCalledWith(EN_MIN);

    setServerTestLocale("en");
    view.switchLocale("vi");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "TIẾN HÀNH THANH TOÁN" }));
    });
    expect(toast.error).toHaveBeenLastCalledWith(VI_MIN);
  });
});

describe("toasts take the displayed language when they fire (AC4)", () => {
  it("translates a checkout error that arrives after the switch", async () => {
    const pending = deferred<void>();
    vi.mocked(createCheckoutSession).mockImplementation(async () => {
      await pending.promise;
      return { error: (await recordedTranslations("payments", "error"))("actions.checkout.alreadyOwned") };
    });
    const view = renderSwitchable(<PublicCourseEnrollmentCardLocalized course={COURSE} />, "vi");

    fireEvent.click(screen.getByRole("button", { name: "Đăng ký khóa học" }));
    fireEvent.click(screen.getByRole("button", { name: "TIẾN HÀNH THANH TOÁN" }));
    view.switchLocale("en");
    await act(async () => pending.resolve());

    expect(toast.error).toHaveBeenCalledWith("You already own this course.");
  });

  it("translates the cancel toasts, including an English server error on a Vietnamese page", async () => {
    const view = renderSwitchable(
      <PublicCourseEnrollmentCardLocalized course={COURSE} resume={resumed()} />,
      "vi",
    );

    setServerTestLocale("en");
    vi.mocked(cancelCheckoutSession).mockImplementation(async () => ({
      error: (await recordedTranslations("payments"))("actions.cancel.updateFailed"),
    }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "HỦY THANH TOÁN" }));
    });
    expect(toast.error).toHaveBeenCalledWith("Không thể cập nhật hủy hóa đơn dưới hệ thống.");

    const pending = deferred<void>();
    vi.mocked(cancelCheckoutSession).mockImplementation(async () => {
      await pending.promise;
      return { success: true };
    });
    fireEvent.click(screen.getByRole("button", { name: "HỦY THANH TOÁN" }));
    view.switchLocale("en");
    await act(async () => pending.resolve());
    expect(toast.success).toHaveBeenCalledWith("Payment cancelled.");
  });

  it("fires the payment-success toast in the language chosen during the 3.5 s delay", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(checkPaymentStatus).mockResolvedValue({ status: "paid" });
    const view = renderSwitchable(
      <PublicCourseEnrollmentCardLocalized course={COURSE} resume={resumed()} />,
      "vi",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText("Thành công!")).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();

    view.switchLocale("en");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_500);
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Payment complete! You now have access to the course.");
  });
});

describe("the QR account-number placeholder follows the displayed language (AC4b)", () => {
  it("switches the placeholder of a resumed checkout VI → EN → VI", () => {
    const view = renderSwitchable(
      <PublicCourseEnrollmentCardLocalized
        course={COURSE}
        resume={resumed()}
        resumeAccountNumberRef={{ key: "payments.actions.checkout.accountNumberPending" }}
      />,
      "vi",
    );

    expect(screen.getByText(VI_PENDING)).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText(EN_PENDING)).toBeTruthy();
    view.switchLocale("vi");
    expect(screen.getByText(VI_PENDING)).toBeTruthy();
  });

  it("switches the placeholder of a new order and uses the page language when the cookie changed in another tab", async () => {
    vi.mocked(createCheckoutSession).mockImplementation(async () => ({
      type: "paid",
      paymentId: "payment-2",
      data: checkout((await recordedTranslations("payments", "accountNumber"))("actions.checkout.accountNumberScan")),
    }));
    setServerTestLocale("en");
    const view = renderSwitchable(<PublicCourseEnrollmentCardLocalized course={COURSE} />, "vi");

    fireEvent.click(screen.getByRole("button", { name: "Đăng ký khóa học" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "TIẾN HÀNH THANH TOÁN" }));
    });

    expect(screen.getByText("Quét mã QR để nhận số tài khoản")).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText("Scan the QR code to get the account number")).toBeTruthy();
    view.switchLocale("vi");
    expect(screen.getByText("Quét mã QR để nhận số tài khoản")).toBeTruthy();
  });

  it("shows a real PayOS account number unchanged in both languages", () => {
    const view = renderSwitchable(
      <PublicCourseEnrollmentCardLocalized course={COURSE} resume={resumed("0123456789")} />,
      "vi",
    );

    expect(screen.getByText("0123456789")).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText("0123456789")).toBeTruthy();
  });

  it("tells a returning visitor in English that the payment is no longer pending", () => {
    render(<PublicCourseEnrollmentCardLocalized course={COURSE} resume={{ status: "none", reason: "unavailable" }} />, {
      locale: "en",
    });

    expect(toast.info).toHaveBeenCalledWith("This payment is no longer pending");
  });
});
