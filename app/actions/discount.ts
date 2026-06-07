"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { discountCouponSchema } from "@/lib/schemas/discount";
import {
  resolveDiscountPricing,
  toNumber,
} from "@/lib/discounts/discount-pricing";

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const discountPreviewInputSchema = z.object({
  courseId: z.string().min(1, { message: "ID khóa học không được để trống" }),
  code: discountCouponSchema.shape.code,
});

export async function validateDiscountPreview(rawInput: unknown) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Bạn cần đăng nhập để sử dụng mã giảm giá." };
  }

  const inputValidation = discountPreviewInputSchema.safeParse(rawInput);

  if (!inputValidation.success) {
    return { error: inputValidation.error.issues[0].message };
  }

  const { courseId, code } = inputValidation.data;

  try {
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, title, price, status, removed_at")
      .eq("id", courseId)
      .maybeSingle();

    if (
      courseError ||
      !course ||
      course.removed_at ||
      course.status !== "published"
    ) {
      return { error: "Khóa học không tồn tại hoặc chưa được mở bán." };
    }

    const coursePrice = toNumber(course.price);

    if (coursePrice <= 0) {
      return { error: "Mã giảm giá không áp dụng cho khóa học miễn phí." };
    }

    const resolvedDiscount = await resolveDiscountPricing({
      supabaseAdmin,
      courseId,
      couponCode: code,
      coursePrice,
    });

    if (!resolvedDiscount.ok) {
      return { error: resolvedDiscount.error };
    }

    if (!resolvedDiscount.discountMeta) {
      return { error: "Mã giảm giá không hợp lệ." };
    }

    return {
      success: true,
      message: "Áp dụng mã giảm giá thành công",
      discount: {
        id: resolvedDiscount.discountMeta.id,
        code: resolvedDiscount.discountMeta.code,
        type: resolvedDiscount.discountMeta.type,
        value: resolvedDiscount.discountMeta.value,
        maxDiscountAmount: resolvedDiscount.discountMeta.maxDiscountAmount,
      },
      pricing: {
        originalAmount: resolvedDiscount.originalAmount,
        discountAmount: resolvedDiscount.discountAmount,
        finalAmount: resolvedDiscount.finalAmount,
      },
    };
  } catch {
    return { error: "Hệ thống gặp sự cố khi kiểm tra mã giảm giá." };
  }
}