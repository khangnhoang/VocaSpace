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
const scope = new AsyncLocalStorage<{ ref: MessageRef | null; fields: Record<string, MessageRef> }>();

// `field` dùng cho kết quả mang nhiều thông báo hệ thống cùng lúc (U3 H4: `error`, `explanation`, `progressError`): mỗi trường có bản ghi
// riêng nên một thông báo không đè lên thông báo khác. Không truyền `field` thì giữ nguyên hành vi một khóa của U2.
export function recordMessage(ref: MessageRef, field?: string) {
  const current = scope.getStore();
  if (!current) return;
  if (field) current.fields[field] = ref;
  else current.ref = ref;
}

/** Chạy `run` và trả kèm thông báo cuối cùng mà nó dịch qua một translator ghi nhận (`recordedTranslations`). */
export async function collectMessageRef<T>(run: () => Promise<T>): Promise<{ value: T; ref: MessageRef | null }> {
  const current: { ref: MessageRef | null; fields: Record<string, MessageRef> } = { ref: null, fields: {} };
  const value = await scope.run(current, run);
  return { value, ref: current.ref };
}

/** Như `collectMessageRef` nhưng trả bản ghi theo từng trường kết quả (xem `recordedTranslations(namespace, field)`). */
export async function collectMessageRefs<T>(run: () => Promise<T>): Promise<{ value: T; refs: Record<string, MessageRef> }> {
  const current: { ref: MessageRef | null; fields: Record<string, MessageRef> } = { ref: null, fields: {} };
  const value = await scope.run(current, run);
  return { value, refs: current.fields };
}

/**
 * Translator cho một namespace, mỗi lần dịch ghi lại (khóa đầy đủ, tham số). Các action này chỉ gọi nó ngay tại câu lệnh `return`
 * trả về đúng thông báo đó, nên bản ghi cuối cùng là thông báo của kết quả.
 */
export async function recordedTranslations(namespace: string, field?: string): Promise<Translate> {
  // Tên namespace là chuỗi tự do ở đây; khóa vẫn được kiểm bởi catalog parity và test, như `asTranslate`.
  const t = asTranslate(await getTranslations(namespace as never));
  return (key, params) => {
    recordMessage({ key: `${namespace}.${key}`, ...(params ? { params } : {}) }, field);
    return t(key, params);
  };
}
