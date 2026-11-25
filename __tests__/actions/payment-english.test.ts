import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale, useRealRequestLocale } from "@/__tests__/support/i18n-request";
import { cancelCheckoutSession, checkPaymentStatus, createCheckoutSession } from "@/app/actions/payment";
import { cancelCheckoutSessionLocalized, createCheckoutSessionLocalized } from "@/app/actions/payment-localized";
import { resumePendingCheckoutWithRef } from "@/app/(client)/courses/_components/resume-checkout";
import { resolveDiscountPricing } from "@/lib/discounts/discount-pricing";
import type { Locale } from "@/lib/i18n/config";
import { payosService } from "@/services/payos";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U5 CP2 AC3/AC4b - createCheckoutSession, cancelCheckoutSession, checkPaymentStatus và
//   resumePendingCheckout trả thông báo theo ngôn ngữ của request trên mọi nhánh, tiếng Việt đúng chuỗi trước U5 (trừ quyết định 4),
//   hình dạng kết quả giữ nguyên; yêu cầu gửi PayOS giống hệt nhau ở vi và en.
// - Loại test: Server Action với Supabase admin/PayOS được mock bằng bảng cấu hình; ngôn ngữ server chọn bằng `setServerTestLocale`,
//   riêng quyết định 4 còn chạy qua bộ phân giải thật với yêu cầu tiếng Anh, khi cờ tắt (tiếng Việt) và khi cờ bật.
// - Case: từng thông báo lỗi/thành công của ba action ở vi và en (kể cả lỗi schema và lỗi sai kiểu); câu thay số tài khoản ở nhánh
//   pending và nhánh đơn mới; số tài khoản thật giữ nguyên; quyết định 4 (lỗi insert không phải 23505) trả câu cố định, không chứa
//   chi tiết database và ghi log server; wrapper `*Localized` trả khóa của `error`/`message` và `accountNumberRef`.
// - Bảo mật/phân quyền: ngôn ngữ không đổi đối số PayOS (mã đơn, số tiền, mô tả, returnUrl, cancelUrl, expiredAt).
// - Khoảng trống đã biết: nghiệp vụ checkout và quyền truy cập do payment.test.ts, payment-resume.test.ts và integration giữ.

const mocks = vi.hoisted(() => ({ adminFrom: vi.fn(), adminRpc: vi.fn(), cookies: vi.fn(), headers: vi.fn() }));

// Chỉ nhóm "quyết định 4 khi cờ tắt" dùng bộ phân giải thật; các nhóm khác chọn ngôn ngữ bằng `setServerTestLocale`.
vi.mock("next/headers", () => ({ cookies: () => mocks.cookies(), headers: () => mocks.headers() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mocks.adminFrom, rpc: mocks.adminRpc })),
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/services/payos", () => ({ payosService: { paymentRequests: { create: vi.fn() } } }));
vi.mock("@/lib/discounts/discount-pricing", () => ({
  toNumber: (value: unknown) => Number(value),
  resolveDiscountPricing: vi.fn(),
  reserveDiscountUsage: vi.fn(),
  releaseReservedDiscount: vi.fn(),
}));

const userId = "11111111-1111-4111-8111-111111111111";
const courseId = "22222222-2222-4222-8222-222222222222";
const paymentId = "33333333-3333-4333-8333-333333333333";
const FUTURE = "2099-01-01T00:00:00+00:00";

type Db = {
  course: Record<string, unknown> | null;
  enrollment: Record<string, unknown> | null;
  enrollmentInsertError: { code: string } | null;
  activePayment: Record<string, unknown> | null;
  paymentInsertError: { code?: string; message: string } | null;
  paymentUpdateError: { message: string } | null;
  cancelResult: { data: unknown; error: unknown };
  statusResult: { data: unknown; error: unknown };
  discount: Record<string, unknown> | null;
};

let db: Db;

function freshDb(overrides: Partial<Db> = {}): Db {
  return {
    course: { id: courseId, title: "TOEIC nền tảng", price: 250000, status: "published", slug: "toeic-nen-tang", removed_at: null },
    enrollment: null,
    enrollmentInsertError: null,
    activePayment: null,
    paymentInsertError: null,
    paymentUpdateError: null,
    cancelResult: { data: { id: paymentId, discount_id: null }, error: null },
    statusResult: { data: { status: "pending" }, error: null },
    discount: null,
    ...overrides,
  };
}

