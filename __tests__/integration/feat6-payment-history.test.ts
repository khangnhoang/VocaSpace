import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPaymentHistory } from "@/app/actions/payment-history";

// Test plan:
// - Mục tiêu: FEAT6 CP1 - học viên đọc đúng lịch sử thanh toán của chính mình qua Server Action và RLS thật (AC3, AC4, AC5, AC7, G1-G3).
// - Loại: integration trên runtime E2E tách biệt (PostgREST + RLS + Auth); không mock database. Chỉ adapter session của Next.js
//   (`@/utils/supabase/server`) được thay bằng client đã đăng nhập của từng học viên.
// - Đối tượng: getPaymentHistory và bảng public.payments (chính sách "Users can view their own payments", quyền đọc bảng courses).
// - Thành công: học viên A chỉ thấy dòng của A; bản ghi gateway free bị loại khỏi danh sách lẫn tổng; bốn bộ lọc ra đúng nhóm trạng thái;
//   thứ tự created_at giảm dần, hòa thì id giảm dần; mỗi trang tối đa 5 dòng cùng tổng chính xác; khóa học không đọc được (nháp)
//   trả course null thay vì làm hỏng cả dòng, kèm tên thật của khóa đó qua hàm own-payment (AC10, G7).
// - Thất bại: chưa đăng nhập nhận AUTH_REQUIRED; trang vượt cuối (PostgREST 416/PGRST103 thật) trả trang cuối thật; tổng 0 trả trang 1 rỗng.
// - Bảo mật/phân quyền: hàm get_own_payment_course_titles chỉ trả tiêu đề cho payment của chính người gọi (A không lấy được tiêu đề qua id
//   payment của B và ngược lại), chỉ trả hai cột (payment_id, course_title), và anon không gọi được;
//   A không đọc được dòng của B qua action lẫn qua truy vấn trực tiếp bằng user_id của B; kết quả không chứa
//   gateway_metadata, discount_id, user_id hay dữ liệu cổng thanh toán (dò bằng mã đánh dấu trong gateway_metadata).
// - Ổn định/resilience: dòng chèn bằng service role chỉ để dựng dữ liệu; dọn sạch trong afterAll.
// - Invariant cần giữ: mỗi học viên chỉ thấy các giao dịch trả tiền của mình, đúng trang, đúng tổng, không lộ dữ liệu cổng.
// - Kết quả verify gần nhất: xem milestone FEAT6 CP1 trong progress.md.
// - Ghi chú: chạy bằng `ALLOW_DB_INTEGRATION_TESTS=true E2E_SUPABASE_WORKDIR=.e2e-runtime npm run test:integration -- __tests__/integration/feat6-payment-history.test.ts`
//   với API 45441 (biến môi trường lấy từ `npx supabase --workdir .e2e-runtime status -o env`).

const authenticated = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => authenticated.client,
}));

const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const runtimeUrl = new URL(api);
if (
  process.env.ALLOW_DB_INTEGRATION_TESTS !== "true" ||
  process.env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" ||
  runtimeUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(runtimeUrl.hostname) ||
  runtimeUrl.port !== "45441"
) {
  throw new Error("FEAT6 integration requires the explicitly enabled isolated E2E runtime on port 45441");
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const anonymous = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
const METADATA_MARKER = `feat6-gateway-secret-${randomUUID()}`;

type Status = "creating" | "pending" | "paid" | "failed" | "expired" | "cancelled";

const userIds: string[] = [];
const courseIds: string[] = [];
let learnerA: SupabaseClient;
let learnerB: SupabaseClient;
let learnerAId = "";
let learnerBId = "";
let learnerEmptyClient: SupabaseClient;
let publishedCourse = { id: "", slug: "", title: "" };
let activeCourseOne = { id: "", slug: "", title: "" };
let activeCourseTwo = { id: "", slug: "", title: "" };
let draftCourseId = "";
let draftCourseTitle = "";
let draftPaymentIdOfA = "";
let paymentIdOfB = "";
const expectedNonFree: Array<{ id: string; status: Status; createdAt: string }> = [];

async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const result = await service.from(table).insert(rows as never);
  if (result.error) throw new Error(`${table}: ${result.error.message}`);
}

