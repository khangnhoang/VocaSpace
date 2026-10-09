"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, RotateCcw, TriangleAlert, XCircle } from "lucide-react";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import type { QuestionDTO } from "@/lib/schemas/learn";
import type { AnswerAttempt, AttemptOutcome } from "./answer-attempt";
import ChoiceGroup from "./ChoiceGroup";
import { announceTopicProgress } from "./topic-progress-feedback";

type Feedback =
  | { kind: "correct"; passed: boolean }
  | { kind: "incorrect"; explanation: string; passed: boolean };

interface MemoryCheckStageProps {
  questions: QuestionDTO[];
  /** Question ids the server already counts as correct (H3 predicate). */
  initiallyCorrectIds: string[];
  /** Submissions by question, owned by the workspace so they outlive this stage's view. */
  attempts?: Record<string, AnswerAttempt>;
  onAttemptStart?: (questionId: string, optionId: string) => void;
  onAttemptSettled?: (questionId: string, optionId: string, outcome: AttemptOutcome) => void;
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
  attempts,
  onAttemptStart,
  onAttemptSettled,
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
  // A request started before this view mounted (the learner went to the cards and came
  // back) is still running: show it as pending and take its result when it lands.
  const [inheritedId] = useState(() => {
    const head = queue[0];
    return head && attempts?.[head]?.status === "pending" ? head : null;
  });
  const [inheritedDone, setInheritedDone] = useState(inheritedId === null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(() => {
    const inherited = inheritedId ? attempts?.[inheritedId] : undefined;
    return inherited ? inherited.optionId : null;
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  const total = questions.length;
  const correctCount = total - queue.length + (feedback?.kind === "correct" ? 1 : 0);
  const currentQuestion = questions.find((question) => question.id === queue[0]);
  const currentAttempt = currentQuestion ? attempts?.[currentQuestion.id] : undefined;
  const isRequestPending = isPending || currentAttempt?.status === "pending";

  useEffect(() => {
    if (feedback) continueButtonRef.current?.focus();
  }, [feedback]);

  // The request this view inherited has landed: show its result (state adjusted
  // while rendering, so the first paint after the result already shows it).
  const inheritedAttempt = inheritedId ? attempts?.[inheritedId] : undefined;
  if (!inheritedDone && inheritedAttempt?.status === "settled") {
    const { outcome } = inheritedAttempt;
    setInheritedDone(true);
    setSelectedOptionId(inheritedAttempt.optionId);
    if (outcome.kind === "error") {
      setError(outcome.message);
    } else {
      setFeedback(
        outcome.kind === "correct"
          ? { kind: "correct", passed: outcome.passed }
          : {
              kind: "incorrect",
              explanation: outcome.explanation || "Đáp án chưa chính xác.",
              passed: outcome.passed,
            },
      );
    }
  }

  if (isPassed) {
    return (
      <section
        aria-labelledby="memory-check-done-title"
        className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-growth-line bg-growth-quiet p-6 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[220ms] md:p-8"
      >
        <CheckCircle2 aria-hidden="true" className="size-10 text-growth" />
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
            size="lg"
            className="px-8"
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
          size="lg"
          className="px-6"
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
    if (!selectedOptionId || isRequestPending || isAnswered) return;
    const questionId = currentQuestion.id;
    const chosenId = selectedOptionId;
    setError(null);
    onAttemptStart?.(questionId, chosenId);
    startTransition(async () => {
      const result = await submitQuestionAnswer(questionId, chosenId);
      if (result.error) {
        onAttemptSettled?.(questionId, chosenId, { kind: "error", message: result.error });
        setError(result.error);
        return;
      }
      announceTopicProgress(result, onTopicCompleted);
      const passed = result.isMemoryCheckPassed === true;
      if (result.isCorrect) onCorrectAnswer(questionId, chosenId);
      onAttemptSettled?.(questionId, chosenId, {
        kind: result.isCorrect ? "correct" : "incorrect",
        explanation: result.explanation,
        progressError: result.progressError,
        passed,
      });
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
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-600">
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
            className="h-full rounded-full bg-recall motion-safe:transition-[width] motion-safe:duration-[220ms]"
            style={{ width: `${total > 0 ? Math.round((correctCount / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div
        key={currentQuestion.id}
        className="flex flex-col gap-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[220ms]"
      >
        <h2
          id="memory-check-question"
          ref={questionHeadingRef}
          tabIndex={-1}
          className="break-words text-xl font-bold leading-snug text-slate-900 outline-none [overflow-wrap:anywhere] md:text-2xl"
        >
          {currentQuestion.content}
        </h2>

        <ChoiceGroup
          options={options}
          selectedId={selectedOptionId}
          result={feedback ? (feedback.kind === "correct" ? "correct" : "incorrect") : null}
          disabled={isAnswered || isRequestPending}
          onSelect={setSelectedOptionId}
          labelledBy="memory-check-question"
        />
      </div>

      <div aria-live="polite" className="min-h-0">
        {/* The green option and its check already show a right answer; only announce it. */}
        {feedback?.kind === "correct" && <p className="sr-only">Chính xác!</p>}
        {feedback?.kind === "incorrect" && (
          <div className="flex flex-col gap-2 rounded-lg border border-correction-line bg-correction-quiet p-4 text-slate-900">
            <p className="flex items-center gap-2 font-bold text-correction">
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
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-attention-line bg-attention-quiet p-4 font-medium text-slate-900"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-attention" />
            {error}
          </p>
        )}
      </div>

      {feedback ? (
        <Button
          ref={continueButtonRef}
          onClick={advance}
          size="lg"
          className="min-h-12 w-full"
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
          disabled={!selectedOptionId || isRequestPending}
          size="lg"
          className="min-h-12 w-full"
        >
          {isRequestPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {isRequestPending ? "Đang kiểm tra..." : "Kiểm tra đáp án"}
        </Button>
      )}
    </section>
  );
}