// Mỗi lần `from()` là một chuỗi mới; kết quả phụ thuộc bảng và thao tác (insert/update) đã gọi trên chuỗi đó.
function installDb() {
  mocks.adminFrom.mockImplementation((table: string) => {
    let op: "read" | "insert" | "update" = "read";
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "match", "lt", "gt", "in"]) chain[method] = () => chain;
    chain.insert = () => {
      op = "insert";
      return chain;
    };
    chain.update = () => {
      op = "update";
      return chain;
    };
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const result =
        op === "insert"
          ? { error: table === "enrollments" ? db.enrollmentInsertError : db.paymentInsertError }
          : op === "update"
            ? { data: [], error: db.paymentUpdateError }
            : { data: [], error: null };
      return Promise.resolve(result).then(resolve, reject);
    };
    chain.single = async () => (table === "courses" ? { data: db.course, error: null } : db.statusResult);
    chain.maybeSingle = async () => {
      if (op === "update") return db.cancelResult;
      if (table === "enrollments") return { data: db.enrollment, error: null };
      if (table === "discounts") return { data: db.discount, error: null };
      if (table === "courses") return { data: db.course, error: null };
      return { data: db.activePayment, error: null };
    };
    return chain;
  });
}

function signedIn(signed = true) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue(
          signed ? { data: { user: { id: userId } }, error: null } : { data: { user: null }, error: { message: "no session" } },
        ),
    },
  } as never);
}

const PENDING = {
  id: paymentId,
  status: "pending",
  gateway_order_id: "12344",
  gateway_metadata: { checkout_url: "https://pay.payos.vn/web/12344", qr_code: "existing-qr" },
  amount_final: 250000,
  amount_discount: 0,
  discount_id: null,
  expires_at: FUTURE,
};

const TEXT = {
  vi: {
    authRequired: "Bạn bắt buộc phải đăng nhập để mua khóa học.",
    courseIdRequired: "ID khóa học không được để trống",
    wrongTypeUndefined: "Invalid input: expected string, received undefined",
    wrongTypeObject: "Invalid input: expected object, received null",
    codeFormat: "Mã giảm giá chỉ bao gồm chữ in hoa và số, không chứa ký tự đặc biệt hoặc khoảng trắng",
    courseUnavailable: "Khóa học không tồn tại hoặc chưa được mở bán.",
    alreadyOwned: "Bạn đã sở hữu khóa học này rồi.",
    freeEnrollFailed: "Cấp quyền học khóa học miễn phí thất bại.",
    freeSuccess: "Đăng ký khóa học miễn phí thành công!",
    unexpected: "Hệ thống gặp sự cố ngoài dự kiến.",
    processing: "Đơn thanh toán đang được xử lý, vui lòng bấm lại sau vài giây.",
    invoiceFailed: "Không thể khởi tạo hóa đơn.",
    gatewayFailed: "Cổng thanh toán PayOS gặp sự cố, vui lòng thử lại sau.",
    updateFailed: "Không thể cập nhật trạng thái đơn thanh toán.",
    accountNumberPending: "Quét mã QR tại cổng PayOS để hiển thị số tài khoản",
    accountNumberScan: "Quét mã QR để nhận số tài khoản",
    pricingNotFound: "Mã giảm giá không tồn tại hoặc hết hạn sử dụng.",
    cancelAuth: "Không tìm thấy phiên đăng nhập.",
    cancelFailed: "Không thể cập nhật hủy hóa đơn dưới hệ thống.",
    statusExpired: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ.",
    statusNotFound: "Không tìm thấy thông tin đơn thanh toán này.",
    statusFailed: "Hệ thống gặp sự cố khi cập nhật trạng thái đơn hàng.",
  },
  en: {
    authRequired: "Please sign in to buy this course.",
    courseIdRequired: "The course ID must not be empty",
    wrongTypeUndefined: "Invalid input: expected string, received undefined",
    wrongTypeObject: "Invalid input: expected object, received null",
    codeFormat: "Discount codes contain only capital letters and digits, with no special characters or spaces",
    courseUnavailable: "This course doesn't exist or isn't on sale yet.",
    alreadyOwned: "You already own this course.",
    freeEnrollFailed: "Couldn't give you access to this free course.",
    freeSuccess: "You're enrolled in this free course!",
    unexpected: "Something unexpected went wrong.",
    processing: "Your payment is being processed. Please try again in a few seconds.",
    invoiceFailed: "Couldn't create the invoice.",
    gatewayFailed: "The PayOS payment gateway is having problems. Please try again later.",
    updateFailed: "Couldn't update the payment status.",
    accountNumberPending: "Scan the QR code on the PayOS page to see the account number",
    accountNumberScan: "Scan the QR code to get the account number",
    pricingNotFound: "This discount code doesn't exist or has expired.",
    cancelAuth: "Your sign-in session was not found.",
    cancelFailed: "Couldn't cancel the invoice in the system.",
    statusExpired: "Your sign-in session has expired or is invalid.",
    statusNotFound: "Couldn't find this payment.",
    statusFailed: "Something went wrong while updating the order status.",
  },
} satisfies Record<Locale, Record<string, string>>;

