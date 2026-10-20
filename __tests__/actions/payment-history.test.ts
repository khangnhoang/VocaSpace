import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPaymentHistory } from "@/app/actions/payment-history";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: ranh giới đọc lịch sử thanh toán FEAT6 (AC3-AC7, G1-G3).
// - Loại test: Server Action với Supabase boundary mock (chuỗi query được ghi lại để đối chiếu).
// - Đối tượng: getPaymentHistory.
// - Case thành công: map bộ lọc sang nhóm trạng thái; loại gateway free; range/count theo trang; thứ tự created_at, id giảm dần;
//   course null thành course null; trang vượt cuối (PGRST103) trả trang cuối thật; tổng 0 trả trang 1 rỗng.
// - Case thất bại: chưa đăng nhập, input sai (trang 0, bộ lọc lạ, trường thừa) không chạm DB; lỗi query khác PGRST103 vẫn là lỗi;
//   lỗi lạ khi đếm lại; output sai hợp đồng thành INVALID_DATA; ngoại lệ thành QUERY_FAILED.
// - Bảo mật/phân quyền: lọc tường minh user_id = người dùng đăng nhập; danh sách cột không có gateway_metadata, discount_id,
//   user_id; chỉ client session được tạo (không có đường service role trong action).
// - Ổn định/resilience: lỗi thô của Supabase không lọt ra kết quả.
// - Invariant cần giữ: học viên chỉ đọc được dòng của mình, mỗi trang tối đa 5 dòng và không bao giờ trả trang vượt tổng.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/actions/payment-history.test.ts`.
// - AC10/G7: tiêu đề khóa học bị ẩn chỉ được đọc qua hàm own-payment khi trang có dòng course rỗng, chỉ với id của các dòng đó;
//   lỗi của hàm không làm hỏng trang.
// - Owner QA round 2: isEnrolled lấy từ ghi danh của chính người gọi (session client, user_id tường minh) chỉ cho id khóa học của trang;
//   không có dòng course_id thì không gọi; lỗi đọc ghi danh không làm hỏng trang.
// - Ghi chú: RLS và trang vượt cuối thật của PostgREST được kiểm bằng __tests__/integration/feat6-payment-history.test.ts.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const rpcMock = vi.fn();
// Truy vấn ghi danh dùng chung cho mọi test; test nào cần dữ liệu thì thay bằng createQuery riêng.
let enrollmentsQuery: { calls: Call[] };

type Call = [method: string, ...args: unknown[]];

interface QueryResult {
  data?: unknown[];
  count?: number | null;
  error?: { code?: string; message: string } | null;
}

function createQuery(result: QueryResult) {
  const calls: Call[] = [];
  const query: Record<string, unknown> = { calls };
  for (const method of [
    "select",
    "eq",
    "neq",
    "in",
    "order",
    "range",
    "limit",
  ]) {
    query[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    });
  }
  query.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({
      data: result.data ?? [],
      count: result.count ?? null,
      error: result.error ?? null,
    }).then(resolve, reject);
  return query as { calls: Call[] };
}

function mockSupabase(
  queries: Array<{ calls: Call[] }>,
  user: unknown = { id: "user-one" },
) {
  const queue = [...queries];
  const from = vi.fn((table: string) =>
    table === "enrollments" ? enrollmentsQuery : queue.shift(),
  );
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from,
    rpc: rpcMock,
  } as never);
  return from;
}

const row = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `payment-${index}`,
  course_id: `course-id-${index}`,
  status: "paid",
  amount_original: 200000,
  amount_discount: 20000,
  amount_final: 180000,
  currency: "VND",
  gateway_order_id: `10000${index}`,
  created_at: "2026-10-01T08:00:00+00:00",
  expires_at: null,
  course: { slug: `course-${index}`, title: `Khóa ${index}` },
  ...overrides,
});

const callsOf = (query: { calls: Call[] }, method: string) =>
  query.calls.filter((call) => call[0] === method);

