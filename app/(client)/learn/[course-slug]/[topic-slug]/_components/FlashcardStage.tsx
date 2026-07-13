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
  presentation?: "workspace" | "review";
}

export default function FlashcardStage({
  currentCard,
  cardsLeft,
  totalCards,
  isFlipped,
  setIsFlipped,
  handleRateCard,
  isPending,
  presentation = "workspace",
}: FlashcardStageProps) {
  if (!currentCard) return null;

  const front = currentCard.front_content;
  const back = currentCard.back_content;
  const isReviewPresentation = presentation === "review";
  const completedCards = Math.max(0, totalCards - cardsLeft);
  const progressPercentage =
    totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  return (
    <div className="flex w-full min-w-0 flex-col items-center font-sans">
      <div
        className={`relative flex w-full max-w-3xl flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 ${
          isReviewPresentation
            ? "min-h-[19rem] gap-5 p-5 pb-12 sm:min-h-[24rem] sm:p-8 sm:pb-14"
            : "min-h-90 gap-4 p-8 pb-16 md:min-h-105"
        }`}
      >
        
        {/* NỘI DUNG MẶT TRƯỚC */}
        <div
          className={`flex w-full min-w-0 animate-in flex-col items-center text-center fade-in zoom-in-95 duration-300 ${
            isReviewPresentation ? "px-0 sm:px-4" : "px-8"
          }`}
        >
          <p
            className={`mb-4 max-w-full break-words font-bold tracking-tight text-slate-800 [overflow-wrap:anywhere] ${
              isReviewPresentation
                ? "text-3xl sm:text-4xl"
                : "text-3xl md:text-5xl"
            }`}
          >
            {front?.word}
          </p>
          
          {(front?.pos || front?.phonetic) && (
            <p
              className={`mb-8 flex max-w-full items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-500 md:text-base ${
                isReviewPresentation ? "flex-wrap" : ""
              }`}
            >
              {front?.pos && (
                <span className="text-emerald-500 font-bold">
                  ({front.pos})
                </span>
              )}
              {front?.pos && front?.phonetic && <span className="text-slate-300">|</span>}
              {front?.phonetic && (
                <span className="max-w-full break-words [overflow-wrap:anywhere]">
                  {front.phonetic}
                </span>
              )}
            </p>
          )}

          {/* NỘI DUNG MẶT SAU (HIỂN THỊ KHI LẬT THẺ) */}
          {isFlipped && (
            <div
              className={`w-full animate-in rounded-2xl border border-slate-100 bg-slate-50 text-left shadow-sm fade-in slide-in-from-top-4 duration-300 ${
                isReviewPresentation ? "p-4 sm:p-5" : "p-5 md:p-6"
              }`}
            >
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
        {isReviewPresentation ? (
          <div className="absolute inset-x-5 bottom-5 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:inset-x-8">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        ) : (
          <div className="absolute bottom-6 flex w-full items-center justify-center gap-3">
            <div className="h-2.5 w-8 rounded-full bg-emerald-500 transition-all duration-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-slate-300 transition-all duration-300" />
          </div>
        )}
      </div>

      {/* KHU VỰC ĐIỀU KHIỂN RATING FSRS */}
      <div
        className={`w-full ${
          isReviewPresentation ? "mt-4 max-w-3xl" : "mt-6 max-w-2xl"
        }`}
      >
        {!isFlipped ? (
          <Button
            onClick={() => setIsFlipped(true)}
            className={`w-full rounded-2xl bg-slate-800 font-bold text-white shadow-lg transition-all hover:bg-slate-900 ${
              isReviewPresentation
                ? "min-h-12 py-3 text-base sm:text-lg"
                : "py-6 text-lg md:py-8 md:text-xl"
            }`}
          >
            Hiện đáp án
          </Button>
        ) : (
          <div
            className={`animate-in gap-2 fade-in slide-in-from-bottom-2 duration-300 sm:gap-4 ${
              isReviewPresentation
                ? "grid grid-cols-2 sm:grid-cols-4"
                : "flex"
            }`}
          >
            <Button
              disabled={isPending}
              onClick={() => handleRateCard(Rating.Again)}
              variant="outline"
              className={`flex-1 rounded-2xl border-rose-200 font-bold text-rose-600 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50 ${
                isReviewPresentation
                  ? "min-h-12 py-3 text-sm sm:text-base"
                  : "py-6 text-base md:py-8 md:text-lg"
              }`}
            >
              Lại
            </Button>
            <Button
              disabled={isPending}
              onClick={() => handleRateCard(Rating.Hard)}
              variant="outline"
              className={`flex-1 rounded-2xl border-orange-200 font-bold text-orange-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 ${
                isReviewPresentation
                  ? "min-h-12 py-3 text-sm sm:text-base"
                  : "py-6 text-base md:py-8 md:text-lg"
              }`}
            >
              Khó
            </Button>
            <Button
              disabled={isPending}
              onClick={() => handleRateCard(Rating.Good)}
              variant="outline"
              className={`flex-1 rounded-2xl border-blue-200 font-bold text-blue-600 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 ${
                isReviewPresentation
                  ? "min-h-12 py-3 text-sm sm:text-base"
                  : "py-6 text-base md:py-8 md:text-lg"
              }`}
            >
              Ổn
            </Button>
            <Button
              disabled={isPending}
              onClick={() => handleRateCard(Rating.Easy)}
              variant="outline"
              className={`flex-1 rounded-2xl border-emerald-200 font-bold text-emerald-600 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 ${
                isReviewPresentation
                  ? "min-h-12 py-3 text-sm sm:text-base"
                  : "py-6 text-base md:py-8 md:text-lg"
              }`}
            >
              Dễ
            </Button>
          </div>
        )}
      </div>

      <div
        className={`text-center text-sm font-bold tracking-wide text-slate-400 ${
          isReviewPresentation ? "mt-3" : "mt-5"
        }`}
      >
        {cardsLeft} / {totalCards}
      </div>
    </div>
  );
}
