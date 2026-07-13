"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Rating } from "ts-fsrs";
import { toast } from "sonner";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import { Button } from "@/components/ui/button";
import type { ReviewFlashcardDTO } from "@/lib/schemas/profile";
import FlashcardStage from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage";

interface ReviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onReviewComplete: () => void;
}

export default function ReviewSheet({
  isOpen,
  onClose,
  onReviewComplete,
}: ReviewSheetProps) {
  const [reviewCards, setReviewCards] = useState<ReviewFlashcardDTO[]>([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [counts, setCounts] = useState({ learningLeft: 0, dueLeft: 0 });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;

    let isActive = true;
    async function loadReviewQueue() {
      setIsLoading(true);
      const result = await getDeckReviewCards();
      if (!isActive) return;

      if (result.error) {
        toast.error(result.error);
        onClose();
      } else if (result.success && result.cards) {
        setReviewCards(result.cards);
        setOriginalTotal(result.cards.length);
        setCounts(result.counts || { learningLeft: 0, dueLeft: 0 });
        setIsFlipped(false);
      }
      setIsLoading(false);
    }

    void loadReviewQueue();
    return () => {
      isActive = false;
    };
  }, [isOpen, onClose]);

  function handleRateCard(rating: Rating) {
    const currentCard = reviewCards[0];
    if (!currentCard) return;

    const nextQueue = reviewCards.slice(1);
    if (rating === Rating.Again || rating === Rating.Hard) {
      nextQueue.push(currentCard);
    } else {
      setCounts((current) => ({
        learningLeft: Math.max(0, current.learningLeft - 1),
        dueLeft: Math.max(0, current.dueLeft - 1),
      }));
    }

    setReviewCards(nextQueue);
    setIsFlipped(false);

    if (nextQueue.length === 0) {
      toast.success("Bạn đã hoàn thành toàn bộ thẻ cần ôn tập lúc này.");
      onReviewComplete();
    }

    startTransition(async () => {
      const result = await submitCardReview(
        currentCard.id,
        currentCard.topic_id,
        rating,
      );
      if (result?.error) {
        toast.error("Chưa thể đồng bộ tiến độ ôn tập.");
      }
    });
  }

  function handleClose() {
    onReviewComplete();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-sheet-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Đóng giao diện ôn tập"
        onClick={handleClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative z-10 flex h-[90vh] w-[92vw] max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-slate-50 shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Đóng giao diện ôn tập"
              onClick={handleClose}
              className="shrink-0 rounded-full text-slate-500"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Button>
            <Sparkles
              aria-hidden="true"
              className="size-5 shrink-0 text-emerald-600"
            />
            <h2
              id="review-sheet-title"
              className="truncate text-base font-extrabold text-slate-800 sm:text-lg"
            >
              Ôn tập tập trung
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-bold">
            <span className="text-orange-600">Đang học {counts.learningLeft}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-emerald-600">Đến hạn {counts.dueLeft}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-5 sm:p-8 lg:p-12">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2
                aria-hidden="true"
                className="size-12 animate-spin text-emerald-500"
              />
              <p className="text-sm font-medium">Đang tải thẻ ôn tập...</p>
            </div>
          ) : reviewCards.length === 0 ? (
            <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <CheckCircle2
                aria-hidden="true"
                className="mx-auto size-14 text-emerald-500"
              />
              <h3 className="mt-4 text-xl font-extrabold text-slate-800">
                Đã hoàn thành lượt ôn tập
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Không còn thẻ nào trong hàng đợi ôn tập ở thời điểm này.
              </p>
              <Button
                type="button"
                onClick={handleClose}
                className="mt-6 bg-slate-900 text-white hover:bg-slate-800"
              >
                Đóng
              </Button>
            </div>
          ) : (
            <div className="flex w-full max-w-6xl items-center justify-center">
              <FlashcardStage
                currentCard={reviewCards[0]}
                cardsLeft={reviewCards.length}
                totalCards={originalTotal}
                isFlipped={isFlipped}
                setIsFlipped={setIsFlipped}
                handleRateCard={handleRateCard}
                isPending={isPending}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
