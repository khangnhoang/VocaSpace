"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogPriceGroup, CatalogQuery } from "@/lib/public-courses/catalog-query";
import { PUBLIC_CATALOG_SEARCH_MAX_LENGTH, type PublicCatalogSort } from "@/lib/schemas/public-course";

export const CATALOG_SORT_LABELS: Record<PublicCatalogSort, string> = {
  popular: "Phổ biến nhất",
  trending: "Thịnh hành 30 ngày",
  newest: "Mới nhất",
  az: "Tên A–Z",
  "price-asc": "Giá thấp đến cao",
  "price-desc": "Giá cao đến thấp",
};

const PRICE_OPTIONS: { value: CatalogPriceGroup; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "free", label: "Miễn phí" },
  { value: "paid", label: "Trả phí" },
];

const SEARCH_COMMIT_DELAY_MS = 150;

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
              Tìm khóa học theo tên
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
              placeholder="Tìm theo tên khóa học"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pr-12 pl-10.5 text-sm text-slate-900 transition-[border-color,box-shadow] duration-150 placeholder:text-slate-500 hover:border-slate-400 focus:border-route focus:shadow-[0_0_0_3px_var(--route-quiet)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {draft ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-route"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-slate-300 bg-slate-100 px-1.5 font-[family-name:var(--font-geist-sans)] text-xs leading-4 text-slate-500 lg:inline"
              >
                /
              </kbd>
            )}
          </div>

          <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
            <div
              role="group"
              aria-label="Lọc theo giá"
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
                    <span className="relative">{option.label}</span>
                    <span
                      className={cn(
                        "relative font-[family-name:var(--font-geist-sans)] text-xs leading-4 tabular-nums",
                        active ? "text-route" : "text-slate-500",
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
                ? "border-route-line bg-route-quiet text-route"
                : "border-slate-300 bg-white text-slate-600 hover:border-route-line hover:text-slate-900",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-4 place-items-center rounded border-[1.5px] transition-colors duration-150",
                query.preview ? "border-route bg-route text-white" : "border-slate-400 bg-white text-transparent",
              )}
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            Có học thử
          </button>

          <div className="flex flex-1 items-center gap-2 text-sm text-slate-600 sm:flex-none lg:ml-auto">
            <label htmlFor="catalog-sort" className="font-semibold whitespace-nowrap max-sm:sr-only">
              Sắp xếp
            </label>
            <div className="relative w-full sm:w-auto">
              <select
                id="catalog-sort"
                value={query.sort}
                onChange={(event) => onSort(event.target.value as PublicCatalogSort)}
                className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-300 bg-white pr-10 pl-3.5 text-sm font-semibold text-slate-900 hover:border-slate-400 focus:border-route focus:shadow-[0_0_0_3px_var(--route-quiet)] focus:outline-none"
              >
                {(Object.keys(CATALOG_SORT_LABELS) as PublicCatalogSort[]).map((sort) => (
                  <option key={sort} value={sort}>
                    {CATALOG_SORT_LABELS[sort]}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
