"use server";

import { createClient } from "@/utils/supabase/server"; // Khởi tạo từ SSR Cookie Client [cite: 2026-04-22]
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import crypto from "node:crypto";
import {
  checkoutInputSchema,
  checkoutResponseSchema,
} from "@/lib/schemas/payment";
import { payosService } from "@/services/payos";

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function createCheckoutSession(rawInput: unknown) {
  // 1. XÁC THỰC NGƯỜI DÙNG (RÀ SOÁT AUTH.UID) [cite: 2026-04-22]
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Bạn bắt buộc phải đăng nhập để mua khóa học." };
  }
  const userId = user.id;

  // 2. VALIDATE ĐẦU VÀO QUA ZOD [cite: 2026-04-22]
  const inputValidation = checkoutInputSchema.safeParse(rawInput);
  if (!inputValidation.success) {
    return { error: inputValidation.error.issues[0].message }; // Chuẩn bóc lỗi của Vocaspace [cite: 2026-04-22]
  }
  const { courseId } = inputValidation.data;

  try {
    // 3. JIT CLEANUP: Dọn rác các đơn 'pending' cũ đã quá 15 phút thanh toán
    await supabaseAdmin
      .from("payments")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .match({ user_id: userId, course_id: courseId, status: "pending" })
      .lt("expires_at", new Date().toISOString());

    // 4. LẤY THÔNG TIN GIÁ KHÓA HỌC GỐC TỪ DB [cite: 2026-04-22]
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, title, price, status")
      .eq("id", courseId)
      .single();

    if (!course || course.status !== "published") {
      return { error: "Khóa học không tồn tại hoặc chưa được mở bán." };
    }

    // 5. CHỐNG MUA LẠI
    const { data: existingEnroll } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .match({ user_id: userId, course_id: courseId })
      .maybeSingle();

    if (existingEnroll) {
      return { error: "Bạn đã sở hữu khóa học này rồi." };
    }

    // ========================================================
    // NHÁNH XỬ LÝ KHÓA HỌC MIỄN PHÍ
    // ========================================================
    if (course.price === 0) {
      // Ưu tiên cấp quyền học trước cho người dùng
      const { error: enrollError } = await supabaseAdmin
        .from("enrollments")
        .insert({
          user_id: userId,
          course_id: courseId,
          enrolled_at: new Date().toISOString(),
        });

      if (enrollError && enrollError.code !== "23505") {
        return { error: "Cấp quyền học khóa học miễn phí thất bại." };
      }

      // Lưu vết báo cáo tài chính sau (non-blocking)
      await supabaseAdmin.from("payments").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        course_id: courseId,
        amount_original: 0,
        amount_final: 0,
        currency: "VND",
        status: "paid",
        gateway: "free",
        gateway_order_id: `FREE-${Date.now()}`,
      });

      return { type: "free", message: "Đăng ký khóa học miễn phí thành công!" };
    }

    // ========================================================
    // NHÁNH XỬ LÝ KHÓA HỌC TRẢ PHÍ (PAYOS INTEGRATION)
    // ========================================================

    // 6. KIỂM TRA XEM CÓ ĐƠN PENDING CÒN HẠN ĐỂ REUSE KHÔNG
    const { data: activePayment } = await supabaseAdmin
      .from("payments")
      .select("id, status, gateway_order_id, gateway_metadata")
      .match({ user_id: userId, course_id: courseId, status: "pending" })
      .maybeSingle();

    if (activePayment) {
      const meta = activePayment.gateway_metadata as any;

      // 🔥 FIX 1: Nếu có chuỗi qr_code lưu vết thì dựng lại ảnh QR, nếu là đơn cũ chưa có thì fallback về checkout_url
      const qrCodeUrl = meta.qr_code
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(meta.qr_code)}`
        : meta.checkout_url;

      return {
        type: "paid",
        paymentId: activePayment.id,
        data: checkoutResponseSchema.parse({
          qrCodeUrl: qrCodeUrl, // <--- Đã được sửa để trả về ảnh QR
          amount: course.price,
          orderId: activePayment.gateway_order_id,
          bankMessage: `VOCASPACE ${activePayment.gateway_order_id}`,
          accountNumber: "Quét mã QR tại cổng PayOS để hiển thị số tài khoản",
        }),
      };
    }

    // 7. BỐC MÃ SỐ NGUYÊN TỪ SEQUENCE DƯỚI DB ĐỂ LÀM ORDER CODE
    const { data: seqData, error: seqError } = await supabaseAdmin.rpc(
      "get_next_sequence_value",
      { seq_name: "payos_order_code_seq" },
    ); // (Hoặc Ú tạo 1 hàm rpc nhỏ để select nextval)

    // Fallback nếu chưa tạo RPC lấy sequence: dùng tạm timestamp số nguyên sạch [cite: 2026-04-22]
    const orderCodeStr = seqError ? Date.now().toString() : String(seqData);

    const localPaymentId = crypto.randomUUID();
    const expiresAtIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // 8. INSERT ĐƠN TRẠNG THÁI 'CREATING' ĐỂ CHIẾM KHÓA
    const { error: insertError } = await supabaseAdmin.from("payments").insert({
      id: localPaymentId,
      user_id: userId,
      course_id: courseId,
      amount_original: course.price,
      amount_final: course.price,
      currency: "VND",
      status: "creating",
      gateway: "payos",
      gateway_order_id: orderCodeStr, // Lưu TEXT dạng số chuỗi sạch [cite: 2026-04-22]
      expires_at: expiresAtIso,
    });

    if (insertError) {
      // Nếu dính 23505 nghĩa là có tab khác đang tạo đồng thời, báo quay lại sau vài giây
      if (insertError.code === "23505") {
        return {
          error:
            "Đơn thanh toán đang được xử lý, vui lòng bấm lại sau vài giây.",
        };
      }
      return { error: `Không thể khởi tạo hóa đơn: ${insertError.message}` };
    }

    // 9. GỌI SANG API CỦA PAYOS SINH LINK QR
    let payosOrder;
    try {
      payosOrder = await payosService.paymentRequests.create({
        orderCode: Number(orderCodeStr), // Ép sang number truyền cho SDK PayOS
        amount: course.price,
        description: `VOCASPACE ${orderCodeStr}`,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?payment_id=${localPaymentId}`,
        cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/learn/${courseId}`,
      });
    } catch (payosError) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", localPaymentId);
      return {
        error: "Cổng thanh toán PayOS gặp sự cố, vui lòng thử lại sau.",
      };
    }

    // 10. CẬP NHẬT CHUYỂN DỊCH SANG 'PENDING' VÀ KHÓA ĐƠN
    const finalMetadata = {
      payos_order_code: Number(orderCodeStr),
      checkout_url: payosOrder.checkoutUrl,
      qr_code: payosOrder.qrCode, // 🔥 FIX 2: Lưu thêm chuỗi VietQR gốc vào JSONB để phục vụ luồng REUSE ở Bước 6
    };

    await supabaseAdmin
      .from("payments")
      .update({
        status: "pending",
        gateway_metadata: finalMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localPaymentId);

    // 11. ĐÓNG GÓI ĐẦU RA AN TOÀN TRẢ VỀ FRONTEND RENDER
    return {
      type: "paid",
      paymentId: localPaymentId,
      data: checkoutResponseSchema.parse({
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payosOrder.qrCode)}`,
        amount: course.price,
        orderId: orderCodeStr,
        bankMessage: `VOCASPACE ${orderCodeStr}`,
        accountNumber:
          payosOrder.accountNumber || "Quét mã QR để nhận số tài khoản",
      }),
    };
  } catch (err) {
    return { error: "Hệ thống gặp sự cố ngoài dự kiến." };
  }
}

