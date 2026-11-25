// lib/discounts/discount-pricing.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatVnd } from "@/lib/i18n/format";
import { recordedTranslations } from "@/lib/i18n/message-ref";

type ResolveDiscountPricingParams = {
  supabaseAdmin: SupabaseClient;
  courseId: string;
  couponCode?: string | null;
  coursePrice: number;
};

type ReserveDiscountUsageParams = {
  supabaseAdmin: SupabaseClient;
  discountId: string;
};

type ReleaseReservedDiscountParams = {
  supabaseAdmin: SupabaseClient;
  discountId: string | null | undefined;
};

export type ResolvedDiscountPricing =
  | {
      ok: true;
      discountId: string | null;
      originalAmount: number;
      discountAmount: number;
      finalAmount: number;
      discountMeta: null | {
        id: string;
        code: string;
        type: string;
        value: number;
        maxDiscountAmount: number | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

// English localization U5: lỗi trả về được dịch theo ngôn ngữ của request và ghi khóa cho trường `error` của kết quả action, để
// wrapper `*Localized` trả kèm khóa cho client (cả `validateDiscountPreview` lẫn `createCheckoutSession` trả nguyên `error` này).
function pricingErrorText() {
  return recordedTranslations("payments", "error");
}

// Tham số của `actions.pricing.minPrice` mang sẵn số tiền đã định dạng cho CẢ HAI ngôn ngữ: client dịch lại thông báo bằng đúng
// tham số đã ghi khi trang đổi ngôn ngữ, nên một chuỗi định dạng theo ngôn ngữ của request sẽ giữ sai kiểu số tiền.
// Tiếng Việt giữ đúng `toLocaleString()` không truyền locale cộng "đ" như trước (U5 G1); tiếng Anh dùng `formatVnd`.
export function minPriceParams(amount: number) {
  return { amountVi: `${amount.toLocaleString()}đ`, amountEn: formatVnd("en", amount) };
}

export function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateDiscountAmount(params: {
  coursePrice: number;
  type: string;
  value: number;
  maxDiscountAmount: number | null;
}) {
  const { coursePrice, type, value, maxDiscountAmount } = params;

  let discountAmount = 0;

  if (type === "fixed") {
    discountAmount = value;
  }

  if (type === "percentage") {
    discountAmount = Math.floor((coursePrice * value) / 100);

    if (maxDiscountAmount !== null) {
      discountAmount = Math.min(discountAmount, maxDiscountAmount);
    }
  }

  return Math.min(coursePrice, Math.max(0, discountAmount));
}

export async function resolveDiscountPricing({
  supabaseAdmin,
  courseId,
  couponCode,
  coursePrice,
}: ResolveDiscountPricingParams): Promise<ResolvedDiscountPricing> {
  if (!couponCode) {
    return {
      ok: true,
      discountId: null,
      originalAmount: coursePrice,
      discountAmount: 0,
      finalAmount: coursePrice,
      discountMeta: null,
    };
  }

  const { data: discount, error: discountError } = await supabaseAdmin
    .from("discounts")
    .select(
      `
      id,
      code,
      type,
      value,
      max_discount_amount,
      min_course_price,
      max_uses,
      uses_count,
      reserved_count,
      start_at,
      expires_at,
      removed_at,
      course_id
    `,
    )
    .eq("course_id", courseId)
    .eq("code", couponCode)
    .is("removed_at", null)
    .maybeSingle();

  const t = await pricingErrorText();

  if (discountError || !discount) {
    return { ok: false, error: t("actions.pricing.notFound") };
  }

  const now = Date.now();

  if (discount.start_at && new Date(discount.start_at).getTime() > now) {
    return { ok: false, error: t("actions.pricing.notStarted") };
  }

  if (discount.expires_at && new Date(discount.expires_at).getTime() <= now) {
    return { ok: false, error: t("actions.pricing.expired") };
  }

  const minCoursePrice = toNumber(discount.min_course_price);

  if (coursePrice < minCoursePrice) {
    return {
      ok: false,
      error: t("actions.pricing.minPrice", minPriceParams(minCoursePrice)),
    };
  }

  const maxUses = discount.max_uses as number | null;
  const usesCount = Number(discount.uses_count ?? 0);
  const reservedCount = Number(discount.reserved_count ?? 0);

  if (maxUses !== null && usesCount + reservedCount >= maxUses) {
    return { ok: false, error: t("actions.pricing.usedUp") };
  }

  const discountAmount = calculateDiscountAmount({
    coursePrice,
    type: String(discount.type),
    value: toNumber(discount.value),
    maxDiscountAmount:
      discount.max_discount_amount === null
        ? null
        : toNumber(discount.max_discount_amount),
  });

  if (discountAmount <= 0) {
    return { ok: false, error: t("actions.pricing.notApplicable") };
  }

  return {
    ok: true,
    discountId: discount.id,
    originalAmount: coursePrice,
    discountAmount,
    finalAmount: Math.max(0, coursePrice - discountAmount),
    discountMeta: {
      id: discount.id,
      code: discount.code,
      type: String(discount.type),
      value: toNumber(discount.value),
      maxDiscountAmount:
        discount.max_discount_amount === null
          ? null
          : toNumber(discount.max_discount_amount),
    },
  };
}

export async function reserveDiscountUsage({
  supabaseAdmin,
  discountId,
}: ReserveDiscountUsageParams) {
  const { data, error } = await supabaseAdmin.rpc("reserve_discount_usage", {
    p_discount_id: discountId,
  });

  if (error) {
    return {
      ok: false,
      error: (await pricingErrorText())("actions.pricing.reserveFailed"),
    };
  }

  if (data !== "SUCCESS") {
    return {
      ok: false,
      error: (await pricingErrorText())("actions.pricing.reserveSoldOut"),
    };
  }

  return { ok: true };
}

export async function releaseReservedDiscount({
  supabaseAdmin,
  discountId,
}: ReleaseReservedDiscountParams) {
  if (!discountId) return { ok: true };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: discount, error: selectError } = await supabaseAdmin
      .from("discounts")
      .select("id, reserved_count")
      .eq("id", discountId)
      .maybeSingle();

    if (selectError || !discount) {
      return { ok: false, error: "Không tìm thấy mã giảm giá để giải phóng." };
    }

    const currentReservedCount = Number(discount.reserved_count ?? 0);

    if (currentReservedCount <= 0) {
      return { ok: true };
    }

    const { data: updatedDiscount, error: updateError } = await supabaseAdmin
      .from("discounts")
      .update({
        reserved_count: currentReservedCount - 1,
      })
      .eq("id", discountId)
      .eq("reserved_count", currentReservedCount)
      .select("id")
      .maybeSingle();

    if (!updateError && updatedDiscount) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    error: "Không thể giải phóng lượt giữ mã giảm giá sau nhiều lần thử.",
  };
}