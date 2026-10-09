// app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage.tsx
"use client";
import React, { useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { FlashcardDTO } from "@/lib/schemas/learn";
import { Rating } from "ts-fsrs";

interface FlashcardStageProps {
  currentCard: FlashcardDTO;
  cardsLeft: number;
  totalCards: number;
  isFlipped: boolean;
  setIsFlipped: (val: boolean) => void;
  handleRateCard: (rating: Rating) => void;
  isPending: boolean;
}

type CardBack = FlashcardDTO["back_content"];

// Recall difficulty only: Attention for the harder ratings, Recall for the easier
// ones. It is not a correct/incorrect signal, so Growth and Correction stay unused.
const RATINGS = [
  {
    rating: Rating.Again,
    label: "Lại",
    className: "border-attention-line bg-attention-quiet text-attention hover:bg-attention-quiet hover:border-attention",
  },
  {
    rating: Rating.Hard,
    label: "Khó",
    className: "border-attention-line bg-white text-attention hover:bg-attention-quiet hover:border-attention",
  },
  {
    rating: Rating.Good,
    label: "Ổn",
    className: "border-recall-line bg-white text-recall hover:bg-recall-quiet hover:border-recall",
  },
  {
    rating: Rating.Easy,
    label: "Dễ",
    className: "border-recall-line bg-recall-quiet text-recall hover:bg-recall-quiet hover:border-recall",
  },
] as const;

const CENTERED = "group-data-[variant=centered]/back";

/**
 * One structure with two presentations, chosen by `data-variant` on the root:
 * `centered` is the D6 review-card composition for backs that fit the fixed box,
 * the default `reading` layout is left-aligned and scrolls inside the face. The
 * attribute is set by the stage after measuring, never by React, so a re-render
 * cannot undo it. Labels switch to screen-reader-only in `centered`, so the spoken
 * content is identical in both.
 */
function BackContent({ back, rootRef }: { back: CardBack; rootRef: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={rootRef}
      data-flashcard-back=""
      className={`group/back m-auto flex w-full min-w-0 flex-col gap-2 text-left data-[variant=centered]:max-w-2xl data-[variant=centered]:items-center data-[variant=centered]:gap-4 data-[variant=centered]:text-center`}
    >
      <p
        className={`break-words text-xl font-bold text-recall [overflow-wrap:anywhere] md:text-2xl ${CENTERED}:text-[clamp(1.5rem,3vw,2rem)] ${CENTERED}:font-semibold ${CENTERED}:leading-[1.35]`}
      >
        <span className={`${CENTERED}:sr-only`}>Nghĩa: </span>
        {back?.translation}
      </p>

      {back?.example && (
        <p
          className={`break-words text-base font-medium italic leading-relaxed text-slate-800 [overflow-wrap:anywhere] md:text-lg ${CENTERED}:font-normal ${CENTERED}:not-italic ${CENTERED}:leading-7 ${CENTERED}:text-slate-600`}
        >
          <span className={`${CENTERED}:sr-only`}>VD: </span>
          <span className={`${CENTERED}:hidden`}>&quot;</span>
          {back.example}
          <span className={`${CENTERED}:hidden`}>&quot;</span>
        </p>
      )}

      {back?.exampleTranslation && (
        <p
          className={`break-words text-sm text-slate-600 [overflow-wrap:anywhere] md:text-base ${CENTERED}:leading-6 ${CENTERED}:text-slate-600 ${CENTERED}:md:text-sm`}
        >
          <span className={`${CENTERED}:sr-only`}>Dịch: </span>
          {back.exampleTranslation}
        </p>
      )}

      {back?.explanation && (
        <div className={`mt-1 border-t border-slate-200 pt-3 ${CENTERED}:w-full ${CENTERED}:border-recall-line ${CENTERED}:pt-4`}>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">
            Giải thích chi tiết
          </p>
          <p className="break-words text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
            {back.explanation}
          </p>
        </div>
      )}

      {back?.hint && (
        <p className="mt-2 break-words rounded-lg border border-attention-line bg-attention-quiet px-3.5 py-2 text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
          <span aria-hidden="true">💡 </span>Mẹo: {back.hint}
        </p>
      )}
    </div>
  );
}

export default function FlashcardStage({
  currentCard,
  cardsLeft,
  totalCards,
  isFlipped,
  setIsFlipped,
  handleRateCard,
  isPending,
}: FlashcardStageProps) {
  // Like the D6 review card, one physical card turns over and turns back: after a
  // confirmed rating it keeps showing the answer it just revealed while it comes
  // back to the front, and only the next reveal shows the new card's answer.
  const [shown, setShown] = useState({ card: currentCard, isFlipped });
  const [previousBack, setPreviousBack] = useState<CardBack | null>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const firstRatingRef = useRef<HTMLButtonElement>(null);
  const hasInteracted = useRef(false);
  const backFaceRef = useRef<HTMLDivElement>(null);
  const backContentRef = useRef<HTMLDivElement>(null);
  const back = isFlipped
    ? currentCard?.back_content
    : (previousBack ?? currentCard?.back_content);

  if (shown.card !== currentCard || shown.isFlipped !== isFlipped) {
    if (shown.isFlipped && !isFlipped && shown.card) {
      setPreviousBack(shown.card.back_content);
    }
    setShown({ card: currentCard, isFlipped });
  }

  // Decide the back's presentation from the real overflow, not from text length:
  // try the centered composition and keep it only when it fits the fixed face. All
  // three steps run before paint (layout effect / resize callback), and the face is
  // hidden until it turns, so the learner never sees the swap.
  useLayoutEffect(() => {
    const face = backFaceRef.current;
    const content = backContentRef.current;
    if (!face || !content) return;
    const evaluate = () => {
      content.dataset.variant = "centered";
      const fits = face.scrollHeight <= face.clientHeight + 1;
      content.dataset.variant = fits ? "centered" : "reading";
    };
    evaluate();
    // Re-measure when the face changes size (viewport, breakpoint, zoom) or fonts settle.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(evaluate);
    observer?.observe(face);
    void document.fonts?.ready.then(evaluate);
    return () => observer?.disconnect();
  }, [back]);

  useEffect(() => {
    if (!hasInteracted.current) return;
    // Reveal moves focus to the first rating; the next front returns it to Reveal.
    (isFlipped ? firstRatingRef : revealRef).current?.focus();
  }, [isFlipped]);

  if (!currentCard) return null;

  const front = currentCard.front_content;
  const completedCards = Math.max(0, totalCards - cardsLeft);
  const progressPercentage =
    totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  return (
    <div className="flex w-full min-w-0 flex-col items-center font-sans">
      <div className="w-full max-w-3xl [perspective:1100px]">
        {/* Fixed height: long and short cards occupy the same box, so nothing below it
            moves when the card changes. Content that does not fit scrolls inside its face. */}
        <div
          data-flashcard-box=""
          className={`grid h-[19rem] grid-rows-[minmax(0,1fr)] [transform-style:preserve-3d] transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] sm:h-[21rem] lg:h-[23rem] motion-reduce:transition-none motion-reduce:[transform:none] ${
            isFlipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div
            aria-hidden={isFlipped || undefined}
            inert={isFlipped}
            tabIndex={isFlipped ? undefined : 0}
            className={`col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col overflow-y-auto rounded-3xl border border-slate-300 bg-white px-5 py-6 text-center shadow-[0_8px_24px_rgb(15_23_42/8%)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route sm:p-8 motion-reduce:transition-opacity motion-reduce:duration-100 ${
              isFlipped ? "motion-reduce:opacity-0" : ""
            }`}
          >
            <div className="m-auto flex w-full min-w-0 flex-col items-center gap-4">
              <p className="max-w-full break-words text-[clamp(1.875rem,6vw,4rem)] font-semibold leading-[1.12] tracking-tight text-slate-900 [overflow-wrap:anywhere]">
                {front?.word}
              </p>
              {(front?.pos || front?.phonetic) && (
                <p className="flex max-w-full flex-wrap items-center justify-center gap-2 text-base font-medium text-slate-600">
                  {front?.pos && <span className="font-bold text-recall">({front.pos})</span>}
                  {front?.pos && front?.phonetic && (
                    <span aria-hidden="true" className="text-slate-400">|</span>
                  )}
                  {front?.phonetic && (
                    <span className="max-w-full break-words [overflow-wrap:anywhere]">
                      {front.phonetic}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div
            ref={backFaceRef}
            aria-hidden={!isFlipped || undefined}
            inert={!isFlipped}
            tabIndex={isFlipped ? 0 : undefined}
            className={`col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col overflow-y-auto rounded-3xl border border-slate-300 bg-[linear-gradient(140deg,#fff,#ecfeff)] px-5 py-6 shadow-[0_8px_24px_rgb(15_23_42/8%)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route sm:p-8 motion-reduce:[transform:none] motion-reduce:transition-opacity motion-reduce:duration-100 ${
              isFlipped ? "" : "motion-reduce:opacity-0"
            }`}
          >
            <BackContent back={back} rootRef={backContentRef} />
          </div>
        </div>
      </div>

      <div className="mt-5 w-full max-w-3xl">
        {!isFlipped ? (
          <Button
            ref={revealRef}
            size="lg"
            onClick={() => {
              hasInteracted.current = true;
              setIsFlipped(true);
            }}
            className="min-h-12 w-full text-base"
          >
            Hiện đáp án
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {RATINGS.map(({ rating, label, className }, index) => (
              <Button
                key={label}
                ref={index === 0 ? firstRatingRef : undefined}
                disabled={isPending}
                onClick={() => handleRateCard(rating)}
                variant="outline"
                size="lg"
                className={`min-h-12 px-1 text-sm sm:text-base ${className}`}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex w-full max-w-3xl flex-col items-center gap-2">
        <div
          role="progressbar"
          aria-label="Tiến độ từ vựng"
          aria-valuemin={0}
          aria-valuemax={totalCards}
          aria-valuenow={completedCards}
          aria-valuetext={`Còn ${cardsLeft} trên ${totalCards} thẻ`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-recall transition-[width] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-sm font-bold tabular-nums tracking-wide text-slate-600">
          {cardsLeft} / {totalCards}
        </p>
      </div>
    </div>
  );
}
