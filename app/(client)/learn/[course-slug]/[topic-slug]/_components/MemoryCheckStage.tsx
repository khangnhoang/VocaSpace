"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, RotateCcw, TriangleAlert, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { submitQuestionAnswerLocalized } from "@/app/actions/progress-localized";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { formatCatalogCount } from "@/lib/i18n/format";
import { heldText, replyForField, resolveHeldMessage, type RequestReply } from "@/lib/i18n/held-message";
import { asTranslate } from "@/lib/i18n/translate";
import { CARDS_REQUIRED } from "@/lib/memory-check";
import type { QuestionDTO } from "@/lib/schemas/learn";
import type { TopicProgress } from "@/lib/schemas/learning-workspace";
import { serverTextFor, type AnswerAttempt, type AttemptOutcome } from "./answer-attempt";
import ChoiceGroup from "./ChoiceGroup";
import { announceTopicProgress } from "./topic-progress-feedback";

type Feedback =
  | { kind: "correct"; passed: boolean }
  | { kind: "incorrect"; explanation: string; passed: boolean };

interface MemoryCheckStageProps {
  questions: QuestionDTO[];
  /** Question ids the server already counts as correct (H3 predicate). */
  initiallyCorrectIds: string[];
  /**
   * Submissions by question, owned by the workspace so they outlive this view. A
   * pending one locks its question, a settled one is the result the learner has not
   * continued past yet; `onAttemptCleared` is that continuation.
   */
  attempts: Record<string, AnswerAttempt>;
  onAttemptStart: (questionId: string, optionId: string) => void;
  onAttemptSettled: (questionId: string, optionId: string, outcome: AttemptOutcome) => void;
  onAttemptCleared: (questionId: string) => void;
  isPassed: boolean;
  /** Chủ đề có bài tập: màn hình xem lại giữ lối mở bài tập. */
  hasExercises: boolean;
  /** LF5 AC6: đáp án đã lưu theo câu, để màn hình xem lại đánh dấu đáp án đúng của học viên. */
  answers?: Record<string, string>;
  /** LF5 AC6/AC9: giải thích chỉ có ở câu mà đáp án đã lưu đang đúng (từ server lúc tải hoặc từ kết quả trả lời trong phiên). */
  explanations?: Record<string, string>;
  onCorrectAnswer: (questionId: string, optionId: string, explanation?: string) => void;
  /** Câu trả lời sai: workspace bỏ giải thích đã giữ của câu đó (AC9). */
  onIncorrectAnswer?: (questionId: string) => void;
  /** Tự chuyển sau phản hồi cuối; server vẫn quyết định memory check đã qua hay chưa. */
  onPassed: (progress?: TopicProgress) => void;
  /**
   * Server báo memory check đã qua ngay trong kết quả của câu trả lời. Workspace đánh dấu bước "đã xong" tại đây (AC8),
   * không đợi học viên bấm tiếp; câu đúng cuối chuyển ngay sang nội dung tiếp theo.
   * `newlyCompleted` là giá trị của chính kết quả câu trả lời này (LF4 AC1): khi bài vừa hoàn thành, màn hình hoàn thành
   * thay cho toast nên workspace không hiện toast memory check.
   */
  onMemoryPassed?: (newlyCompleted: boolean) => void;
  onGoToExercises: () => void;
  onTopicCompleted?: (newlyCompleted: boolean) => void;
  /**
   * The server refused the answer because the topic has a card this learner has not seen (a card added after the page
   * loaded). The workspace owns recovery: back to the flashcards and a data refresh.
   */
  onCardsRequired?: () => void;
  /**
   * The workspace translates the progress warning of a saved answer with the language shown when the reply lands (U3 H4). It
   * stays mounted while this stage does not, so a reply that arrives after the learner left the stage still toasts correctly.
   */
  resolveProgressNotice: (text: string, reply: RequestReply) => string;
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
  onAttemptCleared,
  isPassed,
  hasExercises,
  answers = {},
  explanations = {},
  onCorrectAnswer,
  onIncorrectAnswer,
  onPassed,
  onMemoryPassed,
  onGoToExercises,
  onTopicCompleted,
  onCardsRequired,
  resolveProgressNotice,
}: MemoryCheckStageProps) {
  const t = asTranslate(useTranslations("learn"));
  const tRoot = asTranslate(useTranslations());
  const learningText = asTranslate(useTranslations("learning"));
  const locale: Locale = useLocale() === "en" ? "en" : "vi";
  const count = (value: number) => formatCatalogCount(locale, value);
  const [isPending, startTransition] = useTransition();
  // Retry queue: unanswered/incorrect questions in authoring order; a wrong
  // answer moves its question to the end until every question is correct. A question
  // whose result the learner has not continued past yet stays in, even when correct
  // (for example when the answer landed while the learner was on another stage).
  const [queue, setQueue] = useState<string[]>(() => {
    const correct = new Set(initiallyCorrectIds);
    return questions
      .slice()
      .sort((left, right) => left.order_index - right.order_index)
      .filter((question) => !correct.has(question.id) || attempts[question.id] !== undefined)
      .map((question) => question.id);
  });
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);

  const total = questions.length;
  const currentQuestion = questions.find((question) => question.id === queue[0]);
  const isSettledCorrect = (questionId: string) => {
    const attempt = attempts[questionId];
    return attempt?.status === "settled" && attempt.outcome.kind === "correct";
  };
  const correctCount = total - queue.filter((id) => !isSettledCorrect(id)).length;

  // The attempt, not local state, says what the question shows: pending locks it, a
  // settled result is its feedback, and a failed save keeps the choice for a retry.
  const attempt = currentQuestion ? attempts[currentQuestion.id] : undefined;
  const settled = attempt?.status === "settled" ? attempt.outcome : undefined;
  const feedback: Feedback | null =
    settled && settled.kind !== "error"
      ? settled.kind === "correct"
        ? { kind: "correct", passed: settled.passed }
        : {
            kind: "incorrect",
            explanation:
              serverTextFor(settled.explanation, locale, tRoot) || t("workspace.memory.fallbackExplanation"),
            passed: settled.passed,
          }
      : null;
  // Giữ thông báo lỗi dạng khóa + tham số và dịch lúc render để nó đổi theo ngôn ngữ khi đang hiện (U3 H4).
  const error = settled?.kind === "error" ? resolveHeldMessage(settled.message, locale, t, tRoot) : null;
  const isRequestPending = isPending || attempt?.status === "pending";
  const selectedOptionId =
    attempt && (attempt.status === "pending" || feedback)
      ? attempt.optionId
      : (chosenOptionId ?? attempt?.optionId ?? null);
  const feedbackKey = feedback && currentQuestion ? `${currentQuestion.id}:${feedback.kind}` : null;

  useEffect(() => {
    if (feedbackKey) continueButtonRef.current?.focus();
  }, [feedbackKey]);

  const autoAdvances = feedback?.kind === "correct" && feedback.passed;
  const confirmedProgress = settled && settled.kind !== "error" ? settled.topicProgress : undefined;
  const consumedAttemptRef = useRef<AnswerAttempt | undefined>(undefined);
  const autoAdvanceQuestionId = autoAdvances ? currentQuestion?.id : undefined;
  useLayoutEffect(() => {
    if (!autoAdvanceQuestionId || !attempt || consumedAttemptRef.current === attempt) return;
    // Chỉ xử lý khi bước đang được mở; ref tránh chuyển hai lần khi Strict Mode chạy lại effect.
    consumedAttemptRef.current = attempt;
    onAttemptCleared(autoAdvanceQuestionId);
    onPassed(confirmedProgress);
  }, [autoAdvanceQuestionId, attempt, onAttemptCleared, onPassed, confirmedProgress]);

  // Kết quả chưa tiêu thụ cần được chuyển tiếp trước khi hiện bản xem lại chỉ đọc.
  if (isPassed && !feedback?.passed) {
    // LF5 AC6: xem lại chỉ đọc, không ghi gì và không đổi trạng thái đã qua.
    const reviewQuestions = questions
      .slice()
      .sort((left, right) => left.order_index - right.order_index);
    return (
      <section
        aria-labelledby="memory-check-review-title"
        className="flex w-full max-w-2xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[220ms]"
      >
        <div className="flex flex-col gap-1">
          <h2 id="memory-check-review-title" className="text-xl font-bold text-slate-900">
            {t("workspace.memory.reviewTitle")}
          </h2>
          <p className="text-sm font-medium text-slate-600">
            {t("workspace.memory.reviewCount", {
              count: reviewQuestions.length,
              shown: count(reviewQuestions.length),
            })}
          </p>
        </div>
        <ol className="flex flex-col gap-8">
          {reviewQuestions.map((question, index) => {
            const headingId = `memory-review-${question.id}`;
            const storedOptionId = answers[question.id] ?? null;
            const explanation = explanations[question.id];
            return (
              <li key={question.id} className="flex flex-col gap-3">
                <h3
                  id={headingId}
                  className="break-words text-lg font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]"
                >
                  <span className="mr-2 text-slate-600">{index + 1}.</span>
                  {question.content}
                </h3>
                <ChoiceGroup
                  options={sortOptions(question)}
                  selectedId={storedOptionId}
                  result={storedOptionId ? "correct" : null}
                  disabled
                  onSelect={() => undefined}
                  labelledBy={headingId}
                  t={learningText}
                />
                {explanation && (
                  <div className="flex flex-col gap-1 rounded-lg border border-growth-line bg-growth-quiet p-4 text-slate-900">
                    <p className="flex items-center gap-2 font-bold text-growth">
                      <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
                      {t("workspace.memory.explanation")}
                    </p>
                    <p className="leading-relaxed">{explanation}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {hasExercises && (
          <Button onClick={onGoToExercises} size="lg" className="min-h-12 w-full sm:w-auto sm:self-start sm:px-8">
            {t("workspace.memory.doExercises")}
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
        <h2 className="text-xl font-bold text-slate-800">{t("workspace.memory.changedTitle")}</h2>
        <p className="text-slate-600">{t("workspace.memory.changedBody")}</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="lg"
          className="px-6"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          {t("workspace.memory.reload")}
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
    onAttemptStart(questionId, chosenId);
    startTransition(async () => {
      const { result, ...reply } = await submitQuestionAnswerLocalized(questionId, chosenId);
      if (result.error) {
        if (result.errorCode === CARDS_REQUIRED && onCardsRequired) {
          // Không có câu trả lời nào được ghi: bỏ lượt gửi để câu hỏi không kẹt, rồi để workspace phục hồi.
          onAttemptCleared(questionId);
          onCardsRequired();
          return;
        }
        onAttemptSettled(questionId, chosenId, {
          kind: "error",
          message: heldText(result.error, replyForField(reply, "error"), "actions.progress.saveFailed"),
        });
        return;
      }
      const progressNotice = result.progressError
        ? resolveProgressNotice(result.progressError, replyForField(reply, "progressError"))
        : undefined;
      announceTopicProgress(result, onTopicCompleted, progressNotice);
      if (result.isCorrect) onCorrectAnswer(questionId, chosenId, result.explanation);
      else onIncorrectAnswer?.(questionId);
      onAttemptSettled(questionId, chosenId, {
        kind: result.isCorrect ? "correct" : "incorrect",
        explanation: result.explanation
          ? { text: result.explanation, reply: replyForField(reply, "explanation") }
          : undefined,
        progressError: result.progressError,
        passed: result.isMemoryCheckPassed === true,
        topicProgress: result.topicProgress,
      });
      if (result.isMemoryCheckPassed === true) onMemoryPassed?.(result.topicProgress?.newlyCompleted === true);
    });
  };

  const advance = () => {
    if (!feedback) return;
    const questionId = currentQuestion.id;
    onAttemptCleared(questionId);
    if (feedback.passed) {
      onPassed(confirmedProgress);
      return;
    }
    setQueue((current) => {
      const [head, ...rest] = current;
      return feedback.kind === "correct" ? rest : [...rest, head];
    });
    setChosenOptionId(null);
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
          <span>{t("workspace.memory.title")}</span>
          <span>{t("workspace.memory.correctCount", { correct: count(correctCount), total: count(total) })}</span>
        </div>
        <div
          role="progressbar"
          aria-label={t("workspace.memory.progressLabel")}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={correctCount}
          aria-valuetext={t("workspace.memory.progressValueText", {
            count: total,
            correct: count(correctCount),
            total: count(total),
          })}
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
          onSelect={setChosenOptionId}
          labelledBy="memory-check-question"
          t={learningText}
        />
      </div>

      <div aria-live="polite" className="min-h-0">
        {/* The green option and its check already show a right answer; only announce it. */}
        {feedback?.kind === "correct" && <p className="sr-only">{t("workspace.answer.correctAnnounce")}</p>}
        {feedback?.kind === "incorrect" && (
          <div className="flex flex-col gap-2 rounded-lg border border-correction-line bg-correction-quiet p-4 text-slate-900">
            <p className="flex items-center gap-2 font-bold text-correction">
              <XCircle aria-hidden="true" className="size-5 shrink-0" />
              {t("workspace.answer.incorrectTitle")}
            </p>
            <p className="leading-relaxed">{feedback.explanation}</p>
            <p className="text-sm font-medium">
              {willReturn ? t("workspace.memory.willReturn") : t("workspace.memory.willRetry")}
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
        autoAdvances ? null : (
          <Button
            ref={continueButtonRef}
            onClick={advance}
            size="lg"
            className="min-h-12 w-full"
          >
            {feedback.kind === "incorrect"
              ? willReturn
                ? t("workspace.answer.next")
                : t("workspace.answer.retry")
              : t("workspace.answer.next")}
          </Button>
        )
      ) : (
        <Button
          onClick={submit}
          disabled={!selectedOptionId || isRequestPending}
          size="lg"
          className="min-h-12 w-full"
        >
          {isRequestPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {isRequestPending ? t("workspace.memory.checking") : t("workspace.memory.check")}
        </Button>
      )}
    </section>
  );
}
