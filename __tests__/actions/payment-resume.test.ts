import { beforeEach, describe, expect, it, vi } from "vitest";
import { resumePendingCheckout } from "@/app/actions/payment";
import { createClient } from "@/utils/supabase/server";
import { payosService } from "@/services/payos";

// Test plan:
// - Mục tiêu: resumePendingCheckout (FEAT6 AC11/G8) chỉ mở lại QR của khoản pending còn hạn của chính người gọi, và không bao giờ ghi hay gọi PayOS.
// - Loại test: Server Action; Supabase được thay bằng một bảng dữ liệu trong bộ nhớ áp dụng thật các bộ lọc eq/match/is/gt để điều kiện đủ hạn được kiểm chứng qua kết quả, không qua tên hàm đã gọi.
// - Đối tượng: resumePendingCheckout.
// - Case thành công: khoản pending của chính mình còn hạn trả đúng phản hồi checkout (QR, số tiền, mã đơn, hạn) và paymentId.
// - Case thất bại: chưa đăng nhập; khoản của học viên khác; khóa học nháp/đã gỡ/không tồn tại; đã ghi danh; chỉ có khoản creating;
//   expires_at đã qua hoặc null; lỗi đọc ở từng bước; input sai; metadata không dựng được QR.
// - Bảo mật/phân quyền: mọi trường hợp trên đều trả "none"; không dòng nào bị insert/update/delete; PayOS không được gọi.
// - Ổn định/resilience: lỗi đọc và ngoại lệ không ném ra ngoài.
// - Invariant cần giữ: hành động không có tác dụng phụ.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/actions/payment-resume.test.ts`.

const mocks = vi.hoisted(() => ({ adminFrom: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mocks.adminFrom })),
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/services/payos", () => ({
  payosService: { paymentRequests: { create: vi.fn() } },
}));
vi.mock("@/lib/discounts/discount-pricing", () => ({
  toNumber: (value: unknown) => Number(value),
  resolveDiscountPricing: vi.fn(),
  reserveDiscountUsage: vi.fn(),
  releaseReservedDiscount: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "99999999-9999-4999-8999-999999999999";
const courseId = "22222222-2222-4222-8222-222222222222";
const FUTURE = "2099-01-01T00:00:00+00:00";
const PAST = "2020-01-01T00:00:00+00:00";

type Row = Record<string, unknown>;
type Tables = { courses: Row[]; enrollments: Row[]; payments: Row[] };

const writes: string[] = [];
let readErrorTable: string | null = null;

// Bảng trong bộ nhớ: áp dụng thật các bộ lọc để "expires_at > now", "status = pending" hay "user_id = mình" có hiệu lực.
function installTables(tables: Tables) {
  mocks.adminFrom.mockImplementation((table: keyof Tables) => {
    const filters: Array<(row: Row) => boolean> = [];
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return chain;
      },
      is: (column: string, value: unknown) => {
        filters.push((row) => (row[column] ?? null) === value);
        return chain;
      },
      match: (criteria: Row) => {
        for (const [column, value] of Object.entries(criteria)) {
          filters.push((row) => row[column] === value);
        }
        return chain;
      },
      gt: (column: string, value: string) => {
        filters.push((row) => {
          const cell = row[column];
          return typeof cell === "string" && Date.parse(cell) > Date.parse(value);
        });
        return chain;
      },
      insert: () => {
        writes.push(`${table}.insert`);
        return chain;
      },
      update: () => {
        writes.push(`${table}.update`);
        return chain;
      },
      delete: () => {
        writes.push(`${table}.delete`);
        return chain;
      },
      maybeSingle: async () => {
        if (readErrorTable === table) {
          return { data: null, error: { message: "boom" } };
        }
        const found = tables[table].find((row) => filters.every((f) => f(row)));
        return { data: found ?? null, error: null };
      },
    };
    return chain;
  });
}

function signedInAs(id: string | null) {
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue(
        id
          ? { data: { user: { id } }, error: null }
          : { data: { user: null }, error: { message: "no session" } },
      ),
    },
  } as never);
}

function pendingPayment(overrides: Row = {}): Row {
  return {
    id: "payment-1",
    user_id: userId,
    course_id: courseId,
    status: "pending",
    gateway_order_id: "100001",
    gateway_metadata: { qr_code: "QR-PAYLOAD", checkout_url: "https://example.invalid/pay" },
    amount_final: 250000,
    expires_at: FUTURE,
    ...overrides,
  };
}

