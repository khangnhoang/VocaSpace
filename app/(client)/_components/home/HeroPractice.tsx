"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { domMax, LayoutGroup, LazyMotion, MotionConfig, useReducedMotion } from "motion/react";
import { useAnimate } from "motion/react-mini";
import * as m from "motion/react-m";
import { BriefcaseBusiness, CircleCheck, GraduationCap, Plane, RotateCcw } from "lucide-react";
import { Rating } from "ts-fsrs";
import FlashcardStage from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage";
import type { FlashcardDTO } from "@/lib/schemas/learn";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";
import { cn } from "@/lib/utils";
import styles from "./hero-layout.module.css";

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

// Màn mở đầu: thẻ đầu tiên tự lật một lần rồi úp lại, để khách thấy cơ chế mà chưa cần bấm. Chỉ bắt đầu khi phần lớn thẻ
// đã nằm trong màn hình (trên mobile thẻ thường ở dưới mép lúc tải trang), chạy một lần, và bỏ qua khi người dùng giảm
// chuyển động hoặc đã tương tác với khung thử.
export const INTRO_VISIBLE_RATIO = 0.6;
export const INTRO_FLIP_DELAY_MS = 1600;
export const INTRO_FLIP_HOLD_MS = 3400;

type LastRating = { word: string; outcome: number };
type DemoSession = { queue: number[]; isRevealed: boolean; lastRating: LastRating | null };

// Các DTO và ID minh họa chỉ tồn tại trong bộ thử ở trình duyệt.
const PRACTICE_DECKS = DEMO_DECKS.map((deck, deckIndex) => ({
  ...deck,
  cards: deck.cards.map((card, cardIndex): FlashcardDTO => {
    const [phonetic, pos] = card.phonetic.split(" · ");
    return {
      id: `00000000-0000-4000-8000-${String(deckIndex * 3 + cardIndex + 1).padStart(12, "0")}`,
      front_content: { word: card.word, phonetic, pos },
      back_content: { translation: card.meaning, example: card.example.join("") },
    };
  }),
}));

function newSession(cardCount: number): DemoSession {
  return { queue: Array.from({ length: cardCount }, (_, index) => index), isRevealed: false, lastRating: null };
}

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
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <PracticeDemo />
      </MotionConfig>
    </LazyMotion>
  );
}