async function createLearner(label: string) {
  const id = randomUUID();
  userIds.push(id);
  const email = `feat6-${label}-${id}@example.com`;
  const created = await service.auth.admin.createUser({ id, email, password: "123123", email_confirm: true });
  expect(created.error).toBeNull();
  const client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  const signedIn = await client.auth.signInWithPassword({ email, password: "123123" });
  if (signedIn.error) throw signedIn.error;
  return { id, client };
}

async function createCourse(published: boolean) {
  const id = randomUUID();
  courseIds.push(id);
  const course = { id, slug: `feat6-${id}`, title: `FEAT6 ${id.slice(0, 8)}` };
  await insert("courses", {
    ...course,
    price: 200000,
    status: published ? "published" : "draft",
  });
  return course;
}

function paymentRow(overrides: Record<string, unknown>) {
  const id = randomUUID();
  return {
    id,
    user_id: learnerAId,
    course_id: publishedCourse.id,
    amount_original: 200000,
    amount_discount: 0,
    amount_final: 200000,
    currency: "VND",
    status: "paid",
    gateway: "payos",
    gateway_order_id: `feat6-${id}`,
    gateway_metadata: { checkoutUrl: METADATA_MARKER },
    created_at: "2026-09-01T08:00:00+00:00",
    ...overrides,
  };
}

