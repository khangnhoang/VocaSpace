import { resumePendingCheckout } from "@/app/actions/payment";
import { collectMessageRefs, type MessageRef } from "@/lib/i18n/message-ref";

/**
 * English localization U5 H5: chỉ dùng ở server (trang chi tiết khóa học). Gọi đúng `resumePendingCheckout` và trả nguyên kết quả
 * của nó, kèm khóa của câu thay cho số tài khoản khi action chọn câu đó, để thẻ đăng ký dịch câu ấy theo ngôn ngữ đang hiển thị
 * (thẻ chỉ đọc `resume` một lần lúc mount nên `router.refresh()` sau khi đổi ngôn ngữ không cập nhật được chuỗi đã lưu).
 */
export async function resumePendingCheckoutWithRef(
  rawInput: unknown,
): Promise<{ result: Awaited<ReturnType<typeof resumePendingCheckout>>; accountNumberRef: MessageRef | null }> {
  const { value: result, refs } = await collectMessageRefs(() => resumePendingCheckout(rawInput));
  return { result, accountNumberRef: result.status === "resume" ? (refs.accountNumber ?? null) : null };
}
