"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Rating } from "ts-fsrs";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ReviewFlashcardDTO } from "@/lib/schemas/profile";
import styles from "./ReviewSheet.module.css";

interface ReviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onReviewComplete: () => void;
}
type Batch = { status: "loading" | "error" | "ready"; cards: ReviewFlashcardDTO[]; total: number; dueLeft?: number; error?: string };
const ratings = [
  { value: Rating.Again, label: "Lại" }, { value: Rating.Hard, label: "Khó" },
  { value: Rating.Good, label: "Ổn" }, { value: Rating.Easy, label: "Dễ" },
];

export default function ReviewSheet({ isOpen, onClose, onReviewComplete }: ReviewSheetProps) {
  const [batch, setBatch] = useState<Batch>({ status: "loading", cards: [], total: 0 });
  const [isFlipped, setIsFlipped] = useState(false);
  const [previousAnswer, setPreviousAnswer] = useState<ReviewFlashcardDTO["back_content"] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const operation = useRef<"load" | "rate" | null>(null);
  const generation = useRef(0);
  const hasSaved = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const firstRating = useRef<HTMLButtonElement>(null);
  const stateHeading = useRef<HTMLHeadingElement>(null);
  const callbacks = useRef({ onClose, onReviewComplete });
  useEffect(() => { callbacks.current = { onClose, onReviewComplete }; }, [onClose, onReviewComplete]);
  const invalidate = useCallback(() => {
    generation.current++;
    operation.current = null;
  }, []);

  const loadBatch = useCallback(async () => {
    if (operation.current) return;
    operation.current = "load";
    const request = ++generation.current;
    setBatch({ status: "loading", cards: [], total: 0 });
    setIsFlipped(false);
    setPreviousAnswer(null);
    setIsSaving(false);
    setSaveError(null);
    setWarning(null);
    try {
      const result = await getDeckReviewCards();
      if (request !== generation.current) return;
      if (result.success && result.cards) setBatch({ status: "ready", cards: result.cards, total: result.cards.length, dueLeft: result.counts?.dueLeft });
      else setBatch({ status: "error", cards: [], total: 0, error: result.error || "Chưa thể tải thẻ ôn tập. Hãy thử lại." });
    } catch {
      if (request === generation.current) setBatch({ status: "error", cards: [], total: 0, error: "Chưa thể tải thẻ ôn tập. Hãy thử lại." });
    } finally {
      if (request === generation.current) operation.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    hasSaved.current = false;
    void loadBatch();
    return () => {
      // Đóng/mở lại tạo lượt mới; phản hồi cũ không được thay thế thẻ của lượt đó.
      invalidate();
    };
  }, [isOpen, loadBatch, invalidate]);

  const currentCard = batch.cards[0];
  // Giữ đáp án vừa ôn trên mặt sau trong lúc lật về từ mới; không trì hoãn thẻ hay thao tác kế tiếp.
  const answerContent = isFlipped ? currentCard?.back_content : previousAnswer ?? currentCard?.back_content;
  const processed = batch.total - batch.cards.length;
  const finished = batch.status === "ready" && batch.total > 0 && !currentCard;
  const hasMoreDue = finished && batch.dueLeft !== undefined && batch.dueLeft > 0;
  const noDueCards = batch.dueLeft === 0;
  useEffect(() => {
    if (!isOpen || batch.status === "loading") return;
    if (currentCard) (isFlipped ? firstRating : revealButton).current?.focus();
    else stateHeading.current?.focus();
  }, [isOpen, batch.status, currentCard, isFlipped]);

  async function handleRate(rating: Rating) {
    if (operation.current || !currentCard || !isFlipped) return;
    operation.current = "rate";
    const request = generation.current;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await submitCardReview(currentCard.id, rating);
      if (request !== generation.current) return;
      if (!result.success) {
        setSaveError(result.error || "Chưa lưu được đánh giá.");
        return;
      }
      hasSaved.current = true;
      const cards = batch.cards.slice(1);
      if (rating === Rating.Again || rating === Rating.Hard) cards.push(currentCard);
      setPreviousAnswer(currentCard.back_content);
      setBatch({ ...batch, cards, dueLeft: batch.dueLeft === undefined ? undefined : Math.max(0, batch.dueLeft - (rating === Rating.Good || rating === Rating.Easy ? 1 : 0)) });
      setIsFlipped(false);
      setWarning(result.progressError ?? null);
      if (!cards.length) callbacks.current.onReviewComplete();
    } catch {
      if (request === generation.current) setSaveError("Chưa lưu được đánh giá.");
    } finally {
      if (request === generation.current) {
        operation.current = null;
        setIsSaving(false);
      }
    }
  }

  function close() {
    if (operation.current === "rate") return;
    invalidate();
    setBatch({ status: "loading", cards: [], total: 0 });
    if (hasSaved.current) callbacks.current.onReviewComplete();
    callbacks.current.onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        showCloseButton={false}
        className={`${styles.surface} flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:w-[calc(100%-2rem)] sm:max-h-[90dvh] sm:max-w-4xl sm:rounded-3xl motion-reduce:animate-none`}
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          event.preventDefault();
          stateHeading.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = opener.current;
          if (target?.isConnected && !target.hasAttribute("disabled") && target.getClientRects().length) target.focus();
          else document.getElementById("review-summary-title")?.focus();
        }}
        onEscapeKeyDown={(event) => { if (operation.current === "rate") event.preventDefault(); }}
        onInteractOutside={(event) => { if (operation.current === "rate") event.preventDefault(); }}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" size="icon-lg" className="text-route" aria-label="Đóng giao diện ôn tập" disabled={isSaving} onClick={close}><ArrowLeft aria-hidden="true" /></Button>
          <div className="min-w-0">
            <DialogTitle className="font-semibold leading-6">Ôn tập tập trung</DialogTitle>
            <DialogDescription className={styles.support}>Nhớ lại, xem đáp án rồi tự đánh giá.</DialogDescription>
          </div>
        </div>
        <p role="status" className="sr-only">{isSaving ? "Đang lưu đánh giá…" : ""}</p>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-10 sm:py-7">
          {batch.status === "loading" ? (
            <h3 ref={stateHeading} tabIndex={-1} className="flex min-h-48 items-center justify-center gap-3 outline-none" role="status">
              <Loader2 aria-hidden="true" className="size-5 animate-spin text-route motion-reduce:animate-none" />Đang tải thẻ ôn tập…
            </h3>
          ) : batch.status === "error" ? (
            <div className="space-y-4 py-8">
              <h3 ref={stateHeading} tabIndex={-1} className="text-lg font-semibold outline-none">Chưa thể mở lượt ôn</h3>
              <p role="alert" className="text-correction">{batch.error}</p>
              <Button size="lg" onClick={() => void loadBatch()}>Thử lại</Button>
            </div>
          ) : (
            <>
              {batch.total > 0 && <div className="mb-6 space-y-2">
                <p className={`${styles.progressLabel} text-sm font-semibold`} role="status">Đã xử lý {processed}/{batch.total} thẻ trong lượt</p>
                <div role="progressbar" aria-label="Tiến độ lượt ôn" aria-valuemin={0} aria-valuemax={batch.total} aria-valuenow={processed} className={`${styles.progressTrack} h-1.5 overflow-hidden rounded-full`}>
                  <div className={`${styles.progressFill} h-full`} data-complete={finished} style={{ width: `${processed / batch.total * 100}%` }} />
                </div>
              </div>}
              {warning && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>}
              {currentCard ? (
                <div className="space-y-5">
                  <div className={styles.recallPlane}>
                    <div className={styles.card} data-revealed={isFlipped}>
                      <div className={`${styles.face} ${styles.front}`} aria-hidden={isFlipped}>
                        <div className="min-w-0 space-y-4">
                          <p className={`${styles.instruction} text-sm font-medium`}>Nhớ nghĩa của từ</p>
                          <h3 className={`${styles.word} font-semibold`}>{currentCard.front_content.word}</h3>
                          {(currentCard.front_content.pos || currentCard.front_content.phonetic) && <p className={`${styles.support} text-base`}>{[currentCard.front_content.pos, currentCard.front_content.phonetic].filter(Boolean).join(" · ")}</p>}
                        </div>
                      </div>
                      <div className={`${styles.face} ${styles.back}`} aria-hidden={!isFlipped}>
                        <div className="min-w-0 space-y-4">
                          <h3 className={`${styles.meaning} font-semibold`}>{answerContent?.translation}</h3>
                          {answerContent?.example && <p className={`${styles.support} text-base leading-7`}>{answerContent.example}</p>}
                          {answerContent?.exampleTranslation && <p className={`${styles.support} text-sm leading-6`}>{answerContent.exampleTranslation}</p>}
                          {answerContent?.explanation && <p className={`${styles.support} border-t border-cyan-200 pt-4 text-sm leading-6`}>{answerContent.explanation}</p>}
                          {answerContent?.hint && <p className={`${styles.support} text-sm leading-6`}>Mẹo: {answerContent.hint}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-24 space-y-3" aria-busy={isSaving}>
                    {isFlipped ? <><p className={`${styles.support} text-sm`}>Bạn nhớ từ này ở mức nào?</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {ratings.map(({ value, label }, index) => <Button key={value} ref={index === 0 ? firstRating : undefined} type="button" variant="outline" size="lg" className={styles.rating} disabled={isSaving} onClick={() => void handleRate(value)}>{label}</Button>)}
                      </div></> : <Button ref={revealButton} type="button" size="lg" className="mx-auto flex w-full sm:w-fit sm:min-w-44" onClick={() => setIsFlipped(true)}>Hiện đáp án</Button>}
                    {saveError && <p role="alert" className="text-sm text-correction">{saveError} Chọn lại đánh giá để thử lại.</p>}
                  </div>
                </div>
              ) : (
                <div className={`${finished ? styles.completion : ""} space-y-4 rounded-3xl px-4 py-12 text-center sm:py-16`}>
                  {finished && <CheckCircle2 aria-hidden="true" className={`${styles.completionIcon} mx-auto size-12`} />}
                  <h3 ref={stateHeading} tabIndex={-1} className="text-xl font-semibold outline-none">{finished ? (noDueCards ? "Chúc mừng! Bạn đã ôn hết thẻ đến hạn." : "Đã hoàn tất lượt này") : (noDueCards ? "Hiện không có thẻ đến hạn" : "Lượt tải này chưa có thẻ có thể ôn")}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{hasMoreDue ? "Vẫn còn thẻ đến hạn. Bạn có thể ôn lượt tiếp theo." : "Bạn có thể quay lại không gian học tập và tiếp tục học."}</p>
                  <div className="flex flex-col items-center gap-2">
                    {hasMoreDue && <Button size="lg" onClick={() => void loadBatch()}>Ôn lượt tiếp theo</Button>}
                    <Button variant={hasMoreDue ? "link" : "default"} size="lg" onClick={close}>Quay lại</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