describe.sequential("FEAT6 payment history", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    const a = await createLearner("a");
    const b = await createLearner("b");
    const empty = await createLearner("empty");
    learnerAId = a.id;
    learnerBId = b.id;
    learnerA = a.client;
    learnerB = b.client;
    learnerEmptyClient = empty.client;

    publishedCourse = await createCourse(true);
    activeCourseOne = await createCourse(true);
    activeCourseTwo = await createCourse(true);
    const draftCourse = await createCourse(false);
    draftCourseId = draftCourse.id;
    draftCourseTitle = draftCourse.title;

    // 12 dòng trả tiền của A: paid 5 (một dòng trên khóa nháp), pending-group 2, other 5; cộng một dòng free bị loại.
    const dated = (minute: number) => `2026-09-01T08:${String(minute).padStart(2, "0")}:00+00:00`;
    const rowsOfA = [
      paymentRow({ status: "paid", created_at: dated(1), amount_discount: 20000, amount_final: 180000 }),
      paymentRow({ status: "paid", created_at: dated(2) }),
      // Hai dòng cùng created_at để kiểm tra hòa thì id giảm dần quyết định thứ tự.
      paymentRow({ status: "paid", created_at: dated(3) }),
      paymentRow({ status: "paid", created_at: dated(3) }),
      paymentRow({ status: "paid", created_at: dated(4), course_id: draftCourseId }),
      paymentRow({ status: "cancelled", created_at: dated(5) }),
      paymentRow({ status: "cancelled", created_at: dated(6) }),
      paymentRow({ status: "expired", created_at: dated(7) }),
      paymentRow({ status: "expired", created_at: dated(8) }),
      paymentRow({ status: "failed", created_at: dated(9) }),
      paymentRow({
        status: "pending",
        created_at: dated(10),
        course_id: activeCourseOne.id,
        expires_at: "2099-01-01T00:00:00+00:00",
      }),
      paymentRow({
        status: "creating",
        created_at: dated(11),
        course_id: activeCourseTwo.id,
        expires_at: null,
      }),
    ];
    const freeRow = paymentRow({
      status: "paid",
      gateway: "free",
      amount_original: 0,
      amount_final: 0,
      created_at: dated(12),
    });
    const rowsOfB = [
      paymentRow({ user_id: learnerBId, status: "paid", created_at: dated(13) }),
      paymentRow({ user_id: learnerBId, status: "failed", created_at: dated(14) }),
    ];
    await insert("payments", [...rowsOfA, freeRow, ...rowsOfB]);
    draftPaymentIdOfA = rowsOfA.find((row) => row.course_id === draftCourseId)!.id as string;
    paymentIdOfB = rowsOfB[0].id as string;
    for (const row of rowsOfA) {
      expectedNonFree.push({
        id: row.id as string,
        status: row.status as Status,
        createdAt: row.created_at as string,
      });
    }
  });

  afterAll(async () => {
    await service.from("payments").delete().in("user_id", userIds);
    await service.from("courses").delete().in("id", courseIds);
    for (const id of userIds.splice(0)) await service.auth.admin.deleteUser(id);
    await Promise.all([learnerA, learnerB, learnerEmptyClient].map((client) => client?.auth.signOut()));
  });

  const idsNewestFirst = (statuses?: Status[]) =>
    expectedNonFree
      .filter((row) => !statuses || statuses.includes(row.status))
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          (right.id > left.id ? 1 : -1),
      )
      .map((row) => row.id);

  it("lets learner A read only A's paid transactions, newest first, without free enrolments", async () => {
    authenticated.client = learnerA;

    const first = await getPaymentHistory({ page: 1, filter: "all" });
    const second = await getPaymentHistory({ page: 2, filter: "all" });
    const third = await getPaymentHistory({ page: 3, filter: "all" });

    expect(first.success && second.success && third.success).toBe(true);
    if (!first.success || !second.success || !third.success) return;
    expect(first.data.total).toBe(12);
    expect(first.data.items).toHaveLength(5);
    expect(second.data.items).toHaveLength(5);
    expect(third.data.items).toHaveLength(2);
    expect(third.data.page).toBe(3);
    expect(
      [...first.data.items, ...second.data.items, ...third.data.items].map((item) => item.paymentId),
    ).toEqual(idsNewestFirst());
  });

  it("never returns learner B's rows to A and keeps B's own rows for B", async () => {
    authenticated.client = learnerA;
    const asA = await getPaymentHistory({ page: 1, filter: "all" });
    authenticated.client = learnerB;
    const asB = await getPaymentHistory({ page: 1, filter: "all" });

    expect(asB.success).toBe(true);
    if (!asA.success || !asB.success) return;
    expect(asB.data.total).toBe(2);
    const idsOfA = new Set(asA.data.items.map((item) => item.paymentId));
    for (const item of asB.data.items) expect(idsOfA.has(item.paymentId)).toBe(false);
    expect(asB.data.items.map((item) => item.status).sort()).toEqual(["failed", "paid"]);
  });

  it("denies A a direct read of B's payments through the Data API as well (RLS, not only the action filter)", async () => {
    const direct = await learnerA.from("payments").select("id").eq("user_id", learnerBId);

    expect(direct.error).toBeNull();
    expect(direct.data).toEqual([]);
  });

  it("excludes the free enrolment from the list and from every total", async () => {
    authenticated.client = learnerA;
    const everything = [
      await getPaymentHistory({ page: 1, filter: "all" }),
      await getPaymentHistory({ page: 1, filter: "paid" }),
      await getPaymentHistory({ page: 1, filter: "pending" }),
      await getPaymentHistory({ page: 1, filter: "other" }),
    ];

    const gateways = await service.from("payments").select("id").eq("user_id", learnerAId).eq("gateway", "free");
    const freeId = gateways.data?.[0]?.id as string;
    expect(freeId).toBeTruthy();
    for (const result of everything) {
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items.map((item) => item.paymentId)).not.toContain(freeId);
      }
    }
  });

  it.each([
    ["paid", ["paid"], 5],
    ["pending", ["creating", "pending"], 2],
    ["other", ["cancelled", "expired", "failed"], 5],
  ] as const)("returns exactly the %s status group with its own total", async (filter, statuses, total) => {
    authenticated.client = learnerA;

    const result = await getPaymentHistory({ page: 1, filter });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBe(total);
    for (const item of result.data.items) expect(statuses).toContain(item.status);
    expect(result.data.items.map((item) => item.paymentId)).toEqual(
      idsNewestFirst([...statuses]),
    );
  });

  it("returns a null course for a course the learner cannot read, and the course for a readable one", async () => {
    authenticated.client = learnerA;

    const result = await getPaymentHistory({ page: 1, filter: "paid" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const nullCourse = result.data.items.filter((item) => item.course === null);
    expect(nullCourse).toHaveLength(1);
    // AC10: khóa nháp không đọc được nhưng học viên vẫn thấy tên khóa mình đã trả tiền; khóa đọc được không cần hàm.
    expect(nullCourse[0].hiddenCourseTitle).toBe(draftCourseTitle);
    for (const item of result.data.items.filter((entry) => entry.course !== null)) {
      expect(item.hiddenCourseTitle).toBeNull();
    }
    const readable = result.data.items.find((item) => item.course !== null);
    expect(readable?.course).toEqual({ slug: publishedCourse.slug, title: publishedCourse.title });
  });

  it("returns the title of the caller's own hidden-course payment and only the two documented columns", async () => {
    const result = await learnerA.rpc("get_own_payment_course_titles", {
      p_payment_ids: [draftPaymentIdOfA],
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ payment_id: draftPaymentIdOfA, course_title: draftCourseTitle }]);
  });

  it("returns nothing for another learner's payment id, in both directions", async () => {
    const aAsksForB = await learnerA.rpc("get_own_payment_course_titles", { p_payment_ids: [paymentIdOfB] });
    const bAsksForA = await learnerB.rpc("get_own_payment_course_titles", { p_payment_ids: [draftPaymentIdOfA] });
    const mixed = await learnerA.rpc("get_own_payment_course_titles", {
      p_payment_ids: [paymentIdOfB, draftPaymentIdOfA],
    });

    expect(aAsksForB.error).toBeNull();
    expect(aAsksForB.data).toEqual([]);
    expect(bAsksForA.error).toBeNull();
    expect(bAsksForA.data).toEqual([]);
    // Id lẫn của người khác không làm lộ gì ngoài dòng của chính người gọi.
    expect(mixed.data).toEqual([{ payment_id: draftPaymentIdOfA, course_title: draftCourseTitle }]);
  });

  it("returns nothing for unknown ids and for an empty list", async () => {
    const unknown = await learnerA.rpc("get_own_payment_course_titles", { p_payment_ids: [randomUUID()] });
    const empty = await learnerA.rpc("get_own_payment_course_titles", { p_payment_ids: [] });

    expect(unknown.data).toEqual([]);
    expect(empty.data).toEqual([]);
  });

  it("refuses the title function to anon", async () => {
    const result = await anonymous.rpc("get_own_payment_course_titles", { p_payment_ids: [draftPaymentIdOfA] });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("42501");
  });

  it("carries discount amounts and the order code and keeps gateway data out of the result", async () => {
    authenticated.client = learnerA;

    // Dòng giảm giá là dòng cũ nhất nên nằm ở trang cuối (trang 3).
    const result = await getPaymentHistory({ page: 3, filter: "all" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const discounted = result.data.items.find((item) => item.amountDiscount > 0);
    expect(discounted).toMatchObject({ amountOriginal: 200000, amountDiscount: 20000, amountFinal: 180000 });
    expect(discounted?.orderCode).toMatch(/^feat6-/);
    const serialized = JSON.stringify(result);
    for (const forbidden of ["gateway_metadata", "gatewayMetadata", "discount_id", "user_id", METADATA_MARKER]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).not.toContain(learnerAId);
  });

  it("returns the last existing page when the requested page is past the end", async () => {
    authenticated.client = learnerA;

    const result = await getPaymentHistory({ page: 7, filter: "all" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.page).toBe(3);
    expect(result.data.total).toBe(12);
    expect(result.data.items).toHaveLength(2);
  });

  it("returns page 1 with no rows when a past-the-end page meets an empty total", async () => {
    authenticated.client = learnerEmptyClient;

    await expect(getPaymentHistory({ page: 3, filter: "paid" })).resolves.toEqual({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 5 },
    });
  });

  it("returns page 1, not an error, when everything fits on one page and a later page is asked", async () => {
    authenticated.client = learnerA;

    const result = await getPaymentHistory({ page: 2, filter: "paid" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBe(5);
    expect(result.data.page).toBe(1);
    expect(result.data.items).toHaveLength(5);
  });

  it("rejects a caller without a session", async () => {
    authenticated.client = anonymous;

    await expect(getPaymentHistory({ page: 1, filter: "all" })).resolves.toMatchObject({
      success: false,
      errorCode: "AUTH_REQUIRED",
    });
  });
});
