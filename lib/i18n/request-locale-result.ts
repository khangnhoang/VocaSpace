import { getLocale } from "next-intl/server";
import type { Locale } from "./config";
import { findMessageKey } from "./message-key";

// English localization U2: cookie ngôn ngữ dùng chung giữa các tab, nên chuỗi mà action trả về có thể khác ngôn ngữ của tab đã gửi
// request (tab A hiện VI, tab B đổi sang EN, rồi tab A gửi form). Các wrapper `*Localized` gọi đúng action gốc, giữ nguyên kết quả
// và hợp đồng của nó, rồi trả kèm ngôn ngữ mà next-intl dùng cho request này (cùng nguồn với `getTranslations` trong action) và khóa
// catalog của thông báo, để client biết chuỗi ấy ở ngôn ngữ nào và dịch lại đúng thông báo đó (không phải một thông báo chung, vì cách
// khắc phục có thể khác nhau) khi trang đang hiện ngôn ngữ khác. Wrapper không thêm quyền, dữ liệu hay nhánh nào: action gốc vẫn tự
// kiểm tra auth và redirect như trước. Helper nằm ngoài các tệp "use server" để không trở thành action công khai.
export type WithRequestLocale<T> = { result: T; locale: Locale; messageKey: string | null };

function messageOf(result: unknown): unknown {
  if (!result || typeof result !== "object") return null;
  const { error, message } = result as { error?: unknown; message?: unknown };
  return typeof error === "string" ? error : message;
}

export async function withRequestLocale<T>(result: T, namespaces: readonly string[]): Promise<WithRequestLocale<T>> {
  const locale = (await getLocale()) as Locale;
  return { result, locale, messageKey: findMessageKey(messageOf(result), locale, namespaces) };
}
