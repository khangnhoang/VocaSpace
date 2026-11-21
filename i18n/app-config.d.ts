import type { Locale } from "@/lib/i18n/config";
import type { AppMessages } from "@/lib/i18n/messages";

// Khóa dịch được kiểm khi typecheck: gọi `t("khoa.khong.ton.tai")` là lỗi tsc thay vì hiện khóa thô trên giao diện.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: AppMessages;
  }
}
