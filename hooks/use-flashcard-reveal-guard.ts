import { useCallback, useEffect, useRef, type MouseEvent } from "react";

/**
 * LF8 AC7: sau khi chấm, nút "Hiện đáp án" của thẻ kế tiếp nằm đúng chỗ nút chấm vừa bấm, và nút chấm không còn bị khóa
 * trong lúc lưu. Hook này chặn hai lỗi bấm đúp mà không dùng timer:
 * - `takeRating`: mỗi lần lật chỉ nhận một lần chấm (ref, nên hai lần bấm cùng tick cũng chỉ qua một);
 * - `shouldIgnoreReveal`: bỏ qua click chuột/chạm thuộc cử chỉ bắt đầu trước khi thẻ hiện (không có pointerdown nào kể từ lúc
 *   thẻ hiện) hoặc là lần click thứ hai của một cú bấm đúp (`detail > 1`). Phím (`detail === 0`) không bị chặn, như trước.
 */
export function useFlashcardRevealGuard(cardKey: string | undefined, isFlipped: boolean) {
  const pointerDowns = useRef(0);
  const shownAt = useRef(0);
  const ratingTaken = useRef(false);

  useEffect(() => {
    // Mỗi thẻ mới hoặc mỗi lần đổi mặt đánh dấu mốc pointerdown hiện tại; lật sang mặt đáp án mở lại một lần chấm.
    shownAt.current = pointerDowns.current;
    if (isFlipped) ratingTaken.current = false;
  }, [cardKey, isFlipped]);

  const onPointerDownCapture = useCallback(() => {
    pointerDowns.current += 1;
  }, []);

  const shouldIgnoreReveal = useCallback(
    (event: MouseEvent) =>
      event.detail > 1 || (event.detail > 0 && pointerDowns.current === shownAt.current),
    [],
  );

  const takeRating = useCallback(() => {
    if (ratingTaken.current) return false;
    ratingTaken.current = true;
    return true;
  }, []);

  return { onPointerDownCapture, shouldIgnoreReveal, takeRating };
}
