import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { runLocalPsql } from "./helpers/local-psql";

// Test plan:
// - Mục tiêu: kiểm tra RPC `admin_dashboard_summary()` (AD4 AC2-AC4, AC6, AC7, AC9, AC10; G1, G2, G4, G5) tính đúng số liệu /admin trong database.
// - Loại test: integration/RPC/RLS trên PostgreSQL local thật; service role chỉ dựng fixture và đọc đối chiếu, mọi lời gọi RPC dùng phiên đăng nhập thật.
// - Đối tượng: `public.admin_dashboard_summary()` (SECURITY INVOKER) và các quyền EXECUTE của nó.
// - Case thành công:
//   - admin đang hoạt động nhận đủ khối pending, users, published_courses, flashcards, revenue (sáu tháng, tổng bằng tổng các tháng), top_courses.
//   - đơn paid VND được xếp theo tháng lịch Asia/Ho_Chi_Minh của created_at: giây cuối tháng trước, giây đầu và giây cuối tháng này, tháng cũ nhất của cửa sổ;
//     đơn ngay trước cửa sổ và ngay sau tháng này bị loại; updated_at khác tháng không làm đơn đổi tháng; tháng không có đơn là 0.
//   - chỉ paid + VND được tính: pending, creating, failed, expired, cancelled và paid USD không đổi doanh thu; đơn paid 0 đồng vô hại.
//   - hơn 1000 hàng (1001 học viên, 1001 lượt ghi danh mỗi khóa, 1001 đơn paid) vẫn đếm và cộng đủ, không dừng ở max_rows.
//   - top khóa học: xếp theo số ghi danh giảm dần, hòa thì theo tên (khóa chèn sau nhưng tên đứng trước xếp trước), khóa đã gỡ không vào top,
//     ghi danh của học viên đã bị gỡ vẫn được đếm, doanh thu mỗi khóa chỉ gồm paid VND.
//   - pending: đếm khóa pending chưa gỡ và lấy submitted_at sớm nhất, bỏ khóa pending đã gỡ; trạng thái không có pending trả 0 và null.
//   - số liệu khớp đọc lại bằng service role theo cùng định nghĩa (không so số tuyệt đối vì DB dùng chung với suite khác).
// - Case thất bại:
//   - anon, học viên, giáo viên, admin đã bị gỡ nhưng còn phiên hợp lệ và cả service role nhận lỗi 42501 và không có dữ liệu.
// - Bảo mật/phân quyền:
//   - EXECUTE chỉ còn cho authenticated; hàm là SECURITY INVOKER với search_path cố định; kiểm tra is_admin() chạy trước mọi lần đọc bảng.
// - Ổn định/resilience: fixture gắn token ngẫu nhiên và tiền tố `ad4-`; dọn ở beforeAll/afterAll nên lần chạy hỏng trước không để lại dữ liệu;
//   trạng thái "không có đơn / không có pending" dựng trong một transaction rồi ROLLBACK nên không đổi dữ liệu thật.
// - Invariant cần giữ: tổng doanh thu bằng tổng sáu cột tháng; cột tháng và tổng dùng chung một mốc thời gian; RPC không ghi dữ liệu.
// - Kết quả verify gần nhất: passed (16 test) bằng `npm run test:integration -- __tests__/integration/ad4-admin-dashboard-summary.test.ts` trên runtime E2E cô lập, API 45441.
// - Ghi chú: thứ tự hòa theo tên chỉ kiểm bằng tên ASCII do suite dựng; các khóa seed hòa nhau được so theo số đếm và doanh thu, không theo collation.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEEDED_PASSWORD = "123123";
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const GATEWAY = "ad4-test";

const SEEDED = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
} as const;

interface RpcSummary {
  generated_at: string;
  pending: { count: number; oldest_submitted_at: string | null };
  users: { students: number; teachers: number; admins: number };
  published_courses: number;
  flashcards: number;
  revenue: { total: number; months: { month: string; revenue: number }[] };
  top_courses: { id: string; title: string; enrollment_count: number; revenue: number }[];
}

