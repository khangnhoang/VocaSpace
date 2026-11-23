"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { domMax, LazyMotion, MotionConfig, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { formatCatalogCount } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import {
  countPriceGroups,
  filterAndSortCatalog,
  mostEnrolledCourses,
  paginateCatalog,
  parseCatalogQuery,
  serializeCatalogQuery,
  type CatalogCourse,
  type CatalogQuery,
} from "@/lib/public-courses/catalog-query";
import { CatalogAnimatedGrid } from "./CatalogAnimatedGrid";
import { CatalogBackToTop } from "./CatalogBackToTop";
import { CatalogCourseCard } from "./CatalogCourseCard";
import { CatalogPagination } from "./CatalogPagination";
import { CatalogStatePanel } from "./CatalogStatePanel";
import { CatalogToolbar } from "./CatalogToolbar";

const CONTAINER = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";
const RESULTS_GRID_ID = "catalog-results-grid";
const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4";

type CatalogExplorerProps = {
  courses: CatalogCourse[];
  enrolledCourseIds: string[];
};

// URL là nguồn sự thật duy nhất của bộ lọc (U2 AC5): đọc qua useSearchParams để Back/Forward render lại danh sách,
// ghi bằng history API mà Next đồng bộ vào router. Mỗi lần ghi đọc lại location hiện tại để không dùng query cũ.
function writeCatalogQuery(patch: Partial<CatalogQuery>, mode: "push" | "replace") {
  const current = parseCatalogQuery(new URLSearchParams(window.location.search));
  const search = serializeCatalogQuery({ ...current, page: 1, ...patch });
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
}

export function CatalogExplorer(props: CatalogExplorerProps) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <CatalogExplorerContent {...props} />
      </MotionConfig>
    </LazyMotion>
  );
}

function CatalogExplorerContent({ courses, enrolledCourseIds }: CatalogExplorerProps) {
  const t = useTranslations("courses");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion() ?? false;
  const [userPagedTo, setUserPagedTo] = useState<number | null>(null);
  const query = parseCatalogQuery(searchParams);
  const enrolled = useMemo(() => new Set(enrolledCourseIds), [enrolledCourseIds]);
  const results = filterAndSortCatalog(courses, query);
  const priceCounts = countPriceGroups(courses, query);
  const pageData = paginateCatalog(results, query.page);
  const focusListAfterPageChange = useRef(false);

  useEffect(() => {
    if (!focusListAfterPageChange.current) return;
    focusListAfterPageChange.current = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const list = document.getElementById(RESULTS_GRID_ID);
    list?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    list?.querySelector<HTMLAnchorElement>("h3 a")?.focus({ preventScroll: true });
  }, [pageData.page]);

  if (courses.length === 1) {
    return (
      <div className={CONTAINER}>
        <h2 className="sr-only">{t("catalog.results.title")}</h2>
        <CatalogCourseCard
          course={courses[0]}
          searchQuery=""
          isEnrolled={enrolled.has(courses[0].id)}
          showTrend={false}
          variant="wide"
          prioritizeImage
        />
      </div>
    );
  }

  const chips = [
    query.q ? { key: "q", label: t("catalog.results.chipQuery", { query: query.q }), clear: { q: "" } } : null,
    query.price !== "all"
      ? { key: "price", label: t(`price.${query.price}`), clear: { price: "all" as const } }
      : null,
    query.preview ? { key: "preview", label: t("catalog.toolbar.preview"), clear: { preview: false } } : null,
  ].filter((chip) => chip !== null);
  const clearAll = () => writeCatalogQuery({ q: "", price: "all", preview: false }, "replace");
  const changePage = (page: number) => {
    if (page === pageData.page) return;
    focusListAfterPageChange.current = true;
    setUserPagedTo(page);
    writeCatalogQuery({ page }, "push");
  };

  return (
    <>
      <CatalogToolbar
        query={query}
        priceCounts={priceCounts}
        onSearch={(q) => writeCatalogQuery({ q }, "replace")}
        onPrice={(price) => writeCatalogQuery({ price }, "replace")}
        onPreview={(preview) => writeCatalogQuery({ preview }, "replace")}
        onSort={(sort) => writeCatalogQuery({ sort }, "replace")}
        renderPriceIndicator={(active) =>
          active ? (
            <m.span
              layoutId="catalog-price-indicator"
              aria-hidden="true"
              className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_var(--color-slate-200)]"
              transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.4, 0, 0.2, 1] }}
            />
          ) : null
        }
      />

      <section aria-labelledby="catalog-results-title" className={`${CONTAINER} pt-2`}>
        <h2 id="catalog-results-title" className="sr-only">
          {t("catalog.results.title")}
        </h2>
        <p role="status" aria-live="polite" className="sr-only">
          {results.length > 0 ? t("catalog.results.found", { count: results.length }) : t("catalog.results.none")}
        </p>

        {results.length === 0 ? (
          <NoResults
            query={query}
            chips={chips}
            otherPriceCount={query.price === "all" ? 0 : priceCounts[query.price === "free" ? "paid" : "free"]}
            suggestions={mostEnrolledCourses(courses, 4)}
            enrolled={enrolled}
            onClear={(patch) => writeCatalogQuery(patch, "replace")}
            onClearAll={clearAll}
          />
        ) : (
          <>
            <div className="mb-5 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <span>
                {t.rich(results.length !== courses.length ? "catalog.results.summaryOf" : "catalog.results.summary", {
                  count: results.length,
                  total: courses.length,
                  formatted: formatCatalogCount(locale, results.length),
                  totalFormatted: formatCatalogCount(locale, courses.length),
                  sort: t(`catalog.sort.${query.sort}`),
                  b: (chunks) => <b className="font-semibold text-slate-900 tabular-nums">{chunks}</b>,
                })}
              </span>
              {chips.length > 0 ? (
                <span className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <FilterChip key={chip.key} label={chip.label} onClear={() => writeCatalogQuery(chip.clear, "replace")} />
                  ))}
                  {chips.length > 1 ? (
                    <button type="button" onClick={clearAll} className="min-h-8 pointer-coarse:min-h-11 px-1 font-semibold text-route hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-route">
                      {t("catalog.results.clearAll")}
                    </button>
                  ) : null}
                </span>
              ) : null}
            </div>

            <CatalogAnimatedGrid
              pageKey={pageData.page}
              fadeIn={userPagedTo === pageData.page}
              id={RESULTS_GRID_ID}
              className={`${GRID} scroll-mt-4 lg:scroll-mt-24`}
              items={pageData.items.map((course, index) => ({
                key: course.id,
                node: (
                  <CatalogCourseCard
                    course={course}
                    searchQuery={query.q}
                    isEnrolled={enrolled.has(course.id)}
                    showTrend={query.sort === "trending"}
                    prioritizeImage={pageData.page === 1 && index === 0}
                  />
                ),
              }))}
            />

            {pageData.totalPages > 1 ? (
              <CatalogPagination
                query={query}
                page={pageData.page}
                totalPages={pageData.totalPages}
                from={pageData.from}
                to={pageData.to}
                total={results.length}
                onPage={changePage}
              />
            ) : null}
            <CatalogBackToTop gridId={RESULTS_GRID_ID} afterCard={3} focusTargetId="catalog-title" />
          </>
        )}
      </section>
    </>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  const t = useTranslations("courses");
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={t("catalog.results.chipRemove", { label })}
      className="inline-flex min-h-8 pointer-coarse:min-h-11 items-center gap-1.5 rounded-full border border-route-line bg-route-quiet py-0 pr-1.5 pl-3 text-sm font-semibold text-route hover:border-route focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route"
    >
      {label}
      <X aria-hidden="true" className="size-3.5" />
    </button>
  );
}

