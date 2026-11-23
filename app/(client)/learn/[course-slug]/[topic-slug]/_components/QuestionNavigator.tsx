"use client";

import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CheckCircle2, Circle, ListChecks, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { viLearningText } from "@/lib/i18n/learning-text";
import type { Translate } from "@/lib/i18n/translate";

/** Answer state of one question; the current position is a separate flag. */
export type QuestionNavigatorStatus = "correct" | "incorrect" | "unanswered";

export interface QuestionNavigatorItem {
  id: string;
  /** Position in the whole topic, shown to the learner. */
  number: number;
  text: string;
  status: QuestionNavigatorStatus;
  current: boolean;
  /** Set when the guard in force does not allow opening this question yet. */
  disabledReason?: string;
}

export interface QuestionNavigatorGroup {
  id: string;
  /** Passage group label; absent for standalone questions. */
  label?: string;
  items: QuestionNavigatorItem[];
}

export interface QuestionNavigatorSection {
  id: string;
  title: string;
  badge?: string;
  groups: QuestionNavigatorGroup[];
}

interface QuestionNavigatorProps {
  sections: QuestionNavigatorSection[];
  /** Called after the list closes; the owner of the navigation rules decides whether the jump is allowed. */
  onSelect: (questionId: string) => void;
  /** Visible label of the trigger; defaults to the review wording. */
  label?: string;
  /** `learning` namespace translator (H7); callers that do not pass one keep today's Vietnamese. */
  t?: Translate;
  /** Formats the counts shown in the list (the U3 workspace passes its locale-aware formatter); defaults to bare digits. */
  formatCount?: (value: number) => string;
}

const WIDE_QUERY = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const wideSnapshot = () =>
  typeof window.matchMedia === "function" && window.matchMedia(WIDE_QUERY).matches;

const STATUS_KEY: Record<QuestionNavigatorStatus, string> = {
  correct: "navigator.statusCorrect",
  incorrect: "navigator.statusIncorrect",
  unanswered: "navigator.statusUnanswered",
};

function StatusIcon({ status, locked }: { status: QuestionNavigatorStatus; locked: boolean }) {
  if (locked) return <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attention" />;
  if (status === "correct") {
    return <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-growth" />;
  }
  if (status === "incorrect") {
    return <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-correction" />;
  }
  return <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-500" />;
}

function QuestionList({
  sections,
  onPick,
  t,
  formatCount,
}: {
  sections: QuestionNavigatorSection[];
  onPick: (item: QuestionNavigatorItem) => void;
  t: Translate;
  formatCount: (value: number) => string;
}) {
  const items = sections.flatMap((section) => section.groups.flatMap((group) => group.items));
  const correctCount = items.filter((item) => item.status === "correct").length;
  const lockReasons = Array.from(
    new Set(items.flatMap((item) => (item.disabledReason ? [item.disabledReason] : []))),
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm font-semibold text-slate-700">
        {t("navigator.summary", { correct: formatCount(correctCount), total: formatCount(items.length) })}
      </p>
      {lockReasons.map((reason) => (
        <p
          key={reason}
          className="flex items-start gap-2 rounded-lg border border-attention-line bg-attention-quiet p-3 text-sm text-slate-900"
        >
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attention" />
          {reason}
        </p>
      ))}
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`navigator-${section.id}`} className="flex flex-col gap-2">
          <h3
            id={`navigator-${section.id}`}
            className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900"
          >
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{section.title}</span>
            {section.badge && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-600">
                {section.badge}
              </span>
            )}
          </h3>
          {section.groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-1">
              {group.label && <p className="text-xs font-bold text-slate-600">{group.label}</p>}
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const locked = Boolean(item.disabledReason);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={locked}
                        aria-current={item.current ? "true" : undefined}
                        onClick={() => onPick(item)}
                        className={`flex min-h-12 w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route motion-reduce:transition-none disabled:cursor-not-allowed ${
                          item.current
                            ? "border-route-line bg-route-quiet"
                            : "border-transparent hover:bg-slate-50 disabled:hover:bg-transparent"
                        }`}
                      >
                        <StatusIcon status={item.status} locked={locked} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {t("navigator.item", { number: formatCount(item.number), text: item.text })}
                          </span>
                          <span className="text-xs text-slate-600">
                            {item.current ? t("navigator.current") : ""}
                            {locked ? t("navigator.locked") : t(STATUS_KEY[item.status])}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * "Danh sách câu hỏi": the topic's questions grouped by exercise and passage group,
 * each with a short text and its state (icon plus words, never color alone).
 * It is a popover on wide screens and a bottom sheet on narrow ones, and only
 * reports which question was picked; the caller's own guards decide whether the
 * jump happens, so a locked row cannot be used to bypass them.
 */
export default function QuestionNavigator({
  sections,
  onSelect,
  label,
  t = viLearningText,
  formatCount = String,
}: QuestionNavigatorProps) {
  const [open, setOpen] = useState(false);
  const isWide = useSyncExternalStore(subscribeWide, wideSnapshot, () => false);
  // A picked question takes focus on its own heading, so closing must not pull it back to the trigger.
  const jumped = useRef(false);

  const pick = (item: QuestionNavigatorItem) => {
    if (item.disabledReason) return;
    jumped.current = !item.current;
    setOpen(false);
    onSelect(item.id);
  };

  const keepJumpFocus = (event: Event) => {
    if (!jumped.current) return;
    jumped.current = false;
    event.preventDefault();
  };

  const hintId = useId();
  const trigger = (
    <Button variant="outline" className="shrink-0" aria-describedby={hintId}>
      <ListChecks aria-hidden="true" />
      {label ?? t("navigator.trigger")}
    </Button>
  );
  // The list is the only way to move between questions, so its purpose is shown on every screen size, not on hover.
  const withHint = (control: ReactNode) => (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {control}
      <p id={hintId} className="text-xs text-slate-600">
        {t("navigator.hint")}
      </p>
    </div>
  );

  const list = <QuestionList sections={sections} onPick={pick} t={t} formatCount={formatCount} />;

  if (isWide) {
    return withHint(
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="end"
          aria-label={t("navigator.title")}
          onCloseAutoFocus={keepJumpFocus}
          className="max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto p-4"
        >
          <PopoverHeader>
            <PopoverTitle className="text-base font-bold">{t("navigator.title")}</PopoverTitle>
            <PopoverDescription className="sr-only">
              {t("navigator.description")}
            </PopoverDescription>
          </PopoverHeader>
          {list}
        </PopoverContent>
      </Popover>
    );
  }

  return withHint(
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        onCloseAutoFocus={keepJumpFocus}
        className="max-h-[85dvh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">{t("navigator.title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("navigator.description")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{list}</div>
      </SheetContent>
    </Sheet>
  );
}
