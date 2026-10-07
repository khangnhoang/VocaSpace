"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Rating } from "ts-fsrs";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ReviewFlashcardDTO } from "@/lib/schemas/profile";

interface ReviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onReviewComplete: () => void;
}
type Batch = { status: "loading" | "error" | "ready"; cards: ReviewFlashcardDTO[]; total: number; error?: string };
const ratings = [
  { value: Rating.Again, label: "Lại" }, { value: Rating.Hard, label: "Khó" },
  { value: Rating.Good, label: "Ổn" }, { value: Rating.Easy, label: "Dễ" },
];

export default function ReviewSheet({ isOpen, onClose, onReviewComplete }: ReviewSheetProps) {
  const [batch, setBatch] = useState<Batch>({ status: "loading", cards: [], total: 0 });
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const operation = useRef<"load" | "rate" | null>(null);
  const generation = useRef(0);
  const hasSaved = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
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
    setIsSaving(false);
    setSaveError(null);
    setWarning(null);
    try {
      const result = await getDeckReviewCards();
      if (request !== generation.current) return;
      if (result.success && result.cards) setBatch({ status: "ready", cards: result.cards, total: result.cards.length });
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
  const processed = batch.total - batch.cards.length;
  const finished = batch.status === "ready" && batch.total > 0 && !currentCard;
  useEffect(() => {
    if (!isOpen || batch.status === "loading") return;
    if (currentCard && !isFlipped) revealButton.current?.focus();
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
      setBatch({ ...batch, cards });
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
        className="flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none bg-background p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl motion-reduce:animate-none"
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
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" size="icon-lg" className="border-muted-foreground hover:border-muted-foreground" aria-label="Đóng giao diện ôn tập" disabled={isSaving} onClick={close}><ArrowLeft aria-hidden="true" /></Button>
          <div className="min-w-0">
            <DialogTitle className="font-semibold leading-6">Ôn tập tập trung</DialogTitle>
            <DialogDescription>Nhớ lại, xem đáp án rồi tự đánh giá.</DialogDescription>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
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
                <p className="text-sm font-medium" role="status">Đã xử lý {processed}/{batch.total} thẻ trong lượt</p>
                <div role="progressbar" aria-label="Tiến độ lượt ôn" aria-valuemin={0} aria-valuemax={batch.total} aria-valuenow={processed} className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-[#0E7490] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${processed / batch.total * 100}%` }} />
                </div>
              </div>}
              {warning && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>}
              {currentCard ? (
                <div className="space-y-5">
                  <div className="min-h-40 space-y-3 py-4 text-center [overflow-wrap:anywhere]">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nhớ nghĩa của từ</p>
                    <h3 className="text-3xl font-semibold leading-tight sm:text-4xl">{currentCard.front_content.word}</h3>
                    {(currentCard.front_content.pos || currentCard.front_content.phonetic) && <p className="text-sm text-muted-foreground">{[currentCard.front_content.pos, currentCard.front_content.phonetic].filter(Boolean).join(" · ")}</p>}
                  </div>
                  {isFlipped && <div className="space-y-3 rounded-xl border bg-muted/40 p-4 [overflow-wrap:anywhere] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
                    <p className="text-lg font-semibold">{currentCard.back_content.translation}</p>
                    {currentCard.back_content.example && <p className="leading-7">{currentCard.back_content.example}</p>}
                    {currentCard.back_content.exampleTranslation && <p className="text-sm leading-6 text-muted-foreground">{currentCard.back_content.exampleTranslation}</p>}
                    {currentCard.back_content.explanation && <p className="border-t pt-3 text-sm leading-6">{currentCard.back_content.explanation}</p>}
                    {currentCard.back_content.hint && <p className="text-sm leading-6">Mẹo: {currentCard.back_content.hint}</p>}
                  </div>}
                  <div className="space-y-3" aria-busy={isSaving}>
                    {isFlipped ? <><p className="text-sm text-muted-foreground">Bạn nhớ từ này ở mức nào?</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {ratings.map(({ value, label }) => <Button key={value} type="button" variant="outline" size="lg" className="border-muted-foreground hover:border-muted-foreground" disabled={isSaving} onClick={() => void handleRate(value)}>{label}</Button>)}
                      </div></> : <Button ref={revealButton} type="button" size="lg" className="w-full" onClick={() => setIsFlipped(true)}>Hiện đáp án</Button>}
                    {isSaving && <p role="status" className="text-sm text-muted-foreground">Đang lưu đánh giá…</p>}
                    {saveError && <p role="alert" className="text-sm text-correction">{saveError} Chọn lại đánh giá để thử lại.</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-8 text-center">
                  {finished && <CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-[#15803D]" />}
                  <h3 ref={stateHeading} tabIndex={-1} className="text-xl font-semibold outline-none">{finished ? "Đã hoàn tất lượt này" : "Lượt tải này chưa có thẻ có thể ôn"}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{finished ? "Bạn có thể tải lượt tiếp theo hoặc trở về dashboard." : "Bạn có thể tải lại lượt ôn hoặc trở về dashboard."}</p>
                  <div className="flex flex-col items-center gap-2">
                    <Button size="lg" onClick={() => void loadBatch()}>{finished ? "Ôn lượt tiếp" : "Tải lại lượt ôn"}</Button>
                    <Button variant="link" size="lg" onClick={close}>Về dashboard</Button>
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