type ItemStatus = "draft" | "pending" | "published";

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const createdUserIds = new Set<string>();

function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string, password: string) {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
}

// Dọn mọi fixture theo tiền tố: chạy cả trước khi bắt đầu để lần chạy hỏng trước không để lại dữ liệu.
function purgeFixtures() {
  runLocalPsql(`
    delete from public.payments where gateway = '${GATEWAY}';
    delete from public.enrollments where course_id in (select id from public.courses where slug like 'ad4-dash-%');
    delete from public.courses where slug like 'ad4-dash-%';
    delete from auth.users where email like 'ad4-bulk-%@example.test' or email like 'ad4-dash-%@example.test';
  `);
}

// Phiên của admin đã bị gỡ vẫn còn hạn: đăng nhập trước rồi mới đặt removed_at.
async function createRemovedAdminSession() {
  const email = `ad4-dash-${randomUUID()}@example.test`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { d7_server_created: true },
  });
  if (error || !data.user) throw new Error(`User fixture failed: ${error?.message}`);
  createdUserIds.add(data.user.id);
  const promoted = await service.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  if (promoted.error) throw new Error(`Profile fixture failed: ${promoted.error.message}`);
  const client = await signIn(email, password);
  const removed = await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", data.user.id);
  if (removed.error) throw new Error(`Profile removal fixture failed: ${removed.error.message}`);
  return client;
}

async function summaryOf(client: SupabaseClient): Promise<RpcSummary> {
  const { data, error } = await client.rpc("admin_dashboard_summary");
  if (error) throw new Error(`admin_dashboard_summary failed: ${error.code} ${error.message}`);
  const summary = data as RpcSummary;
  const monthsTotal = summary.revenue.months.reduce((sum, month) => sum + month.revenue, 0);
  expect(summary.revenue.total).toBe(monthsTotal);
  return summary;
}

// Lịch tháng Việt Nam tính độc lập với SQL: UTC+7, không có giờ mùa hè.
function vnMonthStart(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1) - VN_OFFSET_MS);
}

function currentVnMonth(generatedAt: string) {
  const shifted = new Date(Date.parse(generatedAt) + VN_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), monthIndex: shifted.getUTCMonth() };
}

