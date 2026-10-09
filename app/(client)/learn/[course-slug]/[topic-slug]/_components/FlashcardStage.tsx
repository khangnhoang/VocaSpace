// app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
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

// Matches the 240ms ghost keyframes in globals.css, with a little slack.
const GHOST_LIFETIME_MS = 280;

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

function BackContent({ back }: { back: CardBack }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 text-left">
      <p className="break-words text-xl font-bold text-recall [overflow-wrap:anywhere] md:text-2xl">
        Nghĩa: {back?.translation}
      </p>

      {back?.example && (
        <p className="break-words text-base font-medium italic leading-relaxed text-slate-800 [overflow-wrap:anywhere] md:text-lg">
          VD: &quot;{back.example}&quot;
        </p>
      )}

      {back?.exampleTranslation && (
        <p className="break-words text-sm text-slate-600 [overflow-wrap:anywhere] md:text-base">
          Dịch: {back.exampleTranslation}
        </p>
      )}

      {back?.explanation && (
        <div className="mt-1 border-t border-slate-200 pt-3">
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
  // The previous answer, kept only as an inert visual while it folds away after a
  // confirmed rating. The real back face always holds the *current* card.
  const [shown, setShown] = useState({ card: currentCard, isFlipped });
  const [ghost, setGhost] = useState<{ back: CardBack; serial: number } | null>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const firstRatingRef = useRef<HTMLButtonElement>(null);
  const hasInteracted = useRef(false);

  if (shown.card !== currentCard || shown.isFlipped !== isFlipped) {
    // A flipped card turning back to its front only happens after a rating was
    // confirmed, so that moment is when the old answer must fold away.
    if (shown.isFlipped && !isFlipped && shown.card) {
      const back = shown.card.back_content;
      setGhost((previous) => ({ back, serial: (previous?.serial ?? 0) + 1 }));
    }
    setShown({ card: currentCard, isFlipped });
  }

  useEffect(() => {
    if (!ghost) return;
    const timer = window.setTimeout(() => setGhost(null), GHOST_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [ghost]);

  useEffect(() => {
    if (!hasInteracted.current) return;
    // Reveal moves focus to the first rating; the next front returns it to Reveal.
    (isFlipped ? firstRatingRef : revealRef).current?.focus();
  }, [isFlipped]);

  if (!currentCard) return null;

  const front = currentCard.front_content;
  const back = currentCard.back_content;
  const completedCards = Math.max(0, totalCards - cardsLeft);
  const progressPercentage =
    totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  return (
    <div className="flex w-full min-w-0 flex-col items-center font-sans">
      <div className="relative w-full max-w-3xl [perspective:1200px]">
        {/* One card with two faces in the same grid cell, so the footprint is the
            taller face and never changes on reveal. Only the active face is exposed. */}
        <div
          className={`grid [transform-style:preserve-3d] motion-reduce:[transform:none] ${
            isFlipped
              ? "[transform:rotateY(180deg)] transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)]"
              : "transition-none"
          }`}
        >
          <div
            aria-hidden={isFlipped || undefined}
            inert={isFlipped}
            className={`col-start-1 row-start-1 flex min-h-72 min-w-0 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center [backface-visibility:hidden] sm:min-h-80 md:p-10 motion-reduce:transition-opacity motion-reduce:duration-100 ${
              isFlipped ? "motion-reduce:opacity-0" : ""
            }`}
          >
            <p className="mb-4 max-w-full break-words text-3xl font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere] md:text-5xl">
              {front?.word}
            </p>
            {(front?.pos || front?.phonetic) && (
              <p className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 md:text-base">
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

          <div
            aria-hidden={!isFlipped || undefined}
            inert={!isFlipped}
            className={`col-start-1 row-start-1 flex min-h-72 min-w-0 flex-col justify-center rounded-2xl border border-recall-line bg-white p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:min-h-80 md:p-10 motion-reduce:[transform:none] motion-reduce:transition-opacity motion-reduce:duration-100 ${
              isFlipped ? "" : "motion-reduce:opacity-0"
            }`}
          >
            <BackContent back={back} />
          </div>
        </div>

        {ghost && (
          <div
            key={ghost.serial}
            aria-hidden="true"
            inert
            className="learning-ghost-out pointer-events-none absolute inset-0 flex min-w-0 flex-col justify-center overflow-hidden rounded-2xl border border-recall-line bg-white p-6 md:p-10"
          >
            <BackContent back={ghost.back} />
          </div>
        )}
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
