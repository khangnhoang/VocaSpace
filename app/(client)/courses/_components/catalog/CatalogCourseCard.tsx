import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Layers, Play, TrendingUp, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber, formatVnd } from "@/lib/i18n/format";
import { findTitleMatch, type CatalogCourse } from "@/lib/public-courses/catalog-query";
import {
  getLearnCourseOverviewPath,
  getPublicCourseDetailPath,
  getPublicCoursePreviewPath,
} from "@/lib/public-courses/routes";

type CatalogCourseCardProps = {
  course: CatalogCourse;
  searchQuery: string;
  isEnrolled: boolean;
  showTrend: boolean;
  variant?: "grid" | "wide";
  prioritizeImage?: boolean;
};

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const match = findTitleMatch(title, query);
  if (!match) return <>{title}</>;
  const normalized = title.normalize("NFC");
  return (
    <>
      {normalized.slice(0, match[0])}
      <mark className="rounded-[3px] bg-amber-100 px-px text-inherit">
        {normalized.slice(match[0], match[1])}
      </mark>
      {normalized.slice(match[1])}
    </>
  );
}

export function CatalogCourseCard({
  course,
  searchQuery,
  isEnrolled,
  showTrend,
  variant = "grid",
  prioritizeImage = false,
}: CatalogCourseCardProps) {
  const t = useTranslations("courses");
  const locale = useLocale() as Locale;
  const wide = variant === "wide";
  const isFree = course.price === 0;
  // Số đếm đi kèm `count` để câu tiếng Anh chọn số ít/số nhiều; `formatted` là số đã định dạng theo ngôn ngữ.
  const counted = (
    key: "catalog.card.students" | "catalog.card.topics" | "catalog.card.cards" | "catalog.card.trend",
    count: number,
  ) => t(key, { count, formatted: formatNumber(locale, count) });

  return (
    <article
      className={cn(
        // Hover nâng thẻ bằng thuộc tính translate (không phải transform) để không tranh transform với motion ở CP3.
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow,translate] duration-[700ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:border-route-line hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isEnrolled ? "border-route-line" : "border-slate-200",
        wide && "md:max-w-[960px] md:flex-row",
      )}
    >
      <div
        className={cn(
          "relative aspect-4/3 shrink-0 overflow-hidden bg-slate-100 max-sm:aspect-video",
          wide && "md:aspect-auto md:min-h-72 md:w-[42%]",
        )}
      >
        {course.thumbnail_url ? (
          <Image
            src={course.thumbnail_url}
            alt={t("catalog.card.coverAlt", { title: course.title })}
            fill
            priority={prioritizeImage}
            sizes={wide ? "(max-width: 767px) 100vw, 400px" : "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"}
            className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            role="img"
            aria-label={t("catalog.card.noCover", { title: course.title })}
            className="flex h-full items-center justify-center text-slate-500"
          >
            <BookOpen aria-hidden="true" className="size-12" />
          </div>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col gap-2.5 p-5", wide && "md:gap-3 md:px-8 md:py-7")}>
        <div className="flex items-start justify-between gap-2 text-xs leading-4 text-slate-600">
          <span className="flex flex-wrap gap-1.5">
            {isEnrolled ? (
              <span className="rounded-full bg-route-quiet px-2 py-0.5 font-semibold text-route">{t("catalog.card.enrolled")}</span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                isFree ? "bg-growth-quiet text-growth" : "bg-slate-100 text-slate-600",
              )}
            >
              {isFree ? t("price.free") : t("price.paid")}
            </span>
            {course.isNew ? (
              <span className="rounded-full bg-recall-quiet px-2 py-0.5 font-semibold text-recall">{t("catalog.card.new")}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1 tabular-nums">
            <Users aria-hidden="true" className="size-3.5" />
            {counted("catalog.card.students", course.enrollment_count)}
          </span>
        </div>

        <h3
          className={cn(
            "line-clamp-2 text-lg font-bold leading-[26px] text-slate-900",
            wide && "md:line-clamp-3 md:text-2xl md:leading-8",
          )}
        >
          <Link
            href={getPublicCourseDetailPath(course.slug)}
            aria-label={t("catalog.card.viewLabel", { title: course.title })}
            title={course.title}
            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-route focus-visible:after:ring-offset-2"
          >
            <HighlightedTitle title={course.title} query={searchQuery} />
          </Link>
        </h3>

        {course.instructor_name ? (
          <p className="-mt-1 truncate text-[13px] leading-5 text-slate-600">{course.instructor_name}</p>
        ) : null}

        {course.description_excerpt ? (
          <p className={cn("line-clamp-2 text-sm leading-[22px] text-slate-600", wide && "md:line-clamp-4 md:text-[15px] md:leading-6")}>
            {course.description_excerpt}
          </p>
        ) : null}

        {course.topic_count > 0 || (showTrend && course.recent_enrollment_count > 0) ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-[family-name:var(--font-geist-sans)] text-xs font-medium leading-4 text-slate-600">
            {course.topic_count > 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Layers aria-hidden="true" className="size-3.5 text-recall" />
                  {counted("catalog.card.topics", course.topic_count)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen aria-hidden="true" className="size-3.5 text-recall" />
                  {counted("catalog.card.cards", course.card_count)}
                </span>
              </>
            ) : null}
            {showTrend && course.recent_enrollment_count > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-recall">
                <TrendingUp aria-hidden="true" className="size-3.5" />
                {counted("catalog.card.trend", course.recent_enrollment_count)}
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-200 pt-3.5">
          <p className="text-base font-extrabold leading-6 tabular-nums text-slate-900">
            {isFree ? t("price.free") : formatVnd(locale, course.price)}
          </p>
          {isEnrolled ? (
            <Link
              href={getLearnCourseOverviewPath(course.slug)}
              aria-label={t("catalog.card.continueLabel", { title: course.title })}
              className="relative z-10 -mr-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-route transition-colors duration-200 hover:bg-route-quiet focus-visible:outline-2 focus-visible:outline-route"
            >
              {t("catalog.card.continue")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : course.preview_topic_slug ? (
            <Link
              href={getPublicCoursePreviewPath(course.slug, course.preview_topic_slug)}
              aria-label={t("catalog.card.tryLabel", { title: course.title })}
              className="relative z-10 -mr-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-route transition-colors duration-200 hover:bg-route-quiet focus-visible:outline-2 focus-visible:outline-route"
            >
              <Play aria-hidden="true" className="size-3.5 fill-current" />
              {t("catalog.card.try")}
            </Link>
          ) : (
            <span aria-hidden="true" className="inline-flex items-center gap-1 font-semibold text-route">
              {t("catalog.card.detail")}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-[650ms] group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