function monthLabel(year: number, monthIndex: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function expectedLabels(generatedAt: string) {
  const { year, monthIndex } = currentVnMonth(generatedAt);
  return [5, 4, 3, 2, 1, 0].map((back) => monthLabel(year, monthIndex - back));
}

function monthAmounts(summary: RpcSummary) {
  return summary.revenue.months.map((month) => month.revenue);
}

function diff(after: number[], before: number[]) {
  return after.map((value, index) => value - before[index]);
}

async function createCourse(title: string, status: ItemStatus = "published", extra: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from("courses")
    .insert({
      title,
      slug: `ad4-dash-${randomUUID()}`,
      description: "AD4 admin dashboard summary integration fixture",
      status,
      price: 0,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Course fixture failed: ${error?.message}`);
  return data.id as string;
}

interface PaymentSpec {
  courseId: string;
  amount: number;
  createdAt?: Date;
  // updated_at đổi khi học viên bị xóa (trigger), nên doanh thu không được bám cột này.
  updatedAt?: Date;
  status?: "creating" | "pending" | "paid" | "failed" | "expired" | "cancelled";
  currency?: string;
  userId?: string | null;
}

async function insertPayments(specs: PaymentSpec[]) {
  const rows = specs.map((spec) => ({
    user_id: spec.userId ?? null,
    course_id: spec.courseId,
    amount_original: spec.amount,
    amount_discount: 0,
    amount_final: spec.amount,
    currency: spec.currency ?? "VND",
    status: spec.status ?? "paid",
    gateway: GATEWAY,
    gateway_order_id: `ad4-${randomUUID()}`,
    ...(spec.createdAt
      ? { created_at: spec.createdAt.toISOString(), updated_at: (spec.updatedAt ?? spec.createdAt).toISOString() }
      : {}),
  }));
  for (let from = 0; from < rows.length; from += 500) {
    const { error } = await service.from("payments").insert(rows.slice(from, from + 500));
    if (error) throw new Error(`Payment fixture failed: ${error.message}`);
  }
}

async function pagedRows<Row>(table: string, columns: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service.from(table).select(columns).order("id").range(from, from + 999);
    if (error) throw new Error(`Readback of ${table} failed: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return rows;
  }
}

function exactCount(result: { count: number | null; error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`Count readback of ${what} failed: ${result.error.message}`);
  return result.count ?? 0;
}

async function countProfiles(role: "student" | "teacher" | "admin") {
  return exactCount(
    await service.from("profiles").select("*", { count: "exact", head: true }).eq("role", role).is("removed_at", null),
    `${role} profiles`,
  );
}

async function countPublishedCourses() {
  return exactCount(
    await service.from("courses").select("*", { count: "exact", head: true }).eq("status", "published").is("removed_at", null),
    "published courses",
  );
}

async function countFlashcards() {
  return exactCount(await service.from("user_flashcards").select("*", { count: "exact", head: true }), "user_flashcards");
}

async function countEnrollments(courseId: string) {
  return exactCount(
    await service.from("enrollments").select("*", { count: "exact", head: true }).eq("course_id", courseId),
    "enrollments",
  );
}

// Đọc lại bằng service role theo đúng định nghĩa AC2-AC7 rồi so với RPC, không dùng số tuyệt đối.
async function expectReconciles(summary: RpcSummary) {
  const labels = expectedLabels(summary.generated_at);
  expect(summary.revenue.months.map((month) => month.month)).toEqual(labels);

  expect(summary.users).toEqual({
    students: await countProfiles("student"),
    teachers: await countProfiles("teacher"),
    admins: await countProfiles("admin"),
  });
  expect(summary.published_courses).toBe(await countPublishedCourses());
  expect(summary.flashcards).toBe(await countFlashcards());

  const courseRows = await pagedRows<{ status: string; removed_at: string | null; submitted_at: string | null }>(
    "courses",
    "status, removed_at, submitted_at",
  );
  const pendingRows = courseRows.filter((row) => row.status === "pending" && row.removed_at === null);
  const submitted = pendingRows.flatMap((row) => (row.submitted_at ? [Date.parse(row.submitted_at)] : []));
  expect(summary.pending.count).toBe(pendingRows.length);
  expect(summary.pending.oldest_submitted_at === null ? null : Date.parse(summary.pending.oldest_submitted_at)).toBe(
    submitted.length > 0 ? Math.min(...submitted) : null,
  );

  const payments = await pagedRows<{ course_id: string; amount_final: number; currency: string; status: string; created_at: string }>(
    "payments",
    "course_id, amount_final, currency, status, created_at",
  );
  const counted = payments.filter((row) => row.status === "paid" && row.currency === "VND");
  const { year, monthIndex } = currentVnMonth(summary.generated_at);
  const expectedMonths = [5, 4, 3, 2, 1, 0].map((back) => {
    const start = vnMonthStart(year, monthIndex - back).getTime();
    const end = vnMonthStart(year, monthIndex - back + 1).getTime();
    return counted
      .filter((row) => Date.parse(row.created_at) >= start && Date.parse(row.created_at) < end)
      .reduce((sum, row) => sum + Number(row.amount_final), 0);
  });
  expect(monthAmounts(summary)).toEqual(expectedMonths);

  const courses = (await pagedRows<{ id: string; title: string; removed_at: string | null }>("courses", "id, title, removed_at")).filter(
    (row) => row.removed_at === null,
  );
  const enrollmentCounts = new Map<string, number>();
  for (const course of courses) {
    enrollmentCounts.set(course.id, await countEnrollments(course.id));
  }
  const revenueByCourse = new Map<string, number>();
  for (const row of counted) revenueByCourse.set(row.course_id, (revenueByCourse.get(row.course_id) ?? 0) + Number(row.amount_final));

  // Thứ tự khi hòa theo collation của database nên chỉ so tập số đếm; từng hàng phải khớp số đếm và doanh thu của chính khóa đó.
  const expectedCounts = [...enrollmentCounts.values()].sort((a, b) => b - a).slice(0, 5);
  expect(summary.top_courses.map((row) => row.enrollment_count)).toEqual(expectedCounts);
  for (const row of summary.top_courses) {
    expect(enrollmentCounts.has(row.id)).toBe(true);
    expect(row.enrollment_count).toBe(enrollmentCounts.get(row.id));
    expect(row.revenue).toBe(revenueByCourse.get(row.id) ?? 0);
  }
}

let admin: SupabaseClient;
let teacher: SupabaseClient;
let student: SupabaseClient;
let removedAdmin: SupabaseClient;

beforeAll(async () => {
  assertSafeEnvironment();
  purgeFixtures();
  admin = await signIn(SEEDED.admin.email, SEEDED_PASSWORD);
  teacher = await signIn(SEEDED.teacher.email, SEEDED_PASSWORD);
  student = await signIn(SEEDED.student.email, SEEDED_PASSWORD);
  removedAdmin = await createRemovedAdminSession();
}, 60_000);

afterAll(async () => {
  purgeFixtures();
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error && error.code !== "user_not_found") throw new Error(`User fixture cleanup failed: ${error.message}`);
  }
});

