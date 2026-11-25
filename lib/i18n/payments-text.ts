import { createTranslator } from "next-intl";
import viPayments from "@/messages/vi/payments.json";
import viValidation from "@/messages/vi/validation.json";
import { DEFAULT_LOCALE } from "./config";
import { asTranslate } from "./translate";

// Tiếng Việt lấy thẳng từ catalog cho các thành phần thanh toán được gọi không qua provider (test gọi hàm trực tiếp, như
// `viCoursesText`). Khóa tính từ gốc (`payments.…`, `validation.…`) vì thông báo của action mang khóa đầy đủ từ gốc catalog.
export const viPaymentsRootText = asTranslate(
  createTranslator({ locale: DEFAULT_LOCALE, messages: { payments: viPayments, validation: viValidation } } as never),
);
