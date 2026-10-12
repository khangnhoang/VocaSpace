"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  /** Subordinate "next unit" context (next topic, next chapter or the course overview); the only part the sequence reveals last. */
  nextHint: string;
  /** Plays the earned-completion sequence; false for a landing on a completed topic and for every later entry. */
  animate: boolean;
  /** Moves focus to the confirmation when the learner arrived here by an action, never on page load. */
  focusOnEntry: boolean;
  dueCount: number;
  onReviewDue: () => void;
  next:
    | { kind: "topic"; href: string; unitLabel: string; detail: string | null }
    | { kind: "overview"; href: string };
  /** Points the learner at the stage thread; undefined when the topic has no stage to review (no button, no hint). */
  onReview?: () => void;
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

// Owner Q7 (2026-10-12): each fill runs a fixed duration whatever the size of the change, so a small gain stays visible.
// The whole sequence (~1.5 s) deliberately exceeds the 600-900 ms product-language cap for this screen only. Easing is the accepted token.
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const COURSE_BAR = { delay: 0, duration: 1200 };
const CHAPTER_BAR = { delay: 250, duration: 1000 };
const GAIN_FADE_MS = 300;
// The hint and the chapter-done note wait 1250 ms (the literal `delay-[1250ms]` classes below) so they follow the bars.

interface ProgressFillProps {
  previous: number;
  completed: number;
  total: number;
  sequence: boolean;
  revealed: boolean;
  timing: { delay: number; duration: number };
  /** Fill colour once settled. */
  tone: string;
}

/** The fill from `previous` to `completed`; during the sequence the gained segment is tinted, then settles to the fill colour. */
function ProgressFill({ previous, completed, total, sequence, revealed, timing, tone }: ProgressFillProps) {
  const from = percent(previous, total);
  const to = percent(completed, total);
  const shown = sequence && !revealed ? from : to;
  const grow = (property: string) => ({
    transitionProperty: property,
    transitionDuration: `${timing.duration}ms`,
    transitionDelay: `${timing.delay}ms`,
    transitionTimingFunction: EASE,
  });
  return (
    <>
      <div
        className={`h-full rounded-full ${tone}`}
        style={{ width: `${shown}%`, ...(sequence ? grow("width") : {}) }}
      />
      {sequence && (
        <div
          aria-hidden="true"
          data-completion-gain
          className="absolute inset-y-0 rounded-full bg-white/60"
          style={{
            left: `${from}%`,
            width: revealed ? `${Math.max(0, to - from)}%` : "0%",
            opacity: revealed ? 0 : 1,
            transitionProperty: "width, opacity",
            transitionDuration: `${timing.duration}ms, ${GAIN_FADE_MS}ms`,
            transitionDelay: `${timing.delay}ms, ${timing.delay + timing.duration}ms`,
            transitionTimingFunction: EASE,
          }}
        />
      )}
    </>
  );
}

/**
 * LF5 AC3/AC8: the shared completion screen of a finished topic. The text, the
 * values and every action are rendered at once; only the bars move. The sequence
 * (course fill, chapter fill, next hint, about 1.5 s: an Owner-accepted deviation from the 600-900 ms cap for this screen) runs only for a
 * completion that just happened and never under reduced motion.
 */
export default function TopicCompletionPanel({
  topicTitle,
  course,
  chapter,
  nextHint,
  animate,
  focusOnEntry,
  dueCount,
  onReviewDue,
  next,
  onReview,
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

  const chapterFinished = chapter.total > 0 && chapter.completed >= chapter.total;
  const showChapterDone = chapterFinished && revealed;
  // The hint (and the chapter-done note) is the last step: it appears once both fills have finished.
  const hintMotion = sequence
    ? "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[260ms] motion-safe:delay-[1250ms] motion-safe:fill-mode-backwards"
    : "";

  const nextLink =
    next.kind === "topic" ? (
      // Owner Q8: one line; the next topic is already named in the hint above.
      <Link href={next.href}>Chủ đề tiếp theo</Link>
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
            className="relative h-2.5 overflow-hidden rounded-full bg-slate-200"
          >
            <ProgressFill
              previous={course.previous}
              completed={course.completed}
              total={course.total}
              sequence={sequence}
              revealed={revealed}
              timing={COURSE_BAR}
              tone="bg-recall"
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
            className="relative h-2.5 overflow-hidden rounded-full bg-slate-200"
          >
            <ProgressFill
              previous={chapter.previous}
              completed={chapter.completed}
              total={chapter.total}
              sequence={sequence}
              revealed={revealed}
              timing={CHAPTER_BAR}
              tone={showChapterDone ? "bg-growth" : "bg-recall"}
            />
          </div>
          {chapterFinished && (
            <p
              className={`flex items-center gap-1.5 text-sm font-bold text-growth ${
                sequence
                  ? `motion-safe:transition-opacity motion-safe:duration-[260ms] motion-safe:delay-[1250ms] ${revealed ? "opacity-100" : "opacity-0"}`
                  : ""
              }`}
            >
              <CheckCircle2 aria-hidden="true" className="size-4" />
              Đã hoàn thành chương này
            </p>
          )}
          <p data-completion-hint className={`text-sm font-medium text-slate-600 ${hintMotion}`}>
            Tiếp theo: {nextHint}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {dueCount > 0 ? (
          <>
            {/* Owner Q10/Q12/Q13: a small context line over the larger action, both starting at the same x inside a block
                the button centres; the accessible name keeps both lines. Stacked in every input mode (Q13). */}
            <Button
              size="lg"
              className="h-auto min-h-14 w-full py-2"
              aria-label={`Có ${dueCount} thẻ đến hạn, Ôn ngay`}
              onClick={onReviewDue}
            >
              <span aria-hidden="true" className="flex flex-col items-start gap-0.5 text-left">
                <span data-due-line className="text-xs font-medium leading-4">
                  Có {dueCount} thẻ đến hạn
                </span>
                <span data-due-line className="text-lg font-bold leading-6">
                  Ôn ngay
                </span>
              </span>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-auto min-h-12 w-full py-2 text-base">
              {nextLink}
            </Button>
          </>
        ) : (
          <Button asChild size="lg" className="h-auto min-h-12 w-full py-2 text-base">
            {nextLink}
          </Button>
        )}
      </div>

      {onReview && (
        // LF6 AC4 (LF5 Q9): one outline action that draws attention to the stage thread, plus a line saying what to do there.
        <div className="flex flex-col items-center gap-2">
          <Button type="button" variant="outline" className="h-auto min-h-11 w-full px-3 py-2" onClick={onReview}>
            Xem lại
          </Button>
          <p className="text-center text-sm font-medium text-slate-600">
            Chọn một bước ở thanh tiến trình để xem lại.
          </p>
        </div>
      )}
    </section>
  );
}
