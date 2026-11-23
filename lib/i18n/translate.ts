import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE } from "./config";

// Hàm dịch lỏng kiểu (khóa là string) cho các helper thuần dùng chung giữa client, server và test. `useTranslations`/`getTranslations`
// trả hàm có kiểu khóa chặt nên phải qua `asTranslate` một lần ở chỗ gọi; khóa vẫn được kiểm bởi catalog parity và test render.
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function asTranslate(t: unknown): Translate {
  return t as Translate;
}

// Helper thuần (deckScene, curveGeometry, mailboxLinkFor…) nhận `t` tuỳ chọn; thiếu thì dùng bản tiếng Việt lấy thẳng từ catalog
// của đúng namespace đó, để test hiện có giữ nguyên assertion mà chuỗi tiếng Việt chỉ nằm ở catalog. Chỉ truyền catalog của
// namespace mình cần (không phải MESSAGES) để không kéo mọi namespace vào bundle client.
export function staticTranslate(namespace: string, catalog: object): Translate {
  return asTranslate(
    createTranslator({ locale: DEFAULT_LOCALE, messages: { [namespace]: catalog }, namespace } as never),
  );
}

/**
 * Message của issue Zod là khóa catalog, hoặc `khóa|kiểu nhận được` cho lỗi sai kiểu (xem `wrongType`). Trả văn bản đã dịch.
 */
export function translateIssueMessage(t: Translate, message: string): string {
  const [key, received] = message.split("|");
  return received === undefined ? t(key) : t(key, { received });
}
