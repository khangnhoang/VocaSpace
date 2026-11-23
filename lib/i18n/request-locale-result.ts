import { getLocale } from "next-intl/server";
import type { Locale } from "./config";

// English localization U2: cookie ngôn ngữ dùng chung giữa các tab, nên chuỗi mà action trả về có thể khác ngôn ngữ của tab đã gửi
// request (tab A hiện VI, tab B đổi sang EN, rồi tab A gửi form). Các wrapper `*Localized` gọi đúng action gốc, giữ nguyên kết quả
// và hợp đồng của nó, rồi trả kèm ngôn ngữ mà next-intl dùng cho request này (cùng nguồn với `getTranslations` trong action) để
// client biết chuỗi ấy đang ở ngôn ngữ nào. Wrapper không thêm quyền, dữ liệu hay nhánh nào: action gốc vẫn tự kiểm tra auth và
// redirect như trước. Helper nằm ngoài các tệp "use server" để không trở thành action công khai.
export type WithRequestLocale<T> = { result: T; locale: Locale };

export async function withRequestLocale<T>(result: T): Promise<WithRequestLocale<T>> {
  return { result, locale: (await getLocale()) as Locale };
}