const noop = () => undefined;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://vocaspace.example";
  db = freshDb();
  installDb();
  signedIn();
  mocks.adminRpc.mockResolvedValue({ data: 12345, error: null });
  vi.mocked(resolveDiscountPricing).mockResolvedValue({
    ok: true,
    originalAmount: 250000,
    discountAmount: 0,
    finalAmount: 250000,
    discountId: null,
    discountMeta: null,
  });
  vi.mocked(payosService.paymentRequests.create).mockResolvedValue({
    checkoutUrl: "https://pay.payos.vn/web/12345",
    qrCode: "payos-qr-payload",
    accountNumber: "",
  } as never);
});

afterEach(() => {
  setServerTestLocale("vi");
  vi.useRealTimers();
});

describe.each(["vi", "en"] as const)("payment actions in %s", (locale) => {
  const text = TEXT[locale];
  beforeEach(() => setServerTestLocale(locale));

  const cases: Array<[string, () => unknown, unknown, keyof (typeof TEXT)["vi"]]> = [
    ["signed out", () => signedIn(false), {}, "authRequired"],
    ["missing course id", noop, {}, "wrongTypeUndefined"],
    ["empty course id", noop, { courseId: "" }, "courseIdRequired"],
    ["a malformed coupon", noop, { courseId, couponCode: "SALE-1" }, "codeFormat"],
    ["an unpublished course", () => (db.course = null), { courseId }, "courseUnavailable"],
    ["an invalid stored slug", () => (db.course = { ...db.course, slug: "bad slug/path" }), { courseId }, "courseUnavailable"],
    ["an owned course", () => (db.enrollment = { id: "e1" }), { courseId }, "alreadyOwned"],
    [
      "a failed free enrollment",
      () => {
        db.course = { ...db.course, price: 0 };
        db.enrollmentInsertError = { code: "42501" };
      },
      { courseId },
      "freeEnrollFailed",
    ],
    ["a failed order code", () => mocks.adminRpc.mockResolvedValue({ data: null, error: { message: "x" } }), { courseId }, "unexpected"],
    ["a concurrent insert", () => (db.paymentInsertError = { code: "23505", message: "duplicate key" }), { courseId }, "processing"],
    [
      "a PayOS failure",
      () => vi.mocked(payosService.paymentRequests.create).mockRejectedValue(new Error("down")),
      { courseId },
      "gatewayFailed",
    ],
    ["a failed pending update", () => (db.paymentUpdateError = { message: "write failed" }), { courseId }, "updateFailed"],
  ];
  it.each(cases)("createCheckoutSession returns the %s message", async (_, arrange, input, key) => {
    arrange();
    await expect(createCheckoutSession(input)).resolves.toEqual({ error: text[key] });
  });

  it("createCheckoutSession returns the wrong-type message for a non-object input", async () => {
    await expect(createCheckoutSession(null)).resolves.toEqual({ error: text.wrongTypeObject });
  });

  it("createCheckoutSession returns the free enrollment message", async () => {
    db.course = { ...db.course, price: 0 };
    await expect(createCheckoutSession({ courseId })).resolves.toEqual({ type: "free", message: text.freeSuccess });
  });

  it("puts the localized placeholder into the QR data of a reused pending payment", async () => {
    db.activePayment = PENDING;
    const result = await createCheckoutSession({ courseId });
    expect(result).toMatchObject({ type: "paid", paymentId, data: { accountNumber: text.accountNumberPending } });
  });

  it("puts the localized placeholder into a new order without a PayOS account number, and keeps a real one", async () => {
    await expect(createCheckoutSession({ courseId })).resolves.toMatchObject({
      type: "paid",
      data: { accountNumber: text.accountNumberScan },
    });
    vi.mocked(payosService.paymentRequests.create).mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/12345",
      qrCode: "payos-qr-payload",
      accountNumber: "0123456789",
    } as never);
    await expect(createCheckoutSession({ courseId })).resolves.toMatchObject({
      type: "paid",
      data: { accountNumber: "0123456789" },
    });
  });

  it("returns the fixed invoice message without the database text and logs the error on the server (decision 4)", async () => {
    db.paymentInsertError = { code: "22P02", message: "invalid input syntax for type uuid: secret-detail" };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await createCheckoutSession({ courseId });
      expect(result).toEqual({ error: text.invoiceFailed });
      expect(JSON.stringify(result)).not.toContain("secret-detail");
      expect(consoleError).toHaveBeenCalledWith("🚨 [CHECKOUT_INSERT_FAILED]:", db.paymentInsertError);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("returns the cancel messages", async () => {
    signedIn(false);
    await expect(cancelCheckoutSession(paymentId)).resolves.toEqual({ error: text.cancelAuth });
    signedIn();
    db.cancelResult = { data: null, error: { message: "boom" } };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(cancelCheckoutSession(paymentId)).resolves.toEqual({ error: text.cancelFailed });
    } finally {
      consoleError.mockRestore();
    }
    db.cancelResult = { data: { id: paymentId, discount_id: null }, error: null };
    await expect(cancelCheckoutSession(paymentId)).resolves.toEqual({ success: true });
  });

  it("returns the payment status messages", async () => {
    signedIn(false);
    await expect(checkPaymentStatus(paymentId)).resolves.toEqual({ error: text.statusExpired });
    signedIn();
    db.statusResult = { data: null, error: { message: "not found" } };
    await expect(checkPaymentStatus(paymentId)).resolves.toEqual({ error: text.statusNotFound });
    mocks.adminFrom.mockImplementationOnce(() => {
      throw new Error("network");
    });
    await expect(checkPaymentStatus(paymentId)).resolves.toEqual({ error: text.statusFailed });
    installDb();
    db.statusResult = { data: { status: "paid" }, error: null };
    await expect(checkPaymentStatus(paymentId)).resolves.toEqual({ status: "paid" });
  });

  it("returns the request locale and catalog keys from the client wrappers", async () => {
    await expect(createCheckoutSessionLocalized({ courseId: "" })).resolves.toEqual({
      result: { error: text.courseIdRequired },
      locale,
      messageRefs: { error: { key: "validation.payment.courseIdRequired" } },
      accountNumberRef: null,
    });

    db.course = { ...db.course, price: 0 };
    await expect(createCheckoutSessionLocalized({ courseId })).resolves.toMatchObject({
      locale,
      messageRefs: { message: { key: "payments.actions.checkout.freeSuccess" } },
      accountNumberRef: null,
    });

    db.course = freshDb().course;
    db.activePayment = PENDING;
    await expect(createCheckoutSessionLocalized({ courseId })).resolves.toMatchObject({
      result: { type: "paid" },
      messageRefs: {},
      accountNumberRef: { key: "payments.actions.checkout.accountNumberPending" },
    });

    db.activePayment = null;
    await expect(createCheckoutSessionLocalized({ courseId })).resolves.toMatchObject({
      accountNumberRef: { key: "payments.actions.checkout.accountNumberScan" },
    });

    signedIn(false);
    await expect(cancelCheckoutSessionLocalized(paymentId)).resolves.toEqual({
      result: { error: text.cancelAuth },
      locale,
      messageKey: "payments.actions.cancel.authRequired",
    });
  });

  it("passes the discount pricing key through createCheckoutSessionLocalized", async () => {
    const actual = await vi.importActual<typeof import("@/lib/discounts/discount-pricing")>(
      "@/lib/discounts/discount-pricing",
    );
    vi.mocked(resolveDiscountPricing).mockImplementation(actual.resolveDiscountPricing);
    await expect(createCheckoutSessionLocalized({ courseId, couponCode: "NOPE" })).resolves.toEqual({
      result: { error: text.pricingNotFound },
      locale,
      messageRefs: { error: { key: "payments.actions.pricing.notFound" } },
      accountNumberRef: null,
    });
  });

  it("gives the resumed checkout the placeholder key, and none when nothing resumes", async () => {
    db.activePayment = PENDING;
    const resumed = await resumePendingCheckoutWithRef({ courseId });
    expect(resumed.result).toMatchObject({ status: "resume", data: { accountNumber: text.accountNumberPending } });
    expect(resumed.accountNumberRef).toEqual({ key: "payments.actions.checkout.accountNumberPending" });

    db.activePayment = null;
    await expect(resumePendingCheckoutWithRef({ courseId })).resolves.toEqual({
      result: { status: "none", reason: "unavailable" },
      accountNumberRef: null,
    });
  });
});

