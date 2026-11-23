import { useLayoutEffect, useRef, type RefObject } from "react";
import type { Locale } from "./config";
import type { Translate } from "./translate";

/** Ngôn ngữ mà server dùng cho request và khóa catalog của thông báo (xem `request-locale-result.ts`). */
export type RequestReply = { locale: Locale; messageKey: string | null };

/**
 * Thông báo client giữ trong state qua lần đổi ngôn ngữ. `router.refresh()` của bộ chọn ngôn ngữ giữ nguyên state của component
 * đang mount, nên một chuỗi đã dịch lưu trong state sẽ ở lại bằng ngôn ngữ cũ.
 * - `key`: thông báo do client sở hữu, lưu khóa và dịch lúc render nên đổi theo ngôn ngữ ngay.
 * - `text`: chuỗi Server Action đã dịch theo ngôn ngữ mà SERVER dùng cho request đó (không phải ngôn ngữ của tab: cookie dùng chung
 *   giữa các tab, nên tab đang hiện VI vẫn có thể nhận chuỗi EN). Chỉ hiện khi ngôn ngữ ấy khớp ngôn ngữ đang hiển thị; không khớp
 *   thì dịch lại đúng thông báo đó từ `messageKey` (khóa đầy đủ từ gốc catalog), và chỉ khi server không tìm ra khóa mới dùng
 *   `fallbackKey`, một thông báo chung do client dịch, vì cách khắc phục của các lỗi khác nhau.
 */
export type HeldMessage =
  | { kind: "key"; key: string }
  | { kind: "text"; text: string; reply: RequestReply; fallbackKey: string };

export const heldKey = (key: string): HeldMessage => ({ kind: "key", key });

export const heldText = (text: string, reply: RequestReply, fallbackKey: string): HeldMessage => ({
  kind: "text",
  text,
  reply,
  fallbackKey,
});

/** `t` dịch khóa tương đối của component (heldKey, fallbackKey); `tRoot` dịch khóa đầy đủ từ gốc (messageKey). */
export function resolveHeldMessage(message: HeldMessage | null, locale: Locale, t: Translate, tRoot: Translate): string | null {
  if (!message) return null;
  if (message.kind === "key") return t(message.key);
  if (message.reply.locale === locale) return message.text;
  return message.reply.messageKey ? tRoot(message.reply.messageKey) : t(message.fallbackKey);
}

/** Đổi khóa đầy đủ từ gốc thành khóa tương đối trong `namespace`, hoặc null khi khóa nằm ngoài namespace đó. */
export function keyWithin(messageKey: string | null, namespace: string): string | null {
  return messageKey?.startsWith(`${namespace}.`) ? messageKey.slice(namespace.length + 1) : null;
}

/**
 * Cho nơi phát thông báo tức thời (toast): dùng chuỗi server nếu nó cùng ngôn ngữ đang hiển thị lúc toast bật, không thì dịch lại
 * thông báo đó bằng `t` (khóa đầy đủ từ gốc, hoặc tương đối trong `namespace` nếu có), không tìm ra thì dùng `fallbackKey`.
 */
export function pickServerText(
  text: string,
  reply: RequestReply,
  locale: Locale,
  t: Translate,
  fallbackKey: string,
  namespace?: string,
): string {
  if (reply.locale === locale) return text;
  const key = namespace ? keyWithin(reply.messageKey, namespace) : reply.messageKey;
  return t(key ?? fallbackKey);
}

/**
 * Giá trị mới nhất của render gần nhất, cho callback async cần ngôn ngữ/bản dịch LÚC phát thông báo thay vì lúc gửi request:
 * người dùng có thể đổi ngôn ngữ trong lúc request còn chạy, và closure của lần render gửi đi vẫn giữ bản dịch cũ. Component đã
 * unmount thì ref này đứng yên, nên thông báo phải do một component còn sống phát (xem `profile-notice.ts`).
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
