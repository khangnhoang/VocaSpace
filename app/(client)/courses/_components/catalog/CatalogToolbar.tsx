"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  Clock,
  Search,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CatalogPriceGroup, CatalogQuery } from "@/lib/public-courses/catalog-query";
import { PUBLIC_CATALOG_SEARCH_MAX_LENGTH, type PublicCatalogSort } from "@/lib/schemas/public-course";

// Thứ tự các kiểu sắp xếp trong danh sách chọn; nhãn lấy từ catalog `courses` (catalog.sort.<kiểu>).
export const CATALOG_SORTS: PublicCatalogSort[] = ["popular", "trending", "newest", "az", "price-asc", "price-desc"];

const SORT_ICONS: Record<PublicCatalogSort, LucideIcon> = {
  popular: Users,
  trending: TrendingUp,
  newest: Clock,
  az: ArrowDownAZ,
  "price-asc": ArrowUpNarrowWide,
  "price-desc": ArrowDownWideNarrow,
};

const PRICE_OPTIONS: { value: CatalogPriceGroup; labelKey: "priceAll" | "priceFree" | "pricePaid" }[] = [
  { value: "all", labelKey: "priceAll" },
  { value: "free", labelKey: "priceFree" },
  { value: "paid", labelKey: "pricePaid" },
];

const SEARCH_COMMIT_DELAY_MS = 150;
// Viền control dùng slate-500 (4,76:1) thay cho Border #CBD5E1 để đạt 3:1 theo U2 AC11 (Owner quyết định 2026-11-05).

type CatalogToolbarProps = {
  query: CatalogQuery;
  priceCounts: Record<CatalogPriceGroup, number>;
  onSearch: (q: string) => void;
  onPrice: (price: CatalogPriceGroup) => void;
  onPreview: (preview: boolean) => void;
  onSort: (sort: PublicCatalogSort) => void;
  renderPriceIndicator?: (active: boolean) => ReactNode;
};

