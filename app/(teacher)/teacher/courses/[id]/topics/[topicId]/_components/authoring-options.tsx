"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DraftOption = { id?: string; content: string; is_correct: boolean };

export function optionLabel(index: number) {
  let label = "";
  let cursor = index;
  do {
    label = String.fromCharCode(65 + (cursor % 26)) + label;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);
  return label;
}

export function buildEmptyOptions(count = 4): DraftOption[] {
  return Array.from({ length: count }, (_, index) => ({ content: "", is_correct: index === 0 }));
}

// Chọn đáp án đúng là lựa chọn duy nhất; bỏ đáp án đúng thì chuyển "đúng" về đáp án đầu
// để form không rơi vào trạng thái không có đáp án đúng mà người soạn không thấy.
export function setCorrectOption(options: DraftOption[], index: number) {
  return options.map((option, i) => ({ ...option, is_correct: i === index }));
}

export function removeOption(options: DraftOption[], index: number) {
  const next = options.filter((_, i) => i !== index);
  if (next.length > 0 && !next.some((option) => option.is_correct)) {
    next[0] = { ...next[0], is_correct: true };
  }
  return next;
}

export function getOptionProblem(options: DraftOption[]) {
  const filled = options.filter((option) => option.content.trim() !== "");
  if (filled.length < 2) return "Cần ít nhất 2 đáp án có nội dung.";
  if (!filled.some((option) => option.is_correct)) return "Chọn 1 đáp án đúng có nội dung.";
  return null;
}

interface OptionListEditorProps {
  idPrefix: string;
  options: DraftOption[];
  onChange: (options: DraftOption[]) => void;
  disabled?: boolean;
  error?: string | null;
}

export function OptionListEditor({
  idPrefix,
  options,
  onChange,
  disabled = false,
  error,
}: OptionListEditorProps) {
  const errorId = `${idPrefix}-options-error`;

  return (
    <fieldset
      className="space-y-2"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-2 text-sm font-semibold text-slate-800">
        Đáp án <span className="font-normal text-slate-600">(chọn 1 đáp án đúng)</span>
      </legend>
      {options.map((option, index) => {
        const letter = optionLabel(index);
        const inputId = `${idPrefix}-option-${index}`;
        return (
          <div
            key={option.id ?? `new-${index}`}
            className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors duration-[220ms] motion-reduce:transition-none ${
              option.is_correct ? "border-growth-line bg-growth-quiet" : "border-slate-200 bg-white"
            }`}
          >
            <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg">
              <input
                type="radio"
                name={`${idPrefix}-correct`}
                className="size-5 accent-[var(--growth)]"
                checked={option.is_correct}
                disabled={disabled}
                onChange={() => onChange(setCorrectOption(options, index))}
                aria-label={`Đáp án ${letter} là đáp án đúng`}
              />
            </label>
            <label htmlFor={inputId} className="w-5 shrink-0 text-center text-sm font-bold text-slate-600">
              {letter}
            </label>
            <Input
              id={inputId}
              value={option.content}
              disabled={disabled}
              aria-label={`Nội dung đáp án ${letter}`}
              placeholder={`Đáp án ${letter}`}
              onChange={(event) =>
                onChange(
                  options.map((item, i) =>
                    i === index ? { ...item, content: event.target.value } : item,
                  ),
                )
              }
              className="h-10 min-w-0 flex-1 bg-white"
            />
            {option.is_correct ? (
              <span className="hidden shrink-0 text-xs font-bold text-growth sm:inline">Đúng</span>
            ) : null}
            <Button
              type="button"
              variant="destructive-quiet"
              size="icon"
              disabled={disabled || options.length <= 2}
              aria-label={`Bỏ đáp án ${letter}`}
              onClick={() => onChange(removeOption(options, index))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="text-route"
        onClick={() => onChange([...options, { content: "", is_correct: false }])}
      >
        <Plus aria-hidden="true" /> Thêm đáp án {optionLabel(options.length)}
      </Button>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-correction">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
