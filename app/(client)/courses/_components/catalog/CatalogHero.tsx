import { BookOpen, Gift, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";

const ENTER =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[700ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] motion-safe:fill-mode-both";

export type CatalogFacts = { total: number; free: number; preview: number };

export function CatalogHero({ facts }: { facts: CatalogFacts | null }) {
  const t = useTranslations("courses");
  const locale = useLocale() as Locale;
  // Con số in đậm nằm trong câu dịch (<b>) để thứ tự từ theo từng ngôn ngữ.
  const fact = (key: "total" | "free" | "preview", count: number) =>
    t.rich(`catalog.hero.${key}`, {
      count,
      formatted: formatNumber(locale, count),
      b: (chunks) => <b className="font-semibold text-slate-900 tabular-nums">{chunks}</b>,
    });

  return (
    <section aria-labelledby="catalog-title" className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-4 sm:px-6 sm:pt-12 sm:pb-6">
      <p className={`${ENTER} font-[family-name:var(--font-geist-sans)] text-xs font-semibold uppercase leading-4 tracking-[0.04em] text-recall`}>
        {t("catalog.hero.eyebrow")}
      </p>
      <h1
        id="catalog-title"
        tabIndex={-1}
        className={`outline-none ${ENTER} motion-safe:delay-[60ms] mt-3 max-w-[18em] text-[32px] font-extrabold leading-10 tracking-[-0.02em] text-balance text-slate-900 sm:text-[40px] sm:leading-12`}
      >
        {t("catalog.hero.title")}
      </h1>
      <p className={`${ENTER} motion-safe:delay-[120ms] mt-3 max-w-[40em] text-base leading-[26px] text-slate-600`}>
        {t("catalog.hero.intro")}
      </p>
      {facts ? (
        <ul
          aria-label={t("catalog.hero.factsLabel")}
          className={`${ENTER} motion-safe:delay-[180ms] mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600`}
        >
          <li className="flex items-center gap-2">
            <BookOpen aria-hidden="true" className="size-4 text-recall" />
            <span>{fact("total", facts.total)}</span>
          </li>
          {facts.free > 0 ? (
            <li className="flex items-center gap-2">
              <Gift aria-hidden="true" className="size-4 text-recall" />
              <span>{fact("free", facts.free)}</span>
            </li>
          ) : null}
          {facts.preview > 0 ? (
            <li className="flex items-center gap-2">
              <Play aria-hidden="true" className="size-3.5 fill-current text-recall" />
              <span>{fact("preview", facts.preview)}</span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
