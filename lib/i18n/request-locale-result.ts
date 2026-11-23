import { getLocale } from "next-intl/server";
import type { Locale } from "./config";
import { collectMessageRef } from "./message-ref";

// English localization U2: cookie ngôn ngữ dùng chung giữa các tab, nên chuỗi mà action trả về có thể khác ngôn ngữ của tab đã gửi
// request (tab A hiện VI, tab B đổi sang EN, rồi tab A gửi form). Các wrapper `*Localized` gọi đúng action gốc, giữ nguyên kết quả
// và hợp đồng của nó, rồi trả kèm ngôn ngữ mà next-intl dùng cho request này (cùng nguồn với `getTranslations` trong action) và khóa
// catalog + tham số của thông báo, để client biết chuỗi ấy ở ngôn ngữ nào và dịch lại đúng thông báo đó (không phải một thông báo
// chung, vì cách khắc phục có thể khác nhau) khi trang đang hiện ngôn ngữ khác. Khóa do chính action ghi lại lúc chọn thông báo
// (`message-ref.ts`), không suy ngược từ chuỗi đã dịch. Wrapper không thêm quyền, dữ liệu hay nhánh nào: action gốc vẫn tự kiểm tra
// auth và redirect như trước. Helper nằm ngoài các tệp "use server" để không trở thành action công khai.
export type WithRequestLocale<T> = {
  result: T;
  locale: Locale;
  messageKey: string | null;
  messageParams?: Record<string, string | number>;
};

// Kết quả mang thông báo khi có `error` hoặc `message` là chuỗi; kết quả khác (`success`, `data`, `status`) thì không có khóa nào để dịch lại.
function carriesMessage(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const { error, message } = result as { error?: unknown; message?: unknown };
  return typeof error === "string" || typeof message === "string";
}

export async function withRequestLocale<T>(run: () => Promise<T>): Promise<WithRequestLocale<T>> {
  const { value, ref } = await collectMessageRef(run);
  const locale = (await getLocale()) as Locale;
  if (!ref || !carriesMessage(value)) return { result: value, locale, messageKey: null };
  return { result: value, locale, messageKey: ref.key, ...(ref.params ? { messageParams: ref.params } : {}) };
}
