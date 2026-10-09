"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { MEMORY_CHECK_REQUIRED } from "@/lib/memory-check";
import type { QuestionDTO, QuestionOptionDTO } from "@/lib/schemas/learn";
import type { AnswerAttempt, AttemptOutcome } from "./answer-attempt";
import ChoiceGroup from "./ChoiceGroup";
import { announceTopicProgress } from "./topic-progress-feedback";

/**
 * What the response area is showing for the current question.
 * `error` is a failed save: it never marks the chosen option as incorrect.
 */
type Phase =
  | { kind: "choosing" }
  | { kind: "pending" }
  | { kind: "correct"; explanation?: string; progressError?: string; alreadySaved?: boolean }
  | { kind: "incorrect"; explanation: string; progressError?: string }
  | { kind: "error"; message: string };

const INCORRECT_FALLBACK =
  "Rất tiếc đáp án chưa chính xác. Bạn hãy đọc lại ngữ liệu và thử lại nhé!";
const PROGRESS_SYNC_NOTICE =
  "Đã lưu câu trả lời, nhưng chưa ghi nhận được tiến độ bài học.";

interface QuestionResponseProps {
  question: QuestionDTO;
  options: QuestionOptionDTO[];
  questionNumber: number;
  totalQuestions: number;
  /** Position among passage groups; null for standalone questions, which have no group. */
  groupPosition: { current: number; total: number } | null;
  /** Option the server already counts as this question's correct answer, if any. */
  savedOptionId?: string;
  /** This question's submission, owned by the workspace so it survives leaving and returning. */
  attempt?: AnswerAttempt;
  onAttemptStart: (questionId: string, optionId: string) => void;
  onAttemptSettled: (questionId: string, optionId: string, outcome: AttemptOutcome) => void;
  /** Direction of the last question change, so the entrance matches where the learner came from. */
  direction: "next" | "previous" | "none";
  /** Moves focus to the question heading on entry; set only after the learner navigated. */
  focusOnEntry: boolean;
  /** A later question exists; without it there is no "next" to offer and the end action takes its place. */
  hasNext: boolean;
  /**
   * What follows a correct answer when no later question exists: go back to a
   * missing question, or leave for the next topic (or the course overview).
   */
  endAction: { label: string; onClick: () => void } | { label: string; href: string };
  onPrevious: () => void;
  onNext: () => void;
  onCorrectAnswer: (questionId: string, optionId: string) => void;
  onIncorrectAnswer?: (questionId: string) => void;
  onTopicCompleted?: () => void;
  onMemoryCheckRequired?: () => void;
}

/**
 * The learner's side of one exercise question: choose, check, read the result,
 * then retry or continue. The parent keys this component by question id, so
 * every question starts a fresh attempt and a late server result from a
 * previous question cannot show feedback on the current one.
 */
