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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-slate-50 p-0 shadow-2xl sm:h-[90vh] sm:w-[92vw] sm:max-w-5xl sm:rounded-3xl sm:border sm:border-white/20"
      >
        <DialogDescription className="sr-only">
          Ôn tập các thẻ đến hạn trong hàng đợi học tập của bạn.
        </DialogDescription>
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-2">
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
            <DialogTitle asChild>
              <h2 className="text-base font-extrabold text-slate-800 sm:text-lg">
                Ôn tập tập trung
              </h2>
            </DialogTitle>
          </div>
          <div className="grid w-full shrink-0 grid-cols-2 gap-2 text-xs font-bold sm:w-auto">
            <span className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-1.5 text-center text-orange-700">
              Đang học {counts.learningLeft}
            </span>
            <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-center text-emerald-700">
              Đến hạn {counts.dueLeft}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-4 sm:justify-center sm:p-8 lg:p-10">
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
            <div className="flex w-full max-w-5xl items-center justify-center">
              <FlashcardStage
                currentCard={reviewCards[0]}
                cardsLeft={reviewCards.length}
                totalCards={originalTotal}
                isFlipped={isFlipped}
                setIsFlipped={setIsFlipped}
                handleRateCard={handleRateCard}
                isPending={isPending}
                presentation="review"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
