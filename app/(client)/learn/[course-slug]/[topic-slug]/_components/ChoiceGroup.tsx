"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { QuestionOptionDTO } from "@/lib/schemas/learn";

export type ChoiceResult = "correct" | "incorrect";

interface ChoiceGroupProps {
  options: QuestionOptionDTO[];
  selectedId: string | null;
  /** Result of the chosen option once the server has graded it; selection alone never implies correctness. */
  result: ChoiceResult | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
  labelledBy: string;
}

function optionLetter(option: QuestionOptionDTO, index: number) {
  return option.label || (index < 26 ? String.fromCharCode(65 + index) : String(index + 1));
}

/**
 * Single-choice group shared by the memory check and the exercise questions.
 * Neutral -> Route (selected) -> Growth/Correction (graded) keeps selection
 * distinct from correctness, and the result is also carried by an icon and
 * screen-reader text rather than color alone.
 *
 * A fresh validation (the result appearing while this group is mounted) plays
 * one short motion on the chosen option: a corrective nudge for a wrong answer
 * and a growing status bar for a right one. A group that mounts already graded,
 * such as a revisited question, and later re-renders stay still, and reduced
 * motion keeps the state change without any movement.
 */
export default function ChoiceGroup({
  options,
  selectedId,
  result,
  disabled,
  onSelect,
  labelledBy,
}: ChoiceGroupProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Derived during render: true only once a result has appeared after mount, and
  // cleared again when the result is cleared (retry), so the next validation replays.
  const [previousResult, setPreviousResult] = useState(result);
  const [validatedHere, setValidatedHere] = useState(false);
  if (previousResult !== result) {
    setPreviousResult(result);
    setValidatedHere(result !== null);
  }
  // Roving tabindex: the selected option, or the first one, is the single tab stop.
  const selectedIndex = options.findIndex((option) => option.id === selectedId);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  const moveSelection = (event: KeyboardEvent, index: number) => {
    if (disabled) return;
    let target = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      target = (index + 1) % options.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      target = (index - 1 + options.length) % options.length;
    } else {
      return;
    }
    event.preventDefault();
    onSelect(options[target].id);
    buttonRefs.current[target]?.focus();
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-3">
      {options.map((option, index) => {
        const isSelected = selectedId === option.id;
        const graded = isSelected ? result : null;
        const tone =
          graded === "correct"
            ? "border-growth-line bg-growth-quiet text-slate-900 shadow-[inset_5px_0_0_var(--growth)]"
            : graded === "incorrect"
              ? "border-correction-line bg-correction-quiet text-correction shadow-[inset_5px_0_0_var(--correction)]"
              : isSelected
                ? "border-route bg-route-quiet text-slate-900"
                : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50";
        const marker =
          graded === "correct"
            ? "bg-growth text-white"
            : graded === "incorrect"
              ? "bg-correction text-white"
              : isSelected
                ? "bg-route text-white"
                : "bg-slate-100 text-slate-600";

        const motion =
          graded && validatedHere ? (graded === "correct" ? "correct-in" : "corrective") : undefined;

        return (
          <button
            key={option.id}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-motion={motion}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(option.id)}
            onKeyDown={(event) => moveSelection(event, index)}
            className={`flex min-h-12 w-full items-center gap-3 rounded-lg border-2 p-3.5 text-left font-medium transition-[background-color,border-color,color] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 motion-reduce:transition-none motion-safe:data-[motion=corrective]:animate-corrective motion-safe:data-[motion=correct-in]:animate-correct-in disabled:cursor-default ${tone}`}
          >
            <span
              aria-hidden="true"
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-[220ms] motion-reduce:transition-none ${marker}`}
            >
              {optionLetter(option, index)}
            </span>
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
              {option.content}
            </span>
            {graded === "correct" && (
              <>
                <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-growth" />
                <span className="sr-only">(bạn chọn đúng)</span>
              </>
            )}
            {graded === "incorrect" && (
              <>
                <XCircle aria-hidden="true" className="size-5 shrink-0 text-correction" />
                <span className="sr-only">(bạn chọn chưa đúng)</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
