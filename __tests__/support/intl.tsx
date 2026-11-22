import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { hydrateRoot as reactHydrateRoot } from "react-dom/client";
import {
  renderToStaticMarkup as reactRenderToStaticMarkup,
  renderToString as reactRenderToString,
} from "react-dom/server";
import type { Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";

// Provider dùng chung cho test component (English localization U1): mặc định tiếng Việt, giống root layout khi cờ tắt.
// Test hiện có chỉ đổi dòng import `render`/`renderToStaticMarkup`/`renderToString`/`hydrateRoot` sang tệp này; test tiếng Anh truyền `locale: "en"`.
export * from "@testing-library/react";

function IntlWrapper({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Ho_Chi_Minh">
      {children}
    </NextIntlClientProvider>
  );
}

export function render(ui: ReactElement, options: RenderOptions & { locale?: Locale } = {}) {
  const { locale = "vi", ...rest } = options;
  return rtlRender(ui, {
    ...rest,
    wrapper: ({ children }) => <IntlWrapper locale={locale}>{children}</IntlWrapper>,
  });
}

export function renderToStaticMarkup(ui: ReactElement, { locale = "vi" }: { locale?: Locale } = {}) {
  return reactRenderToStaticMarkup(<IntlWrapper locale={locale}>{ui}</IntlWrapper>);
}

export function renderToString(ui: ReactElement, { locale = "vi" }: { locale?: Locale } = {}) {
  return reactRenderToString(<IntlWrapper locale={locale}>{ui}</IntlWrapper>);
}

// Khớp với `renderToString` ở trên: provider không sinh DOM nên markup SSR và markup hydrate giống hệt nhau.
export function hydrateRoot(container: Element | Document, ui: ReactElement, { locale = "vi" }: { locale?: Locale } = {}) {
  return reactHydrateRoot(container, <IntlWrapper locale={locale}>{ui}</IntlWrapper>);
}
