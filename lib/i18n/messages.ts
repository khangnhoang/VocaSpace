import enAuth from "@/messages/en/auth.json";
import enCommon from "@/messages/en/common.json";
import enValidation from "@/messages/en/validation.json";
import viAuth from "@/messages/vi/auth.json";
import viCommon from "@/messages/vi/common.json";
import viValidation from "@/messages/vi/validation.json";
import type { Locale } from "./config";

// Mỗi namespace là một tệp riêng (H2) để các unit sau thêm namespace mà ít đụng nhau. Bộ tiếng Việt là bộ gốc về kiểu;
// test parity bắt lệch khóa giữa hai ngôn ngữ.
const viMessages = { common: viCommon, validation: viValidation, auth: viAuth };
export type AppMessages = typeof viMessages;

export const MESSAGES: Record<Locale, AppMessages> = {
  vi: viMessages,
  en: { common: enCommon, validation: enValidation, auth: enAuth },
};

// G5/G4: client chỉ nhận các namespace mà subtree của nó dùng. `common` và `validation` luôn có vì provider gốc gửi chúng,
// và provider lồng nhau thay (không gộp) messages của provider cha khi truyền `messages` (use-intl), nên mỗi provider lồng
// phải liệt kê đủ cả hai.
export const CLIENT_NAMESPACES = ["common", "validation"] as const satisfies readonly (keyof AppMessages)[];

export function pickClientMessages(locale: Locale, extra: readonly (keyof AppMessages)[] = []) {
  const messages = MESSAGES[locale];
  const namespaces = [...CLIENT_NAMESPACES, ...extra] as const;
  return Object.fromEntries(namespaces.map((namespace) => [namespace, messages[namespace]]));
}
