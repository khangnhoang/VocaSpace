import viAuth from "@/messages/vi/auth.json";
import { staticTranslate } from "@/lib/i18n/translate";

// Bản dịch tiếng Việt mặc định cho các helper thuần của auth khi người gọi không truyền `t` (xem staticTranslate).
export const viAuthText = staticTranslate("auth", viAuth);