function tables(overrides: Partial<Tables> = {}): Tables {
  return {
    courses: [{ id: courseId, status: "published", removed_at: null }],
    enrollments: [],
    payments: [pendingPayment()],
    ...overrides,
  };
}

describe("resumePendingCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.length = 0;
    readErrorTable = null;
    signedInAs(userId);
    installTables(tables());
  });

  function expectNoSideEffects() {
    expect(writes).toEqual([]);
    expect(payosService.paymentRequests.create).not.toHaveBeenCalled();
  }

  it("returns the checkout response of the learner's own pending payment that has not expired", async () => {
    const result = await resumePendingCheckout({ courseId });

    expect(result).toEqual({
      status: "resume",
      paymentId: "payment-1",
      data: {
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent("QR-PAYLOAD")}`,
        amount: 250000,
        orderId: "100001",
        bankMessage: "VOCASPACE 100001",
        accountNumber: "Quét mã QR tại cổng PayOS để hiển thị số tài khoản",
        // DB trả "+00:00"; phản hồi checkout dùng dạng "Z" như schema yêu cầu.
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    });
    expectNoSideEffects();
  });

  it("falls back to the checkout URL when the payment has no QR payload, like the existing resume branch", async () => {
    installTables(
      tables({
        payments: [pendingPayment({ gateway_metadata: { checkout_url: "https://example.invalid/pay" } })],
      }),
    );

    const result = await resumePendingCheckout({ courseId });

    expect(result).toMatchObject({
      status: "resume",
      data: { qrCodeUrl: "https://example.invalid/pay" },
    });
    expectNoSideEffects();
  });

  it("returns none for a signed-out visitor without reading any table", async () => {
    signedInAs(null);

    expect(await resumePendingCheckout({ courseId })).toEqual({
      status: "none",
      reason: "unauthenticated",
    });
    expect(mocks.adminFrom).not.toHaveBeenCalled();
    expectNoSideEffects();
  });

  it.each([
    ["no payment at all", { payments: [] }],
    ["only a payment of another learner", { payments: [pendingPayment({ user_id: otherUserId })] }],
    ["a creating payment only", { payments: [pendingPayment({ status: "creating", gateway_metadata: null })] }],
    ["an expired deadline", { payments: [pendingPayment({ expires_at: PAST })] }],
    ["a missing deadline", { payments: [pendingPayment({ expires_at: null })] }],
    ["a paid payment", { payments: [pendingPayment({ status: "paid" })] }],
    ["a payment for another course", { payments: [pendingPayment({ course_id: "other-course" })] }],
    ["a draft course", { courses: [{ id: courseId, status: "draft", removed_at: null }] }],
    ["a removed course", { courses: [{ id: courseId, status: "published", removed_at: PAST }] }],
    ["a missing course", { courses: [] }],
    ["an enrolled learner", { enrollments: [{ user_id: userId, course_id: courseId }] }],
  ] as Array<[string, Partial<Tables>]>)(
    "returns none with no QR and no write for %s",
    async (_label, override) => {
      installTables(tables(override));

      expect(await resumePendingCheckout({ courseId })).toEqual({
        status: "none",
        reason: "unavailable",
      });
      expectNoSideEffects();
    },
  );

  it("keeps another learner's enrollment from blocking this learner", async () => {
    installTables(
      tables({ enrollments: [{ user_id: otherUserId, course_id: courseId }] }),
    );

    expect(await resumePendingCheckout({ courseId })).toMatchObject({ status: "resume" });
  });

  it.each(["courses", "enrollments", "payments"])(
    "returns none when reading %s fails",
    async (table) => {
      readErrorTable = table;

      expect(await resumePendingCheckout({ courseId })).toEqual({
        status: "none",
        reason: "unavailable",
      });
      expectNoSideEffects();
    },
  );

  it("returns none when the stored payment data cannot build a checkout response", async () => {
    installTables(tables({ payments: [pendingPayment({ gateway_metadata: null })] }));

    expect(await resumePendingCheckout({ courseId })).toEqual({
      status: "none",
      reason: "unavailable",
    });
    expectNoSideEffects();
  });

  it.each([undefined, null, {}, { courseId: "" }, { courseId, extra: "x" }])(
    "returns none for invalid input %j without reading any table",
    async (input) => {
      expect(await resumePendingCheckout(input)).toEqual({
        status: "none",
        reason: "unavailable",
      });
      expect(mocks.adminFrom).not.toHaveBeenCalled();
    },
  );
});
