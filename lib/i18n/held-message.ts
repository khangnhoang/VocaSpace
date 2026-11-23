import type { Locale } from "./config";
import type { Translate } from "./translate";

/**
 * Thông báo client giữ trong state qua lần đổi ngôn ngữ. `router.refresh()` của bộ chọn ngôn ngữ giữ nguyên state của component
 * đang mount, nên một chuỗi đã dịch lưu trong state sẽ ở lại bằng ngôn ngữ cũ.
 * - `key`: thông báo do client sở hữu, lưu khóa và dịch lúc render nên đổi theo ngôn ngữ ngay.
 * - `text`: chuỗi Server Action đã dịch theo ngôn ngữ của request; gắn ngôn ngữ đó và chỉ hiện khi còn khớp ngôn ngữ đang dùng,
 *   kể cả phản hồi về muộn sau khi người dùng đã đổi (đổi lại thì hiện lại, vì chuỗi vẫn đúng ngôn ngữ của nó).
 */
export type HeldMessage = { kind: "key"; key: string } | { kind: "text"; text: string; locale: Locale };

export const heldKey = (key: string): HeldMessage => ({ kind: "key", key });

export const heldText = (text: string, requestLocale: Locale): HeldMessage => ({ kind: "text", text, locale: requestLocale });

export function resolveHeldMessage(message: HeldMessage | null, locale: Locale, t: Translate): string | null {
  if (!message) return null;
  if (message.kind === "key") return t(message.key);
  return message.locale === locale ? message.text : null;
}