export function CatalogToolbar({
  query,
  priceCounts,
  onSearch,
  onPrice,
  onPreview,
  onSort,
  renderPriceIndicator,
}: CatalogToolbarProps) {
  const t = useTranslations("courses");
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isStuck, setIsStuck] = useState(false);
  // Ô tìm giữ chữ đang gõ; URL chỉ nhận giá trị sau một nhịp ngắn. Khi URL đổi từ nơi khác (Back, xóa chip)
  // thì đồng bộ lại ô tìm, trừ khi đó chính là giá trị đang gõ (để không mất khoảng trắng cuối).
  const [draft, setDraft] = useState(query.q);
  const [syncedQ, setSyncedQ] = useState(query.q);
  if (query.q !== syncedQ) {
    setSyncedQ(query.q);
    if (draft.trim().slice(0, PUBLIC_CATALOG_SEARCH_MAX_LENGTH) !== query.q) setDraft(query.q);
  }

  useEffect(() => {
    // Back/Forward trong lúc đang chờ ghi từ khóa: bỏ lần ghi đó để không đè lên mục lịch sử vừa quay về.
    const cancelPendingSearch = () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
    window.addEventListener("popstate", cancelPendingSearch);
    return () => {
      window.removeEventListener("popstate", cancelPendingSearch);
      cancelPendingSearch();
    };
  }, []);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function commitSearch(value: string, immediately = false) {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    if (immediately) {
      onSearch(value);
      return;
    }
    commitTimer.current = setTimeout(() => onSearch(value), SEARCH_COMMIT_DELAY_MS);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
    commitSearch(event.target.value);
  }

  function clearSearch() {
    setDraft("");
    commitSearch("", true);
    inputRef.current?.focus();
  }

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div
        className={cn(
          "z-20 border-b bg-slate-50/95 py-3 transition-[border-color,box-shadow] duration-200 lg:sticky lg:top-0",
          isStuck ? "lg:border-slate-200 lg:shadow-[0_6px_16px_rgba(15,23,42,0.06)]" : "border-transparent",
        )}
      >
        <div role="search" className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <div className="relative w-full lg:w-auto lg:max-w-110 lg:flex-1">
            <label htmlFor="catalog-search" className="sr-only">
              {t("catalog.toolbar.searchLabel")}
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-slate-500" />
            <input
              ref={inputRef}
              id="catalog-search"
              type="search"
              value={draft}
              maxLength={PUBLIC_CATALOG_SEARCH_MAX_LENGTH}
              onChange={handleChange}
              onKeyDown={(event) => {
                if (event.key === "Escape" && draft) {
                  event.preventDefault();
                  clearSearch();
                }
              }}
              placeholder={t("catalog.toolbar.searchPlaceholder")}
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-500 bg-white pr-12 pl-10.5 text-sm text-slate-900 transition-[border-color,box-shadow] duration-150 placeholder:text-slate-500 hover:border-slate-600 focus:border-route focus:shadow-[0_0_0_3px_var(--route-quiet)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {draft ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={t("catalog.toolbar.clearSearch")}
                className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-route"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-slate-300 bg-slate-100 px-1.5 font-[family-name:var(--font-geist-sans)] text-xs leading-4 text-slate-600 lg:inline"
              >
                /
              </kbd>
            )}
          </div>

          <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
            <div
              role="group"
              aria-label={t("catalog.toolbar.priceGroup")}
              className="relative inline-flex gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-1"
            >
              {PRICE_OPTIONS.map((option) => {
                const active = query.price === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPrice(option.value)}
                    className={cn(
                      "relative inline-flex min-h-9 pointer-coarse:min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-route",
                      active ? "text-route" : "text-slate-600 hover:text-slate-900",
                      active && !renderPriceIndicator && "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_var(--color-slate-200)]",
                    )}
                  >
                    {renderPriceIndicator?.(active)}
                    <span className="relative">{t(`catalog.toolbar.${option.labelKey}`)}</span>
                    <span
                      className={cn(
                        "relative font-[family-name:var(--font-geist-sans)] text-xs leading-4 tabular-nums",
                        active ? "text-route" : "text-slate-600",
                      )}
                    >
                      {priceCounts[option.value]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            aria-pressed={query.preview}
            onClick={() => onPreview(!query.preview)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route",
              query.preview
                ? "border-route bg-route-quiet text-route"
                : "border-slate-500 bg-white text-slate-600 hover:border-route hover:text-slate-900",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-4 place-items-center rounded border-[1.5px] transition-colors duration-150",
                query.preview ? "border-route bg-route text-white" : "border-slate-500 bg-white text-transparent",
              )}
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            {t("catalog.toolbar.preview")}
          </button>

          <div className="flex flex-1 items-center gap-2 text-sm text-slate-600 sm:flex-none lg:ml-auto">
            <label htmlFor="catalog-sort" className="font-semibold whitespace-nowrap max-sm:sr-only">
              {t("catalog.toolbar.sort")}
            </label>
            <Select value={query.sort} onValueChange={(value) => onSort(value as PublicCatalogSort)}>
              <SelectTrigger
                id="catalog-sort"
                className="group h-11 w-full min-w-48 gap-2 rounded-xl border-slate-500 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-none transition-[border-color,box-shadow] duration-150 hover:border-slate-600 focus-visible:border-route focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_var(--route-quiet)] data-[size=default]:h-11 data-[state=open]:border-route data-[state=open]:shadow-[0_0_0_3px_var(--route-quiet)] sm:w-auto [&>svg:last-child]:hidden"
              >
                <SelectValue />
                <ChevronDown
                  aria-hidden="true"
                  className="ml-auto size-4 shrink-0 text-slate-600 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="end"
                sideOffset={8}
                className="w-(--radix-select-trigger-width) min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-[0_12px_32px_rgba(15,23,42,0.12)] ring-0 data-[side=bottom]:translate-y-0 motion-reduce:animate-none!"
              >
                {CATALOG_SORTS.map((sort) => {
                  const Icon = SORT_ICONS[sort];
                  return (
                    <SelectItem
                      key={sort}
                      value={sort}
                      className="min-h-9 cursor-pointer gap-2.5 rounded-lg py-1.5 pr-9 pl-2.5 text-sm leading-5 font-medium text-slate-700 transition-colors duration-150 focus:bg-slate-100 focus:text-slate-900 data-[state=checked]:bg-route-quiet data-[state=checked]:font-semibold data-[state=checked]:text-route pointer-coarse:min-h-11 motion-reduce:transition-none [&_svg]:text-current"
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0 opacity-80" />
                      {t(`catalog.sort.${sort}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </>
  );
}
