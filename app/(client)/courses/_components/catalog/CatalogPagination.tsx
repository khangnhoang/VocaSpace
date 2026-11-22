"use client";

import type { MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { formatCatalogCount } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  catalogPageWindow,
  serializeCatalogQuery,
  type CatalogQuery,
} from "@/lib/public-courses/catalog-query";

type CatalogPaginationProps = {
  query: CatalogQuery;
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
};

const ITEM =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route";

export function CatalogPagination({ query, page, totalPages, from, to, total, onPage }: CatalogPaginationProps) {
  const t = useTranslations("courses");
  const locale = useLocale() as Locale;
  const displayNumber = (value: number) => formatCatalogCount(locale, value);
  // Link thật để trang vẫn chuyển được khi JavaScript chưa chạy; khi đã hydrate thì đổi trang tại chỗ.
  const href = (target: number) => {
    const search = serializeCatalogQuery({ ...query, page: target });
    return search ? `?${search}` : "?";
  };
  const go = (target: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onPage(target);
  };

  return (
    <nav aria-label={t("catalog.pagination.nav")} className="mt-10 flex flex-col items-center gap-3">
      <ol className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <a href={href(page - 1)} onClick={go(page - 1)} aria-label={t("catalog.pagination.previousLabel")} className={cn(ITEM, "border-transparent text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900")}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span className="max-sm:hidden">{t("catalog.pagination.previous")}</span>
            </a>
          ) : (
            <span aria-disabled="true" className={cn(ITEM, "border-transparent text-slate-400")}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span className="max-sm:hidden">{t("catalog.pagination.previous")}</span>
            </span>
          )}
        </li>
        {catalogPageWindow(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="w-7 text-center text-slate-500">
              …
            </li>
          ) : (
            <li key={item}>
              <a
                href={href(item)}
                onClick={go(item)}
                aria-label={t("catalog.pagination.page", { page: displayNumber(item) })}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  ITEM,
                  item === page
                    ? "border-route-line bg-route-quiet text-route"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900",
                )}
              >
                {displayNumber(item)}
              </a>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <a href={href(page + 1)} onClick={go(page + 1)} aria-label={t("catalog.pagination.nextLabel")} className={cn(ITEM, "border-transparent text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900")}>
              <span className="max-sm:hidden">{t("catalog.pagination.next")}</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </a>
          ) : (
            <span aria-disabled="true" className={cn(ITEM, "border-transparent text-slate-400")}>
              <span className="max-sm:hidden">{t("catalog.pagination.next")}</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </span>
          )}
        </li>
      </ol>
      <p className="font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-medium text-slate-600">
        {t("catalog.pagination.showing", { from: displayNumber(from), to: displayNumber(to), total: displayNumber(total) })}
      </p>
    </nav>
  );
}
