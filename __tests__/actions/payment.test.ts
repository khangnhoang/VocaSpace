import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "@/app/actions/payment";
import { createClient } from "@/utils/supabase/server";
import { payosService } from "@/services/payos";
import {
  releaseReservedDiscount,
  reserveDiscountUsage,
  resolveDiscountPricing,
} from "@/lib/discounts/discount-pricing";

const mocks = vi.hoisted(() => {
  const adminFrom = vi.fn();
  const adminRpc = vi.fn();

  return {
    adminClient: { from: adminFrom, rpc: adminRpc },
    adminFrom,
    adminRpc,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mocks.adminClient),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/services/payos", () => ({
  payosService: { paymentRequests: { create: vi.fn() } },
}));

vi.mock("@/lib/discounts/discount-pricing", () => ({
  toNumber: (value: unknown) => Number(value),
  resolveDiscountPricing: vi.fn(),
  reserveDiscountUsage: vi.fn(),
  releaseReservedDiscount: vi.fn(),
}));

// Test plan:
// - Mục tiêu: bảo vệ trust boundary và canonical PayOS cancel URL của createCheckoutSession.
// - Loại test: Server Action với Supabase/PayOS boundary được mock.
// - Đối tượng: trusted course query, eligibility, free/pending/new paid và rollback.
// - Case thành công: paid checkout dùng stored slug; free không gọi PayOS; pending được reuse.
// - Case thất bại: missing/unpublished/removed/invalid slug fail closed; PayOS failure rollback.
// - Bảo mật/phân quyền: slug/cancel URL từ client không thể điều khiển redirect PayOS.
// - Ổn định/resilience: không reserve discount hoặc tạo payment cho course không hợp lệ.
// - Invariant cần giữ: success returnUrl không đổi và checkout input vẫn chỉ có courseId/couponCode.
// - Kết quả verify gần nhất: xem evidence B1.5 hiện hành trong progress.md.

const mockedCreateClient = vi.mocked(createClient);
const mockedPayosCreate = vi.mocked(payosService.paymentRequests.create);
const mockedResolveDiscount = vi.mocked(resolveDiscountPricing);
const mockedReserveDiscount = vi.mocked(reserveDiscountUsage);
const mockedReleaseDiscount = vi.mocked(releaseReservedDiscount);

const userId = "11111111-1111-4111-8111-111111111111";
const courseId = "22222222-2222-4222-8222-222222222222";

type CourseRow = {
  id: string;
  title: string;
  price: number;
  status: string;
  slug: string;
  removed_at: string | null;
};

type HarnessOptions = {
  activePayment?: Record<string, unknown> | null;
  course?: CourseRow | null;
  paymentInsertError?: { code?: string; message: string } | null;
};

function activeCourse(overrides: Partial<CourseRow> = {}): CourseRow {
  return {
    id: courseId,
    title: "TOEIC nền tảng",
    price: 250000,
    status: "published",
    slug: "toeic-nen-tang",
    removed_at: null,
    ...overrides,
  };
}

function createChain() {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    match: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    lt: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.match.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);

  return chain;
}

