import { useLayoutEffect, useRef, type RefObject } from "react";
import type { Locale } from "./config";
import type { Translate } from "./translate";

/**
 * Thông báo client giữ trong state qua lần đổi ngôn ngữ. `router.refresh()` của bộ chọn ngôn ngữ giữ nguyên state của component
 * đang mount, nên một chuỗi đã dịch lưu trong state sẽ ở lại bằng ngôn ngữ cũ.
 * - `key`: thông báo do client sở hữu, lưu khóa và dịch lúc render nên đổi theo ngôn ngữ ngay.
 * - `text`: chuỗi Server Action đã dịch theo ngôn ngữ mà SERVER dùng cho request đó (không phải ngôn ngữ của tab: cookie dùng chung
 *   giữa các tab, nên tab đang hiện VI vẫn có thể nhận chuỗi EN). Chỉ hiện khi ngôn ngữ ấy khớp ngôn ngữ đang hiển thị; không khớp
 *   thì hiện `fallbackKey`, một thông báo chung do client dịch, để người dùng luôn thấy lỗi bằng đúng ngôn ngữ của trang.
 */
export type HeldMessage =
  | { kind: "key"; key: string }
  | { kind: "text"; text: string; responseLocale: Locale; fallbackKey: string };

export const heldKey = (key: string): HeldMessage => ({ kind: "key", key });

export const heldText = (text: string, responseLocale: Locale, fallbackKey: string): HeldMessage => ({
  kind: "text",
  text,
  responseLocale,
  fallbackKey,
});

export function resolveHeldMessage(message: HeldMessage | null, locale: Locale, t: Translate): string | null {
  if (!message) return null;
  if (message.kind === "key") return t(message.key);
  return message.responseLocale === locale ? message.text : t(message.fallbackKey);
}

/**
 * Cho nơi phát thông báo tức thời (toast): chọn chuỗi server nếu nó cùng ngôn ngữ đang hiển thị lúc toast bật, không thì dùng
 * thông báo chung của client.
 */
export function pickServerText(text: string, responseLocale: Locale, locale: Locale, fallback: string): string {
  return responseLocale === locale ? text : fallback;
}

/**
 * Giá trị mới nhất của render gần nhất, cho callback async cần ngôn ngữ/bản dịch LÚC phát thông báo thay vì lúc gửi request:
 * người dùng có thể đổi ngôn ngữ trong lúc request còn chạy, và closure của lần render gửi đi vẫn giữ bản dịch cũ.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
