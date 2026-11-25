import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkoutInputSchema } from "@/lib/schemas/payment";
import { discountCouponSchema } from "@/lib/schemas/discount";
import { MESSAGES } from "@/lib/i18n/messages";
import { asTranslate, staticTranslate, translateIssueMessage } from "@/lib/i18n/translate";
import { createTranslator } from "next-intl";

// Test plan:
// - Mục tiêu: English localization U5 H4/G1 - checkoutInputSchema và discountCouponSchema nhận/từ chối đúng như trước và thông
//   báo tiếng Việt sau khi dịch khóa trùng từng chữ với thông báo của schema trước U5 (kể cả văn bản mặc định của Zod cho lỗi sai
//   kiểu); bản tiếng Anh không có khóa thô.
// - Loại test: schema thuần; so với bản sao nguyên văn của hai schema ở base `70c12e11` trên cùng một bộ đầu vào dò.
// - Khoảng trống đã biết: thông báo của checkoutResponseSchema không đổi (lỗi đó chỉ bị bắt ở server, không tới người dùng).

const baseCoupon = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .min(1, { message: "Vui lòng nhập mã giảm giá" })
      .regex(/^[A-Z0-9]+$/, {
        message:
          "Mã giảm giá chỉ bao gồm chữ in hoa và số, không chứa ký tự đặc biệt hoặc khoảng trắng",
      }),
  );
const BASE = {
  discountCouponSchema: z.object({ code: baseCoupon }),
  checkoutInputSchema: z.object({
    courseId: z.string().min(1, { message: "ID khóa học không được để trống" }),
    couponCode: baseCoupon.optional(),
  }),
};
const CURRENT = { discountCouponSchema, checkoutInputSchema };

const VALUES: unknown[] = [undefined, null, 1, true, [], {}, "", " ", "abc", "abc1", "SALE-1", "Sale 20", "ÂU", "VOCASPACE100"];
const WHOLE: unknown[] = [undefined, null, "x", 1, [], {}];

function cases(schema: keyof typeof BASE): unknown[] {
  const result: unknown[] = [...WHOLE];
  for (const value of VALUES) {
    if (schema === "discountCouponSchema") result.push({ code: value });
    else {
      result.push({ courseId: value });
      result.push({ courseId: "c1", couponCode: value });
    }
  }
  return result;
}

const viValidation = staticTranslate("validation", MESSAGES.vi.validation);
const enValidation = asTranslate(
  createTranslator({ locale: "en", messages: { validation: MESSAGES.en.validation }, namespace: "validation" } as never),
);

describe.each(Object.keys(BASE) as (keyof typeof BASE)[])("%s keeps its behavior and Vietnamese text", (name) => {
  it("accepts and rejects the same inputs with the same Vietnamese messages", () => {
    for (const input of cases(name)) {
      const before = BASE[name].safeParse(input);
      const after = CURRENT[name].safeParse(input);
      expect(after.success, JSON.stringify(input)).toBe(before.success);
      if (before.success && after.success) expect(after.data).toEqual(before.data);
      if (!before.success && !after.success) {
        expect(after.error.issues.map((issue) => translateIssueMessage(viValidation, issue.message))).toEqual(
          before.error.issues.map((issue) => issue.message),
        );
        for (const issue of after.error.issues) {
          const english = translateIssueMessage(enValidation, issue.message);
          expect(english).not.toMatch(/^(payment|discount|zodType)\./);
          expect(english).not.toMatch(/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i);
        }
      }
    }
  });
});