function PracticeDemo() {
  const [deckId, setDeckId] = useState<DeckId>("toeic");
  const [session, setSession] = useState<DemoSession>(() => newSession(PRACTICE_DECKS[0].cards.length));
  const [hasChangedDeck, setHasChangedDeck] = useState(false);
  const indicatorGroup = useId();
  const reduceMotion = useReducedMotion();
  const introCancelled = useRef(false);
  const pendingFocus = useRef<"reveal" | "restart" | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  const deck = PRACTICE_DECKS.find((item) => item.id === deckId) ?? PRACTICE_DECKS[0];
  const card = deck.cards[session.queue[0]];
  const completedCards = deck.cards.length - session.queue.length;
  const currentMark = session.lastRating ? RATING_OUTCOMES[session.lastRating.outcome].mark : 0;
  const currentStep = session.isRevealed ? 1 : session.lastRating ? 2 : 0;

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timers: number[] = [];
    const cardArea = stageRef.current?.querySelector("[data-flashcard-box]");
    if (!cardArea || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      timers.push(
        window.setTimeout(() => {
          if (introCancelled.current) return;
          setSession((current) => ({ ...current, isRevealed: true }));
          timers.push(
            window.setTimeout(() => {
              if (!introCancelled.current) setSession((current) => ({ ...current, isRevealed: false }));
            }, INTRO_FLIP_HOLD_MS),
          );
        }, INTRO_FLIP_DELAY_MS),
      );
    }, { threshold: INTRO_VISIBLE_RATIO });
    observer.observe(cardArea);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "reveal") stageRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    if (target === "restart") restartRef.current?.focus();
  }, [session, deckId]);

  function stopIntro() {
    introCancelled.current = true;
  }

  function handleRateCard(rating: Rating) {
    stopIntro();
    if (!card || !session.isRevealed) return;
    const outcome = FLASHCARD_RATINGS.findIndex((item) => item.rating === rating);
    if (outcome === -1) return;
    const [active, ...remaining] = session.queue;
    // Cùng quy tắc với LearningWorkspace và PublicCoursePreviewExperience: Lại/Khó quay về cuối hàng đợi.
    if (rating === Rating.Again || rating === Rating.Hard) remaining.push(active);
    pendingFocus.current = remaining.length === 0 ? "restart" : "reveal";
    setSession({ queue: remaining, isRevealed: false, lastRating: { word: card.front_content.word, outcome } });
    if (remaining.length === 0) void celebrate(panelRef.current);
  }

  const lastOutcome = session.lastRating && RATING_OUTCOMES[session.lastRating.outcome];
  const status = session.isRevealed
    ? "Bạn nhớ từ này ở mức nào?"
    : session.lastRating && lastOutcome
      ? `${session.lastRating.word}: ${session.lastRating.outcome < 2 ? "sẽ gặp lại trong bộ thử. " : ""}Ôn lại ${lastOutcome.when}.`
      : "Hiện đáp án rồi chọn mức nhớ để xem lần ôn tiếp theo.";

  return (
    <section
      ref={panelRef}
      aria-labelledby="hero-practice-title"
      onPointerDownCapture={stopIntro}
      onKeyDownCapture={stopIntro}
      className="min-w-0 rounded-3xl border border-slate-300 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.10)] sm:max-lg:p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-[1200ms] motion-safe:delay-[250ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] motion-safe:fill-mode-both"
    >
      <ol aria-label="Các bước học thử" className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-5 text-xs font-semibold leading-4 text-slate-500 sm:gap-3 sm:text-sm lg:mb-3 lg:pb-3">
        {["Gặp từ", "Nhớ lại", "Hẹn ôn"].map((label, index) => (
          <li key={label} aria-current={index === currentStep ? "step" : undefined} className={cn("flex min-w-0 flex-1 items-center gap-2 transition-colors duration-[450ms] motion-reduce:transition-none", index === currentStep && "text-route", index < currentStep && "text-recall")}>
            <span aria-hidden="true" className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-[450ms] motion-reduce:transition-none", index === currentStep ? "border-route bg-route-quiet" : index < currentStep ? "border-recall bg-recall-quiet" : "border-slate-300")}>
              {index < currentStep ? <CircleCheck className="size-3.5" /> : index + 1}
            </span>
            <span>{label}</span>
            {index < 2 && <span aria-hidden="true" className="ml-auto hidden h-px flex-1 bg-slate-300 sm:block" />}
          </li>
        ))}
      </ol>
      <div className="flex min-h-8 items-center justify-between gap-3 sm:min-h-0">
        <h2 id="hero-practice-title" className="font-[family-name:var(--font-geist-sans)] text-xs font-semibold uppercase leading-4 tracking-[0.04em] text-recall">
          Thử ngay · {deck.title}
        </h2>
        <p className="shrink-0 font-[family-name:var(--font-geist-sans)] text-xs font-medium leading-4 text-slate-500">
          Còn {session.queue.length}/{deck.cards.length} thẻ
        </p>
      </div>
      <Tabs
        value={deckId}
        onValueChange={(value) => {
          const nextDeck = PRACTICE_DECKS.find((item) => item.id === value);
          if (!nextDeck) return;
          stopIntro();
          setHasChangedDeck(true);
          setDeckId(nextDeck.id);
          setSession(newSession(nextDeck.cards.length));
        }}
        className="mt-3 gap-0 lg:mt-2"
      >
        <LayoutGroup id={indicatorGroup}>
          <TabsList
            variant="line"
            aria-label="Chọn bộ thẻ"
            className="w-full justify-start gap-0 rounded-none border-b border-slate-200 p-0 group-data-horizontal/tabs:h-11"
          >
            {DEMO_DECKS.map(({ id, tab, Icon }) => (
              <TabsTrigger key={id} value={id} className="h-11 min-w-0 flex-none select-none rounded-none px-2.5 py-0 text-xs font-semibold text-slate-600 transition-colors duration-[250ms] after:hidden hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-route data-active:text-route motion-reduce:transition-none sm:px-3 sm:text-sm">
                <span data-deck-label="" className="relative inline-flex h-full items-center gap-1.5">
                  <Icon aria-hidden="true" className="size-3.5 sm:size-4" />
                  {tab}
                  {deckId === id && (
                    <m.span
                      aria-hidden="true"
                      layoutId="deck-indicator"
                      transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.4, 0, 0.2, 1] }}
                      className="pointer-events-none absolute -bottom-px inset-x-0 h-0.5 bg-route"
                    />
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </LayoutGroup>
        <TabsContent key={deckId} value={deckId} className={cn("mt-4 lg:mt-3", styles.practiceGrid)}>
          {card ? (
            <div
              ref={stageRef}
              role={session.isRevealed ? "group" : undefined}
              aria-label={session.isRevealed ? "Bạn nhớ từ này ở mức nào?" : undefined}
            >
              <DemoLearningCard
                enter={hasChangedDeck}
                currentCard={card}
                cardsLeft={session.queue.length}
                totalCards={deck.cards.length}
                isFlipped={session.isRevealed}
                setIsFlipped={(isRevealed) => {
                  stopIntro();
                  setSession((current) => ({ ...current, isRevealed }));
                }}
                handleRateCard={handleRateCard}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-growth-line bg-growth-quiet p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)]">
              <CircleCheck aria-hidden="true" className="mb-3 size-6 text-growth" />
              <p className="font-bold text-growth">Hoàn thành bộ thử</p>
              <p className="mt-2 text-sm leading-[22px] text-slate-700">Bạn đã nhớ {deck.cards.length}/{deck.cards.length} thẻ. Trong app, mỗi thẻ có lịch ôn riêng.</p>
              <Button
                ref={restartRef}
                type="button"
                variant="outline"
                size="lg"
                className="mt-4 duration-[350ms]"
                onClick={() => {
                  pendingFocus.current = "reveal";
                  setSession(newSession(deck.cards.length));
                }}
              >
                <RotateCcw aria-hidden="true" />
                Ôn lại bộ này
              </Button>
              <div role="progressbar" aria-label="Tiến độ từ vựng" aria-valuemin={0} aria-valuemax={deck.cards.length} aria-valuenow={completedCards} className="mt-4 h-1.5 rounded-full bg-recall" />
            </div>
          )}
          <div className={cn("mt-5 rounded-2xl border border-recall-line bg-recall-quiet p-4 sm:max-lg:p-5 lg:mt-3", styles.reviewPanel)}>
            <div className="flex flex-wrap justify-between gap-2 font-[family-name:var(--font-geist-sans)] text-xs font-medium leading-4 text-recall">
              <span>{session.lastRating ? `Lịch ôn của ${session.lastRating.word}` : "Lịch ôn của từ này"}</span>
              <span>Ví dụ minh họa</span>
            </div>
            <ReviewRail currentMark={currentMark} />
            <p role="status" className="mt-4 min-h-[44px] text-sm font-semibold leading-[22px] text-slate-900 lg:mt-2">{status}</p>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function DemoLearningCard({ enter, ...props }: ComponentProps<typeof FlashcardStage> & { enter: boolean }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduceMotion = useReducedMotion();
  useLayoutEffect(() => {
    if (!enter || reduceMotion || typeof scope.current?.animate !== "function") return;
    // Dùng lớp nội dung để chuyển động khi đổi bộ mà không dịch khung thẻ.
    const animation = animate(
      "[data-flashcard-box] > div > div",
      { transform: ["translateX(12px)", "translateX(0px)"] },
      { duration: 0.65, ease: [0.4, 0, 0.2, 1] },
    );
    return () => animation.cancel();
  }, [animate, enter, reduceMotion, scope]);
  return (
    <div ref={scope} className={cn("[&_[data-flashcard-box]]:duration-[800ms] [&_[data-flashcard-box]>div]:overflow-x-hidden lg:[&_[data-flashcard-box]]:h-[clamp(11rem,calc(100svh-35.5rem),22rem)] lg:[&_[data-flashcard-box]>div]:py-5", styles.demoStage)}>
      <FlashcardStage {...props} />
    </div>
  );
}

// Đường ray kể thứ tự lịch ôn, còn thông báo và hành động kế tiếp luôn có ngay khi chọn mức nhớ.
const RAIL_STEP_MS = 250;

function ReviewRail({ currentMark }: { currentMark: number }) {
  const reduceMotion = useReducedMotion();
  const timing = (step: number, isFilling: boolean) => ({
    transitionDuration: "550ms",
    transitionDelay: isFilling && currentMark > 0 ? `${step * RAIL_STEP_MS}ms` : "0ms",
  });

  return (
    <div aria-hidden="true" className={styles.reviewRail}>
      <div className={cn("mx-1 mt-3 flex items-center", styles.reviewTrack)}>
        {DEMO_RAIL_MARKS.map((mark, index) => (
          <div key={mark} className={cn("flex items-center", styles.reviewStop, index > 0 && "flex-1")}>
            {index > 0 && (
              <span className={cn("h-0.5 flex-1 overflow-hidden bg-slate-300", styles.reviewSegment)}>
                <m.span
                  initial={false}
                  animate={{ scale: index <= currentMark ? 1 : 0 }}
                  transition={{
                    duration: reduceMotion || index > currentMark ? 0 : 0.55,
                    delay: reduceMotion || index > currentMark ? 0 : ((index - 1) * RAIL_STEP_MS) / 1000,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className={cn("block h-full origin-left bg-recall", styles.reviewFill)}
                />
              </span>
            )}
            <span
              data-rail-mark={mark}
              data-state={index < currentMark ? "done" : index === currentMark ? "current" : "next"}
              style={timing(index, index <= currentMark)}
              className={cn(
                "size-3 shrink-0 rounded-full border-2 transition-[background-color,border-color,box-shadow] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
                index < currentMark && "border-recall bg-recall",
                index === currentMark && "border-route bg-route ring-[3px] ring-route-quiet",
                index > currentMark && "border-slate-300 bg-white",
              )}
            />
          </div>
        ))}
      </div>
      <div className={cn("mt-2 flex justify-between text-xs leading-4 text-slate-500", styles.reviewLabels)}>
        {DEMO_RAIL_MARKS.map((mark, index) => (
          <span key={mark} className={cn(index === currentMark && "font-bold text-route")}>
            {mark}
          </span>
        ))}
      </div>
    </div>
  );
}
