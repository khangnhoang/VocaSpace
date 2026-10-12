"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CompletionReviewStage {
  key: string;
  label: string;
  onSelect: () => void;
}

interface TopicCompletionPanelProps {
  topicTitle: string;
  /** `previous` is the value before this completion; it equals `completed` on a settled screen. */
  course: { completed: number; total: number; previous: number };
  chapter: {
    title: string;
    completed: number;
    total: number;
    previous: number;
  };
  /** Subordinate context shown once the chapter is finished and another chapter follows. */
  nextChapterHint: string | null;
  /** Plays the earned-completion sequence; false for a landing on a completed topic and for every later entry. */
  animate: boolean;
  /** Moves focus to the confirmation when the learner arrived here by an action, never on page load. */
  focusOnEntry: boolean;
  dueCount: number;
  onReviewDue: () => void;
  next:
    | { kind: "topic"; href: string; unitLabel: string; detail: string | null }
    | { kind: "overview"; href: string };
  reviewStages: CompletionReviewStage[];
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const percent = (value: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

/**
 * LF5 AC3/AC8: the shared completion screen of a finished topic. The text, the
 * values and every action are rendered at once; only the bars move. The sequence
 * (course progress, chapter settle, next hint, about 880 ms) runs only for a
 * completion that just happened and never under reduced motion.
 */
export default function TopicCompletionPanel({
  topicTitle,
  course,
  chapter,
  nextChapterHint,
  animate,
  focusOnEntry,
  dueCount,
  onReviewDue,
  next,
  reviewStages,
}: TopicCompletionPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [sequence] = useState(() => animate && !prefersReducedMotion());
  const [revealed, setRevealed] = useState(!sequence);

  useEffect(() => {
    if (!sequence) return;
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [sequence]);

  useEffect(() => {
    if (focusOnEntry) headingRef.current?.focus();
    // Only the entry decides focus; later renders must not take it back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courseValue = revealed ? course.completed : course.previous;
  const chapterValue = revealed ? chapter.completed : chapter.previous;
  const chapterFinished = chapter.total > 0 && chapter.completed >= chapter.total;
  const showChapterDone = chapterFinished && revealed;
  const barMotion = (delay: string, duration: string) =>
    sequence
      ? `motion-safe:transition-[width] motion-safe:ease-[cubic-bezier(0.2,0,0,1)] ${delay} ${duration}`
      : "";
  const hintMotion = sequence
    ? "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[260ms] motion-safe:delay-[620ms] motion-safe:fill-mode-backwards"
    : "";

  const nextLink =
    next.kind === "topic" ? (
      <Link href={next.href}>
        <span className="flex min-w-0 flex-col items-start text-left leading-tight">
          <span>Tiếp tục học</span>
          <span className="break-words text-sm font-medium [overflow-wrap:anywhere]">
            {next.unitLabel}
          </span>
          {next.detail && (
            <span className="break-words text-xs font-medium opacity-90 [overflow-wrap:anywhere]">
              {next.detail}
            </span>
          )}
        </span>
        <ChevronRight aria-hidden="true" />
      </Link>
    ) : (
      <Link href={next.href}>Về tổng quan khóa học</Link>
    );

  return (
    <section
      aria-labelledby="topic-completion-title"
      data-motion={sequence ? "sequence" : "settled"}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 aria-hidden="true" className="size-10 text-growth" />
        <h2
          id="topic-completion-title"
          ref={headingRef}
          tabIndex={-1}
          className="break-words text-xl font-bold leading-snug text-slate-900 outline-none [overflow-wrap:anywhere] md:text-2xl"
        >
          Đã hoàn thành chủ đề “{topicTitle}”
        </h2>
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm font-bold text-slate-700">
            <span id="completion-course-label">Tiến độ khóa học</span>
            <span>
              {course.completed}/{course.total} chủ đề
            </span>
          </div>
          <div
            role="progressbar"
            aria-labelledby="completion-course-label"
            aria-valuemin={0}
            aria-valuemax={course.total}
            aria-valuenow={course.completed}
            aria-valuetext={`${course.completed} trên ${course.total} chủ đề`}
            className="h-2.5 overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className={`h-full rounded-full bg-recall ${barMotion("motion-safe:delay-0", "motion-safe:duration-[400ms]")}`}
              style={{ width: `${percent(courseValue, course.total)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm font-bold text-slate-700">
            <span id="completion-chapter-label" className="min-w-0 break-words [overflow-wrap:anywhere]">
              {chapter.title}
            </span>
            <span className="shrink-0">
              {chapter.completed}/{chapter.total} chủ đề
            </span>
          </div>
          <div
            role="progressbar"
            aria-labelledby="completion-chapter-label"
            aria-valuemin={0}
            aria-valuemax={chapter.total}
            aria-valuenow={chapter.completed}
            aria-valuetext={`${chapter.completed} trên ${chapter.total} chủ đề của chương`}
            className="h-2 overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className={`h-full rounded-full ${showChapterDone ? "bg-growth" : "bg-recall"} ${barMotion("motion-safe:delay-[400ms]", "motion-safe:duration-[220ms]")}`}
              style={{ width: `${percent(chapterValue, chapter.total)}%` }}
            />
          </div>
          {chapterFinished && (
            <p
              className={`flex items-center gap-1.5 text-sm font-bold text-growth ${
                sequence
                  ? `motion-safe:transition-opacity motion-safe:duration-[220ms] motion-safe:delay-[400ms] ${revealed ? "opacity-100" : "opacity-0"}`
                  : ""
              }`}
            >
              <CheckCircle2 aria-hidden="true" className="size-4" />
              Đã hoàn thành chương này
            </p>
          )}
          {nextChapterHint && (
            <p className={`text-sm font-medium text-slate-600 ${hintMotion}`}>
              Tiếp theo: {nextChapterHint}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {dueCount > 0 ? (
          <>
            <Button size="lg" className="min-h-12 w-full" onClick={onReviewDue}>
              Ôn ngay {dueCount} thẻ
            </Button>
            <Button asChild size="lg" variant="outline" className="h-auto min-h-12 w-full py-2">
              {nextLink}
            </Button>
          </>
        ) : (
          <Button asChild size="lg" className="h-auto min-h-12 w-full py-2">
            {nextLink}
          </Button>
        )}
      </div>

      {reviewStages.length > 0 && (
        <div role="group" aria-label="Xem lại các bước" className="flex flex-wrap items-center gap-2">
          {reviewStages.map((stage) => (
            <Button key={stage.key} type="button" variant="outline" onClick={stage.onSelect}>
              Xem lại {stage.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
