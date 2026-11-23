import type { Locale } from "./config";
import { MESSAGES } from "./messages";

// Chỉ mục "chuỗi -> khóa" theo (ngôn ngữ, danh sách namespace), dựng một lần. Khóa là đường dẫn đầy đủ từ gốc, ví dụ
// `auth.actions.samePassword`. Chuỗi trùng ở nhiều khóa được đánh dấu null vì không biết khóa nào mới đúng ý.
const indexes = new Map<string, Map<string, string | null>>();

function indexFor(locale: Locale, namespaces: readonly string[]) {
  const id = `${locale}:${namespaces.join(",")}`;
  let index = indexes.get(id);
  if (!index) {
    const built = new Map<string, string | null>();
    const catalog = MESSAGES[locale] as unknown as Record<string, unknown>;
    const walk = (node: unknown, path: string) => {
      if (typeof node === "string") built.set(node, built.has(node) ? null : path);
      else if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
    };
    for (const namespace of namespaces) walk(catalog[namespace], namespace);
    indexes.set(id, built);
    index = built;
  }
  return index;
}

/**
 * Tìm khóa catalog của một chuỗi Server Action đã dịch, để client dịch lại đúng thông báo đó sang ngôn ngữ của trang khi server và
 * trang lệch ngôn ngữ. Trả null khi chuỗi không khớp đúng một khóa (có tham số nội suy, trùng nhiều khóa, hoặc không có trong catalog);
 * nơi gọi khi đó dùng thông báo chung.
 */
export function findMessageKey(text: unknown, locale: Locale, namespaces: readonly string[]): string | null {
  return typeof text === "string" ? (indexFor(locale, namespaces).get(text) ?? null) : null;
}
