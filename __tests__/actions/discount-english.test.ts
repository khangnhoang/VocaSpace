import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { validateDiscountPreview } from "@/app/actions/discount";
import { validateDiscountPreviewLocalized } from "@/app/actions/discount-localized";
import { reserveDiscountUsage } from "@/lib/discounts/discount-pricing";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U5 CP2 AC3 - validateDiscountPreview (gồm mọi lỗi của resolveDiscountPricing thật) và
//   reserveDiscountUsage trả thông báo theo ngôn ngữ của request; tiếng Việt đúng chuỗi trước U5; kết quả thành công giữ nguyên.
// - Loại test: Server Action với Supabase admin mock (một mã giảm giá cấu hình được); ngôn ngữ chọn bằng `setServerTestLocale`.
// - Case: chưa đăng nhập, lỗi schema (thiếu, rỗng, sai định dạng, sai kiểu), khóa học không bán, khóa miễn phí, mã không tồn tại,
//   chưa tới hạn, hết hạn, dưới giá tối thiểu (số tiền theo ngôn ngữ), hết lượt, không giảm được, áp dụng thành công, lỗi bất ngờ;
//   lỗi giữ lượt và hết lượt khi giữ; wrapper trả khóa theo trường `error`/`message`.
// - Khoảng trống đã biết: cách tính giảm giá và giữ lượt thật do integration payment-discount-rpc giữ.

const mocks = vi.hoisted(() => ({ adminFrom: vi.fn(), adminRpc: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mocks.adminFrom, rpc: mocks.adminRpc })),
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const courseId = "22222222-2222-4222-8222-222222222222";
let course: Record<string, unknown> | null;
let discount: Record<string, unknown> | null;

function activeDiscount(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    code: "SAVE20",
    type: "fixed",
    value: 50000,
    max_discount_amount: null,
    min_course_price: 0,
    max_uses: null,
    uses_count: 0,
    reserved_count: 0,
    start_at: null,
    expires_at: null,
    removed_at: null,
    course_id: courseId,
    ...overrides,
  };
}

function signedIn(signed = true) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue(signed ? { data: { user: { id: "u1" } }, error: null } : { data: { user: null }, error: null }),
    },
  } as never);
}

const TEXT = {
  vi: {
    authRequired: "Bạn cần đăng nhập để sử dụng mã giảm giá.",
    wrongType: "Invalid input: expected string, received undefined",
    courseIdRequired: "ID khóa học không được để trống",
    codeRequired: "Vui lòng nhập mã giảm giá",
    codeFormat: "Mã giảm giá chỉ bao gồm chữ in hoa và số, không chứa ký tự đặc biệt hoặc khoảng trắng",
    courseUnavailable: "Khóa học không tồn tại hoặc chưa được mở bán.",
    freeCourse: "Mã giảm giá không áp dụng cho khóa học miễn phí.",
    notFound: "Mã giảm giá không tồn tại hoặc hết hạn sử dụng.",
    notStarted: "Mã giảm giá chưa đến thời gian sử dụng.",
    expired: "Mã giảm giá đã hết hạn sử dụng.",
    minPrice: `Mã giảm giá chỉ áp dụng cho khóa học từ ${(300000).toLocaleString()}đ.`,
    usedUp: "Mã giảm giá đã hết lượt sử dụng.",
    notApplicable: "Mã giảm giá không hợp lệ cho khóa học này.",
    applied: "Áp dụng mã giảm giá thành công",
    checkFailed: "Hệ thống gặp sự cố khi kiểm tra mã giảm giá.",
    reserveFailed: "Không thể giữ lượt mã giảm giá, vui lòng thử lại.",
    reserveSoldOut: "Mã giảm giá vừa hết lượt sử dụng, vui lòng thử lại mã khác.",
  },
  en: {
    authRequired: "Please sign in to use a discount code.",
    wrongType: "Invalid input: expected string, received undefined",
    courseIdRequired: "The course ID must not be empty",
    codeRequired: "Please enter a discount code",
    codeFormat: "Discount codes contain only capital letters and digits, with no special characters or spaces",
    courseUnavailable: "This course doesn't exist or isn't on sale yet.",
    freeCourse: "Discount codes don't apply to free courses.",
    notFound: "This discount code doesn't exist or has expired.",
    notStarted: "This discount code can't be used yet.",
    expired: "This discount code has expired.",
    minPrice: "This discount code only applies to courses from 300,000 ₫.",
    usedUp: "This discount code has no uses left.",
    notApplicable: "This discount code isn't valid for this course.",
    applied: "Discount code applied",
    checkFailed: "Something went wrong while checking the discount code.",
    reserveFailed: "Couldn't hold a use of this discount code. Please try again.",
    reserveSoldOut: "This discount code just ran out of uses. Please try another code.",
  },
} satisfies Record<Locale, Record<string, string>>;

