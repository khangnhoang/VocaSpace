"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LearnDashboardCourse } from "@/lib/schemas/learn-dashboard";

function getCourseInitials(title: string) {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toLocaleUpperCase("vi-VN");
}

export function CourseThumbnail({ course }: { course: LearnDashboardCourse }) {
  const t = useTranslations("learn");
  const [hasImageError, setHasImageError] = useState(false);
  const showImage = Boolean(course.courseThumbnailUrl) && !hasImageError;

  return (
    <div className="relative size-23 shrink-0 overflow-hidden rounded-2xl bg-linear-to-br from-blue-50 to-cyan-50 md:h-30 md:w-40">
      {showImage ? (
        <Image
          src={course.courseThumbnailUrl!}
          alt={t("courseRow.coverAlt", { title: course.courseTitle })}
          fill
          sizes="(max-width: 767px) 92px, 160px"
          onError={() => setHasImageError(true)}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={t("courseRow.coverMissing", { title: course.courseTitle })}
          className="flex size-full items-center justify-center text-blue-700"
        >
          <span className="text-xl font-extrabold tracking-tight md:text-3xl">
            {getCourseInitials(course.courseTitle) || (
              <BookOpen aria-hidden="true" className="size-8" />
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function getCoursePresentation(course: LearnDashboardCourse) {
  if (course.status === "completed") {
    return {
      destinationTopic: course.lastTopic,
      eyebrowKey: "courseRow.completedEyebrow",
      ctaKey: "courseRow.completedCta",
    } as const;
  }

  if (course.status === "not-started") {
    return {
      destinationTopic: course.nextTopic,
      eyebrowKey: "courseRow.notStartedEyebrow",
      ctaKey: "courseRow.notStartedCta",
    } as const;
  }

  if (course.status === "in-progress") {
    return {
      destinationTopic: course.nextTopic,
      eyebrowKey: "courseRow.inProgressEyebrow",
      ctaKey: "courseRow.inProgressCta",
    } as const;
  }

  return {
    destinationTopic: null,
    eyebrowKey: "courseRow.contentEyebrow",
    ctaKey: null,
  } as const;
}

export default function CourseRow({
  course,
}: {
  course: LearnDashboardCourse;
}) {
  const t = useTranslations("learn");
  const locale = useLocale();
  const isCompleted = course.status === "completed";
  const isHighlighted = course.status === "in-progress";
  const presentation = getCoursePresentation(course);
  const destination = presentation.destinationTopic
    ? `/learn/${course.courseSlug}/${presentation.destinationTopic.slug}`
    : null;
  const overviewDestination = `/learn/${course.courseSlug}`;
  const progress = isCompleted ? 100 : (course.progressPercentage ?? 0);

  return (
    <article
      className={`grid min-h-40 min-w-0 grid-cols-[92px_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-[20px] border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] md:flex md:min-h-46 md:flex-wrap md:items-center md:gap-5 md:p-5 ${
        isHighlighted ? "border-blue-200" : "border-slate-200"
      }`}
    >
      <CourseThumbnail
        key={course.courseThumbnailUrl ?? "fallback"}
        course={course}
      />

      <div className="min-w-0 md:min-w-64 md:flex-1">
        <h3 className="line-clamp-2 min-w-0 wrap-break-word text-base font-bold leading-6 text-slate-950">
          {course.courseTitle}
        </h3>
        {isCompleted && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-800">
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            {t("courseRow.completedBadge")}
          </span>
        )}

        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] leading-4.5 text-slate-600">
          <span>
            {course.status === "no-content"
              ? t("courseRow.noProgress")
              : t("courseRow.progress")}
          </span>
          <span className="shrink-0 font-bold text-blue-700">
            {course.status === "no-content" ? "—" : `${progress}%`}
          </span>
        </div>
        <div
          role={course.status === "no-content" ? undefined : "progressbar"}
          aria-label={
            course.status === "no-content"
              ? undefined
              : t("courseRow.progressLabel", { title: course.courseTitle })
          }
          aria-valuemin={course.status === "no-content" ? undefined : 0}
          aria-valuemax={course.status === "no-content" ? undefined : 100}
          aria-valuenow={
            course.status === "no-content" ? undefined : progress
          }
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
        >
          {course.status !== "no-content" && (
            <div
              className={`h-full rounded-full transition-[width] ${isCompleted ? "bg-growth" : "bg-recall"}`}
              style={{ width: `${progress}%` }}
            />
          )}
        </div>

        <p className="mt-2 text-[10px] font-extrabold tracking-[0.11em] text-blue-700">
          {t(presentation.eyebrowKey)}
        </p>
        <p className="mt-0.5 line-clamp-2 wrap-break-word text-[13px] leading-5 text-slate-600">
          {presentation.destinationTopic?.title ??
            t("courseRow.updating")}
        </p>
      </div>

      {/* The Vietnamese labels fit the 10rem column; the English ones are longer ("Review the last lesson" needs about 12.5rem with its arrow), so the column is 13rem wide in English. */}
      <div
        className={`col-span-2 flex w-full shrink-0 flex-col gap-2 md:col-span-1 ${
          locale === "en" ? "md:w-52" : "md:w-40"
        }`}
      >
        {destination && presentation.ctaKey && (
          <Button
            asChild
            variant={isCompleted ? "outline" : "default"}
            className="h-11 w-full text-center [@media(hover:hover)_and_(pointer:fine)]:h-9"
          >
            <Link href={destination}>
              <span>{t(presentation.ctaKey)}</span>
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        )}

        <Button
          asChild
          variant="outline"
          className={`h-11 w-full text-center [@media(hover:hover)_and_(pointer:fine)]:h-9 ${
            destination
              ? "text-route underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:border-transparent [@media(hover:hover)_and_(pointer:fine)]:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
              : ""
          }`}
        >
          <Link href={overviewDestination}>{t("courseRow.overview")}</Link>
        </Button>
      </div>
    </article>
  );
}
