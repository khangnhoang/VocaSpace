import { toast } from "sonner";
import type { Locale } from "@/lib/i18n/config";
import { pickServerText, type RequestReply } from "@/lib/i18n/held-message";
import type { Translate } from "@/lib/i18n/translate";

// Thông báo của form hồ sơ và form đổi mật khẩu. Khi người dùng đổi tab, form bị unmount nhưng request còn chạy; ref "mới nhất" của
// form đã dừng cập nhật nên toast của nó có thể ra bằng ngôn ngữ cũ. Vì vậy `ProfileSidebar` (còn mounted qua mọi tab) phát toast và
// đọc ngôn ngữ ở đó; form chỉ phát khi đứng riêng (không có `onNotice`). `t` là bản dịch gốc, khóa là khóa đầy đủ từ gốc catalog.
export type ProfileNotice =
  | { type: "success"; key: string }
  | { type: "error"; text: string; reply: RequestReply; fallbackKey: string };

export type EmitProfileNotice = (notice: ProfileNotice) => void;

// Nhận ref "mới nhất" chứ không nhận giá trị, để ngôn ngữ được đọc đúng lúc toast bật.
export function showProfileNotice(notice: ProfileNotice, latest: { readonly current: { t: Translate; locale: Locale } }) {
  const now = latest.current;
  if (notice.type === "success") toast.success(now.t(notice.key));
  else toast.error(pickServerText(notice.text, notice.reply, now.locale, now.t, notice.fallbackKey));
}
