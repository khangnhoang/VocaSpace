"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { submitQuestionAnswerLocalized } from "@/app/actions/progress-localized";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { formatCatalogCount } from "@/lib/i18n/format";
import {
  heldKey,
  heldText,
  replyForField,
  resolveHeldMessage,
  type HeldMessage,
  type RequestReply,
} from "@/lib/i18n/held-message";
import { asTranslate } from "@/lib/i18n/translate";
import { MEMORY_CHECK_REQUIRED } from "@/lib/memory-check";
import type { QuestionDTO, QuestionOptionDTO } from "@/lib/schemas/learn";
import { serverTextFor, type AnswerAttempt, type AttemptOutcome, type ServerText } from "./answer-attempt";
import ChoiceGroup from "./ChoiceGroup";
import { announceTopicProgress } from "./topic-progress-feedback";

/**
 * What the response area is showing for the current question.
 * `error` is a failed save: it never marks the chosen option as incorrect.
 */
type Phase =
  | { kind: "choosing" }
  | { kind: "pending" }
  | { kind: "correct"; explanation?: ServerText; progressError?: string; alreadySaved?: boolean }
  | { kind: "incorrect"; explanation?: ServerText; progressError?: string }
  | { kind: "error"; message: HeldMessage };

function phaseOf(outcome: AttemptOutcome): Phase {
  if (outcome.kind === "correct") {
    return { kind: "correct", explanation: outcome.explanation, progressError: outcome.progressError };
  }
  if (outcome.kind === "incorrect") {
    return { kind: "incorrect", explanation: outcome.explanation, progressError: outcome.progressError };
  }
  return { kind: "error", message: outcome.message };
}

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
  /**
   * ENLOC-004: outcome carried across a workspace remount after `router.refresh()`. It sets the first phase only, so a learner who
   * leaves this question and comes back later still starts a fresh choice. `onResumed` lets the workspace use it once.
   */
  resumeAttempt?: Extract<AnswerAttempt, { status: "settled" }>;
  onResumed?: (questionId: string) => void;
  onAttemptStart: (questionId: string, optionId: string) => void;
  onAttemptSettled: (questionId: string, optionId: string, outcome: AttemptOutcome) => void;
  /** Direction of the last question change, so the entrance matches where the learner came from. */
  direction: "next" | "previous" | "none";
  /** Moves focus to the question heading on entry; set only after the learner navigated. */
  focusOnEntry: boolean;
  /** A later question to continue to; without it the end action takes its place. */
  hasNext: boolean;
  /**
   * What follows a correct answer when there is no next question: go back to a
   * missing question, open the completion screen of a completed topic, or leave
   * for the next topic (or the course overview). The learner always presses it,
   * so the last feedback stays on screen until they move on.
   */
  endAction: { label: string; onClick: () => void } | { label: string; href: string };
  onNext: () => void;
  onCorrectAnswer: (questionId: string, optionId: string) => void;
  onIncorrectAnswer?: (questionId: string) => void;
  /** The server reports the topic as completed; the argument is its `newlyCompleted` (LF5 AC4). */
  onTopicCompleted?: (newlyCompleted: boolean) => void;
  onMemoryCheckRequired?: () => void;
  /**
   * The workspace translates the progress warning of a saved answer with the language shown when the reply lands (U3 H4). This
   * view unmounts when the learner leaves the question, the workspace does not.
   */
  resolveProgressNotice: (text: string, reply: RequestReply) => string;
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
  resumeAttempt,
  onResumed,
  onAttemptStart,
  onAttemptSettled,
  direction,
  focusOnEntry,
  hasNext,
  endAction,
  onNext,
  onCorrectAnswer,
  onIncorrectAnswer,
  onTopicCompleted,
  onMemoryCheckRequired,
  resolveProgressNotice,
}: QuestionResponseProps) {
  const t = asTranslate(useTranslations("learn"));
  const tRoot = asTranslate(useTranslations());
  const learningText = asTranslate(useTranslations("learning"));
  const locale: Locale = useLocale() === "en" ? "en" : "vi";
  const count = (value: number) => formatCatalogCount(locale, value);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef(0);
  const submittingRef = useRef(false);
  const aliveRef = useRef(true);
  const [, startTransition] = useTransition();
  // A request started before this view mounted (the learner left and came back) is
  // still running: show it as pending and take its result when it lands.
  const inheritedPendingRef = useRef(!savedOptionId && attempt?.status === "pending");
  const [selectedId, setSelectedId] = useState<string | null>(
    resumeAttempt?.optionId ?? savedOptionId ?? (attempt?.status === "pending" ? attempt.optionId : null),
  );
  const [phase, setPhase] = useState<Phase>(
    resumeAttempt
      ? phaseOf(resumeAttempt.outcome)
      : savedOptionId
        ? { kind: "correct", alreadySaved: true }
        : attempt?.status === "pending"
          ? { kind: "pending" }
          : { kind: "choosing" },
  );

  useEffect(() => {
    if (resumeAttempt) onResumed?.(question.id);
    // Chỉ lúc mount: lần dựng lại sau này không dùng lại kết quả đã mang qua.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!inheritedPendingRef.current || attempt?.status !== "settled") return;
    inheritedPendingRef.current = false;
    const { outcome, optionId } = attempt;
    setSelectedId(optionId);
    setPhase(phaseOf(outcome));
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
  const heading = question.content.trim() || t("workspace.navigator.fallbackText");

  const submit = () => {
    if (!selectedId || isPending || isCorrect || submittingRef.current) return;
    submittingRef.current = true;
    const attemptNumber = ++attemptRef.current;
    const chosenId = selectedId;
    inheritedPendingRef.current = false;
    setPhase({ kind: "pending" });
    onAttemptStart(question.id, chosenId);

    startTransition(async () => {
      let response: Awaited<ReturnType<typeof submitQuestionAnswerLocalized>>;
      try {
        response = await submitQuestionAnswerLocalized(question.id, chosenId);
      } catch {
        const message = heldKey("workspace.question.sendFailed");
        onAttemptSettled(question.id, chosenId, { kind: "error", message });
        if (aliveRef.current && attemptRef.current === attemptNumber) {
          setPhase({ kind: "error", message });
        }
        return;
      } finally {
        submittingRef.current = false;
      }
      // Leaving this question makes this view history only; a view that replaced it
      // takes the outcome from the workspace.
      const isCurrent = aliveRef.current && attemptRef.current === attemptNumber;
      const { result, ...reply } = response;

      if (result.error) {
        const message = heldText(result.error, replyForField(reply, "error"), "actions.progress.saveFailed");
        onAttemptSettled(question.id, chosenId, { kind: "error", message });
        if (!isCurrent) return;
        if (result.errorCode === MEMORY_CHECK_REQUIRED && onMemoryCheckRequired) {
          onMemoryCheckRequired();
          return;
        }
        setPhase({ kind: "error", message });
        return;
      }

      const progressNotice = result.progressError
        ? resolveProgressNotice(result.progressError, replyForField(reply, "progressError"))
        : undefined;
      announceTopicProgress(result, onTopicCompleted, progressNotice);
      if (result.isCorrect) onCorrectAnswer(question.id, chosenId);
      else onIncorrectAnswer?.(question.id);
      // Lời nhắc mặc định của câu sai có khóa catalog; giải thích do tác giả viết thì không, nên luôn hiện đúng như đã viết.
      const explanation = result.explanation
        ? { text: result.explanation, reply: replyForField(reply, "explanation") }
        : undefined;
      onAttemptSettled(question.id, chosenId, {
        kind: result.isCorrect ? "correct" : "incorrect",
        explanation,
        progressError: result.progressError,
        passed: result.isMemoryCheckPassed === true,
      });
      if (!isCurrent) return;

      setPhase(
        result.isCorrect
          ? { kind: "correct", explanation, progressError: result.progressError }
          : { kind: "incorrect", explanation, progressError: result.progressError },
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
        ? { label: t("workspace.answer.next"), icon: null, trailingIcon: <ChevronRight aria-hidden="true" /> }
        : "href" in endAction
          ? null
          : { label: endAction.label, icon: null, trailingIcon: null }
      : phase.kind === "incorrect"
        ? { label: t("workspace.answer.retry"), icon: null, trailingIcon: null }
        : {
            label: isPending ? t("workspace.question.checking") : t("workspace.question.confirm"),
            icon: isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null,
            trailingIcon: null,
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
        ? t("workspace.question.progressNotice")
        : null
      : null;

  return (
    <div
      className={`flex min-w-0 flex-col gap-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[220ms] ${entrance}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-600">
        <span>
          {t("workspace.question.position", { current: count(questionNumber), total: count(totalQuestions) })}
        </span>
        {groupPosition && (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            {t("workspace.navigator.group", { number: count(groupPosition.current), total: count(groupPosition.total) })}
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
        t={learningText}
      />

      <div className="flex flex-col gap-3">
        {primary ? (
          <Button
            size="lg"
            className="w-full"
            disabled={
              isPending || ((phase.kind === "choosing" || phase.kind === "error") && !selectedId)
            }
            onClick={() => {
              if (phase.kind === "correct") {
                if (hasNext) onNext();
                else if ("onClick" in endAction) endAction.onClick();
              } else if (phase.kind === "incorrect") retry();
              else submit();
            }}
          >
            {primary.icon}
            {primary.label}
            {primary.trailingIcon}
          </Button>
        ) : (
          "href" in endAction && (
            <Button asChild size="lg" className="w-full">
              <Link href={endAction.href}>
                {endAction.label}
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          )
        )}

        <div aria-live="polite" aria-atomic="true" ref={feedbackRef} className="empty:hidden">
          {/* The green option and its check already show a right answer. Without an explanation the
              live region only announces it (a saved answer was announced when it was given); with one,
              the box below has the same shape as the incorrect box and its heading is the announcement. */}
          {phase.kind === "correct" && !phase.alreadySaved && !phase.explanation && (
            <p className="sr-only">{t("workspace.answer.correctAnnounce")}</p>
          )}
          {phase.kind === "correct" && phase.explanation && (
            <div className="flex flex-col gap-2 rounded-lg border border-growth-line bg-growth-quiet p-4 text-slate-900">
              <p className="flex items-center gap-2 font-bold text-growth">
                <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
                {t("workspace.answer.correctTitle")}
              </p>
              <p className="leading-relaxed">{serverTextFor(phase.explanation, locale, tRoot)}</p>
            </div>
          )}
          {phase.kind === "incorrect" && (
            <div className="flex flex-col gap-2 rounded-lg border border-correction-line bg-correction-quiet p-4 text-slate-900">
              <p className="flex items-center gap-2 font-bold text-correction">
                <XCircle aria-hidden="true" className="size-5 shrink-0" />
                {t("workspace.answer.incorrectTitle")}
              </p>
              <p className="leading-relaxed">
                {serverTextFor(phase.explanation, locale, tRoot) || t("workspace.question.incorrectFallback")}
              </p>
            </div>
          )}
          {phase.kind === "error" && (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-lg border border-attention-line bg-attention-quiet p-4 text-slate-900"
            >
              <p className="flex items-center gap-2 font-bold text-attention">
                <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
                {t("workspace.question.saveFailedTitle")}
              </p>
              <p className="leading-relaxed">
                {t("workspace.question.saveFailedBody", {
                  message: resolveHeldMessage(phase.message, locale, t, tRoot) ?? "",
                })}
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
