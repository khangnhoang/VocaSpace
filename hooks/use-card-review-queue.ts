import { useCallback, useEffect, useRef, useState } from "react";
import type { Rating } from "ts-fsrs";
import { submitCardReview } from "@/app/actions/review";

// LF8: hàng đợi lưu đánh giá thẻ dùng chung cho LearningWorkspace và ReviewSheet. Giao diện tiến ngay; việc lưu đi sau,
// từng đánh giá một theo thứ tự, qua `submitCardReview` không đổi.

export const CARD_REVIEW_RETRY_DELAY_MS = 1000;

export type CardReviewSuccess = Extract<Awaited<ReturnType<typeof submitCardReview>>, { success: true }>;

export interface CardReviewRequest {
  cardId: string;
  rating: Rating;
  // Thế hệ hàng đợi của giao diện lúc chấm; lỗi cuối chỉ được đưa thẻ về lại đúng thế hệ này (G4).
  generation: number;
}

interface CardReviewQueueHandlers {
  // Chạy khi lần lưu của đánh giá thành công; nơi duy nhất được đổi state suy ra từ server (G2).
  onSaved: (request: CardReviewRequest, result: CardReviewSuccess) => void;
  // Chạy khi đã thử lại một lần mà vẫn lỗi. `error` là thông báo của server nếu có.
  onFailed: (request: CardReviewRequest, error?: string) => void;
}

// G5: trạng thái module chỉ gồm chuỗi lưu, số đánh giá đang chờ và listener `beforeunload` do số đó điều khiển.
// `epoch` chỉ để hàm reset của test làm các mục cũ (đang treo) thành vô hiệu.
let chain: Promise<void> = Promise.resolve();
let pendingCount = 0;
let epoch = 0;

function warnBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  // Safari cần returnValue rỗng để hiện hộp xác nhận rời trang.
  event.returnValue = "";
}

function retain() {
  pendingCount += 1;
  if (pendingCount === 1) window.addEventListener("beforeunload", warnBeforeUnload);
}

function release() {
  pendingCount = Math.max(0, pendingCount - 1);
  if (pendingCount === 0) window.removeEventListener("beforeunload", warnBeforeUnload);
}

/** Chỉ cho test: đưa chuỗi lưu dùng chung về trạng thái trống để mục treo của test trước không chặn test sau. */
export function resetCardReviewQueueForTests() {
  epoch += 1;
  chain = Promise.resolve();
  pendingCount = 0;
  if (typeof window !== "undefined") window.removeEventListener("beforeunload", warnBeforeUnload);
}

// Lỗi của callback giao diện không được làm đứt chuỗi lưu (mục sau vẫn phải chạy) nhưng cũng không được nuốt.
function rethrowLater(error: unknown) {
  queueMicrotask(() => {
    throw error;
  });
}

function schedule(task: () => void | Promise<void>) {
  chain = chain.then(async () => {
    try {
      await task();
    } catch (error) {
      rethrowLater(error);
    }
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Attempt = { ok: true; result: CardReviewSuccess } | { ok: false; error?: string };

async function attempt(request: CardReviewRequest): Promise<Attempt> {
  try {
    const result = await submitCardReview(request.cardId, request.rating);
    if (result && !result.error) return { ok: true, result: result as CardReviewSuccess };
    return { ok: false, error: result?.error };
  } catch {
    return { ok: false };
  }
}

export function useCardReviewQueue(handlers: CardReviewQueueHandlers) {
  const [pending, setPending] = useState(0);
  const mounted = useRef(true);
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const enqueue = useCallback((request: CardReviewRequest) => {
    const owner = epoch;
    retain();
    setPending((count) => count + 1);
    schedule(async () => {
      if (owner !== epoch) return;
      let outcome = await attempt(request);
      if (owner !== epoch) return;
      if (!outcome.ok) {
        await sleep(CARD_REVIEW_RETRY_DELAY_MS);
        if (owner !== epoch) return;
        outcome = await attempt(request);
        if (owner !== epoch) return;
      }
      try {
        // Đã unmount thì vẫn lưu xong nhưng không đụng state hay UI (G5).
        if (mounted.current) {
          if (outcome.ok) latest.current.onSaved(request, outcome.result);
          else latest.current.onFailed(request, outcome.error);
          setPending((count) => Math.max(0, count - 1));
        }
      } finally {
        release();
      }
    });
  }, []);

  // Chạy `callback` một lần khi không còn đánh giá nào đang chờ (đã tính cả đánh giá thêm vào sau). Chạy ngay nếu đang rảnh.
  // Trả về hàm hủy; không chạy nếu đã unmount.
  const whenDrained = useCallback((callback: () => void) => {
    let live = true;
    const owner = epoch;
    const run = () => {
      if (!live || !mounted.current || owner !== epoch) return;
      if (pendingCount > 0) {
        schedule(run);
        return;
      }
      live = false;
      callback();
    };
    if (pendingCount === 0) run();
    else schedule(run);
    return () => {
      live = false;
    };
  }, []);

  return { enqueue, whenDrained, pendingCount: pending };
}