const noop = () => undefined;

beforeEach(() => {
  vi.clearAllMocks();
  course = { id: courseId, title: "TOEIC", price: 250000, status: "published", removed_at: null };
  discount = activeDiscount();
  signedIn();
  mocks.adminFrom.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is"]) chain[method] = () => chain;
    chain.maybeSingle = async () => ({ data: table === "courses" ? course : discount, error: null });
    return chain;
  });
});

afterEach(() => setServerTestLocale("vi"));

describe.each(["vi", "en"] as const)("discount messages in %s", (locale) => {
  const text = TEXT[locale];
  beforeEach(() => setServerTestLocale(locale));

  const cases: Array<[string, () => unknown, unknown, keyof (typeof TEXT)["vi"]]> = [
    ["signed out", () => signedIn(false), { courseId, code: "SAVE20" }, "authRequired"],
    ["missing course id", noop, { code: "SAVE20" }, "wrongType"],
    ["empty course id", noop, { courseId: "", code: "SAVE20" }, "courseIdRequired"],
    ["empty code", noop, { courseId, code: "  " }, "codeRequired"],
    ["malformed code", noop, { courseId, code: "SAVE-20" }, "codeFormat"],
    ["unpublished course", () => (course = { ...course, status: "draft" }), { courseId, code: "SAVE20" }, "courseUnavailable"],
    ["free course", () => (course = { ...course, price: 0 }), { courseId, code: "SAVE20" }, "freeCourse"],
    ["unknown code", () => (discount = null), { courseId, code: "SAVE20" }, "notFound"],
    ["code not started", () => (discount = activeDiscount({ start_at: "2099-01-01T00:00:00Z" })), { courseId, code: "SAVE20" }, "notStarted"],
    ["expired code", () => (discount = activeDiscount({ expires_at: "2020-01-01T00:00:00Z" })), { courseId, code: "SAVE20" }, "expired"],
    ["course below the minimum price", () => (discount = activeDiscount({ min_course_price: 300000 })), { courseId, code: "SAVE20" }, "minPrice"],
    ["used-up code", () => (discount = activeDiscount({ max_uses: 2, uses_count: 1, reserved_count: 1 })), { courseId, code: "SAVE20" }, "usedUp"],
    ["zero discount", () => (discount = activeDiscount({ value: 0 })), { courseId, code: "SAVE20" }, "notApplicable"],
  ];
  it.each(cases)("validateDiscountPreview returns the %s message", async (_, arrange, input, key) => {
    arrange();
    await expect(validateDiscountPreview(input)).resolves.toEqual({ error: text[key] });
  });

  it("returns the applied message with unchanged pricing", async () => {
    await expect(validateDiscountPreview({ courseId, code: "save20" })).resolves.toEqual({
      success: true,
      message: text.applied,
      discount: { id: "d1", code: "SAVE20", type: "fixed", value: 50000, maxDiscountAmount: null },
      pricing: { originalAmount: 250000, discountAmount: 50000, finalAmount: 200000 },
    });
  });

  it("returns the check-failed message on an unexpected error", async () => {
    mocks.adminFrom.mockImplementation(() => {
      throw new Error("network");
    });
    await expect(validateDiscountPreview({ courseId, code: "SAVE20" })).resolves.toEqual({ error: text.checkFailed });
  });

  it("returns the reservation messages", async () => {
    mocks.adminRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(reserveDiscountUsage({ supabaseAdmin: { rpc: mocks.adminRpc } as never, discountId: "d1" })).resolves.toEqual({
      ok: false,
      error: text.reserveFailed,
    });
    mocks.adminRpc.mockResolvedValueOnce({ data: "LIMIT_REACHED", error: null });
    await expect(reserveDiscountUsage({ supabaseAdmin: { rpc: mocks.adminRpc } as never, discountId: "d1" })).resolves.toEqual({
      ok: false,
      error: text.reserveSoldOut,
    });
  });

  it("returns per-field catalog keys from the wrapper", async () => {
    await expect(validateDiscountPreviewLocalized({ courseId, code: "SAVE20" })).resolves.toMatchObject({
      locale,
      messageRefs: { message: { key: "payments.actions.discount.applied" } },
    });
    discount = activeDiscount({ min_course_price: 300000 });
    const reply = await validateDiscountPreviewLocalized({ courseId, code: "SAVE20" });
    expect(reply).toEqual({
      result: { error: text.minPrice },
      locale,
      messageRefs: {
        error: {
          key: "payments.actions.pricing.minPrice",
          params: { amountVi: `${(300000).toLocaleString()}đ`, amountEn: "300,000 ₫" },
        },
      },
    });
    const schemaReply = await validateDiscountPreviewLocalized({ code: "SAVE20" });
    expect(schemaReply.messageRefs).toEqual({ error: { key: "validation.zodType.string", params: { received: "undefined" } } });
  });
});