describe("decision 4 through the real locale resolver", () => {
  beforeEach(() => {
    db = freshDb({ paymentInsertError: { code: "22P02", message: "invalid input syntax for type uuid: secret-detail" } });
    installDb();
    signedIn();
    useRealRequestLocale(true);
    // Yêu cầu tiếng Anh: cookie và Accept-Language đều là en.
    mocks.cookies.mockResolvedValue({ get: (name: string) => (name === "NEXT_LOCALE" ? { value: "en" } : undefined) });
    mocks.headers.mockResolvedValue(new Headers({ "accept-language": "en-US,en;q=0.9" }));
  });
  afterEach(() => {
    useRealRequestLocale(false);
    vi.unstubAllEnvs();
  });

  it.each([
    [undefined, "Không thể khởi tạo hóa đơn.", false],
    ["1", "Couldn't create the invoice.", true],
  ] as const)("with ENGLISH_UI_ENABLED=%j an English request gets %j", async (flag, message, readsRequest) => {
    vi.stubEnv("ENGLISH_UI_ENABLED", flag);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await createCheckoutSession({ courseId });
      expect(result).toEqual({ error: message });
      expect(JSON.stringify(result)).not.toContain("secret-detail");
      expect(consoleError).toHaveBeenCalledWith("🚨 [CHECKOUT_INSERT_FAILED]:", db.paymentInsertError);
      // U1 G1 / U5 G8: cờ tắt thì không đọc dữ liệu request.
      expect(mocks.cookies.mock.calls.length > 0).toBe(readsRequest);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("the PayOS request does not depend on the locale", () => {
  it("sends byte-identical arguments in vi and en", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T03:00:00.000Z"));
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue("44444444-4444-4444-8444-444444444444");
    vi.mocked(resolveDiscountPricing).mockResolvedValue({
      ok: true,
      originalAmount: 250000,
      discountAmount: 50000,
      finalAmount: 200000,
      discountId: null,
      discountMeta: null,
    });
    try {
      for (const locale of ["vi", "en"] as const) {
        setServerTestLocale(locale);
        await createCheckoutSession({ courseId });
      }
      const calls = vi.mocked(payosService.paymentRequests.create).mock.calls;
      expect(calls).toHaveLength(2);
      expect(JSON.stringify(calls[1][0])).toBe(JSON.stringify(calls[0][0]));
      expect(calls[0][0]).toEqual({
        orderCode: 12345,
        amount: 200000,
        description: "VOCASPACE 12345",
        returnUrl: "https://vocaspace.example/payment/success?payment_id=44444444-4444-4444-8444-444444444444",
        cancelUrl: "https://vocaspace.example/courses/toeic-nen-tang",
        expiredAt: Math.floor(Date.parse("2026-11-25T03:15:00.000Z") / 1000),
      });
    } finally {
      uuid.mockRestore();
    }
  });
});
