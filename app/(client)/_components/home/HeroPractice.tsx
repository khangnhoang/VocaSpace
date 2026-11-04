"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CircleCheck, GraduationCap, Plane, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";
import { cn } from "@/lib/utils";

type DemoCard = {
  word: string;
  phonetic: string;
  meaning: string;
  example: readonly [string, string, string];
};

export const DEMO_DECKS = [
  {
    id: "toeic",
    tab: "TOEIC",
    title: "TOEIC Part 1",
    Icon: Plane,
    cards: [
      {
        word: "commute",
        phonetic: "/kəˈmjuːt/ · động từ",
        meaning: "đi lại hằng ngày giữa nhà và nơi làm",
        example: ["She ", "commutes", " to the office by train."],
      },
      {
        word: "itinerary",
        phonetic: "/aɪˈtɪnərəri/ · danh từ",
        meaning: "lịch trình chuyến đi",
        example: ["Please check the ", "itinerary", " before you book."],
      },
      {
        word: "reimburse",
        phonetic: "/ˌriːɪmˈbɜːs/ · động từ",
        meaning: "hoàn lại tiền đã chi",
        example: ["The company will ", "reimburse", " your travel costs."],
      },
    ],
  },
  {
    id: "ielts",
    tab: "IELTS",
    title: "IELTS Academic",
    Icon: GraduationCap,
    cards: [
      {
        word: "substantial",
        phonetic: "/səbˈstænʃl/ · tính từ",
        meaning: "đáng kể, lớn",
        example: ["There was a ", "substantial", " rise in prices."],
      },
      {
        word: "allocate",
        phonetic: "/ˈæləkeɪt/ · động từ",
        meaning: "phân bổ",
        example: ["The city will ", "allocate", " more funds to schools."],
      },
      {
        word: "hypothesis",
        phonetic: "/haɪˈpɒθəsɪs/ · danh từ",
        meaning: "giả thuyết",
        example: ["The data support the ", "hypothesis", "."],
      },
    ],
  },
  {
    id: "office",
    tab: "Công sở",
    title: "Giao tiếp công sở",
    Icon: BriefcaseBusiness,
    cards: [
      {
        word: "deadline",
        phonetic: "/ˈdedlaɪn/ · danh từ",
        meaning: "hạn chót",
        example: ["We need to meet the ", "deadline", " on Friday."],
      },
      {
        word: "follow up",
        phonetic: "/ˈfɒləʊ ʌp/ · cụm động từ",
        meaning: "liên hệ lại, theo dõi tiếp",
        example: ["I'll ", "follow up", " with the client tomorrow."],
      },
      {
        word: "agenda",
        phonetic: "/əˈdʒendə/ · danh từ",
        meaning: "chương trình cuộc họp",
        example: ["Let's go through the ", "agenda", " first."],
      },
    ],
  },
] as const satisfies readonly {
  id: string;
  tab: string;
  title: string;
  Icon: typeof Plane;
  cards: readonly DemoCard[];
}[];

type DeckId = (typeof DEMO_DECKS)[number]["id"];

// Mốc minh họa cho khách xem, không phải lịch FSRS thật: trong app, khoảng ôn do FSRS tính riêng cho từng thẻ.
// Thứ tự khớp FLASHCARD_RATINGS: Lại, Khó, Ổn, Dễ.
export const DEMO_RAIL_MARKS = ["Hôm nay", "1 ngày", "3 ngày", "1 tuần", "1 tháng"] as const;
const RATING_OUTCOMES = [
  { mark: 0, when: "trong hôm nay" },
  { mark: 1, when: "sau khoảng 1 ngày" },
  { mark: 2, when: "sau khoảng 3 ngày" },
  { mark: 3, when: "sau khoảng 1 tuần" },
] as const;

// Màn mở đầu: thẻ đầu tiên tự lật một lần sau khi hero hiện xong rồi úp lại, để khách thấy cơ chế mà chưa cần bấm.
// Chỉ chạy một lần, bỏ qua khi người dùng giảm chuyển động hoặc đã tương tác với khung thử.
export const INTRO_FLIP_START_MS = 900;
export const INTRO_FLIP_HOLD_MS = 1100;
const CARD_SWAP_MS = 220;

