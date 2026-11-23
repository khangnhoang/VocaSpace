"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { asTranslate } from "@/lib/i18n/translate";
import type { CurveVariant } from "@/lib/auth/memory-curve";
import { deckScene, type DeckTone } from "@/lib/auth/word-deck";
import styles from "./word-deck.module.css";

const UTILITY = "font-[family-name:var(--font-geist-sans)] text-xs font-semibold leading-4";
// Thẻ phía sau xoè nhẹ để chồng đọc ra là một bộ thẻ; từ thẻ thứ tư trở đi nằm khuất.
const FAN = ["none", "translate(7px, 8px) rotate(3deg) scale(0.97)", "translate(-7px, 14px) rotate(-3deg) scale(0.94)"];
const LEAVING: CSSProperties = { transform: "translate(-30px, -14px) rotate(-8deg)", opacity: 0, zIndex: 20 };
const REVIEW_EVERY_MS = 1500;
const LEAVE_MS = 360;
// Tự ôn 2 lần (khoảng 3 giây) rồi dừng: chuyển động tự chạy phải ngắn hơn 5 giây (WCAG 2.2.2).
const AUTO_REVIEWS = 2;

const TONE_CLASS: Record<DeckTone, string> = {
  due: "bg-route-quiet text-route",
  fade: "bg-attention-quiet text-attention",
  ok: "bg-growth-quiet text-growth",
};

type WordDeckProps = { variant: CurveVariant; flipped: boolean };

