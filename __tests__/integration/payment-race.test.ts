import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

// Khởi tạo Supabase Client với quyền service_role tối cao
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe("Payment Race Condition & Idempotency Integration Test", () => {
  // Biến lưu trữ thông tin thực thể cô lập hoàn toàn cho ca test
  let testUserId: string;
  let testCourseId: string;
  
  // Biến sinh động cho từng vòng chạy test (Lifecycle-scoped)
  let paymentId: string;
  let gatewayOrderCode: string;

  // BẢO VỆ PRODUCTION: Tạo một User hoàn toàn mới trong hệ thống Auth [cite: 2026-04-22]
  beforeAll(async () => {
    const email = `race-test-${crypto.randomUUID()}@example.com`;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "TestPassword123!",
      email_confirm: true,
    });

    if (authError) {
      throw new Error(`Tạo user test thất bại: ${authError.message}`);
    }

    testUserId = authUser.user.id;

    // Sử dụng .limit(1) thay vì .single() để chặn đứng việc quăng lỗi crash bừa bãi từ Supabase [cite: 2026-04-22]
    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id")
      .limit(1);

    if (!courses || courses.length === 0) {
      throw new Error("Môi trường thiếu dữ liệu mồi! Bắt buộc phải có sẵn tối thiểu 1 course trong DB.");
    }

    testCourseId = courses[0].id;
  });

  // DỌN SẠCH TẬN GỐC: Xóa user test ra khỏi hệ thống Auth sau khi hoàn tất [cite: 2026-04-22]
  afterAll(async () => {
    if (testUserId) {
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
    }
  });

  beforeEach(async () => {
    paymentId = crypto.randomUUID();
    gatewayOrderCode = Date.now().toString();

    // Khởi tạo hóa đơn mẫu ở trạng thái 'pending' gắn chặt với User ảo vừa tạo
    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        id: paymentId,
        user_id: testUserId,
        course_id: testCourseId,
        discount_id: null,
        amount_original: 500000,
        amount_discount: 0,
        amount_final: 500000,
        currency: "VND",
        status: "pending", // Trạng thái mồi bắt buộc
        gateway: "payos",
        gateway_order_id: gatewayOrderCode, // Khớp cột vật lý ăn Unique Index [cite: 2026-04-22]
        gateway_metadata: {
          payos_order_code: Number(gatewayOrderCode),
          checkout_url: `https://checkout.payos.vn/order/${gatewayOrderCode}`,
          payos_payment_link_id: crypto.randomUUID(),
        },
      });

    if (paymentError) {
      throw new Error(`Setup dữ liệu hóa đơn thất bại: ${paymentError.message}`);
    }
  });

  afterEach(async () => {
    // Chỉ dọn dẹp dữ liệu phát sinh của đúng User Test, không gây ảnh hưởng đến User thật [cite: 2026-04-22]
    await supabaseAdmin
      .from("enrollments")
      .delete()
      .match({ user_id: testUserId, course_id: testCourseId });

    await supabaseAdmin
      .from("payments")
      .delete()
      .eq("id", paymentId);
  });

  it("nên xử lý chính xác 1 request thành công và các request còn lại no-op khi bị spam đồng thời", async () => {
    const callPaymentRpc = async (transactionId: string) => {
      const { data, error } = await supabaseAdmin.rpc("handle_payment_success", {
        p_gateway: "payos",
        p_gateway_order_id: gatewayOrderCode,
        p_gateway_transaction_id: transactionId,
      });

      if (error) throw error;
      return data as string;
    };

    // ĐỘNG HÓA CONCURRENCY: Sử dụng Array.from giúp dễ dàng nâng tải stress test lên 10, 50 hoặc 100 requests [cite: 2026-04-22]
    const REQUEST_CONCURRENCY = 250;
    const results = await Promise.all(
      Array.from({ length: REQUEST_CONCURRENCY }, (_, i) => 
        callPaymentRpc(`TXN_${String(i + 1).padStart(2, "0")}`)
      )
    );

    // 1. Chỉ duy nhất 1 request chiếm được khóa 'FOR UPDATE' chạy trước và trả về SUCCESS [cite: 2026-04-22]
    const successCount = results.filter((r) => r === "SUCCESS").length;
    expect(successCount).toBe(1);

    // 2. Toàn bộ các request còn lại phải rơi vào chốt chặn Idempotency check [cite: 2026-04-22]
    const idempotentCount = results.filter((r) => r === "IDEMPOTENT_SUCCESS").length;
    expect(idempotentCount).toBe(REQUEST_CONCURRENCY - 1);

    // 3. Trạng thái cuối trong DB của hóa đơn phải nhảy sang 'success'
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("status")
      .eq("id", paymentId)
      .single();
    expect(payment?.status).toBe("paid");

    // 4. Lớp phòng thủ cuối cùng bảo toàn: Chỉ sinh ra duy nhất 1 bản ghi ghi danh
    const { data: enrollments } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .match({ user_id: testUserId, course_id: testCourseId });
    expect(enrollments?.length).toBe(1);
  });
});