export default function QuestionResponse({
  question,
  options,
  questionNumber,
  totalQuestions,
  groupPosition,
  savedOptionId,
  attempt,
  onAttemptStart,
  onAttemptSettled,
  direction,
  focusOnEntry,
  hasNext,
  endAction,
  onPrevious,
  onNext,
  onCorrectAnswer,
  onIncorrectAnswer,
  onTopicCompleted,
  onMemoryCheckRequired,
}: QuestionResponseProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef(0);
  const aliveRef = useRef(true);
  const [, startTransition] = useTransition();
  // A request started before this view mounted (the learner left and came back) is
  // still running: show it as pending and take its result when it lands.
  const inheritedPendingRef = useRef(!savedOptionId && attempt?.status === "pending");
  const [selectedId, setSelectedId] = useState<string | null>(
    savedOptionId ?? (attempt?.status === "pending" ? attempt.optionId : null),
  );
  const [phase, setPhase] = useState<Phase>(
    savedOptionId
      ? { kind: "correct", alreadySaved: true }
      : attempt?.status === "pending"
        ? { kind: "pending" }
        : { kind: "choosing" },
  );

  useEffect(() => {
    if (!inheritedPendingRef.current || attempt?.status !== "settled") return;
    inheritedPendingRef.current = false;
    const { outcome, optionId } = attempt;
    setSelectedId(optionId);
    setPhase(
      outcome.kind === "correct"
        ? { kind: "correct", explanation: outcome.explanation, progressError: outcome.progressError }
        : outcome.kind === "incorrect"
          ? {
              kind: "incorrect",
              explanation: outcome.explanation || INCORRECT_FALLBACK,
              progressError: outcome.progressError,
            }
          : { kind: "error", message: outcome.message },
    );
  }, [attempt]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (focusOnEntry) headingRef.current?.focus();
    // Only the entry of this question decides focus; later renders must not steal it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase.kind === "correct" && phase.alreadySaved) return;
    if (phase.kind === "correct" || phase.kind === "incorrect" || phase.kind === "error") {
      feedbackRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [phase]);

  const isPending = phase.kind === "pending";
  const isCorrect = phase.kind === "correct";
  const result = isCorrect ? "correct" : phase.kind === "incorrect" ? "incorrect" : null;
  const heading = question.content.trim() || "Chọn đáp án đúng";

  const submit = () => {
    if (!selectedId || isPending || isCorrect) return;
    const attemptNumber = ++attemptRef.current;
    const chosenId = selectedId;
    inheritedPendingRef.current = false;
    setPhase({ kind: "pending" });
    onAttemptStart(question.id, chosenId);

    startTransition(async () => {
      let response: Awaited<ReturnType<typeof submitQuestionAnswer>>;
      try {
        response = await submitQuestionAnswer(question.id, chosenId);
      } catch {
        const message = "Không thể gửi câu trả lời lúc này.";
        onAttemptSettled(question.id, chosenId, { kind: "error", message });
        if (aliveRef.current && attemptRef.current === attemptNumber) {
          setPhase({ kind: "error", message });
        }
        return;
      }
      // Leaving this question makes this view history only; a view that replaced it
      // takes the outcome from the workspace.
      const isCurrent = aliveRef.current && attemptRef.current === attemptNumber;

      if (response.error) {
        onAttemptSettled(question.id, chosenId, { kind: "error", message: response.error });
        if (!isCurrent) return;
        if (response.errorCode === MEMORY_CHECK_REQUIRED && onMemoryCheckRequired) {
          onMemoryCheckRequired();
          return;
        }
        setPhase({ kind: "error", message: response.error });
        return;
      }

      announceTopicProgress(response, onTopicCompleted);
      if (response.isCorrect) onCorrectAnswer(question.id, chosenId);
      else onIncorrectAnswer?.(question.id);
      onAttemptSettled(question.id, chosenId, {
        kind: response.isCorrect ? "correct" : "incorrect",
        explanation: response.explanation,
        progressError: response.progressError,
        passed: response.isMemoryCheckPassed === true,
      });
      if (!isCurrent) return;

      setPhase(
        response.isCorrect
          ? {
              kind: "correct",
              explanation: response.explanation,
              progressError: response.progressError,
            }
          : {
              kind: "incorrect",
              explanation: response.explanation || INCORRECT_FALLBACK,
              progressError: response.progressError,
            },
      );
    });
  };

  const retry = () => {
    setSelectedId(null);
    setPhase({ kind: "choosing" });
    headingRef.current?.focus();
  };

  const primary =
    phase.kind === "correct"
      ? hasNext
        ? { label: "Câu tiếp theo", onClick: onNext, icon: <ChevronRight aria-hidden="true" /> }
        : "href" in endAction
          ? null
          : { label: endAction.label, onClick: endAction.onClick, icon: null }
      : phase.kind === "incorrect"
        ? { label: "Thử lại", onClick: retry, icon: null }
        : {
            label: isPending ? "Đang kiểm tra…" : "Xác nhận đáp án",
            onClick: submit,
            icon: isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null,
          };

  const entrance =
    direction === "next"
      ? "motion-safe:slide-in-from-right-3"
      : direction === "previous"
        ? "motion-safe:slide-in-from-left-3"
        : "";
  const progressNotice =
    phase.kind === "correct" || phase.kind === "incorrect"
      ? phase.progressError
        ? PROGRESS_SYNC_NOTICE
        : null
      : null;

  return (
    <div
      className={`flex min-w-0 flex-col gap-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[220ms] ${entrance}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-600">
        <span>
          Câu hỏi {questionNumber}/{totalQuestions}
        </span>
        {groupPosition && (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            Nhóm {groupPosition.current}/{groupPosition.total}
          </span>
        )}
      </div>

      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        data-question-heading=""
        className="scroll-mt-4 break-words text-xl font-bold leading-snug text-slate-900 outline-none [overflow-wrap:anywhere] md:text-2xl"
      >
        {heading}
      </h2>

      <ChoiceGroup
        options={options}
        selectedId={selectedId}
        result={result}
        disabled={isPending || isCorrect || phase.kind === "incorrect"}
        onSelect={setSelectedId}
        labelledBy={headingId}
      />

      <div className="flex flex-col gap-3">
        {/* Two opposite actions share one row: back as a text link, forward as the primary. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Button onClick={onPrevious} variant="link" size="lg" className="px-2">
            <ChevronLeft aria-hidden="true" /> Câu trước
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {!isCorrect && hasNext && (
              <Button onClick={onNext} variant="link" size="lg" className="px-2">
                Câu sau <ChevronRight aria-hidden="true" />
              </Button>
            )}
            {primary ? (
              <Button
                size="lg"
                disabled={
                  isPending || ((phase.kind === "choosing" || phase.kind === "error") && !selectedId)
                }
                onClick={primary.onClick}
              >
                {primary.icon}
                {primary.label}
              </Button>
            ) : (
              "href" in endAction && (
                <Button asChild size="lg">
                  <Link href={endAction.href}>
                    {endAction.label}
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              )
            )}
          </div>
        </div>

        <div aria-live="polite" aria-atomic="true" ref={feedbackRef} className="empty:hidden">
          {/* The green option and its check already show a right answer; the live region
              only announces it, and a saved answer was announced when it was given. */}
          {phase.kind === "correct" && !phase.alreadySaved && (
            <p className="sr-only">Chính xác!</p>
          )}
          {phase.kind === "correct" && phase.explanation && (
            <p className="leading-relaxed text-slate-900">{phase.explanation}</p>
          )}
          {phase.kind === "incorrect" && (
            <div className="flex flex-col gap-2 rounded-lg border border-correction-line bg-correction-quiet p-4 text-slate-900">
              <p className="flex items-center gap-2 font-bold text-correction">
                <XCircle aria-hidden="true" className="size-5 shrink-0" />
                Chưa chính xác
              </p>
              <p className="leading-relaxed">{phase.explanation}</p>
            </div>
          )}
          {phase.kind === "error" && (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-lg border border-attention-line bg-attention-quiet p-4 text-slate-900"
            >
              <p className="flex items-center gap-2 font-bold text-attention">
                <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
                Chưa lưu được câu trả lời
              </p>
              <p className="leading-relaxed">
                {phase.message} Lựa chọn của bạn vẫn được giữ, hãy thử gửi lại.
              </p>
            </div>
          )}
          {progressNotice && (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-attention-line bg-attention-quiet p-3 text-sm text-slate-900">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attention" />
              {progressNotice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
