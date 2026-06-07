import { z } from "zod";

export const discountCouponSchema = z.object({
  code: z
    .string()
    .min(1, { message: "Vui lòng nhập mã giảm giá" })
    .regex(/^[A-Z0-9]+$/, {
      message:
        "Mã giảm giá chỉ bao gồm chữ in hoa và số, không chứa ký tự đặc biệt hoặc khoảng trắng",
    }),
});

export type DiscountCouponInput = z.infer<typeof discountCouponSchema>;