type NoResultsProps = {
  query: CatalogQuery;
  chips: { key: string; label: string; clear: Partial<CatalogQuery> }[];
  otherPriceCount: number;
  suggestions: CatalogCourse[];
  enrolled: Set<string>;
  onClear: (patch: Partial<CatalogQuery>) => void;
  onClearAll: () => void;
};

function NoResults({ query, chips, otherPriceCount, suggestions, enrolled, onClear, onClearAll }: NoResultsProps) {
  const t = useTranslations("courses");
  const locale = useLocale() as Locale;
  const conditions = [
    query.q ? t("catalog.noResults.conditionQuery", { query: query.q }) : null,
    query.price !== "all" ? t("catalog.noResults.conditionPrice", { price: t(`price.${query.price}`) }) : null,
    query.preview ? t("catalog.noResults.conditionPreview") : null,
  ].filter(Boolean);
  const otherPrice = query.price === "free" ? "paid" : "free";

  return (
    <>
      <CatalogStatePanel
        art="search"
        role="status"
        eyebrow={t("catalog.noResults.eyebrow")}
        title={t("catalog.noResults.title", { conditions: conditions.join(" ") })}
        description={
          <>
            <p>{t("catalog.noResults.description")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <FilterChip key={chip.key} label={chip.label} onClear={() => onClear(chip.clear)} />
              ))}
            </div>
          </>
        }
      >
        {query.price !== "all" && otherPriceCount > 0 ? (
          <Button type="button" size="lg" onClick={() => onClear({ price: otherPrice })}>
            {t("catalog.noResults.seeOther", { count: otherPriceCount, formatted: formatCatalogCount(locale, otherPriceCount), price: t(`price.${otherPrice}`).toLowerCase() })}
          </Button>
        ) : null}
        <Button type="button" size="lg" variant="outline" onClick={onClearAll}>
          {t("catalog.noResults.clearFilters")}
        </Button>
      </CatalogStatePanel>

      <section aria-labelledby="catalog-suggestions-title" className="mt-12">
        <h2 id="catalog-suggestions-title" className="text-lg leading-[26px] font-bold text-slate-900">
          {t("catalog.noResults.suggestionsTitle")}
        </h2>
        <p className="mt-1 mb-5 text-sm text-slate-600">{t("catalog.noResults.suggestionsHint")}</p>
        <div className={GRID}>
          {suggestions.map((course) => (
            <CatalogCourseCard
              key={course.id}
              course={course}
              searchQuery=""
              isEnrolled={enrolled.has(course.id)}
              showTrend={false}
            />
          ))}
        </div>
      </section>
    </>
  );
}
