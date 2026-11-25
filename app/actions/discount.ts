"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { discountCouponSchema } from "@/lib/schemas/discount";
import { wrongType } from "@/lib/schemas/issue-keys";
import { recordedTranslations } from "@/lib/i18n/message-ref";
import { translateIssueMessage } from "@/lib/i18n/translate";
import {
  resolveDiscountPricing,
  toNumber,
} from "@/lib/discounts/discount-pricing";

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// English localization U5 (H4): message là khóa trong namespace `validation`, dịch ở nhánh trả lỗi bên dưới.
const discountPreviewInputSchema = z.object(
  {
    courseId: z.string({ error: wrongType("string") }).min(1, { message: "payment.courseIdRequired" }),
    code: discountCouponSchema.shape.code,
  },
  { error: wrongType("object") },
);

export async function validateDiscountPreview(rawInput: unknown) {
  // Lỗi và thông báo thành công ghi khóa theo trường (`error`, `message`), cùng trường mà `resolveDiscountPricing` ghi lỗi của nó.
  const t = await recordedTranslations("payments", "error");
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: t("actions.discount.authRequired") };
  }

  const inputValidation = discountPreviewInputSchema.safeParse(rawInput);

  if (!inputValidation.success) {
    return {
      error: translateIssueMessage(
        await recordedTranslations("validation", "error"),
        inputValidation.error.issues[0].message,
      ),
    };
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
      return { error: t("actions.discount.courseUnavailable") };
    }

    const coursePrice = toNumber(course.price);

    if (coursePrice <= 0) {
      return { error: t("actions.discount.freeCourse") };
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
      return { error: t("actions.discount.invalid") };
    }

    return {
      success: true,
      message: (await recordedTranslations("payments", "message"))("actions.discount.applied"),
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
    return { error: t("actions.discount.checkFailed") };
  }
}