function setupHarness(options: HarnessOptions = {}) {
  const courseQuery = createChain();
  const enrollmentQuery = createChain();
  const paymentQuery = createChain();
  const course = options.course === undefined ? activeCourse() : options.course;

  courseQuery.single.mockResolvedValue({ data: course, error: null });
  enrollmentQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
  enrollmentQuery.insert.mockResolvedValue({ error: null });
  paymentQuery.lt.mockResolvedValue({ data: [], error: null });
  paymentQuery.maybeSingle.mockResolvedValue({
    data: options.activePayment ?? null,
    error: null,
  });
  paymentQuery.insert.mockResolvedValue({
    error: options.paymentInsertError ?? null,
  });
  paymentQuery.eq.mockReturnValue({ error: null });

  mocks.adminFrom.mockImplementation((table: string) => {
    if (table === "courses") return courseQuery;
    if (table === "enrollments") return enrollmentQuery;
    if (table === "payments") return paymentQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.adminRpc.mockResolvedValue({ data: 12345, error: null });

  return { courseQuery, enrollmentQuery, paymentQuery };
}

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://vocaspace.example";
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    mockedResolveDiscount.mockResolvedValue({
      ok: true,
      originalAmount: 250000,
      discountAmount: 0,
      finalAmount: 250000,
      discountId: null,
      discountMeta: null,
    });
    mockedReserveDiscount.mockResolvedValue({ ok: true });
    mockedPayosCreate.mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/12345",
      qrCode: "payos-qr-payload",
      accountNumber: "0123456789",
    } as Awaited<ReturnType<typeof payosService.paymentRequests.create>>);
  });

  it("creates a paid checkout with the trusted canonical cancel URL and unchanged return URL", async () => {
    const { courseQuery } = setupHarness();

    const result = await createCheckoutSession({ courseId });

    expect(result).toMatchObject({ type: "paid" });
    if (!("paymentId" in result)) throw new Error("Expected paid checkout");
    expect(courseQuery.select).toHaveBeenCalledWith(
      "id, title, price, status, slug, removed_at",
    );
    expect(courseQuery.eq).toHaveBeenNthCalledWith(1, "id", courseId);
    expect(courseQuery.eq).toHaveBeenNthCalledWith(2, "status", "published");
    expect(courseQuery.is).toHaveBeenCalledWith("removed_at", null);
    expect(mockedPayosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelUrl: "https://vocaspace.example/courses/toeic-nen-tang",
        returnUrl: `https://vocaspace.example/payment/success?payment_id=${result.paymentId}`,
      }),
    );
  });

  it("ignores client slug-like redirect fields and uses only the stored course slug", async () => {
    setupHarness({ course: activeCourse({ slug: "trusted-course" }) });

    await createCheckoutSession({
      courseId,
      courseSlug: "attacker-course",
      slug: "stale-course",
      cancelUrl: "https://attacker.example/redirect",
    });

    expect(mockedPayosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelUrl: "https://vocaspace.example/courses/trusted-course",
      }),
    );
  });

  it.each([
    ["missing", null],
    ["unpublished", activeCourse({ status: "draft" })],
    [
      "published but soft-deleted",
      activeCourse({ removed_at: "2026-07-11T00:00:00.000Z" }),
    ],
    ["missing trusted slug", activeCourse({ slug: "" })],
    ["invalid trusted slug", activeCourse({ slug: "bad slug/path" })],
  ])("rejects an unavailable %s course before paid side effects", async (_, course) => {
    const { paymentQuery } = setupHarness({ course });

    await expect(createCheckoutSession({ courseId })).resolves.toEqual({
      error: "Khóa học không tồn tại hoặc chưa được mở bán.",
    });
    expect(mockedPayosCreate).not.toHaveBeenCalled();
    expect(mockedResolveDiscount).not.toHaveBeenCalled();
    expect(mockedReserveDiscount).not.toHaveBeenCalled();
    expect(paymentQuery.insert).not.toHaveBeenCalled();
  });

  it("keeps free enrollment outside PayOS", async () => {
    const { enrollmentQuery, paymentQuery } = setupHarness({
      course: activeCourse({ price: 0 }),
    });

    await expect(createCheckoutSession({ courseId })).resolves.toMatchObject({
      type: "free",
    });
    expect(enrollmentQuery.insert).toHaveBeenCalledOnce();
    expect(paymentQuery.insert).toHaveBeenCalledOnce();
    expect(mockedPayosCreate).not.toHaveBeenCalled();
  });

  it("reuses an active pending payment without creating another PayOS order", async () => {
    const { paymentQuery } = setupHarness({
      activePayment: {
        id: "33333333-3333-4333-8333-333333333333",
        status: "pending",
        gateway_order_id: "12344",
        gateway_metadata: {
          checkout_url: "https://pay.payos.vn/web/12344",
          qr_code: "existing-qr",
        },
        amount_final: 250000,
        amount_discount: 0,
        discount_id: null,
        expires_at: "2026-07-11T12:00:00.000Z",
      },
    });

    await expect(createCheckoutSession({ courseId })).resolves.toMatchObject({
      type: "paid",
      paymentId: "33333333-3333-4333-8333-333333333333",
    });
    expect(paymentQuery.insert).not.toHaveBeenCalled();
    expect(mockedResolveDiscount).not.toHaveBeenCalled();
    expect(mockedPayosCreate).not.toHaveBeenCalled();
  });

  it("marks a new payment failed and releases its reserved discount when PayOS fails", async () => {
    const { paymentQuery } = setupHarness();
    mockedResolveDiscount.mockResolvedValue({
      ok: true,
      originalAmount: 250000,
      discountAmount: 50000,
      finalAmount: 200000,
      discountId: "44444444-4444-4444-8444-444444444444",
      discountMeta: {
        id: "44444444-4444-4444-8444-444444444444",
        code: "SAVE20",
        type: "fixed",
        value: 50000,
        maxDiscountAmount: null,
      },
    });
    mockedPayosCreate.mockRejectedValue(new Error("gateway unavailable"));

    await expect(
      createCheckoutSession({ courseId, couponCode: "SAVE20" }),
    ).resolves.toEqual({
      error: "Cổng thanh toán PayOS gặp sự cố, vui lòng thử lại sau.",
    });
    expect(paymentQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(mockedReleaseDiscount).toHaveBeenCalledWith(
      expect.objectContaining({
        discountId: "44444444-4444-4444-8444-444444444444",
      }),
    );
  });
});
