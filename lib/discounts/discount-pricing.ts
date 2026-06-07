// lib/discounts/discount-pricing.ts

type ResolveDiscountPricingParams = {
  supabaseAdmin: any;
  courseId: string;
  couponCode?: string | null;
  coursePrice: number;
};

type ReserveDiscountUsageParams = {
  supabaseAdmin: any;
  discountId: string;
};

type ReleaseReservedDiscountParams = {
  supabaseAdmin: any;
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

  if (discountError || !discount) {
    return { ok: false, error: "Mã giảm giá không tồn tại hoặc hết hạn sử dụng." };
  }

  const now = Date.now();

  if (discount.start_at && new Date(discount.start_at).getTime() > now) {
    return { ok: false, error: "Mã giảm giá chưa đến thời gian sử dụng." };
  }

  if (discount.expires_at && new Date(discount.expires_at).getTime() <= now) {
    return { ok: false, error: "Mã giảm giá đã hết hạn sử dụng." };
  }

  const minCoursePrice = toNumber(discount.min_course_price);

  if (coursePrice < minCoursePrice) {
    return {
      ok: false,
      error: `Mã giảm giá chỉ áp dụng cho khóa học từ ${minCoursePrice.toLocaleString()}đ.`,
    };
  }

  const maxUses = discount.max_uses as number | null;
  const usesCount = Number(discount.uses_count ?? 0);
  const reservedCount = Number(discount.reserved_count ?? 0);

  if (maxUses !== null && usesCount + reservedCount >= maxUses) {
    return { ok: false, error: "Mã giảm giá đã hết lượt sử dụng." };
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
    return { ok: false, error: "Mã giảm giá không hợp lệ cho khóa học này." };
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
      usesCount,
      reservedCount,
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
      error: "Không thể giữ lượt mã giảm giá, vui lòng thử lại.",
    };
  }

  if (data !== "SUCCESS") {
    return {
      ok: false,
      error: "Mã giảm giá vừa hết lượt sử dụng, vui lòng thử lại mã khác.",
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