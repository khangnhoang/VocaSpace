"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import crypto from "node:crypto";
import {
  checkoutInputSchema,
  checkoutResponseSchema,
} from "@/lib/schemas/payment";
import { payosService } from "@/services/payos";
import {
  releaseReservedDiscount,
  reserveDiscountUsage,
  resolveDiscountPricing,
  toNumber,
} from "@/lib/discounts/discount-pricing";

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function expireStalePendingPayments(params: {
  userId: string;
  courseId: string;
}) {
  const { userId, courseId } = params;
  const nowIso = new Date().toISOString();

  const { data: expiredPayments } = await supabaseAdmin
    .from("payments")
    .select("id, discount_id")
    .match({ user_id: userId, course_id: courseId, status: "pending" })
    .lt("expires_at", nowIso);

  if (!expiredPayments || expiredPayments.length === 0) return;

  const expiredPaymentIds = expiredPayments.map((payment) => payment.id);

  const { data: updatedPayments } = await supabaseAdmin
    .from("payments")
    .update({ status: "expired", updated_at: nowIso })
    .in("id", expiredPaymentIds)
    .eq("status", "pending")
    .select("id, discount_id");

  if (!updatedPayments) return;

  await Promise.all(
    updatedPayments
      .filter((payment) => payment.discount_id)
      .map((payment) =>
        releaseReservedDiscount({
          supabaseAdmin,
          discountId: payment.discount_id,
        }),
      ),
  );
}

