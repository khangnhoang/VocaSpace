import type { ReactNode } from "react";
import { NextIntlClientProvider, useLocale } from "next-intl";
import DocumentLang from "@/components/i18n/document-lang";
import type { Locale } from "@/lib/i18n/config";
import { pickClientMessages } from "@/lib/i18n/messages";

// Provider và `lang` của layout gốc có thể sống sót qua điều hướng client vào hoặc ra khỏi khu vực bị khóa (U9 H4). Mỗi layout
// khu vực (học viên, giáo viên, admin) và not-found gốc render lại theo request của nó, nên bọc cây của mình bằng ngôn ngữ đúng.
// Provider lồng nhau thay (không gộp) messages của provider cha, nên chỉ gửi đúng hai namespace mà provider gốc gửi.
export default function AreaLocale({ children }: { children: ReactNode }) {
  const locale = useLocale() as Locale;

  return (
    <NextIntlClientProvider locale={locale} messages={pickClientMessages(locale)}>
      <DocumentLang locale={locale} />
      {children}
    </NextIntlClientProvider>
  );
}
