import { AsyncLocalStorage } from "node:async_hooks";
import { getTranslations } from "next-intl/server";
import { asTranslate, type Translate } from "./translate";

/**
 * Khóa catalog đầy đủ từ gốc (ví dụ `validation.profile.usernameMin`) và tham số nội suy của một thông báo Server Action, ghi lại
 * đúng nơi action chọn thông báo. Client dùng nó để dịch lại ĐÚNG thông báo đó sang ngôn ngữ của trang khi server và trang lệch
 * ngôn ngữ (cookie ngôn ngữ dùng chung giữa các tab); không bao giờ suy khóa ngược từ chuỗi đã dịch (plan G3).
 */
export type MessageRef = { key: string; params?: Record<string, string | number> };

// Phạm vi một lần gọi wrapper `*Localized` (request-scoped, không dùng chung giữa các request). Action gốc không biết có wrapper hay không:
// khi không có phạm vi nào thì `recordMessage` không làm gì, nên kết quả và hành vi của action gốc giữ nguyên.
const scope = new AsyncLocalStorage<{ ref: MessageRef | null }>();

export function recordMessage(ref: MessageRef) {
  const current = scope.getStore();
  if (current) current.ref = ref;
}

/** Chạy `run` và trả kèm thông báo cuối cùng mà nó dịch qua một translator ghi nhận (`recordedTranslations`). */
export async function collectMessageRef<T>(run: () => Promise<T>): Promise<{ value: T; ref: MessageRef | null }> {
  const current: { ref: MessageRef | null } = { ref: null };
  const value = await scope.run(current, run);
  return { value, ref: current.ref };
}

/**
 * Translator cho một namespace, mỗi lần dịch ghi lại (khóa đầy đủ, tham số). Các action này chỉ gọi nó ngay tại câu lệnh `return`
 * trả về đúng thông báo đó, nên bản ghi cuối cùng là thông báo của kết quả.
 */
export async function recordedTranslations(namespace: string): Promise<Translate> {
  // Tên namespace là chuỗi tự do ở đây; khóa vẫn được kiểm bởi catalog parity và test, như `asTranslate`.
  const t = asTranslate(await getTranslations(namespace as never));
  return (key, params) => {
    recordMessage({ key: `${namespace}.${key}`, ...(params ? { params } : {}) });
    return t(key, params);
  };
}