describe("AD4 admin_dashboard_summary access", () => {
  it.each([
    ["a signed-out visitor", () => newClient()],
    ["a student", () => student],
    ["a teacher", () => teacher],
    ["a removed admin whose session is still valid", () => removedAdmin],
    ["the service role (EXECUTE revoked)", () => service],
  ])("refuses %s with 42501 and returns no data", async (_label, pick) => {
    const { data, error } = await pick().rpc("admin_dashboard_summary");
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("keeps the removed admin's session valid so the refusal comes from the role check, not an expired token", async () => {
    const { data, error } = await removedAdmin.auth.getUser();
    expect(error).toBeNull();
    expect(data.user).not.toBeNull();
  });

  it("is SECURITY INVOKER with a fixed search_path and EXECUTE only for authenticated", () => {
    const row = runLocalPsql(`
      select p.prosecdef::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
        || has_function_privilege('anon', p.oid, 'execute')::text || '|'
        || has_function_privilege('authenticated', p.oid, 'execute')::text || '|'
        || has_function_privilege('service_role', p.oid, 'execute')::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'admin_dashboard_summary';
    `);
    expect(row).toBe("false|search_path=public|false|true|false");
  });

  it("returns the whole summary object to an active admin", async () => {
    const summary = await summaryOf(admin);
    expect(Object.keys(summary).sort()).toEqual(
      ["flashcards", "generated_at", "pending", "published_courses", "revenue", "top_courses", "users"].sort(),
    );
    expect(summary.revenue.months).toHaveLength(6);
    expect(summary.top_courses.length).toBeLessThanOrEqual(5);
    await expectReconciles(summary);
  });
});

describe("AD4 admin_dashboard_summary pending queue", () => {
  it("counts only non-removed pending courses and reports the oldest submission", async () => {
    const before = await summaryOf(admin);
    const day = 24 * 60 * 60 * 1000;
    const older = new Date(Date.now() - 3 * day);
    const newer = new Date(Date.now() - 1 * day);
    const removedOlder = new Date(Date.now() - 400 * day);
    await createCourse(`AD4 pending older ${randomUUID()}`, "pending", { submitted_at: older.toISOString() });
    await createCourse(`AD4 pending newer ${randomUUID()}`, "pending", { submitted_at: newer.toISOString() });
    await createCourse(`AD4 pending removed ${randomUUID()}`, "pending", {
      submitted_at: removedOlder.toISOString(),
      removed_at: new Date().toISOString(),
    });
    await createCourse(`AD4 draft ${randomUUID()}`, "draft", { submitted_at: removedOlder.toISOString() });

    const after = await summaryOf(admin);
    expect(after.pending.count - before.pending.count).toBe(2);
    const oldest = Date.parse(after.pending.oldest_submitted_at!);
    expect(oldest).toBeLessThanOrEqual(older.getTime());
    expect(oldest).toBeGreaterThan(removedOlder.getTime());
    await expectReconciles(after);
  });

  it("reports zero pending, null wait and six zero months when nothing is pending or paid (rolled back)", () => {
    const out = runLocalPsql(`
      begin;
      update public.payments set status = 'failed' where status = 'paid';
      update public.courses set status = 'draft' where status = 'pending';
      select set_config('request.jwt.claims', '{"sub":"${SEEDED.admin.id}","role":"authenticated"}', true);
      set local role authenticated;
      select public.admin_dashboard_summary();
      rollback;
    `);
    const line = out.split("\n").find((entry) => entry.startsWith("{") && entry.includes("generated_at"));
    const summary = JSON.parse(line!) as RpcSummary;
    expect(summary.pending).toEqual({ count: 0, oldest_submitted_at: null });
    expect(summary.revenue.total).toBe(0);
    expect(summary.revenue.months).toHaveLength(6);
    expect(monthAmounts(summary)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(summary.revenue.months.map((month) => month.month)).toEqual(expectedLabels(summary.generated_at));
  });
});

describe("AD4 admin_dashboard_summary revenue", () => {
  it("buckets paid VND orders by the Vietnam calendar month of created_at and keeps only the six-month window", async () => {
    const before = await summaryOf(admin);
    const { year, monthIndex } = currentVnMonth(before.generated_at);
    const courseId = await createCourse(`AD4 edge ${randomUUID()}`);
    const ms = (value: Date, delta: number) => new Date(value.getTime() + delta);
    const thisMonth = vnMonthStart(year, monthIndex);
    const nextMonth = vnMonthStart(year, monthIndex + 1);
    const oldestMonth = vnMonthStart(year, monthIndex - 5);
    await insertPayments([
      { courseId, amount: 1_100_003, createdAt: ms(thisMonth, -1) },
      { courseId, amount: 2_200_007, createdAt: thisMonth, updatedAt: ms(oldestMonth, 1000) },
      { courseId, amount: 3_300_011, createdAt: ms(nextMonth, -1) },
      { courseId, amount: 4_400_013, createdAt: oldestMonth },
      { courseId, amount: 5_500_017, createdAt: ms(oldestMonth, -1) },
      { courseId, amount: 6_600_019, createdAt: nextMonth },
    ]);

    const after = await summaryOf(admin);
    expect(after.revenue.months.map((month) => month.month)).toEqual(expectedLabels(after.generated_at));
    expect(diff(monthAmounts(after), monthAmounts(before))).toEqual([4_400_013, 0, 0, 0, 1_100_003, 2_200_007 + 3_300_011]);
    expect(after.revenue.total - before.revenue.total).toBe(4_400_013 + 1_100_003 + 2_200_007 + 3_300_011);
    await expectReconciles(after);
  });

  it("counts only paid VND orders and ignores every other status and currency", async () => {
    const before = await summaryOf(admin);
    const courseId = await createCourse(`AD4 exclusions ${randomUUID()}`);
    await insertPayments([
      { courseId, amount: 7_000_000 },
      { courseId, amount: 0 },
      { courseId, amount: 8_000_000, currency: "USD" },
      { courseId, amount: 9_000_000, status: "pending", userId: SEEDED.student.id },
      { courseId, amount: 9_100_000, status: "creating", userId: SEEDED.teacher.id },
      { courseId, amount: 9_200_000, status: "failed" },
      { courseId, amount: 9_300_000, status: "expired" },
      { courseId, amount: 9_400_000, status: "cancelled" },
    ]);

    const after = await summaryOf(admin);
    expect(diff(monthAmounts(after), monthAmounts(before))).toEqual([0, 0, 0, 0, 0, 7_000_000]);
    expect(after.revenue.total - before.revenue.total).toBe(7_000_000);
    await expectReconciles(after);
  });
});

describe("AD4 admin_dashboard_summary with more than 1000 rows", () => {
  const token = randomUUID().replace(/-/g, "").slice(0, 12);
  const bulkTotal = 1001;
  const removedLearners = 5;
  const revenueOfA = 1_000_000 + 2_000_000 + 500_000;
  const revenueOfB = bulkTotal * 1000;
  const revenueOfRemovedCourse = 9_999_999;
  let before: RpcSummary;
  let after: RpcSummary;
  let ids: { a: string; b: string; c: string; removed: string };

  beforeAll(async () => {
    before = await summaryOf(admin);
    runLocalPsql(`
      insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
      select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        format('ad4-bulk-%s-%s@example.test', '${token}', i), '{}'::jsonb, now(), now(), now()
      from generate_series(1, ${bulkTotal}) i;
    `);
    // Khóa B chèn trước A nhưng tên đứng sau; khóa đã gỡ có tên đứng đầu nên nếu lọt vào top sẽ lộ ngay.
    const b = await createCourse(`AD4 ${token} B`);
    const a = await createCourse(`AD4 ${token} A`);
    const c = await createCourse(`AD4 ${token} C`);
    const removed = await createCourse(`AD4 ${token} 0 removed`, "published", { removed_at: new Date().toISOString() });
    ids = { a, b, c, removed };
    runLocalPsql(`
      insert into public.enrollments (user_id, course_id)
      select p.id, c.course_id
      from public.profiles p
      cross join (values ('${a}'::uuid), ('${b}'::uuid), ('${removed}'::uuid)) as c(course_id)
      where p.email like 'ad4-bulk-${token}-%@example.test';
      insert into public.enrollments (user_id, course_id)
      select p.id, '${c}'::uuid
      from public.profiles p
      where p.email like 'ad4-bulk-${token}-%@example.test'
      order by p.email
      limit ${bulkTotal - 1};
      update public.profiles set removed_at = now()
      where id in (
        select id from public.profiles where email like 'ad4-bulk-${token}-%@example.test' order by email limit ${removedLearners}
      );
    `);
    await insertPayments([
      { courseId: a, amount: 1_000_000 },
      { courseId: a, amount: 2_000_000 },
      { courseId: a, amount: 500_000 },
      { courseId: a, amount: 5_000_000, currency: "USD" },
      { courseId: a, amount: 4_000_000, status: "failed" },
      { courseId: removed, amount: revenueOfRemovedCourse },
      ...Array.from({ length: bulkTotal }, () => ({ courseId: b, amount: 1000 })),
    ]);
    after = await summaryOf(admin);
  }, 120_000);

  it("counts every active student past the 1000-row API limit and excludes removed learners", () => {
    expect(after.users.students - before.users.students).toBe(bulkTotal - removedLearners);
    expect(after.users.teachers).toBe(before.users.teachers);
    expect(after.users.admins).toBe(before.users.admins);
  });

  it("sums more than 1000 paid orders into the current month and the total", () => {
    const revenueDelta = revenueOfA + revenueOfB + revenueOfRemovedCourse;
    expect(after.revenue.total - before.revenue.total).toBe(revenueDelta);
    expect(diff(monthAmounts(after), monthAmounts(before))).toEqual([0, 0, 0, 0, 0, revenueDelta]);
  });

  it("ranks by enrollments, breaks ties by title, counts removed learners and leaves out removed courses", () => {
    expect(after.published_courses - before.published_courses).toBe(3);
    expect(after.top_courses.slice(0, 3)).toEqual([
      { id: ids.a, title: `AD4 ${token} A`, enrollment_count: bulkTotal, revenue: revenueOfA },
      { id: ids.b, title: `AD4 ${token} B`, enrollment_count: bulkTotal, revenue: revenueOfB },
      { id: ids.c, title: `AD4 ${token} C`, enrollment_count: bulkTotal - 1, revenue: 0 },
    ]);
    expect(after.top_courses).toHaveLength(5);
    expect(after.top_courses.map((row) => row.id)).not.toContain(ids.removed);
  });

  it("reconciles with a service-role readback of the same definitions", async () => {
    await expectReconciles(after);
  });
});