type Phase = { kind: "front" } | { kind: "rating" } | { kind: "rated"; outcome: number };
type FocusTarget = "reveal" | "firstRating" | "next" | "restart";

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function celebrate(origin: HTMLElement | null) {
  if (prefersReducedMotion()) return;
  try {
    const { default: confetti } = await import("canvas-confetti");
    const rect = origin?.getBoundingClientRect();
    void confetti({
      particleCount: 70,
      spread: 70,
      startVelocity: 32,
      ticks: 120,
      colors: ["#2563EB", "#0E7490", "#15803D", "#A5F3FC"],
      origin: rect
        ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 3) / window.innerHeight }
        : { y: 0.5 },
      disableForReducedMotion: true,
    });
  } catch {
    // Confetti chỉ là phần thưởng thị giác; thiếu canvas thì màn hoàn thành vẫn đủ nghĩa.
  }
}

export default function HeroPractice() {
  const [deckId, setDeckId] = useState<DeckId>("toeic");
  const [cardIndex, setCardIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "front" });
  const [introFlip, setIntroFlip] = useState(false);
  const [outgoing, setOutgoing] = useState<{ key: string; card: DemoCard } | null>(null);
  const [swapCount, setSwapCount] = useState(0);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const introCancelled = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const firstRatingRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  const deck = DEMO_DECKS.find((item) => item.id === deckId) ?? DEMO_DECKS[0];
  const card: DemoCard = deck.cards[cardIndex];
  const isLastCard = cardIndex === deck.cards.length - 1;
  const isComplete = phase.kind === "rated" && isLastCard;
  const isRevealed = phase.kind !== "front" || introFlip;
  const currentMark = phase.kind === "rated" ? RATING_OUTCOMES[phase.outcome].mark : 0;
  const completedCards = phase.kind === "rated" ? cardIndex + 1 : cardIndex;

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timers = [
      window.setTimeout(() => {
        if (!introCancelled.current) setIntroFlip(true);
      }, INTRO_FLIP_START_MS),
      window.setTimeout(() => setIntroFlip(false), INTRO_FLIP_START_MS + INTRO_FLIP_HOLD_MS),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Nút cần focus chỉ tồn tại sau khi React commit phase mới, nên focus trong effect thay vì ngay trong handler.
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "reveal") revealRef.current?.focus();
    if (target === "firstRating") firstRatingRef.current?.focus();
    if (target === "next") nextRef.current?.focus();
    if (target === "restart") restartRef.current?.focus();
  }, [phase, cardIndex, deckId]);

  function stopIntro() {
    introCancelled.current = true;
    setIntroFlip(false);
  }

  function resetDeck(focus: FocusTarget | null) {
    pendingFocus.current = focus;
    setOutgoing(null);
    setCardIndex(0);
    setPhase({ kind: "front" });
  }

  const status =
    phase.kind === "front"
      ? "Lật thẻ rồi chọn mức nhớ để xem lần ôn tiếp theo."
      : phase.kind === "rating"
        ? "Bạn nhớ từ này ở mức nào?"
        : `Ôn lại ${RATING_OUTCOMES[phase.outcome].when}.`;

  return (
    <section
      ref={panelRef}
      aria-labelledby="hero-practice-title"
      onPointerDownCapture={stopIntro}
      onKeyDownCapture={stopIntro}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.10)] sm:rounded-3xl sm:p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-[320ms] motion-safe:delay-[120ms] motion-safe:fill-mode-both"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="hero-practice-title"
          className="font-[family-name:var(--font-geist-sans)] text-xs font-semibold uppercase leading-4 tracking-[0.04em] text-recall"
        >
          Thử ngay · {deck.title}
        </h2>
        <p className="font-[family-name:var(--font-geist-sans)] text-xs font-medium leading-4 text-slate-500">
          Thẻ {cardIndex + 1}/{deck.cards.length}
        </p>
      </div>

      <Tabs
        value={deckId}
        onValueChange={(value) => {
          stopIntro();
          setDeckId(value as DeckId);
          resetDeck(null);
        }}
        className="mt-3 gap-0"
      >
        <TabsList
          variant="line"
          aria-label="Chọn bộ thẻ"
          className="h-auto w-full justify-start gap-1 rounded-none border-b border-slate-200 p-0"
        >
          {DEMO_DECKS.map(({ id, tab, Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="h-10 flex-none rounded-none px-3 text-sm font-semibold text-slate-600 after:bg-route hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-route data-active:text-route group-data-horizontal/tabs:after:bottom-[-1px]"
            >
              <Icon aria-hidden="true" />
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={deckId} className="mt-4">
          <div
            role="progressbar"
            aria-label="Số thẻ đã ôn trong bộ thử"
            aria-valuemin={0}
            aria-valuemax={deck.cards.length}
            aria-valuenow={completedCards}
            className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100"
          >
            <span
              className="block h-full rounded-full bg-recall transition-[width] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
              style={{ width: `${(completedCards / deck.cards.length) * 100}%` }}
            />
          </div>

          <div className="relative [perspective:1200px]">
            <div
              key={`${deckId}-${cardIndex}`}
              className={cn(
                "grid min-h-48 [transform-style:preserve-3d] transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:[transform:none]",
                isRevealed && "[transform:rotateY(180deg)]",
                // Thẻ mới trượt vào từ phải cùng lúc thẻ cũ trượt ra trái, nên không phải chờ animation mới bấm tiếp được.
                swapCount > 0 && "animate-in fade-in slide-in-from-right-6 duration-[220ms] motion-reduce:animate-none",
              )}
            >
              <div
                aria-hidden={isRevealed || undefined}
                inert={isRevealed}
                className={cn(
                  "col-start-1 row-start-1 flex flex-col items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 p-5 text-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
                  isRevealed && "motion-reduce:invisible",
                )}
              >
                <p className="text-[32px] font-extrabold leading-10 tracking-[-0.015em] text-slate-900">{card.word}</p>
                <p className="mt-1 text-sm text-slate-500">{card.phonetic}</p>
              </div>
              <div
                aria-hidden={!isRevealed || undefined}
                inert={!isRevealed}
                className={cn(
                  "col-start-1 row-start-1 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:[transform:none]",
                  !isRevealed && "motion-reduce:invisible",
                )}
              >
                <CardBack card={card} />
              </div>
            </div>
            {outgoing && (
              <div
                key={outgoing.key}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 animate-out fade-out slide-out-to-left-6 duration-[220ms] fill-mode-forwards motion-reduce:hidden"
              >
                <CardBack card={outgoing.card} />
              </div>
            )}
          </div>

          <div className="mt-4 min-h-11">
            {phase.kind === "front" && (
              <Button
                ref={revealRef}
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => {
                  stopIntro();
                  pendingFocus.current = "firstRating";
                  setPhase({ kind: "rating" });
                }}
              >
                <RotateCw aria-hidden="true" />
                Lật thẻ
              </Button>
            )}
            {phase.kind === "rating" && (
              <div role="group" aria-label="Bạn nhớ từ này ở mức nào?" className="grid grid-cols-4 gap-2">
                {FLASHCARD_RATINGS.map(({ label, className }, index) => (
                  <Button
                    key={label}
                    ref={index === 0 ? firstRatingRef : undefined}
                    type="button"
                    variant="outline"
                    size="lg"
                    className={cn("px-1", className)}
                    onClick={() => {
                      pendingFocus.current = isLastCard ? "restart" : "next";
                      setPhase({ kind: "rated", outcome: index });
                      if (isLastCard) void celebrate(panelRef.current);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
            {phase.kind === "rated" && !isComplete && (
              <Button
                ref={nextRef}
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => {
                  pendingFocus.current = "reveal";
                  setOutgoing({ key: `${deckId}-${cardIndex}-${swapCount}`, card });
                  setSwapCount((count) => count + 1);
                  setCardIndex((index) => index + 1);
                  setPhase({ kind: "front" });
                  window.setTimeout(() => setOutgoing(null), CARD_SWAP_MS + 80);
                }}
              >
                Thẻ tiếp theo
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
            {isComplete && (
              <div className="flex flex-col gap-3 rounded-2xl border border-growth-line bg-growth-quiet p-4 sm:flex-row sm:items-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-[320ms]">
                <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-growth" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-5 text-growth">Hoàn thành bộ thử</p>
                  <p className="text-sm leading-[22px] text-slate-700">
                    Bạn đã ôn {deck.cards.length}/{deck.cards.length} thẻ. Trong app, mỗi thẻ có lịch ôn riêng.
                  </p>
                </div>
                <Button
                  ref={restartRef}
                  type="button"
                  variant="outline"
                  size="lg"
                  className="shrink-0"
                  onClick={() => resetDeck("reveal")}
                >
                  <RotateCcw aria-hidden="true" />
                  Ôn lại bộ này
                </Button>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="flex justify-between gap-3 font-[family-name:var(--font-geist-sans)] text-xs font-medium leading-4 text-slate-500">
              <span>Lịch ôn của từ này</span>
              <span>Ví dụ minh họa</span>
            </div>
            <ReviewRail currentMark={currentMark} />
            <p role="status" className="mt-3 min-h-[22px] text-sm text-slate-600">
              {status}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CardBack({ card }: { card: DemoCard }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-300 bg-white p-5 text-center">
      <p className="text-sm font-semibold text-slate-500">{card.word}</p>
      <p className="mt-1.5 text-lg font-bold leading-[26px] text-slate-900">{card.meaning}</p>
      <p className="mt-2 max-w-[30em] text-sm text-slate-600">
        {card.example[0]}
        <strong className="font-semibold text-slate-900">{card.example[1]}</strong>
        {card.example[2]}
      </p>
    </div>
  );
}

// Khi chọn mức nhớ, đường ray chạy lần lượt từ mốc đầu tới mốc mới: mỗi đoạn 80ms, tối đa bốn đoạn nên cả chuỗi
// không quá 320ms (Product Language: single earned micro-cue). Quay về "Hôm nay" thì đổi ngay, không cần kể lại thứ tự.
const RAIL_STEP_MS = 80;

function ReviewRail({ currentMark }: { currentMark: number }) {
  const timing = (step: number, isFilling: boolean) => ({
    transitionDuration: `${RAIL_STEP_MS}ms`,
    transitionDelay: isFilling && currentMark > 0 ? `${step * RAIL_STEP_MS}ms` : "0ms",
  });

  return (
    <div aria-hidden="true">
      <div className="mx-1 mt-3 flex items-center">
        {DEMO_RAIL_MARKS.map((mark, index) => (
          <div key={mark} className={cn("flex items-center", index > 0 && "flex-1")}>
            {index > 0 && (
              <span
                style={timing(index - 1, index <= currentMark)}
                className={cn(
                  "h-0.5 flex-1 transition-colors ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                  index <= currentMark ? "bg-recall" : "bg-slate-300",
                )}
              />
            )}
            <span
              data-rail-mark={mark}
              data-state={index < currentMark ? "done" : index === currentMark ? "current" : "next"}
              style={timing(index, index <= currentMark)}
              className={cn(
                "size-3 shrink-0 rounded-full border-2 transition-[background-color,border-color,box-shadow] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                index < currentMark && "border-recall bg-recall",
                index === currentMark && "border-route bg-route ring-[3px] ring-route-quiet",
                index > currentMark && "border-slate-300 bg-white",
              )}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs leading-4 text-slate-500">
        {DEMO_RAIL_MARKS.map((mark, index) => (
          <span key={mark} className={cn(index === currentMark && "font-bold text-route")}>
            {mark}
          </span>
        ))}
      </div>
    </div>
  );
}