export async function cancelCheckoutSession(paymentId: string) {
  // 1. Kiểm tra session đăng nhập chính chủ [cite: 2026-04-22]
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Không tìm thấy phiên đăng nhập." };

  // 2. Cập nhật trạng thái hóa đơn sang 'cancelled' để giải phóng Unique Index
  const { error } = await supabaseAdmin
    .from("payments")
    .update({ 
      status: "cancelled", 
      updated_at: new Date().toISOString() 
    })
    .match({ id: paymentId, user_id: user.id, status: "pending" }); // Chỉ cho phép hủy đúng đơn pending của mình [cite: 2026-04-22]

  if (error) {
    console.error("🚨 [CANCEL_PAYMENT_FAILED]:", error);
    return { error: "Không thể cập nhật hủy hóa đơn dưới hệ thống." };
  }

  return { success: true };
}

export async function checkPaymentStatus(paymentId: string) {
  // 1. XÁC THỰC NGƯỜI DÙNG CHÍNH CHỦ (RÀ SOÁT AUTH.UID CHẶN ĐỨNG LIÊN QUỚI DATA) [cite: 2026-04-22]
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ." };
  }

  try {
    // 2. TRUY VẤN TRẠNG THÁI ĐƠN HÀNG KHỚP CHÍNH XÁC CẢ PAYMENT_ID VÀ USER_ID [cite: 2026-04-22]
    const { data: payment, error: queryError } = await supabaseAdmin
      .from("payments")
      .select("status")
      .match({ id: paymentId, user_id: user.id })
      .single();

    if (queryError || !payment) {
      return { error: "Không tìm thấy thông tin đơn thanh toán này." };
    }

    // 3. TRẢ VỀ TRẠNG THÁI SẠCH CHO FRONTEND POLLING ĐỌC (e.g. 'pending', 'paid', 'cancelled', 'expired')
    return { status: payment.status };
  } catch (err) {
    console.error("🚨 [CHECK_PAYMENT_STATUS_ERROR]:", err);
    return { error: "Hệ thống gặp sự cố khi cập nhật trạng thái đơn hàng." };
  }
}