"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import type { QuestionDTO } from "@/lib/schemas/learn";
import { announceTopicProgress } from "./topic-progress-feedback";

type Feedback =
  | { kind: "correct"; passed: boolean }
  | { kind: "incorrect"; explanation: string; passed: boolean };

interface MemoryCheckStageProps {
  questions: QuestionDTO[];
  /** Question ids the server already counts as correct (H3 predicate). */
  initiallyCorrectIds: string[];
  isPassed: boolean;
  hasExercises: boolean;
  onCorrectAnswer: (questionId: string, optionId: string) => void;
  onPassed: () => void;
  onGoToExercises: () => void;
  onTopicCompleted?: () => void;
}

function sortOptions(question: QuestionDTO) {
  return question.options
    .slice()
    .sort(
      (left, right) =>
        (left.order_index ?? Number.MAX_SAFE_INTEGER) -
          (right.order_index ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    );
}

export default function MemoryCheckStage({
  questions,
  initiallyCorrectIds,
  isPassed,
  hasExercises,
  onCorrectAnswer,
  onPassed,
  onGoToExercises,
  onTopicCompleted,
}: MemoryCheckStageProps) {
  const [isPending, startTransition] = useTransition();
  // Retry queue: unanswered/incorrect questions in authoring order; a wrong
  // answer moves its question to the end until every question is correct.
  const [queue, setQueue] = useState<string[]>(() => {
    const correct = new Set(initiallyCorrectIds);
    return questions
      .slice()
      .sort((left, right) => left.order_index - right.order_index)
      .filter((question) => !correct.has(question.id))
      .map((question) => question.id);
  });
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  const total = questions.length;
  const correctCount = total - queue.length + (feedback?.kind === "correct" ? 1 : 0);
  const currentQuestion = questions.find((question) => question.id === queue[0]);

  useEffect(() => {
    if (feedback) continueButtonRef.current?.focus();
  }, [feedback]);

  if (isPassed) {
    return (
      <section
        aria-labelledby="memory-check-done-title"
        className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-sm"
      >
        <CheckCircle2 aria-hidden="true" className="size-10 text-emerald-600" />
        <h2 id="memory-check-done-title" className="text-xl font-bold text-slate-800">
          Bạn đã trả lời đúng hết memory check
        </h2>
        <p className="text-slate-600">
          {hasExercises
            ? "Bài tập của chủ đề này đã mở."
            : "Chủ đề này không có bài tập."}
        </p>
        {hasExercises && (
          <Button
            onClick={onGoToExercises}
            className="min-h-11 rounded-xl bg-emerald-600 px-8 font-bold text-white hover:bg-emerald-700"
          >
            Làm bài tập
          </Button>
        )}
      </section>
    );
  }

  if (!currentQuestion) {
    // Local queue is empty but the server has not confirmed the pass, e.g.
    // the teacher changed the memory check since this page loaded. A full reload is
    // needed: router.refresh() keeps the client queue and answers state.
    return (
      <section role="status" className="flex max-w-xl flex-col items-center gap-4 text-center">
        <h2 className="text-xl font-bold text-slate-800">Memory check vừa thay đổi</h2>
        <p className="text-slate-600">Tải lại để làm các câu còn lại trước khi mở bài tập.</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="min-h-11 rounded-xl px-6 font-bold"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Tải lại
        </Button>
      </section>
    );
  }

  const options = sortOptions(currentQuestion);
  const isAnswered = feedback !== null;

  const submit = () => {
    if (!selectedOptionId || isPending || isAnswered) return;
    setError(null);
    startTransition(async () => {
      const result = await submitQuestionAnswer(currentQuestion.id, selectedOptionId);
      if (result.error) {
        setError(result.error);
        return;
      }
      announceTopicProgress(result, onTopicCompleted);
      const passed = result.isMemoryCheckPassed === true;
      if (result.isCorrect) onCorrectAnswer(currentQuestion.id, selectedOptionId);
      setFeedback(
        result.isCorrect
          ? { kind: "correct", passed }
          : {
              kind: "incorrect",
              explanation: result.explanation || "Đáp án chưa chính xác.",
              passed,
            },
      );
    });
  };

  const advance = () => {
    if (!feedback) return;
    if (feedback.passed) {
      onPassed();
      return;
    }
    setQueue((current) => {
      const [head, ...rest] = current;
      return feedback.kind === "correct" ? rest : [...rest, head];
    });
    setFeedback(null);
    setSelectedOptionId(null);
    requestAnimationFrame(() => questionHeadingRef.current?.focus());
  };

  const willReturn = feedback?.kind === "incorrect" && queue.length > 1;

  return (
    <section
      aria-labelledby="memory-check-question"
      className="flex w-full max-w-2xl flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-500">
          <span>Memory check</span>
          <span>
            Đã đúng {correctCount}/{total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Tiến độ memory check"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={correctCount}
          aria-valuetext={`Đã đúng ${correctCount} trên ${total} câu`}
          className="h-2 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-emerald-500 motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${total > 0 ? Math.round((correctCount / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <h2
        id="memory-check-question"
        ref={questionHeadingRef}
        tabIndex={-1}
        className="break-words text-2xl font-bold leading-snug text-slate-800 outline-none [overflow-wrap:anywhere] md:text-3xl"
      >
        {currentQuestion.content}
      </h2>

      <div role="radiogroup" aria-labelledby="memory-check-question" className="flex flex-col gap-3">
        {options.map((option, index) => {
          const isSelected = selectedOptionId === option.id;
          const resolved = isSelected && feedback;
          const tone = resolved
            ? feedback.kind === "correct"
              ? "border-emerald-600 bg-emerald-50 text-emerald-900"
              : "border-rose-600 bg-rose-50 text-rose-900"
            : isSelected
              ? "border-slate-800 bg-slate-50 text-slate-900"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isAnswered || isPending}
              onClick={() => setSelectedOptionId(option.id)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 p-4 text-left font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2 disabled:cursor-default ${tone}`}
            >
              <span
                aria-hidden="true"
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isSelected ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {option.label || String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.content}</span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="min-h-0">
        {feedback?.kind === "correct" && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
            Chính xác!
          </p>
        )}
        {feedback?.kind === "incorrect" && (
          <div className="flex flex-col gap-2 rounded-xl bg-rose-50 p-4 text-rose-900">
            <p className="flex items-center gap-2 font-bold">
              <XCircle aria-hidden="true" className="size-5 shrink-0" />
              Chưa chính xác
            </p>
            <p className="leading-relaxed">{feedback.explanation}</p>
            <p className="text-sm font-medium">
              {willReturn
                ? "Câu này sẽ quay lại sau các câu còn lại."
                : "Bạn sẽ trả lời lại câu này."}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 font-medium text-rose-800">
            {error}
          </p>
        )}
      </div>

      {feedback ? (
        <Button
          ref={continueButtonRef}
          onClick={advance}
          className="min-h-12 w-full rounded-xl bg-slate-800 font-bold text-white hover:bg-slate-900"
        >
          {feedback.passed
            ? hasExercises
              ? "Mở bài tập"
              : "Hoàn thành memory check"
            : "Tiếp tục"}
        </Button>
      ) : (
        <Button
          onClick={submit}
          disabled={!selectedOptionId || isPending}
          className="min-h-12 w-full rounded-xl bg-slate-800 font-bold text-white hover:bg-slate-900"
        >
          {isPending ? "Đang kiểm tra..." : "Kiểm tra đáp án"}
        </Button>
      )}
    </section>
  );
}
