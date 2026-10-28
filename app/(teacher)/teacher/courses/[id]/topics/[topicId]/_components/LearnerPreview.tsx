"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  parseQuestionGroupManagedMediaReference,
  type QuestionGroupMediaType,
} from "@/lib/schemas/exercise";
import { QuestionGroupMediaPreview } from "./QuestionGroupMediaField";
import { optionLabel } from "./authoring-options";

// Preview chỉ đọc giá trị đang gõ (G5): không gọi grading/progress của learner,
// không dùng lại `QuestionResponse` vì component đó gắn với callback chấm điểm.

export interface FlashcardPreviewValues {
  word: string;
  pos?: string;
  phonetic?: string;
  translation: string;
  explanation?: string;
  example?: string;
  exampleTranslation?: string;
  hint?: string;
}

export function FlashcardPreview({ values }: { values: FlashcardPreviewValues }) {
  const [showBack, setShowBack] = useState(false);
  const word = values.word.trim();
  const translation = values.translation.trim();

  return (
    <div className="space-y-3">
      <div className="[perspective:1100px]">
        <div
          className={`grid min-h-56 [transform-style:preserve-3d] transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:[transform:none] ${
            showBack ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div
            aria-hidden={showBack}
            className={`col-start-1 row-start-1 flex min-w-0 flex-col items-center justify-center gap-2 rounded-3xl border border-slate-300 bg-white px-5 py-6 text-center shadow-[0_8px_24px_rgb(15_23_42/8%)] [backface-visibility:hidden] motion-reduce:transition-opacity motion-reduce:duration-100 ${
              showBack ? "motion-reduce:opacity-0" : ""
            }`}
          >
            <p
              className={`max-w-full text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] ${
                word ? "text-slate-900" : "text-slate-400"
              }`}
            >
              {word || "Từ vựng"}
            </p>
            {values.pos?.trim() || values.phonetic?.trim() ? (
              <p className="flex max-w-full flex-wrap items-center justify-center gap-2 text-sm font-medium text-slate-600">
                {values.pos?.trim() ? (
                  <span className="font-bold text-recall">({values.pos.trim()})</span>
                ) : null}
                {values.phonetic?.trim() ? (
                  <span className="[overflow-wrap:anywhere]">{values.phonetic.trim()}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div
            aria-hidden={!showBack}
            className={`col-start-1 row-start-1 flex min-w-0 flex-col justify-center gap-2 rounded-3xl border border-slate-300 bg-[linear-gradient(140deg,#fff,#ecfeff)] px-5 py-6 shadow-[0_8px_24px_rgb(15_23_42/8%)] [backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:[transform:none] motion-reduce:transition-opacity motion-reduce:duration-100 ${
              showBack ? "" : "motion-reduce:opacity-0"
            }`}
          >
            <p
              className={`text-xl font-bold [overflow-wrap:anywhere] ${
                translation ? "text-recall" : "text-slate-400"
              }`}
            >
              {translation || "Nghĩa của từ"}
            </p>
            {values.example?.trim() ? (
              <p className="text-sm font-medium text-slate-800 italic [overflow-wrap:anywhere]">
                &quot;{values.example.trim()}&quot;
              </p>
            ) : null}
            {values.exampleTranslation?.trim() ? (
              <p className="text-sm text-slate-600 [overflow-wrap:anywhere]">
                {values.exampleTranslation.trim()}
              </p>
            ) : null}
            {values.explanation?.trim() ? (
              <p className="border-t border-slate-200 pt-2 text-sm text-slate-700 [overflow-wrap:anywhere]">
                {values.explanation.trim()}
              </p>
            ) : null}
            {values.hint?.trim() ? (
              <p className="rounded-lg border border-attention-line bg-attention-quiet px-3 py-1.5 text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
                {values.hint.trim()}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        aria-pressed={showBack}
        onClick={() => setShowBack((current) => !current)}
      >
        <RotateCcw aria-hidden="true" />
        {showBack ? "Xem mặt trước" : "Lật thẻ xem mặt sau"}
      </Button>
      <p className="sr-only" aria-live="polite">
        {showBack ? "Đang xem mặt sau của thẻ." : "Đang xem mặt trước của thẻ."}
      </p>
    </div>
  );
}

export interface PreviewOption {
  content: string;
  is_correct: boolean;
}

export function QuestionPreview({
  content,
  options,
  explanation,
  numberLabel,
}: {
  content: string;
  options: PreviewOption[];
  explanation?: string;
  numberLabel?: string;
}) {
  const visibleOptions = options.filter((option) => option.content.trim() !== "");

  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/6%)]">
      <p
        className={`text-base leading-7 font-semibold [overflow-wrap:anywhere] ${
          content.trim() ? "text-slate-900" : "text-slate-400"
        }`}
      >
        {numberLabel ? <span className="mr-1.5 text-recall">{numberLabel}</span> : null}
        {content.trim() || "Nội dung câu hỏi"}
      </p>
      {visibleOptions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Chưa có đáp án nào.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {options.map((option, index) =>
            option.content.trim() === "" ? null : (
              <li
                key={index}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors duration-[220ms] motion-reduce:transition-none ${
                  option.is_correct
                    ? "border-growth-line bg-growth-quiet text-slate-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    option.is_correct
                      ? "border-growth bg-growth text-white"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  {optionLabel(index)}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 [overflow-wrap:anywhere]">{option.content}</span>
                {option.is_correct ? (
                  <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs font-bold text-growth">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Đáp án đúng
                  </span>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
      {explanation?.trim() ? (
        <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600 [overflow-wrap:anywhere]">
          <span className="font-semibold text-slate-800">Giải thích: </span>
          {explanation.trim()}
        </p>
      ) : null}
    </div>
  );
}

export function GroupContextPreview({
  groupId,
  passage,
  audioUrl,
  imageUrl,
  savedAudioUrl,
  savedImageUrl,
}: {
  groupId?: string;
  passage?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  savedAudioUrl?: string | null;
  savedImageUrl?: string | null;
}) {
  const media: { type: QuestionGroupMediaType; value: string; saved?: string | null }[] = [];
  if (imageUrl?.trim()) media.push({ type: "image", value: imageUrl.trim(), saved: savedImageUrl });
  if (audioUrl?.trim()) media.push({ type: "audio", value: audioUrl.trim(), saved: savedAudioUrl });

  if (!passage?.trim() && media.length === 0) return null;

  return (
    <div className="space-y-2">
      {media.map((item) => {
        // Tệp tải lên VocaSpace chỉ đọc được qua route đã lưu theo group; tệp vừa tải chưa lưu
        // thì route đó còn trả tệp cũ, nên chỉ báo chữ thay vì hiện sai media.
        const managed = parseQuestionGroupManagedMediaReference(
          item.type,
          item.value,
          process.env.NEXT_PUBLIC_SUPABASE_URL,
        );
        if (managed && (!groupId || item.value !== item.saved?.trim())) {
          return (
            <p
              key={item.type}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
            >
              {item.type === "image" ? "Hình ảnh" : "Âm thanh"} vừa tải lên sẽ hiện ở đây sau khi
              lưu. Bạn có thể nghe/xem ngay trong ô {item.type === "image" ? "Hình ảnh" : "Audio"} của
              form.
            </p>
          );
        }
        return (
          <QuestionGroupMediaPreview
            key={item.type}
            type={item.type}
            value={item.value}
            groupId={groupId}
          />
        );
      })}
      {passage?.trim() ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">
          {passage}
        </div>
      ) : null}
    </div>
  );
}
