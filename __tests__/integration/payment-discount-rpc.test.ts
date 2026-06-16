import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TEST_DISCOUNT_CODE_PREFIX = "VOCASPACE_TEST_RPC";
const TEST_USER_PASSWORD = "TestPassword123!";

let testUserId: string;
let testEmail: string;
let courseId: string;
let coursePrice: number;
let discountId: string;
let gatewayOrderId: string;
let paymentId: string;

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chặn test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true nếu chắc chắn đang dùng test/dev DB.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  if (!supabaseUrl.startsWith("http://127.0.0.1:45321")) {
    throw new Error(
      `Chặn test DB integration vì Supabase URL không phải local: ${supabaseUrl}`,
    );
  }
}

async function createTestCourse() {
  courseId = randomUUID();
  coursePrice = 100000;

  const { error } = await supabaseAdmin.from("courses").insert({
    id: courseId,
    title: "Payment Discount RPC Integration Test Course",
    slug: `payment-discount-rpc-integration-test-course-${randomUUID()}`,
    description: "Course created by payment discount RPC integration test",
    price: coursePrice,
    status: "published",
    removed_at: null,
  });

  if (error) {
    throw new Error(`Không thể tạo course test: ${error.message}`);
  }
}

async function createTestDiscount() {
  const testDiscountCode = `${TEST_DISCOUNT_CODE_PREFIX}_${randomUUID()}`;

  const { data: createdDiscount, error: createError } = await supabaseAdmin
    .from("discounts")
    .insert({
      course_id: courseId,
      code: testDiscountCode,
      type: "fixed",
      value: 1,
      max_discount_amount: null,
      min_course_price: 0,
      max_uses: 999999,
      uses_count: 0,
      reserved_count: 0,
      start_at: null,
      expires_at: null,
      removed_at: null,
    })
    .select("id")
    .single();

  if (createError || !createdDiscount) {
    throw new Error(`Không thể tạo discount test: ${createError?.message}`);
  }

  discountId = createdDiscount.id;
}

async function getDiscountSnapshot(label: string) {
  const { data, error } = await supabaseAdmin
    .from("discounts")
    .select("id, code, max_uses, uses_count, reserved_count")
    .eq("id", discountId)
    .single();

  if (error || !data) {
    throw new Error(`Không lấy được discount snapshot: ${error?.message}`);
  }

  const snapshot = {
    label,
    code: data.code,
    max_uses: data.max_uses,
    uses_count: Number(data.uses_count ?? 0),
    reserved_count: Number(data.reserved_count ?? 0),
  };

  console.table([snapshot]);

  return snapshot;
}

describe.sequential("payment discount RPC integration", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();

    testEmail = `vocaspace_rpc_test_${randomUUID()}@example.com`;

    const { data: authUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: TEST_USER_PASSWORD,
        email_confirm: true,
      });

    if (createUserError || !authUser.user) {
      throw new Error(
        `Không thể tạo auth user test: ${createUserError?.message}`,
      );
    }

    testUserId = authUser.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: testUserId,
        email: testEmail,
        full_name: "VocaSpace RPC Test User",
        role: "student",
      });

    if (profileError) {
      throw new Error(
        `Không thể tạo/cập nhật profile test: ${profileError.message}`,
      );
    }

    await createTestCourse();
    await createTestDiscount();
  });

  afterAll(async () => {
    if (testUserId && courseId) {
      await supabaseAdmin
        .from("enrollments")
        .delete()
        .match({ user_id: testUserId, course_id: courseId });
    }

    if (paymentId) {
      await supabaseAdmin.from("payments").delete().eq("id", paymentId);
    }

    if (discountId) {
      await supabaseAdmin.from("discounts").delete().eq("id", discountId);
    }

    if (courseId) {
      await supabaseAdmin.from("courses").delete().eq("id", courseId);
    }

    if (testUserId) {
      await supabaseAdmin.from("profiles").delete().eq("id", testUserId);
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
    }
  });

  it("consumes discount reservation when payment webhook RPC marks payment as paid", async () => {
    const beforeReserve = await getDiscountSnapshot("BEFORE_RESERVE");

    const { data: reservedDiscount, error: reserveError } = await supabaseAdmin
      .from("discounts")
      .update({
        reserved_count: beforeReserve.reserved_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", discountId)
      .eq("reserved_count", beforeReserve.reserved_count)
      .select("id, uses_count, reserved_count, max_uses")
      .maybeSingle();

    expect(reserveError).toBeNull();
    expect(reservedDiscount).not.toBeNull();

    const afterReserve = await getDiscountSnapshot("AFTER_RESERVE");

    expect(afterReserve.uses_count).toBe(beforeReserve.uses_count);
    expect(afterReserve.reserved_count).toBe(beforeReserve.reserved_count + 1);

    paymentId = randomUUID();
    gatewayOrderId = `TEST-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const discountAmount = 1;
    const finalAmount = Math.max(0, coursePrice - discountAmount);

    const { error: paymentInsertError } = await supabaseAdmin
      .from("payments")
      .insert({
        id: paymentId,
        user_id: testUserId,
        course_id: courseId,
        discount_id: discountId,
        amount_original: coursePrice,
        amount_discount: discountAmount,
        amount_final: finalAmount,
        currency: "VND",
        status: "pending",
        gateway: "payos",
        gateway_order_id: gatewayOrderId,
        gateway_metadata: {},
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

    expect(paymentInsertError).toBeNull();

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "handle_payment_success",
      {
        p_gateway: "payos",
        p_gateway_order_id: gatewayOrderId,
        p_gateway_transaction_id: `TEST-TXN-${randomUUID()}`,
      },
    );

    expect(rpcError).toBeNull();
    expect(rpcResult).toBe("SUCCESS");

    const afterPaid = await getDiscountSnapshot("AFTER_RPC_PAID");

    expect(afterPaid.uses_count).toBe(beforeReserve.uses_count + 1);
    expect(afterPaid.reserved_count).toBe(beforeReserve.reserved_count);

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("id", paymentId)
      .single();

    expect(paymentError).toBeNull();
    expect(payment?.status).toBe("paid");

    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .match({ user_id: testUserId, course_id: courseId })
      .maybeSingle();

    expect(enrollmentError).toBeNull();
    expect(enrollment).not.toBeNull();

    const { data: secondRpcResult, error: secondRpcError } =
      await supabaseAdmin.rpc("handle_payment_success", {
        p_gateway: "payos",
        p_gateway_order_id: gatewayOrderId,
        p_gateway_transaction_id: `TEST-TXN-${randomUUID()}`,
      });

    expect(secondRpcError).toBeNull();
    expect(secondRpcResult).toBe("IDEMPOTENT_SUCCESS");

    const afterIdempotent = await getDiscountSnapshot("AFTER_IDEMPOTENT_RPC");

    expect(afterIdempotent.uses_count).toBe(afterPaid.uses_count);
    expect(afterIdempotent.reserved_count).toBe(afterPaid.reserved_count);
  });
});
