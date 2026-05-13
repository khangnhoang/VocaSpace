// app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage.tsx
"use client";
import React from "react";
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

export default function FlashcardStage({
  currentCard,
  cardsLeft,
  totalCards,
  isFlipped,
  setIsFlipped,
  handleRateCard,
  isPending,
}: FlashcardStageProps) {
  if (!currentCard) return null;

  const front = currentCard.front_content;
  const back = currentCard.back_content;

  return (
    <div className="w-full flex flex-col items-center font-sans">
      <div className="w-full max-w-3xl border border-slate-100 shadow-xl shadow-slate-200/40 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white p-8 pb-16 min-h-90 md:min-h-105 relative overflow-hidden">
        
        {/* NỘI DUNG MẶT TRƯỚC */}
        <div className="flex flex-col items-center text-center w-full px-8 animate-in fade-in zoom-in-95 duration-300">
          <p className="font-bold text-3xl md:text-5xl text-slate-800 mb-4 tracking-tight">
            {front?.word}
          </p>
          
          {(front?.pos || front?.phonetic) && (
            <p className="text-sm md:text-base text-slate-500 font-medium mb-8 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100 flex items-center justify-center gap-2">
              {front?.pos && (
                <span className="text-emerald-500 font-bold">
                  ({front.pos})
                </span>
              )}
              {front?.pos && front?.phonetic && <span className="text-slate-300">|</span>}
              {front?.phonetic && <span>{front.phonetic}</span>}
            </p>
          )}

          {/* NỘI DUNG MẶT SAU (HIỂN THỊ KHI LẬT THẺ) */}
          {isFlipped && (
            <div className="bg-slate-50 p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm w-full animate-in fade-in slide-in-from-top-4 duration-300 text-left">
              <p className="font-bold text-lg md:text-xl text-emerald-600 mb-3">
                Nghĩa: {back?.translation}
              </p>
              
              {/* TRUY XUẤT CHÍNH XÁC KEY NGUYÊN THỦY DB */}
              {back?.example && (
                <p className="text-base md:text-lg text-slate-700 italic font-medium mb-1.5 leading-relaxed">
                  VD: &quot;{back.example}&quot;
                </p>
              )}
              
              {back?.exampleTranslation && (
                <p className="text-sm md:text-base text-slate-500 mb-3">
                  Dịch: {back.exampleTranslation}
                </p>
              )}

              {/* BỔ SUNG VÙNG GIẢI THÍCH NẾU CÓ DỮ LIỆU */}
              {back?.explanation && (
                <div className="mt-2 pt-3 border-t border-slate-200/60">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Giải thích chi tiết</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{back.explanation}</p>
                </div>
              )}
              
              {back?.hint && (
                <div className="mt-4">
                  <p className="text-xs md:text-sm text-orange-600 font-bold bg-orange-50 inline-block px-3.5 py-2 rounded-lg border border-orange-100">
                    💡 Mẹo: {back.hint}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INDICATORS DƯỚI ĐÁY */}
        <div className="absolute bottom-6 flex items-center justify-center gap-3 w-full">
          <div className="h-2.5 rounded-full transition-all duration-300 w-8 bg-emerald-500" />
          <div className="h-2.5 rounded-full transition-all duration-300 w-2.5 bg-slate-300" />
        </div>
      </div>

      {/* KHU VỰC ĐIỀU KHIỂN RATING FSRS */}
      <div className="w-full max-w-2xl mt-6">
        {!isFlipped ? (
          <Button
            onClick={() => setIsFlipped(true)}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-2xl py-6 md:py-8 font-bold text-lg md:text-xl shadow-lg transition-all"
          >
            Hiện đáp án
          </Button>
        ) : (
          <div className="flex gap-2 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Button
              disabled={isPending}
              onClick={() => handleRateCard(Rating.Again)}
              variant="outline"
              className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm"
            >
              Lại
            </Button>
            <Button
              disabled={isPending}
              onClick={() => handleRateCard(Rating.Hard)}
              variant="outline"
              className="flex-1 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm"
            >
              Khó
            </Button>
            <Button
              disabled={isPending}
              onClick={() => handleRateCard(Rating.Good)}
              variant="outline"
              className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm"
            >
              Ổn
            </Button>
            <Button
              disabled={isPending}
              onClick={() => handleRateCard(Rating.Easy)}
              variant="outline"
              className="flex-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm"
            >
              Dễ
            </Button>
          </div>
        )}
      </div>

      <div className="text-center mt-5 text-slate-400 font-bold text-sm tracking-wide">
        {cardsLeft} / {totalCards}
      </div>
    </div>
  );
}