export async function createCheckoutSession(rawInput: unknown) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Bạn bắt buộc phải đăng nhập để mua khóa học." };
  }

  const userId = user.id;

  const inputValidation = checkoutInputSchema.safeParse(rawInput);

  if (!inputValidation.success) {
    return { error: inputValidation.error.issues[0].message };
  }

  const { courseId, couponCode } = inputValidation.data;

  try {
    await expireStalePendingPayments({ userId, courseId });

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, title, price, status")
      .eq("id", courseId)
      .single();

    if (!course || course.status !== "published") {
      return { error: "Khóa học không tồn tại hoặc chưa được mở bán." };
    }

    const { data: existingEnroll } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .match({ user_id: userId, course_id: courseId })
      .maybeSingle();

    if (existingEnroll) {
      return { error: "Bạn đã sở hữu khóa học này rồi." };
    }

    const coursePrice = toNumber(course.price);

    if (coursePrice === 0) {
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

      await supabaseAdmin.from("payments").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        course_id: courseId,
        amount_original: 0,
        amount_discount: 0,
        amount_final: 0,
        currency: "VND",
        status: "paid",
        gateway: "free",
        gateway_order_id: `FREE-${Date.now()}`,
      });

      return { type: "free", message: "Đăng ký khóa học miễn phí thành công!" };
    }

    const { data: activePayment } = await supabaseAdmin
      .from("payments")
      .select(
        "id, status, gateway_order_id, gateway_metadata, amount_final, amount_discount, discount_id, expires_at",
      )
      .match({ user_id: userId, course_id: courseId, status: "pending" })
      .maybeSingle();

    if (activePayment) {
      const meta = activePayment.gateway_metadata as any;

      const qrCodeUrl = meta.qr_code
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(meta.qr_code)}`
        : meta.checkout_url;

      return {
        type: "paid",
        paymentId: activePayment.id,
        data: checkoutResponseSchema.parse({
          qrCodeUrl,
          amount: Number(activePayment.amount_final),
          orderId: activePayment.gateway_order_id,
          bankMessage: `VOCASPACE ${activePayment.gateway_order_id}`,
          accountNumber: "Quét mã QR tại cổng PayOS để hiển thị số tài khoản",
          expiresAt: activePayment.expires_at,
        }),
      };
    }

    const resolvedDiscount = await resolveDiscountPricing({
      supabaseAdmin,
      courseId,
      couponCode,
      coursePrice,
    });

    if (!resolvedDiscount.ok) {
      return { error: resolvedDiscount.error };
    }

    let reservedDiscountId: string | null = null;

    if (resolvedDiscount.discountId && resolvedDiscount.discountMeta) {
      const reserveResult = await reserveDiscountUsage({
        supabaseAdmin,
        discountId: resolvedDiscount.discountId,
      });

      if (!reserveResult.ok) {
        return { error: reserveResult.error };
      }

      reservedDiscountId = resolvedDiscount.discountId;
    }

    const { data: seqData, error: seqError } = await supabaseAdmin.rpc(
      "get_next_sequence_value",
      { seq_name: "payos_order_code_seq" },
    );

    const orderCodeStr = seqError ? Date.now().toString() : String(seqData);
    const localPaymentId = crypto.randomUUID();

    const PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;
    const expiresAtDate = new Date(Date.now() + PAYMENT_TIMEOUT_MS);
    const expiresAtIso = expiresAtDate.toISOString();
    const payosExpiredAtTimestamp = Math.floor(expiresAtDate.getTime() / 1000);

    const { error: insertError } = await supabaseAdmin.from("payments").insert({
      id: localPaymentId,
      user_id: userId,
      course_id: courseId,
      amount_original: resolvedDiscount.originalAmount,
      amount_discount: resolvedDiscount.discountAmount,
      amount_final: resolvedDiscount.finalAmount,
      discount_id: resolvedDiscount.discountId,
      currency: "VND",
      status: "creating",
      gateway: "payos",
      gateway_order_id: orderCodeStr,
      expires_at: expiresAtIso,
    });

    if (insertError) {
      if (reservedDiscountId) {
        await releaseReservedDiscount({
          supabaseAdmin,
          discountId: reservedDiscountId,
        });
      }

      if (insertError.code === "23505") {
        return {
          error:
            "Đơn thanh toán đang được xử lý, vui lòng bấm lại sau vài giây.",
        };
      }

      return { error: `Không thể khởi tạo hóa đơn: ${insertError.message}` };
    }

    let payosOrder;

    try {
      payosOrder = await payosService.paymentRequests.create({
        orderCode: Number(orderCodeStr),
        amount: resolvedDiscount.finalAmount,
        description: `VOCASPACE ${orderCodeStr}`,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?payment_id=${localPaymentId}`,
        cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/learn/${courseId}`,
        expiredAt: payosExpiredAtTimestamp,
      });
    } catch {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", localPaymentId);

      if (reservedDiscountId) {
        await releaseReservedDiscount({
          supabaseAdmin,
          discountId: reservedDiscountId,
        });
      }

      return {
        error: "Cổng thanh toán PayOS gặp sự cố, vui lòng thử lại sau.",
      };
    }

    const finalMetadata = {
      payos_order_code: Number(orderCodeStr),
      checkout_url: payosOrder.checkoutUrl,
      qr_code: payosOrder.qrCode,
    };

    const { error: updatePendingError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "pending",
        gateway_metadata: finalMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localPaymentId);

    if (updatePendingError) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", localPaymentId);

      if (reservedDiscountId) {
        await releaseReservedDiscount({
          supabaseAdmin,
          discountId: reservedDiscountId,
        });
      }

      return { error: "Không thể cập nhật trạng thái đơn thanh toán." };
    }

    return {
      type: "paid",
      paymentId: localPaymentId,
      data: checkoutResponseSchema.parse({
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payosOrder.qrCode)}`,
        amount: resolvedDiscount.finalAmount,
        orderId: orderCodeStr,
        bankMessage: `VOCASPACE ${orderCodeStr}`,
        accountNumber:
          payosOrder.accountNumber || "Quét mã QR để nhận số tài khoản",
        expiresAt: expiresAtIso,
      }),
    };
  } catch {
    return { error: "Hệ thống gặp sự cố ngoài dự kiến." };
  }
}

export async function cancelCheckoutSession(paymentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Không tìm thấy phiên đăng nhập." };

  const { data: cancelledPayment, error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .match({ id: paymentId, user_id: user.id, status: "pending" })
    .select("id, discount_id")
    .maybeSingle();

  if (error) {
    console.error("🚨 [CANCEL_PAYMENT_FAILED]:", error);
    return { error: "Không thể cập nhật hủy hóa đơn dưới hệ thống." };
  }

  if (cancelledPayment?.discount_id) {
    await releaseReservedDiscount({
      supabaseAdmin,
      discountId: cancelledPayment.discount_id,
    });
  }

  return { success: true };
}

export async function checkPaymentStatus(paymentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ." };
  }

  try {
    const { data: payment, error: queryError } = await supabaseAdmin
      .from("payments")
      .select("status")
      .match({ id: paymentId, user_id: user.id })
      .single();

    if (queryError || !payment) {
      return { error: "Không tìm thấy thông tin đơn thanh toán này." };
    }

    return { status: payment.status };
  } catch {
    return { error: "Hệ thống gặp sự cố khi cập nhật trạng thái đơn hàng." };
  }
}