describe("getPaymentHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: [], error: null });
    enrollmentsQuery = createQuery({ data: [] });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("rejects an unauthenticated caller before reading payments", async () => {
    const from = mockSupabase([], null);

    await expect(getPaymentHistory({ page: 1, filter: "all" })).resolves.toEqual({
      success: false,
      errorCode: "AUTH_REQUIRED",
      error: "Vui lòng đăng nhập để xem lịch sử thanh toán.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["page zero", { page: 0, filter: "all" }],
    ["fractional page", { page: 1.5, filter: "all" }],
    ["unknown filter", { page: 1, filter: "free" }],
    ["client user_id", { page: 1, filter: "all", user_id: "other-user" }],
    ["no input", undefined],
  ])("returns INVALID_INPUT for %s without creating a client", async (_name, input) => {
    await expect(getPaymentHistory(input)).resolves.toMatchObject({
      success: false,
      errorCode: "INVALID_INPUT",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("reads only the caller's non-free rows, newest first, with an exact count and the page range", async () => {
    const query = createQuery({ data: [row(1)], count: 23 });
    mockSupabase([query], { id: "user-one" });

    const result = await getPaymentHistory({ page: 3, filter: "all" });

    expect(result).toEqual({
      success: true,
      data: {
        items: [
          {
            paymentId: "payment-1",
            status: "paid",
            amountOriginal: 200000,
            amountDiscount: 20000,
            amountFinal: 180000,
            currency: "VND",
            orderCode: "100001",
            createdAt: "2026-10-01T08:00:00+00:00",
            expiresAt: null,
            course: { slug: "course-1", title: "Khóa 1" },
            hiddenCourseTitle: null,
            isEnrolled: false,
          },
        ],
        total: 23,
        page: 3,
        pageSize: 5,
      },
    });
    expect(callsOf(query, "eq")).toEqual([["eq", "user_id", "user-one"]]);
    expect(callsOf(query, "neq")).toEqual([["neq", "gateway", "free"]]);
    expect(callsOf(query, "in")).toEqual([]);
    expect(callsOf(query, "order")).toEqual([
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ]);
    expect(callsOf(query, "range")).toEqual([["range", 10, 14]]);
    const [, columns, options] = callsOf(query, "select")[0];
    expect(options).toEqual({ count: "exact" });
    for (const forbidden of ["gateway_metadata", "discount_id", "user_id"]) {
      expect(columns as string).not.toContain(forbidden);
    }
  });

  it.each([
    ["paid", ["paid"]],
    ["pending", ["creating", "pending"]],
    ["other", ["cancelled", "expired", "failed"]],
  ] as const)("maps the %s filter to its status group", async (filter, statuses) => {
    const query = createQuery({ data: [], count: 0 });
    mockSupabase([query]);

    await getPaymentHistory({ page: 1, filter });

    expect(callsOf(query, "in")).toEqual([["in", "status", statuses]]);
  });

  it("filters by the signed-in session user", async () => {
    const query = createQuery({ data: [], count: 0 });
    mockSupabase([query], { id: "session-user" });

    await getPaymentHistory({ page: 1, filter: "all" });

    expect(callsOf(query, "eq")).toEqual([["eq", "user_id", "session-user"]]);
  });

  it("returns a null course when the course can no longer be read", async () => {
    const query = createQuery({ data: [row(1, { course: null })], count: 1 });
    mockSupabase([query]);

    const result = await getPaymentHistory({ page: 1, filter: "all" });

    expect(result).toMatchObject({
      success: true,
      data: { items: [{ paymentId: "payment-1", course: null }] },
    });
  });

  it("does not call the own-payment title function when every course on the page was readable", async () => {
    mockSupabase([createQuery({ data: [row(1), row(2)], count: 2 })]);

    const result = await getPaymentHistory({ page: 1, filter: "all" });

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      data: { items: [{ hiddenCourseTitle: null }, { hiddenCourseTitle: null }] },
    });
  });

  it("asks the function for only the ids whose course join was empty and shows the real title as hiddenCourseTitle", async () => {
    mockSupabase([
      createQuery({
        data: [row(1), row(2, { course: null }), row(3, { course: null })],
        count: 3,
      }),
    ]);
    rpcMock.mockResolvedValue({
      data: [{ payment_id: "payment-2", course_title: "Khóa đã ẩn" }],
      error: null,
    });

    const result = await getPaymentHistory({ page: 1, filter: "all" });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("get_own_payment_course_titles", {
      p_payment_ids: ["payment-2", "payment-3"],
    });
    expect(result).toMatchObject({
      success: true,
      data: {
        items: [
          { paymentId: "payment-1", course: { title: "Khóa 1" }, hiddenCourseTitle: null },
          { paymentId: "payment-2", course: null, hiddenCourseTitle: "Khóa đã ẩn" },
          // Hàm không trả tiêu đề (dòng course đã mất): giữ null để giao diện dùng chữ dự phòng.
          { paymentId: "payment-3", course: null, hiddenCourseTitle: null },
        ],
      },
    });
  });

  it("marks only the rows whose course the caller is enrolled in, reading the caller's own enrollments for this page's course ids", async () => {
    mockSupabase([
      createQuery({
        data: [row(1), row(2), row(3, { course: null }), row(4, { course_id: "course-id-1" })],
        count: 4,
      }),
    ]);
    enrollmentsQuery = createQuery({
      data: [{ course_id: "course-id-1" }, { course_id: "course-id-3" }],
    });

    const result = await getPaymentHistory({ page: 1, filter: "all" });

    expect(result).toMatchObject({
      success: true,
      data: {
        items: [
          { paymentId: "payment-1", isEnrolled: true },
          { paymentId: "payment-2", isEnrolled: false },
          // Khóa ẩn nhưng đã ghi danh vẫn được đánh dấu.
          { paymentId: "payment-3", isEnrolled: true },
          { paymentId: "payment-4", isEnrolled: true },
        ],
      },
    });
    expect(callsOf(enrollmentsQuery, "select")).toEqual([["select", "course_id"]]);
    expect(callsOf(enrollmentsQuery, "eq")).toEqual([["eq", "user_id", "user-one"]]);
    expect(callsOf(enrollmentsQuery, "in")).toEqual([
      ["in", "course_id", ["course-id-1", "course-id-2", "course-id-3"]],
    ]);
  });

  it("does not read enrollments for an empty page", async () => {
    const from = mockSupabase([createQuery({ data: [], count: 0 })]);

    await getPaymentHistory({ page: 1, filter: "all" });

    expect(from).not.toHaveBeenCalledWith("enrollments");
  });

  it("keeps the page, with every row not enrolled, when the enrollment read fails", async () => {
    mockSupabase([createQuery({ data: [row(1)], count: 1 })]);
    enrollmentsQuery = createQuery({ data: [], error: { code: "42501", message: "enrollment detail" } });

    const result = await getPaymentHistory({ page: 1, filter: "all" });

    expect(result).toMatchObject({ success: true, data: { items: [{ isEnrolled: false }] } });
    expect(JSON.stringify(result)).not.toContain("enrollment detail");
  });

  it("keeps the page when the title function fails, with the fallback for the hidden course", async () => {
    mockSupabase([createQuery({ data: [row(1, { course: null })], count: 1 })]);
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "denied detail" } });

    const result = await getPaymentHistory({ page: 1, filter: "all" });

    expect(result).toMatchObject({
      success: true,
      data: { items: [{ course: null, hiddenCourseTitle: null }] },
    });
    expect(JSON.stringify(result)).not.toContain("denied detail");
  });

  it("returns the last existing page when the requested page is past the end", async () => {
    const pastEnd = createQuery({
      error: { code: "PGRST103", message: "Requested range not satisfiable" },
    });
    const recount = createQuery({ data: [row(1)], count: 12 });
    const lastPage = createQuery({ data: [row(11), row(12)], count: 12 });
    mockSupabase([pastEnd, recount, lastPage]);

    const result = await getPaymentHistory({ page: 5, filter: "all" });

    expect(result).toMatchObject({
      success: true,
      data: { total: 12, page: 3, pageSize: 5 },
    });
    expect(callsOf(pastEnd, "range")).toEqual([["range", 20, 24]]);
    expect(callsOf(lastPage, "range")).toEqual([["range", 10, 14]]);
    if (result.success) expect(result.data.items).toHaveLength(2);
  });

  it("returns page 1 with no rows when a past-the-end page meets an empty total", async () => {
    const pastEnd = createQuery({ error: { code: "PGRST103", message: "x" } });
    const recount = createQuery({ data: [], count: 0 });
    mockSupabase([pastEnd, recount]);

    await expect(getPaymentHistory({ page: 2, filter: "paid" })).resolves.toEqual({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 5 },
    });
  });

  it("clamps to the last page when PostgREST answers 200 with no rows because the offset equals the total", async () => {
    // Tổng 5 là bội của cỡ trang: xin trang 2 có offset 5 = tổng, PostgREST không trả 416 mà trả danh sách rỗng.
    const emptyPage = createQuery({ data: [], count: 5 });
    const recount = createQuery({ data: [row(1)], count: 5 });
    const lastPage = createQuery({ data: [row(1), row(2), row(3), row(4), row(5)], count: 5 });
    mockSupabase([emptyPage, recount, lastPage]);

    const result = await getPaymentHistory({ page: 2, filter: "paid" });

    expect(result).toMatchObject({ success: true, data: { total: 5, page: 1, pageSize: 5 } });
    expect(callsOf(emptyPage, "range")).toEqual([["range", 5, 9]]);
    expect(callsOf(lastPage, "range")).toEqual([["range", 0, 4]]);
    if (result.success) expect(result.data.items).toHaveLength(5);
  });

  it("does not recount when page 1 is simply empty", async () => {
    const only = createQuery({ data: [], count: 0 });
    mockSupabase([only]);

    await expect(getPaymentHistory({ page: 1, filter: "all" })).resolves.toEqual({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 5 },
    });
  });

  it("keeps any other query error an error without leaking the raw message", async () => {
    mockSupabase([
      createQuery({ error: { code: "42501", message: "sensitive rls detail" } }),
    ]);

    const result = await getPaymentHistory({ page: 1, filter: "all" });

    expect(result).toEqual({
      success: false,
      errorCode: "QUERY_FAILED",
      error: "Không thể tải lịch sử thanh toán lúc này.",
    });
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("fails the read when the recount after a past-the-end page fails", async () => {
    mockSupabase([
      createQuery({ error: { code: "PGRST103", message: "x" } }),
      createQuery({ error: { code: "XX000", message: "count failed" } }),
    ]);

    await expect(getPaymentHistory({ page: 4, filter: "all" })).resolves.toMatchObject({
      success: false,
      errorCode: "QUERY_FAILED",
    });
  });

  it("reports INVALID_DATA when a row breaks the output contract", async () => {
    mockSupabase([
      createQuery({ data: [row(1, { status: "refunded" })], count: 1 }),
    ]);

    await expect(getPaymentHistory({ page: 1, filter: "all" })).resolves.toMatchObject({
      success: false,
      errorCode: "INVALID_DATA",
    });
  });

  it("turns an unexpected throw into QUERY_FAILED", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-one" } },
          error: null,
        }),
      },
      from: vi.fn(() => {
        throw new Error("network down");
      }),
    } as never);

    await expect(getPaymentHistory({ page: 1, filter: "all" })).resolves.toMatchObject({
      success: false,
      errorCode: "QUERY_FAILED",
    });
  });
});
