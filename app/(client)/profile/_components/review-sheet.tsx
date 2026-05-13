// app/(client)/profile/_components/review-sheet.tsx
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { ArrowLeft, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Rating } from "ts-fsrs";

import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import { ReviewFlashcardDTO } from "@/lib/schemas/profile";

// Tái sử dụng giao diện lật thẻ chuẩn SSOT
import FlashcardStage from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage";

interface ReviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onReviewComplete: () => void;
}

export default function ReviewSheet({ isOpen, onClose, onReviewComplete }: ReviewSheetProps) {
  const [reviewCards, setReviewCards] = useState<ReviewFlashcardDTO[]>([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const [counts, setCounts] = useState<{ learningLeft: number; dueLeft: number }>({
    learningLeft: 0,
    dueLeft: 0,
  });

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadReviewQueue() {
      setIsLoading(true);
      const res = await getDeckReviewCards();
      
      if (!isMounted) return;

      if (res.error) {
        toast.error(res.error);
        onClose();
      } else if (res.success && res.cards) {
        setReviewCards(res.cards);
        setOriginalTotal(res.cards.length);
        setCounts(res.counts || { learningLeft: 0, dueLeft: 0 });
        setIsFlipped(false);
      }
      setIsLoading(false);
    }

    loadReviewQueue();
    return () => { isMounted = false; };
  }, [isOpen, onClose]);

  const handleRateCard = (rating: Rating) => {
    if (reviewCards.length === 0) return;

    const currentCard = reviewCards[0];
    if (!currentCard) return;

    const newQueue = [...reviewCards.slice(1)];
    const isHardOrAgain = rating === Rating.Again || rating === Rating.Hard;

    if (isHardOrAgain) {
      newQueue.push(currentCard);
    } else {
      setCounts((prev) => ({
        learningLeft: Math.max(0, prev.learningLeft - 1),
        dueLeft: Math.max(0, prev.dueLeft - 1),
      }));
    }

    setReviewCards(newQueue);
    setIsFlipped(false);

    if (newQueue.length === 0) {
      toast.success("Tuyệt vời! Bạn đã hoàn thành toàn bộ thẻ cần ôn tập thời điểm này.");
      onReviewComplete(); 
    }

    startTransition(async () => {
      const res = await submitCardReview(currentCard.id, currentCard.topic_id, rating);
      if (res?.error) {
        toast.error("Lỗi đồng bộ tiến độ FSRS!");
      }
    });
  };

  const handleClosePanel = () => {
    onReviewComplete();
    onClose();
  };

  if (!isOpen) return null;

  const currentCard = reviewCards[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
      
      {/* LỚP PHỦ MỜ NỀN TỐI (Backdrop Overlay) */}
      <div 
        onClick={handleClosePanel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* 🔥 KHUNG MODAL TẬP TRUNG: 90% width, 90% height, bo tròn tinh tế */}
      <div className="relative z-10 w-[90vw] h-[90vh] max-w-7xl bg-slate-50 rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200">
        
        {/* TOPBAR CHUYÊN DỤNG */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleClosePanel}
              className="p-2 text-slate-400 hover:text-slate-700 transition-colors rounded-full hover:bg-slate-100"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <span className="font-bold text-slate-800 text-base md:text-lg">
                Ôn tập Tập trung (90% Focus Mode)
              </span>
            </div>
          </div>

          {/* BỘ ĐẾM TRỰC QUAN */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-bold text-slate-600 hidden sm:inline">Chưa xong:</span>
              <strong className="text-xs font-bold text-orange-600">{counts.learningLeft}</strong>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-600 hidden sm:inline">Đến hạn:</span>
              <strong className="text-xs font-bold text-emerald-600">{counts.dueLeft}</strong>
            </div>
          </div>
        </div>

        {/* NỘI DUNG CHÍNH (Chiếm trọn không gian giữa) */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto bg-slate-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-emerald-500 w-12 h-12" />
              <p className="text-sm font-medium text-slate-500">Đang nạp bộ nhớ đệm thẻ...</p>
            </div>
          ) : reviewCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center max-w-md bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hoàn thành xuất sắc!</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Không còn thẻ từ vựng nào tồn đọng trong hàng đợi ôn tập của bạn lúc này.
              </p>
              <Button 
                onClick={handleClosePanel}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-8 font-bold"
              >
                Đóng giao diện
              </Button>
            </div>
          ) : (
            // 🔥 TRUYỀN THẲNG DTO NGUYÊN THỦY VÀO COMPONENT LÕI
            <div className="w-full max-w-6xl flex items-center justify-center">
              <FlashcardStage
                currentCard={currentCard}
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