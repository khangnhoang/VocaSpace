import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: kiểm tra PAYGRANT, chỉ service_role (và postgres cho pg_cron) chạy được RPC thanh toán và ghi payments;
//   và PAYCODE, mã đơn PayOS chỉ cấp được qua RPC next_payos_order_code của service_role.
// - Loại test: integration/RPC/grant trên Supabase local thật.
// - Đối tượng: handle_payment_success, reserve_discount_usage, expire_stale_payments, next_payos_order_code, bảng payments, sequence payos_order_code_seq.
// - Case thành công:
//   - service_role vẫn có EXECUTE trên bốn hàm và mọi quyền trên payments/sequence; authenticated vẫn SELECT được payment của mình.
//   - service_role gọi next_payos_order_code hai lần: hai số nguyên 13 chữ số, tăng chặt, trong khoảng 9000000000000..9999999999999.
// - Case thất bại:
//   - anon và học viên chủ đơn gọi handle_payment_success trên đơn creating/pending thật có giữ discount: 42501.
//   - anon và học viên gọi reserve_discount_usage và expire_stale_payments: 42501.
//   - anon và học viên gọi next_payos_order_code: 42501.
// - Bảo mật/phân quyền:
//   - catalog: anon/authenticated/public không EXECUTE bốn hàm; anon không có quyền nào trên payments (kể cả REFERENCES, TRIGGER, MAINTAIN); authenticated chỉ SELECT; service_role giữ đủ; anon/authenticated không có quyền trên sequence.
//   - sau mỗi lần bị từ chối: trạng thái payment, enrollment và reserved_count/uses_count của discount không đổi.
//   - hết dải 13 chữ số (nextval báo 2200H) và hành vi migration PAYCODE trên dữ liệu có sẵn được kiểm bằng script scenario psql
//     trên runtime cô lập (kế hoạch PAYCODE §3), không nằm trong file này vì setval/nextval không rollback được.
// - Ổn định/resilience: fixture cô lập theo course/user UUID, mỗi case tự tạo và dọn payment vì uq_active_payment chỉ cho một đơn active; lỗi dọn dẹp làm test fail thay vì để sót dữ liệu.
// - Invariant cần giữ: người dùng không thể tự đánh dấu paid hoặc tự ghi danh khóa học trả phí.
// - Kết quả verify gần nhất: passed (11/11) sau migration PAYCODE `20261021100000` trên runtime cô lập (45441, sau `db reset` đầy đủ) và trên
//   root runtime (45321, sau `migration up --local`) bằng
//   `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- __tests__/integration/payment-privileges.test.ts`;
//   trước migration PAYCODE (runtime cô lập reset về `20261021090000`) 4 case fail (PGRST202, chưa có RPC).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_PASSWORD = "TestPassword123!";

function client(key = SUPABASE_ANON_KEY) {
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Chặn test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true nếu chắc chắn đang dùng test/dev DB.");
  }
  if (!SUPABASE_URL?.startsWith("http://127.0.0.1:")) {
    throw new Error(`Chặn test DB integration vì Supabase URL không phải local: ${SUPABASE_URL}`);
  }
}

const service = client(SUPABASE_SERVICE_ROLE_KEY);
const anonymous = client();
let learner: SupabaseClient;
let learnerId = "";
let courseId = "";
let discountId = "";
const paymentIds = new Set<string>();

