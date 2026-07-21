"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { useState } from "react";
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
  const [hasImageError, setHasImageError] = useState(false);
  const showImage = Boolean(course.courseThumbnailUrl) && !hasImageError;

  return (
    <div className="relative size-23 shrink-0 overflow-hidden rounded-2xl bg-linear-to-br from-blue-50 to-cyan-50 md:h-30 md:w-40">
      {showImage ? (
        <Image
          src={course.courseThumbnailUrl!}
          alt={`Ảnh bìa khóa học ${course.courseTitle}`}
          fill
          sizes="(max-width: 767px) 92px, 160px"
          onError={() => setHasImageError(true)}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`Chưa có ảnh bìa cho khóa học ${course.courseTitle}`}
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
      eyebrow: "BÀI HỌC CUỐI",
      cta: "Xem lại bài học cuối",
    };
  }

  if (course.status === "not-started") {
    return {
      destinationTopic: course.nextTopic,
      eyebrow: "BÀI ĐẦU TIÊN",
      cta: "Bắt đầu học",
    };
  }

  if (course.status === "in-progress") {
    return {
      destinationTopic: course.nextTopic,
      eyebrow: "BÀI TIẾP THEO",
      cta: "Tiếp tục học",
    };
  }

  return {
    destinationTopic: null,
    eyebrow: "NỘI DUNG",
    cta: null,
  };
}

export default function CourseRow({
  course,
}: {
  course: LearnDashboardCourse;
}) {
  const isCompleted = course.status === "completed";
  const isHighlighted =
    course.status === "in-progress" || course.status === "completed";
  const presentation = getCoursePresentation(course);
  const destination = presentation.destinationTopic
    ? `/learn/${course.courseSlug}/${presentation.destinationTopic.slug}`
    : null;
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
            Đã hoàn thành
          </span>
        )}

        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] leading-4.5 text-slate-600">
          <span>
            {course.status === "no-content"
              ? "Chưa có tiến độ"
              : "Tiến độ khóa học"}
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
              : `Tiến độ khóa học ${course.courseTitle}`
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
              className="h-full rounded-full bg-cyan-500 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>

        <p className="mt-2 text-[10px] font-extrabold tracking-[0.11em] text-blue-700">
          {presentation.eyebrow}
        </p>
        <p className="mt-0.5 line-clamp-2 wrap-break-word text-[13px] leading-5 text-slate-600">
          {presentation.destinationTopic?.title ??
            "Nội dung đang được cập nhật"}
        </p>
      </div>

      {destination && presentation.cta && (
        <Link
          href={destination}
          className="col-span-2 inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-center text-[13px] font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 md:col-span-1 md:w-38"
        >
          <span>{presentation.cta}</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </article>
  );
}
