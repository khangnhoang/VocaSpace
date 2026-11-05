import { BookOpen, Gift, Play } from "lucide-react";

const ENTER =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[700ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] motion-safe:fill-mode-both";

export type CatalogFacts = { total: number; free: number; preview: number };

const numberFormatter = new Intl.NumberFormat("vi-VN");

export function CatalogHero({ facts }: { facts: CatalogFacts | null }) {
  return (
    <section aria-labelledby="catalog-title" className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-4 sm:px-6 sm:pt-12 sm:pb-6">
      <p className={`${ENTER} font-[family-name:var(--font-geist-sans)] text-xs font-semibold uppercase leading-4 tracking-[0.04em] text-recall`}>
        Thư viện khóa học
      </p>
      <h1
        id="catalog-title"
        className={`${ENTER} motion-safe:delay-[60ms] mt-3 max-w-[18em] text-[32px] font-extrabold leading-10 tracking-[-0.02em] text-balance text-slate-900 sm:text-[40px] sm:leading-12`}
      >
        Tìm khóa học hợp với mục tiêu của bạn
      </h1>
      <p className={`${ENTER} motion-safe:delay-[120ms] mt-3 max-w-[40em] text-base leading-[26px] text-slate-600`}>
        Mỗi khóa là một lộ trình chủ đề với thẻ từ vựng và bài luyện. Nhiều khóa cho học thử ngay, không cần đăng nhập.
      </p>
      {facts ? (
        <ul
          aria-label="Tổng quan thư viện"
          className={`${ENTER} motion-safe:delay-[180ms] mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600`}
        >
          <li className="flex items-center gap-2">
            <BookOpen aria-hidden="true" className="size-4 text-recall" />
            <span>
              <b className="font-semibold text-slate-900 tabular-nums">{numberFormatter.format(facts.total)}</b> khóa học
            </span>
          </li>
          {facts.free > 0 ? (
            <li className="flex items-center gap-2">
              <Gift aria-hidden="true" className="size-4 text-recall" />
              <span>
                <b className="font-semibold text-slate-900 tabular-nums">{numberFormatter.format(facts.free)}</b> khóa miễn phí
              </span>
            </li>
          ) : null}
          {facts.preview > 0 ? (
            <li className="flex items-center gap-2">
              <Play aria-hidden="true" className="size-3.5 fill-current text-recall" />
              <span>
                <b className="font-semibold text-slate-900 tabular-nums">{numberFormatter.format(facts.preview)}</b> khóa cho
                học thử không cần đăng nhập
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