async function insertPayment(status: "creating" | "pending", expiresAt = new Date(Date.now() + 15 * 60 * 1000)) {
  const id = randomUUID();
  const gatewayOrderId = `PAYGRANT-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const { error } = await service.from("payments").insert({
    id,
    user_id: learnerId,
    course_id: courseId,
    discount_id: discountId,
    amount_original: 100000,
    amount_discount: 1,
    amount_final: 99999,
    currency: "VND",
    status,
    gateway: "payos",
    gateway_order_id: gatewayOrderId,
    gateway_metadata: {},
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`Không tạo được payment test: ${error.message}`);
  paymentIds.add(id);
  return { id, gatewayOrderId };
}

async function expectCleanup(label: string, query: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await query;
  if (error) throw new Error(`Không dọn được ${label} test: ${error.message}`);
}

async function deleteTrackedPayments() {
  for (const id of [...paymentIds]) {
    await expectCleanup(`payment ${id}`, service.from("payments").delete().eq("id", id));
    paymentIds.delete(id);
  }
}

async function snapshot(paymentId: string) {
  const [{ data: payment, error: paymentError }, { data: enrollment, error: enrollmentError }, { data: discount, error: discountError }] =
    await Promise.all([
      service.from("payments").select("status").eq("id", paymentId).single(),
      service.from("enrollments").select("id").match({ user_id: learnerId, course_id: courseId }).maybeSingle(),
      service.from("discounts").select("reserved_count, uses_count").eq("id", discountId).single(),
    ]);
  if (paymentError || enrollmentError || discountError) {
    throw new Error(`Không đọc được snapshot: ${paymentError?.message ?? enrollmentError?.message ?? discountError?.message}`);
  }
  return {
    status: payment.status,
    enrolled: enrollment !== null,
    reserved: Number(discount.reserved_count ?? 0),
    used: Number(discount.uses_count ?? 0),
  };
}

describe.sequential("payment privileges (PAYGRANT)", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();

    const email = `paygrant_${randomUUID()}@example.com`;
    const { data: created, error: userError } = await service.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (userError || !created.user) throw new Error(`Không tạo được user test: ${userError?.message}`);
    learnerId = created.user.id;
    const { error: profileError } = await service
      .from("profiles")
      .upsert({ id: learnerId, email, full_name: "PAYGRANT Learner", role: "student" });
    if (profileError) throw new Error(`Không tạo được profile test: ${profileError.message}`);

    learner = client();
    const { error: signInError } = await learner.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (signInError) throw new Error(`Không đăng nhập được học viên test: ${signInError.message}`);

    courseId = randomUUID();
    const { error: courseError } = await service.from("courses").insert({
      id: courseId,
      title: "PAYGRANT Paid Course",
      slug: `paygrant-paid-course-${courseId}`,
      description: "Course created by the PAYGRANT privilege test",
      price: 100000,
      status: "published",
      removed_at: null,
    });
    if (courseError) throw new Error(`Không tạo được course test: ${courseError.message}`);

    // Discount đang giữ một chỗ, như sau khi checkout đã reserve, để thấy rõ nếu RPC lỡ tiêu thụ hoặc nhả chỗ.
    const { data: discount, error: discountError } = await service
      .from("discounts")
      .insert({
        course_id: courseId,
        code: `PAYGRANT_${randomUUID()}`,
        type: "fixed",
        value: 1,
        min_course_price: 0,
        max_uses: 999999,
        uses_count: 0,
        reserved_count: 1,
      })
      .select("id")
      .single();
    if (discountError || !discount) throw new Error(`Không tạo được discount test: ${discountError?.message}`);
    discountId = discount.id;
  });

  // Trả fixture về trạng thái ban đầu để một case lỡ lọt quyền không làm hỏng snapshot của case sau.
  afterEach(async () => {
    await deleteTrackedPayments();
    if (learnerId && courseId) {
      await expectCleanup("enrollment", service.from("enrollments").delete().match({ user_id: learnerId, course_id: courseId }));
    }
    if (discountId) {
      await expectCleanup("discount reset", service.from("discounts").update({ reserved_count: 1, uses_count: 0 }).eq("id", discountId));
    }
  });

  // Dọn payment trước bản ghi cha: payment còn sót sẽ chặn xóa discount/course (FK) và profile (CHECK của A5).
  afterAll(async () => {
    await deleteTrackedPayments();
    if (learnerId && courseId) {
      await expectCleanup("enrollment", service.from("enrollments").delete().match({ user_id: learnerId, course_id: courseId }));
    }
    if (discountId) await expectCleanup("discount", service.from("discounts").delete().eq("id", discountId));
    if (courseId) await expectCleanup("course", service.from("courses").delete().eq("id", courseId));
    if (learnerId) {
      await expectCleanup("profile", service.from("profiles").delete().eq("id", learnerId));
      const { error } = await service.auth.admin.deleteUser(learnerId);
      if (error) throw new Error(`Không dọn được auth user test: ${error.message}`);
    }
  });

  it("grants the payment RPCs, table writes and order-code sequence to service_role only", async () => {
    const roles = "array['anon', 'authenticated', 'public', 'service_role']";
    for (const signature of [
      "public.handle_payment_success(text, text, text)",
      "public.reserve_discount_usage(uuid)",
      "public.expire_stale_payments(integer)",
      "public.next_payos_order_code()",
    ]) {
      const grants = await waitForLocalPostgresQuery(
        `select string_agg(r || '=' || has_function_privilege(r, '${signature}', 'execute')::text, ',' order by r)
           from unnest(${roles}) as r`,
        `${signature} execute grants`,
      );
      expect(grants, signature).toBe("anon=false,authenticated=false,public=false,service_role=true");
    }

    const tableGrants = await waitForLocalPostgresQuery(
      `select string_agg(r || ':' || p || '=' || has_table_privilege(r, 'public.payments', p)::text, ',' order by r, p)
         from unnest(array['anon', 'authenticated', 'service_role']) as r
         cross join unnest(array['DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE']) as p`,
      "public.payments table grants",
    );
    const privileges = ["DELETE", "INSERT", "MAINTAIN", "REFERENCES", "SELECT", "TRIGGER", "TRUNCATE", "UPDATE"];
    expect(tableGrants).toBe(
      [
        ...privileges.map((p) => `anon:${p}=false`),
        ...privileges.map((p) => `authenticated:${p}=${p === "SELECT"}`),
        ...privileges.map((p) => `service_role:${p}=true`),
      ].join(","),
    );

    const sequenceGrants = await waitForLocalPostgresQuery(
      `select string_agg(r || ':' || p || '=' || has_sequence_privilege(r, 'public.payos_order_code_seq', p)::text, ',' order by r, p)
         from unnest(array['anon', 'authenticated', 'service_role']) as r
         cross join unnest(array['SELECT', 'UPDATE', 'USAGE']) as p`,
      "payos_order_code_seq grants",
    );
    expect(sequenceGrants).toBe(
      [
        "anon:SELECT=false", "anon:UPDATE=false", "anon:USAGE=false",
        "authenticated:SELECT=false", "authenticated:UPDATE=false", "authenticated:USAGE=false",
        "service_role:SELECT=true", "service_role:UPDATE=true", "service_role:USAGE=true",
      ].join(","),
    );
  });

  for (const caller of ["anon", "learner"] as const) {
    for (const status of ["creating", "pending"] as const) {
      it(`refuses ${caller} marking their own ${status} payment paid, with no enrollment and no discount change`, async () => {
        const payment = await insertPayment(status);
        const before = await snapshot(payment.id);
        expect(before).toEqual({ status, enrolled: false, reserved: 1, used: 0 });

        const actor = caller === "anon" ? anonymous : learner;
        const { data, error } = await actor.rpc("handle_payment_success", {
          p_gateway: "payos",
          p_gateway_order_id: payment.gatewayOrderId,
          p_gateway_transaction_id: `FORGED-${randomUUID()}`,
        });

        expect(data).toBeNull();
        expect(error?.code).toBe("42501");
        expect(await snapshot(payment.id)).toEqual(before);
      });
    }
  }

  for (const caller of ["anon", "learner"] as const) {
    it(`refuses ${caller} reserving a discount or expiring stale payments`, async () => {
      // Đơn đã quá hạn: nếu expire_stale_payments lọt quyền thì đơn sẽ thành expired và nhả chỗ discount.
      const stale = await insertPayment("pending", new Date(Date.now() - 60 * 1000));
      const before = await snapshot(stale.id);
      const actor = caller === "anon" ? anonymous : learner;

      const reserve = await actor.rpc("reserve_discount_usage", { p_discount_id: discountId });
      expect(reserve.error?.code).toBe("42501");

      const expire = await actor.rpc("expire_stale_payments", { p_limit: 100 });
      expect(expire.error?.code).toBe("42501");

      expect(await snapshot(stale.id)).toEqual(before);
    });
  }

  it("hands service_role two strictly increasing 13-digit PayOS order codes", async () => {
    const first = await service.rpc("next_payos_order_code");
    const second = await service.rpc("next_payos_order_code");

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    for (const code of [first.data, second.data]) {
      expect(Number.isSafeInteger(code)).toBe(true);
      expect(String(code)).toMatch(/^\d{13}$/);
      expect(code).toBeGreaterThanOrEqual(9000000000000);
      expect(code).toBeLessThanOrEqual(9999999999999);
    }
    expect(second.data).toBeGreaterThan(first.data);
  });

  for (const caller of ["anon", "learner"] as const) {
    it(`refuses ${caller} drawing a PayOS order code`, async () => {
      const actor = caller === "anon" ? anonymous : learner;
      const { data, error } = await actor.rpc("next_payos_order_code");

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    });
  }

  it("keeps the learner's own payment readable through the session client", async () => {
    const payment = await insertPayment("pending");
    const { data, error } = await learner.from("payments").select("id, status").eq("id", payment.id);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: payment.id, status: "pending" }]);
  });
});
