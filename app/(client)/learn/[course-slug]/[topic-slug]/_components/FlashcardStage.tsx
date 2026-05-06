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
}: FlashcardStageProps) {
  if (!currentCard) return null;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-3xl border border-slate-100 shadow-xl shadow-slate-200/40 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white p-8 pb-16 min-h-90 md:min-h-105 relative">
        <div className="flex flex-col items-center text-center w-full px-8 animate-in fade-in zoom-in-95 duration-300">
          <p className="font-bold text-3xl md:text-5xl text-slate-800 mb-4 tracking-tight">
            {currentCard?.front_content?.word}
          </p>
          <p className="text-sm md:text-base text-slate-500 font-medium mb-8 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100">
            <span className="text-emerald-500 font-bold mr-2">
              ({currentCard?.front_content?.pos})
            </span>
            | {currentCard?.front_content?.phonetic}
          </p>

          {isFlipped && (
            <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
              <p className="font-bold text-lg md:text-xl text-emerald-600 mb-3">
                Nghĩa: {currentCard?.back_content?.translation}
              </p>
              <p className="text-base md:text-lg text-slate-700 italic font-medium mb-2 leading-relaxed">
                VD: &quot;{currentCard?.back_content?.example_en}&quot;
              </p>
              <p className="text-sm md:text-base text-slate-500">
                Dịch: {currentCard?.back_content?.example_vi}
              </p>
              {currentCard?.back_content?.mnemonics && (
                <p className="text-sm text-orange-500 font-bold mt-4 bg-orange-50 inline-block px-4 py-2 rounded-lg border border-orange-100">
                  💡 Mẹo: {currentCard?.back_content?.mnemonics}
                </p>
              )}
            </div>
          )}
        </div>

        {/* INDICATORS */}
        <div className="absolute bottom-6 flex items-center justify-center gap-3 w-full">
          <div className="h-2.5 rounded-full transition-all duration-300 w-8 bg-emerald-500" />
          <div className="h-2.5 rounded-full transition-all duration-300 w-2.5 bg-slate-300" />
        </div>
      </div>

      <div className="w-full max-w-2xl mt-6">
        {!isFlipped ? (
          <Button
            onClick={() => setIsFlipped(true)}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-2xl py-6 md:py-8 font-bold text-lg md:text-xl shadow-lg"
          >
            Hiện đáp án
          </Button>
        ) : (
          <div className="flex gap-2 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Button onClick={() => handleRateCard(Rating.Again)} variant="outline" className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm">Lại</Button>
            <Button onClick={() => handleRateCard(Rating.Hard)} variant="outline" className="flex-1 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm">Khó</Button>
            <Button onClick={() => handleRateCard(Rating.Good)} variant="outline" className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm">Ổn</Button>
            <Button onClick={() => handleRateCard(Rating.Easy)} variant="outline" className="flex-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm">Dễ</Button>
          </div>
        )}
      </div>

      <div className="text-center mt-5 text-slate-400 font-bold text-sm">
        {cardsLeft + 1} / {totalCards}
      </div>
    </div>
  );
}