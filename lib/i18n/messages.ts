import enCommon from "@/messages/en/common.json";
import enValidation from "@/messages/en/validation.json";
import viCommon from "@/messages/vi/common.json";
import viValidation from "@/messages/vi/validation.json";
import type { Locale } from "./config";

// Mỗi namespace là một tệp riêng (H2) để các unit sau thêm namespace mà ít đụng nhau. Bộ tiếng Việt là bộ gốc về kiểu;
// test parity bắt lệch khóa giữa hai ngôn ngữ.
const viMessages = { common: viCommon, validation: viValidation };
export type AppMessages = typeof viMessages;

export const MESSAGES: Record<Locale, AppMessages> = {
  vi: viMessages,
  en: { common: enCommon, validation: enValidation },
};

// G5: chỉ các namespace mà client component đã chuyển đổi dùng mới được gửi xuống trình duyệt.
export const CLIENT_NAMESPACES = ["common", "validation"] as const satisfies readonly (keyof AppMessages)[];

export function pickClientMessages(locale: Locale) {
  const messages = MESSAGES[locale];
  return Object.fromEntries(CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]]));
}
