"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Rating } from "ts-fsrs";
import { getDeckReviewCards } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCardReviewQueue, type CardReviewRequest, type CardReviewSuccess } from "@/hooks/use-card-review-queue";
import { useFlashcardRevealGuard } from "@/hooks/use-flashcard-reveal-guard";
import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";
import type { ReviewFlashcardDTO } from "@/lib/schemas/profile";
import styles from "./ReviewSheet.module.css";

interface ReviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onReviewComplete: () => void;
}
type Batch = { status: "loading" | "error" | "ready"; cards: ReviewFlashcardDTO[]; total: number; dueLeft?: number; error?: string };

export default function ReviewSheet({ isOpen, onClose, onReviewComplete }: ReviewSheetProps) {
  const [batch, setBatch] = useState<Batch>({ status: "loading", cards: [], total: 0 });
  const [isFlipped, setIsFlipped] = useState(false);
  const [previousAnswer, setPreviousAnswer] = useState<ReviewFlashcardDTO["back_content"] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  // Thế hệ hàng đợi đã chấm hết thẻ và đang chờ lưu xong (AC5); null khi không có hoặc khi có thẻ được xếp lại.
  const [armedGeneration, setArmedState] = useState<number | null>(null);
  const operation = useRef<"load" | null>(null);
  const generation = useRef(0);
  const hasSaved = useRef(false);
  // Bản sao đồng bộ của hàng đợi thẻ để đọc ngay trong cùng tick (hai lần bấm liên tiếp không đọc state cũ).
  const cardsRef = useRef<ReviewFlashcardDTO[]>([]);
  const knownCards = useRef(new Map<string, ReviewFlashcardDTO>());
  const pendingByCard = useRef(new Map<string, number>());
  const armedRef = useRef<number | null>(null);
  const closing = useRef(false);
  const cancelClose = useRef<(() => void) | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const firstRating = useRef<HTMLButtonElement>(null);
  const stateHeading = useRef<HTMLHeadingElement>(null);
  const callbacks = useRef({ onClose, onReviewComplete });
  useEffect(() => { callbacks.current = { onClose, onReviewComplete }; }, [onClose, onReviewComplete]);
  const setArmed = useCallback((value: number | null) => {
    armedRef.current = value;
    setArmedState(value);
  }, []);
  const updateCards = useCallback((cards: ReviewFlashcardDTO[]) => {
    cardsRef.current = cards;
    setBatch((current) => ({ ...current, cards }));
  }, []);
  const invalidate = useCallback(() => {
    generation.current++;
    operation.current = null;
    setArmed(null);
  }, [setArmed]);

  // Số đánh giá của thẻ này còn đang chờ lưu sau khi một đánh giá vừa xong.
  function settlePending(cardId: string) {
    const left = Math.max(0, (pendingByCard.current.get(cardId) ?? 1) - 1);
    if (left) pendingByCard.current.set(cardId, left);
    else pendingByCard.current.delete(cardId);
    return left;
  }

  // Chỉ khi lưu thành công mới đổi giá trị do server quyết định (G2): cảnh báo tiến độ, dueLeft, hasSaved.
  function handleSaved(request: CardReviewRequest, result: CardReviewSuccess) {
    settlePending(request.cardId);
    hasSaved.current = true;
    if (request.generation !== generation.current) return;
    setWarning(result.progressError ?? null);
    if (request.rating === Rating.Good || request.rating === Rating.Easy) {
      setBatch((current) => ({ ...current, dueLeft: current.dueLeft === undefined ? undefined : Math.max(0, current.dueLeft - 1) }));
    }
  }

  // Đã thử lại một lần vẫn lỗi: đưa thẻ về cuối hàng đợi của đúng thế hệ này, hủy lệnh đóng đang chờ và báo người học.
  function handleSaveFailed(request: CardReviewRequest) {
    const left = settlePending(request.cardId);
    const card = knownCards.current.get(request.cardId);
    const label = `Chưa lưu được đánh giá thẻ "${card?.front_content.word ?? ""}".`;
    if (request.generation !== generation.current || !card) {
      setSaveError(label);
      return;
    }
    cancelClose.current?.();
    cancelClose.current = null;
    closing.current = false;
    setIsClosing(false);
    if (cardsRef.current.some((queued) => queued.id === card.id) || left > 0) {
      setSaveError(label);
      return;
    }
    updateCards([...cardsRef.current, card]);
    setArmed(null);
    setSaveError(`${label} Thẻ được xếp lại để bạn chấm lại.`);
  }

  const { enqueue, whenDrained, pendingCount: pendingSaves } = useCardReviewQueue({ onSaved: handleSaved, onFailed: handleSaveFailed });

  // Hàng đợi rỗng sau đánh giá cuối và đã lưu hết: chạy một lần rồi tắt cờ (G3).
  function runQueueEnd(queueGeneration: number) {
    if (armedRef.current !== queueGeneration) return;
    setArmed(null);
    if (queueGeneration === generation.current) callbacks.current.onReviewComplete();
  }

  const loadBatch = useCallback(async () => {
    if (operation.current) return;
    operation.current = "load";
    const request = ++generation.current;
    cardsRef.current = [];
    setArmed(null);
    setBatch({ status: "loading", cards: [], total: 0 });
    setIsFlipped(false);
    setPreviousAnswer(null);
    setSaveError(null);
    setWarning(null);
    try {
      const result = await getDeckReviewCards();
      if (request !== generation.current) return;
      if (result.success && result.cards) {
        cardsRef.current = result.cards;
        knownCards.current = new Map(result.cards.map((card) => [card.id, card]));
        setBatch({ status: "ready", cards: result.cards, total: result.cards.length, dueLeft: result.counts?.dueLeft });
      }
      else setBatch({ status: "error", cards: [], total: 0, error: result.error || "Chưa thể tải thẻ ôn tập. Hãy thử lại." });
    } catch {
      if (request === generation.current) setBatch({ status: "error", cards: [], total: 0, error: "Chưa thể tải thẻ ôn tập. Hãy thử lại." });
    } finally {
      if (request === generation.current) operation.current = null;
    }
  }, [setArmed]);

  useEffect(() => {
    if (!isOpen) return;
    hasSaved.current = false;
    closing.current = false;
    setIsClosing(false);
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
  const savingResults = finished && armedGeneration !== null;
  const guard = useFlashcardRevealGuard(currentCard?.id, isFlipped);
  const hasMoreDue = finished && batch.dueLeft !== undefined && batch.dueLeft > 0;
  const noDueCards = batch.dueLeft === 0;
  useEffect(() => {
    if (!isOpen || batch.status === "loading") return;
    if (currentCard) (isFlipped ? firstRating : revealButton).current?.focus();
    else stateHeading.current?.focus();
  }, [isOpen, batch.status, currentCard, isFlipped, armedGeneration]);

  // Tiến ngay tới thẻ kế tiếp; việc lưu chạy nền theo thứ tự qua hàng đợi dùng chung (LF8).
  function handleRate(rating: Rating) {
    const card = cardsRef.current[0];
    if (closing.current || !card || !isFlipped || !guard.takeRating()) return;
    const cards = cardsRef.current.slice(1);
    if (rating === Rating.Again || rating === Rating.Hard) cards.push(card);
    pendingByCard.current.set(card.id, (pendingByCard.current.get(card.id) ?? 0) + 1);
    setSaveError(null);
    setPreviousAnswer(card.back_content);
    updateCards(cards);
    setIsFlipped(false);
    const queueGeneration = generation.current;
    enqueue({ cardId: card.id, rating, generation: queueGeneration });
    if (!cards.length) {
      setArmed(queueGeneration);
      whenDrained(() => runQueueEnd(queueGeneration));
    }
  }

  function finishClose() {
    closing.current = false;
    cancelClose.current = null;
    setIsClosing(false);
    invalidate();
    cardsRef.current = [];
    setBatch({ status: "loading", cards: [], total: 0 });
    if (hasSaved.current) callbacks.current.onReviewComplete();
    callbacks.current.onClose();
  }

  // Đóng, Escape và bấm ra ngoài chờ lưu xong rồi mới đóng; lỗi cuối của một đánh giá hủy lệnh đóng (AC6).
  function close() {
    if (closing.current) return;
    closing.current = true;
    const cancel = whenDrained(finishClose);
    if (closing.current) {
      cancelClose.current = cancel;
      setIsClosing(true);
    }
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
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" size="icon-lg" className="text-route" aria-label="Đóng giao diện ôn tập" disabled={isClosing} onClick={close}>{isClosing ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <ArrowLeft aria-hidden="true" />}</Button>
          <div className="min-w-0">
            <DialogTitle className="font-semibold leading-6">Ôn tập tập trung</DialogTitle>
            <DialogDescription className={styles.support}>Nhớ lại, xem đáp án rồi tự đánh giá.</DialogDescription>
          </div>
        </div>
        {/* Một dòng trạng thái duy nhất, chỉ có trong DOM khi còn đánh giá đang lưu; không đẩy bố cục. */}
        {pendingSaves > 0 && <p role="status" className="pointer-events-none absolute bottom-2 right-4 z-10 text-xs font-medium text-slate-600">Đang lưu…</p>}
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
              {saveError && <p role="alert" className="mb-4 text-sm text-correction">{saveError}</p>}
              {warning && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>}
              {currentCard ? (
                <div className="space-y-5" onPointerDownCapture={guard.onPointerDownCapture}>
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
                  <div className="min-h-24 space-y-3">
                    {isFlipped ? <><p className={`${styles.support} text-sm`}>Bạn nhớ từ này ở mức nào?</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {FLASHCARD_RATINGS.map(({ rating, label, className }, index) => <Button key={rating} ref={index === 0 ? firstRating : undefined} type="button" variant="outline" size="lg" className={className} onClick={() => handleRate(rating)}>{label}</Button>)}
                      </div></> : <Button ref={revealButton} type="button" size="lg" className="mx-auto flex w-full sm:w-fit sm:min-w-44" onClick={(event) => { if (!closing.current && !guard.shouldIgnoreReveal(event)) setIsFlipped(true); }}>Hiện đáp án</Button>}
                  </div>
                </div>
              ) : savingResults ? (
                <h3 ref={stateHeading} tabIndex={-1} className="flex min-h-48 items-center justify-center gap-3 text-xl font-semibold outline-none">
                  <Loader2 aria-hidden="true" className="size-5 animate-spin text-route motion-reduce:animate-none" />Đang lưu kết quả các thẻ…
                </h3>
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