// U3 quyết định 17: điểm nhấn riêng cho màn dưới 960px thay cho đường cong. Chồng thẻ chỉ là minh hoạ (aria-hidden);
// tiêu đề và lời bên cạnh mang nội dung cho trình đọc màn hình.
export function WordDeck({ variant, flipped }: WordDeckProps) {
  const t = asTranslate(useTranslations("auth"));
  const scene = deckScene(variant, t);
  const sceneKey = scene.cards.map((card) => card.word).join("|");
  const reduceMotion = useReducedMotion();

  // Thứ tự trong chồng (từ trên xuống); đặt lại khi biến thể đổi bộ thẻ.
  const [deck, setDeck] = useState({ key: sceneKey, order: scene.cards.map((card) => card.word) });
  const [leaving, setLeaving] = useState<string | null>(null);
  let order = deck.order;
  if (deck.key !== sceneKey) {
    order = scene.cards.map((card) => card.word);
    setDeck({ key: sceneKey, order });
    // Lượt ôn dở của bộ thẻ cũ không được giấu thẻ của bộ mới (ví dụ "remember" khi sang /forgot-password).
    if (leaving) setLeaving(null);
  }
  const leaveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), [sceneKey]);

  // Thẻ có từ lần vẽ đầu đứng yên; chỉ thẻ vừa thêm (chặng đăng ký mới) rơi xuống đầu chồng. Khi có thẻ mới, cờ của thẻ
  // cũ được xoá để "Quay lại" không chạy lại hiệu ứng vào. Bảng sống cùng component như bảng timing của đường cong.
  const [entering] = useState(() => new Map(scene.cards.map((card) => [card.word, false])));
  for (const word of [...entering.keys()]) if (!order.includes(word)) entering.delete(word);
  const added = order.filter((word) => !entering.has(word));
  if (added.length > 0) {
    for (const word of entering.keys()) entering.set(word, false);
    for (const word of added) entering.set(word, true);
  }

  const canReview = scene.cycles && !flipped && !leaving && order.length > 1;
  const reviewNext = () => {
    if (!canReview) return;
    const rotate = () => setDeck((current) => (current.key === sceneKey ? { ...current, order: [...current.order.slice(1), current.order[0]] } : current));
    if (reduceMotion) return rotate();
    setLeaving(order[0]);
    leaveTimer.current = window.setTimeout(() => {
      rotate();
      setLeaving(null);
    }, LEAVE_MS);
  };
  const reviewRef = useRef(reviewNext);
  useEffect(() => {
    reviewRef.current = reviewNext;
  });

  useEffect(() => {
    if (!scene.cycles || reduceMotion) return;
    let left = AUTO_REVIEWS;
    const timer = window.setInterval(() => {
      if (left <= 0) return window.clearInterval(timer);
      left -= 1;
      reviewRef.current();
    }, REVIEW_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [sceneKey, scene.cycles, reduceMotion]);

  return (
    <aside
      aria-label={t("deck.label")}
      className="order-first flex flex-col items-center gap-2 rounded-[16px] bg-slate-100 px-4 pt-3.5 pb-3 sm:flex-row sm:gap-5 sm:px-5 sm:py-[18px] min-[960px]:hidden"
    >
      {/* Chạm vào chồng thẻ để ôn thẻ tiếp theo: chỉ là phần thưởng cho chuột/cảm ứng, không mang thông tin. */}
      <div
        aria-hidden="true"
        data-testid="word-deck"
        onClick={reviewNext}
        className={cn("relative h-[116px] w-[208px] flex-none [perspective:900px]", scene.cycles && "cursor-pointer")}
      >
        {scene.cards.map((card) => {
          const position = order.indexOf(card.word);
          const isTop = position === 0;
          const style: CSSProperties =
            leaving === card.word
              ? LEAVING
              : { transform: FAN[Math.min(position, 2)], opacity: position < 3 ? 1 : 0, zIndex: 10 - position };
          return (
            <div
              key={card.word}
              data-deck-card={card.word}
              data-deck-position={position}
              className={cn(
                "absolute top-0 left-0 h-24 w-[208px] origin-bottom transition-[transform,opacity] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                entering.get(card.word) && isTop && styles.enter,
              )}
              style={style}
            >
              <div
                className={cn(
                  "relative size-full transition-transform duration-[620ms] ease-[cubic-bezier(0.2,0,0,1)] [transform-style:preserve-3d] motion-reduce:transition-none",
                  isTop && flipped && scene.cycles && "[transform:rotateY(180deg)]",
                )}
              >
                <div className="absolute inset-0 flex flex-col justify-between rounded-[14px] border border-slate-300 bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] [backface-visibility:hidden]">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn(UTILITY, "tracking-[0.04em] text-recall")}>{t("deck.cardLabel")}</span>
                    {card.tag ? (
                      <span className={cn(UTILITY, "inline-flex items-center gap-1 rounded-full px-2 py-px", TONE_CLASS[card.tone ?? "due"])}>
                        {card.locked ? <Lock className="size-3" /> : null}
                        {card.tag}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "text-[22px] leading-7 font-extrabold tracking-[-0.01em] text-slate-900",
                      scene.memory && styles[scene.memory],
                    )}
                  >
                    {card.word}
                  </span>
                  <span
                    className={cn(
                      "font-[family-name:var(--font-geist-sans)] text-[13px] leading-4 font-medium text-slate-600",
                      scene.memory && styles[scene.memory],
                    )}
                  >
                    {card.meaning}
                  </span>
                </div>
                {scene.cycles ? (
                  <div className="absolute inset-0 flex flex-col justify-center gap-1 rounded-[14px] bg-slate-900 px-3.5 py-2.5 text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <span className="flex items-center gap-2 text-sm leading-5 font-bold">
                      <Lock className="size-4" />
                      {t("deck.peekTitle")}
                    </span>
                    <span className="text-xs leading-[18px] text-slate-300">{t("deck.peekText")}</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div aria-live="polite" className="text-center sm:flex-1 sm:text-left">
        <p className={cn(UTILITY, "tracking-[0.04em] text-recall uppercase")}>{t("deck.badge")}</p>
        <p className="mt-0.5 text-base leading-6 font-bold text-slate-900 sm:text-lg sm:leading-[26px]">{scene.title}</p>
        <p className="mt-1 hidden text-sm leading-[22px] text-slate-600 sm:block">{scene.text}</p>
      </div>
    </aside>
  );
}
