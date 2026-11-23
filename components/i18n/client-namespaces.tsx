import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { pickClientMessages } from "@/lib/i18n/messages";
import type { AppMessages } from "@/lib/i18n/messages";

// Provider lồng nhau cho một subtree cần thêm namespace ngoài `common` và `validation` (U2 H2, G4). Chạy ở server nên chỉ các
// namespace được liệt kê mới xuống trình duyệt, và locale lấy đúng từ request như provider gốc.
export async function ClientNamespaces({
  namespaces,
  children,
}: {
  namespaces: readonly (keyof AppMessages)[];
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <NextIntlClientProvider locale={locale} messages={pickClientMessages(locale, namespaces)}>
      {children}
    </NextIntlClientProvider>
  );
}
