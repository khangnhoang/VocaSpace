import { z } from "zod";
import { wrongType } from "./issue-keys";

// English localization U5 (H4): message là khóa trong namespace `validation`; action và hộp thoại thanh toán dịch theo ngôn ngữ
// đang dùng. Lỗi sai kiểu đi qua `wrongType` để giữ đúng văn bản mặc định của Zod như trước (U2 G2).
export const discountCouponSchema = z.object(
  {
    code: z
      .string({ error: wrongType("string") })
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(
        z
          .string()
          .min(1, { message: "discount.codeRequired" })
          .regex(/^[A-Z0-9]+$/, {
            message: "discount.codeFormat",
          }),
      ),
  },
  { error: wrongType("object") },
);

export type DiscountCouponInput = z.infer<typeof discountCouponSchema>;
