"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Rating } from "ts-fsrs";
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  Headphones,
  Loader2,
  XCircle,
} from "lucide-react";
import { getPublicCoursePreview } from "@/app/actions/public-course-preview";
import { answerPublicCoursePreviewQuestionLocalized } from "@/app/actions/public-course-preview-localized";
import { getFirstTopicSlugByCourseSlugLocalized } from "@/app/actions/course-navigation-localized";
import { Button } from "@/components/ui/button";
import { asTranslate } from "@/lib/i18n/translate";
import { heldKey, heldText, resolveHeldMessage, type HeldMessage } from "@/lib/i18n/held-message";
import type { PublicCoursePreview } from "@/lib/schemas/public-course-preview";
import ChoiceGroup from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/ChoiceGroup";
import ExerciseContext from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/ExerciseContext";
import FlashcardStage from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage";
import QuestionNavigator, {
  type QuestionNavigatorSection,
} from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/QuestionNavigator";
import StickyColumn from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/StickyColumn";
import { arrangeMaterial } from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/exercise-arrangement";
import { PublicCoursePreviewUnavailable } from "./PublicCoursePreviewUnavailable";

type PreviewExercise = PublicCoursePreview["exercises"][number];
type PreviewQuestion = PreviewExercise["questions"][number];
type PreviewGroup = PreviewExercise["groups"][number];

type PreviewQuestionItem = {
  exerciseId: string;
  exerciseTitle: string;
  exerciseBadge: string;
  partType: string | null;
  question: PreviewQuestion;
  group: PreviewGroup | null;
};

type PublicCoursePreviewExperienceProps = {
  data: PublicCoursePreview;
  isEnrolled: boolean;
  returnToCourseHref: string;
};

function flattenQuestions(exercises: PublicCoursePreview["exercises"]) {
  // D3: the memory check runs right after the cards, as in the learning
  // workspace, but preview never locks exercises behind it.
  const ordered = [
    ...exercises.filter((exercise) => exercise.activity_stage === "memory_check"),
    ...exercises.filter((exercise) => exercise.activity_stage === "exercise"),
  ];
  return ordered.flatMap((exercise) => {
    const exerciseBadge =
      exercise.activity_stage === "memory_check" ? "Memory check" : exercise.part_type;
    return [
      ...exercise.questions.map((question) => ({
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        exerciseBadge,
        partType: exercise.part_type,
        question,
        group: null,
      })),
      ...exercise.groups.flatMap((group) =>
        group.questions.map((question) => ({
          exerciseId: exercise.id,
          exerciseTitle: exercise.title,
          exerciseBadge,
          partType: exercise.part_type,
          question,
          group,
        })),
      ),
    ];
  }) as PreviewQuestionItem[];
}

function PreviewImage({
  src,
  alt,
  onPrivateMediaError,
}: {
  src: string;
  alt: string;
  onPrivateMediaError: (src: string) => void;
}) {
  return (
    <div className="relative mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-100">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes="(max-width: 768px) 100vw, 672px"
        className="object-contain"
        onError={() => onPrivateMediaError(src)}
      />
    </div>
  );
}

export function PublicCoursePreviewExperience({
  data,
  isEnrolled,
  returnToCourseHref,
}: PublicCoursePreviewExperienceProps) {
  const router = useRouter();
  const t = useTranslations("courses");
  const locale = useLocale() === "en" ? "en" : "vi";
  // H7: các thành phần học tập dùng chung nhận bản dịch namespace `learning`.
  const learningText = asTranslate(useTranslations("learning"));
  const questions = flattenQuestions(data.exercises);
  const [remainingCards, setRemainingCards] = useState(() => data.flashcards);
  const [isFlipped, setIsFlipped] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    explanation: string | null;
  } | null>(null);
  // Local to this page view like everything else here: the right choice kept per
  // question so a revisit shows it again, and the questions answered wrongly so far.
  const [correctChoices, setCorrectChoices] = useState<
    Record<string, { optionId: string; explanation: string | null }>
  >({});
  const [incorrectIds, setIncorrectIds] = useState<Record<string, true>>({});
  // Thông báo giữ qua lần đổi ngôn ngữ: khóa hoặc chuỗi gắn ngôn ngữ của request, dịch/lọc lúc render (xem held-message.ts).
  const [answerMessage, setAnswerError] = useState<HeldMessage | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  // Requests in flight, by question: the option sent. Keyed by question so a result can
  // only ever land on the question that was submitted, wherever the learner is now.
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string>>({});
  const [isContinuePending, startContinueTransition] = useTransition();
  const [continueMessage, setContinueError] = useState<HeldMessage | null>(null);
  const answerError = resolveHeldMessage(answerMessage, locale, asTranslate(t));
  const continueError = resolveHeldMessage(continueMessage, locale, asTranslate(t));
  const answerInFlight = useRef<Set<string>>(new Set());
  const latestAttempt = useRef<Record<string, number>>({});
  const attemptCounter = useRef(0);
  const continueInFlight = useRef(false);
  const mediaRevalidationInFlight = useRef(false);
  const currentCard = remainingCards[0];
  const currentQuestionItem = questions[questionIndex];
  const isAnswerPending = currentQuestionItem
    ? pendingAnswers[currentQuestionItem.question.id] !== undefined
    : false;
  const currentQuestionId = currentQuestionItem?.question.id;
  const currentQuestionIdRef = useRef(currentQuestionId);
  useLayoutEffect(() => {
    currentQuestionIdRef.current = currentQuestionId;
  }, [currentQuestionId]);
  const questionHeadingId = useId();
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusQuestionHeading = useRef(false);

  useEffect(() => {
    // After the learner moves on or retries, focus returns to the question.
    if (!focusQuestionHeading.current) return;
    focusQuestionHeading.current = false;
    questionHeadingRef.current?.focus();
  }, [questionIndex, answerResult]);

  async function handlePrivateMediaError(src: string) {
    if (
      !src.startsWith("/api/public-course-preview/media/") ||
      mediaRevalidationInFlight.current
    ) {
      return;
    }

    mediaRevalidationInFlight.current = true;
    try {
      // Native media errors omit HTTP status, so recheck Preview eligibility before hiding the page.
      const result = await getPublicCoursePreview({
        courseSlug: data.course.slug,
        topicSlug: data.topic.slug,
      });
      if (result.status !== "success") setIsUnavailable(true);
    } catch {
      setIsUnavailable(true);
    } finally {
      mediaRevalidationInFlight.current = false;
    }
  }

  function handleRateCard(rating: Rating) {
    if (!currentCard) return;

    setRemainingCards((cards) => {
      const [activeCard, ...rest] = cards;
      if (!activeCard) return cards;
      if (rating === Rating.Again || rating === Rating.Hard) {
        return [...rest, activeCard];
      }
      return rest;
    });
    setIsFlipped(false);
  }

  function selectOption(optionId: string) {
    if (isAnswerPending || answerResult) return;
    setSelectedOptionId(optionId);
    setAnswerError(null);
  }

  function submitAnswer() {
    if (!currentQuestionItem || !selectedOptionId || isAnswerPending) return;
    const answeredId = currentQuestionItem.question.id;
    const chosenId = selectedOptionId;
    if (answerInFlight.current.has(answeredId)) return;

    const attempt = ++attemptCounter.current;
    latestAttempt.current[answeredId] = attempt;
    answerInFlight.current.add(answeredId);
    setPendingAnswers((pending) => ({ ...pending, [answeredId]: chosenId }));
    setAnswerError(null);

    // The learner may have moved on by the time this settles: the result then only
    // goes to the session history of the submitted question, never the open one.
    const isShowing = () =>
      currentQuestionIdRef.current === answeredId && latestAttempt.current[answeredId] === attempt;

    void (async () => {
      try {
        const { result, locale: responseLocale } = await answerPublicCoursePreviewQuestionLocalized({
          courseSlug: data.course.slug,
          topicSlug: data.topic.slug,
          questionId: answeredId,
          selectedOptionId: chosenId,
        });

        if (result.status === "unavailable") {
          setIsUnavailable(true);
          return;
        }
        if (result.status === "error") {
          if (isShowing()) setAnswerError(heldText(result.error, responseLocale, "preview.answerFailed"));
          return;
        }

        if (result.data.isCorrect) {
          setCorrectChoices((choices) => ({
            ...choices,
            [answeredId]: { optionId: chosenId, explanation: result.data.explanation },
          }));
        } else {
          setIncorrectIds((ids) => ({ ...ids, [answeredId]: true }));
        }
        if (isShowing()) {
          setSelectedOptionId(chosenId);
          setAnswerResult(result.data);
        }
      } catch {
        if (isShowing()) {
          setAnswerError(heldKey("preview.answerFailed"));
        }
      } finally {
        answerInFlight.current.delete(answeredId);
        setPendingAnswers((pending) => {
          const rest = { ...pending };
          delete rest[answeredId];
          return rest;
        });
      }
    })();
  }

  function resetQuestionAttempt() {
    focusQuestionHeading.current = true;
    setSelectedOptionId(null);
    setAnswerResult(null);
    setAnswerError(null);
  }

  // A question already answered right shows that answer again instead of a blank form.
  function openQuestion(index: number) {
    const target = questions[index];
    const saved = target ? correctChoices[target.question.id] : undefined;
    const pendingOptionId = target ? pendingAnswers[target.question.id] : undefined;
    focusQuestionHeading.current = true;
    setQuestionIndex(index);
    setSelectedOptionId(saved?.optionId ?? pendingOptionId ?? null);
    setAnswerResult(saved ? { isCorrect: true, explanation: saved.explanation } : null);
    setAnswerError(null);
  }

  function advanceQuestion() {
    openQuestion(questionIndex + 1);
  }

  // Moves the learner from the end of a stacked passage to the question; reduced motion jumps.
  function scrollToQuestion() {
    const heading = questionHeadingRef.current;
    if (!heading) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView?.({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }

  function jumpToQuestion(questionId: string) {
    const index = questions.findIndex((item) => item.question.id === questionId);
    if (index >= 0) openQuestion(index);
  }

  function continueLearning() {
    if (!isEnrolled || continueInFlight.current) return;
    continueInFlight.current = true;
    setContinueError(null);
    startContinueTransition(async () => {
      try {
        const { result, locale: responseLocale } = await getFirstTopicSlugByCourseSlugLocalized(data.course.slug);
        if (result.error || !result.topicSlug) {
          setContinueError(result.error ? heldText(result.error, responseLocale, "preview.openTopicFailed") : heldKey("preview.noFirstTopic"));
          return;
        }
        router.push(
          `/learn/${encodeURIComponent(data.course.slug)}/${encodeURIComponent(result.topicSlug)}`,
        );
      } catch {
        setContinueError(heldKey("preview.openTopicFailed"));
      } finally {
        continueInFlight.current = false;
      }
    });
  }

  if (isUnavailable) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <PublicCoursePreviewUnavailable
          kind="unavailable"
          returnToCourseHref={returnToCourseHref}
        />
      </div>
    );
  }

  const correctCount = Object.keys(correctChoices).length;
  const isEmpty = data.flashcards.length === 0 && questions.length === 0;
  const isComplete = !isEmpty && remainingCards.length === 0 && questionIndex >= questions.length;
  const isLastQuestion = questionIndex === questions.length - 1;

  const arrangement = currentQuestionItem?.group
    ? arrangeMaterial(currentQuestionItem.partType, currentQuestionItem.group, false)
    : null;
  const hasMaterial =
    arrangement !== null && (arrangement.kinds.length > 0 || arrangement.missing.length > 0);
  const isSplit = hasMaterial && arrangement.layout === "split";
  const navigatorSections: QuestionNavigatorSection[] = [];
  questions.forEach((item, index) => {
    let section = navigatorSections.find((candidate) => candidate.id === item.exerciseId);
    if (!section) {
      section = { id: item.exerciseId, title: item.exerciseTitle, badge: item.exerciseBadge, groups: [] };
      navigatorSections.push(section);
    }
    const groupId = item.group?.id ?? `${item.exerciseId}:standalone`;
    let group = section.groups.find((candidate) => candidate.id === groupId);
    if (!group) {
      const passageNumber = section.groups.filter((candidate) => candidate.label).length + 1;
      const passageTotal = new Set(
        questions
          .filter((other) => other.exerciseId === item.exerciseId && other.group)
          .map((other) => other.group!.id),
      ).size;
      group = {
        id: groupId,
        label: item.group ? t("preview.group", { number: passageNumber, total: passageTotal }) : undefined,
        items: [],
      };
      section.groups.push(group);
    }
    group.items.push({
      id: item.question.id,
      number: index + 1,
      text: item.question.content.trim() || t("preview.fallbackQuestion"),
      status: correctChoices[item.question.id]
        ? "correct"
        : incorrectIds[item.question.id]
          ? "incorrect"
          : "unanswered",
      current: index === questionIndex,
    });
  });
  const questionNavigator = (
    <QuestionNavigator sections={navigatorSections} onSelect={jumpToQuestion} t={learningText} />
  );
  const gradedResult = answerResult ? (answerResult.isCorrect ? "correct" : "incorrect") : null;

  return (
    <section
      aria-labelledby="public-course-preview-title"
      className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 font-sans"
    >
      <nav aria-label={t("preview.nav")}>
        <ol className="flex min-w-0 items-center gap-1.5 text-sm text-slate-600">
          <li className="min-w-0">
            <Link
              href={returnToCourseHref}
              className="block max-w-[45vw] truncate rounded-sm transition-colors duration-[120ms] hover:text-route focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route sm:max-w-xs"
            >
              {data.course.title}
            </Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="size-4" /></li>
          <li aria-current="page" className="min-w-0 truncate font-semibold text-slate-800">
            {data.topic.title}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1
            id="public-course-preview-title"
            className="break-words text-xl font-bold leading-snug text-slate-900 [overflow-wrap:anywhere] md:text-2xl"
          >
            {data.topic.title}
          </h1>
          {data.topic.description && (
            <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {data.topic.description}
            </p>
          )}
        </div>
        <p className="inline-flex shrink-0 items-center gap-2 rounded-md border border-route-line bg-route-quiet px-3 py-1.5 text-sm font-semibold text-slate-900">
          <BookOpenText aria-hidden="true" className="size-4 text-route" />
          {t("preview.badge")}
        </p>
      </header>

      <main className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        {isEmpty ? (
          <div role="status" className="py-12 text-center">
            <BookOpenText aria-hidden="true" className="mx-auto size-10 text-slate-400" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">{t("preview.emptyTitle")}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              {t("preview.emptyBody")}
            </p>
            <Button asChild variant="outline" size="lg" className="mt-6">
              <Link href={returnToCourseHref}><ArrowLeft aria-hidden="true" />{t("preview.back")}</Link>
            </Button>
          </div>
        ) : isComplete ? (
          <div
            role="status"
            className="mx-auto flex max-w-xl flex-col items-center gap-4 py-6 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[240ms]"
          >
            <CheckCircle2 aria-hidden="true" className="size-12 text-growth" />
            <p className="text-sm font-bold text-growth">{t("preview.doneEyebrow")}</p>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("preview.doneTitle")}
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              {t("preview.doneBody")}
            </p>

            <div className="grid w-full max-w-sm grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-900">{data.flashcards.length}</p>
                <p className="mt-0.5 text-xs text-slate-600">{t("preview.cardsSeen")}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-900">{correctCount}/{questions.length}</p>
                <p className="mt-0.5 text-xs text-slate-600">{t("preview.correctThisRound")}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              {questions.length > 0 && questionNavigator}
              <Button asChild variant="outline" size="lg">
                <Link href={returnToCourseHref}>{t("preview.back")}</Link>
              </Button>
              {!isEnrolled ? (
                <Button asChild size="lg">
                  <Link href={returnToCourseHref}>
                    {t("preview.enrollNow")}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <Button type="button" size="lg" onClick={continueLearning} disabled={isContinuePending}>
                  {isContinuePending ? t("preview.opening") : t("preview.continue")}
                  <ArrowRight aria-hidden="true" />
                </Button>
              )}
            </div>
            {continueError && <p role="alert" className="text-sm text-correction">{continueError}</p>}
          </div>
        ) : currentCard ? (
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-700">{t("preview.cardsLeft", { count: remainingCards.length })}</p>
              <Link
                href={returnToCourseHref}
                className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-slate-600 underline-offset-4 transition-colors duration-[120ms] hover:text-route hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t("preview.back")}
              </Link>
            </div>
            {currentCard.image_url && (
              <PreviewImage
                src={currentCard.image_url}
                alt={t("preview.imageAlt", { word: currentCard.front_content.word })}
                onPrivateMediaError={handlePrivateMediaError}
              />
            )}
            {currentCard.audio_url && (
              <div className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-lg border border-recall-line bg-recall-quiet p-3 sm:p-4">
                <Headphones aria-hidden="true" className="size-5 shrink-0 text-recall" />
                <audio
                  aria-label={t("preview.audioLabel")}
                  controls
                  preload="none"
                  className="h-10 min-w-0 flex-1"
                  src={currentCard.audio_url}
                  onError={() => handlePrivateMediaError(currentCard.audio_url!)}
                >
                  {t("preview.audioUnsupported")}
                </audio>
              </div>
            )}
            <FlashcardStage
              currentCard={currentCard}
              cardsLeft={remainingCards.length}
              totalCards={data.flashcards.length}
              isFlipped={isFlipped}
              setIsFlipped={setIsFlipped}
              handleRateCard={handleRateCard}
            />
          </div>
        ) : currentQuestionItem ? (
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-600">
              <p className="flex flex-wrap items-center gap-2">
                <span>{currentQuestionItem.exerciseTitle}</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-600">
                  {currentQuestionItem.exerciseBadge}
                </span>
              </p>
              <span className="flex items-center gap-3">
                {t("preview.questionOf", { current: questionIndex + 1, total: questions.length })}
                {questionNavigator}
              </span>
            </div>

            <div
              className={
                isSplit
                  ? `grid min-w-0 items-start gap-6 lg:gap-8 ${
                      arrangement.dominant === "image"
                        ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
                        : "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
                    }`
                  : "mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-5"
              }
            >
              {hasMaterial && currentQuestionItem.group && arrangement && (
                <StickyColumn
                  key={`${currentQuestionItem.exerciseId}:${currentQuestionItem.group.id}`}
                  enabled={isSplit}
                  className="min-w-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[240ms]"
                >
                  <ExerciseContext
                    group={currentQuestionItem.group}
                    arrangement={arrangement}
                    enlargeableImage={currentQuestionItem.partType === "part1"}
                    onMediaError={handlePrivateMediaError}
                    t={learningText}
                  />
                  {isSplit && (
                    <div className="mt-3 flex justify-end lg:hidden">
                      <Button type="button" variant="link" size="lg" className="px-2" onClick={scrollToQuestion}>
                        {t("preview.toQuestion")}
                        <ArrowDown aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </StickyColumn>
              )}

              <StickyColumn
                key={currentQuestionItem.question.id}
                enabled={isSplit}
                className="flex min-w-0 flex-col gap-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[220ms]"
              >
                <h2
                  id={questionHeadingId}
                  ref={questionHeadingRef}
                  tabIndex={-1}
                  data-question-heading=""
                  className="scroll-mt-4 break-words text-xl font-bold leading-snug text-slate-900 outline-none [overflow-wrap:anywhere] md:text-2xl"
                >
                  {currentQuestionItem.question.content}
                </h2>

                {currentQuestionItem.question.options.length === 0 ? (
                  <div
                    role="status"
                    className="flex flex-col items-start gap-3 rounded-lg border border-attention-line bg-attention-quiet p-4"
                  >
                    <p className="text-sm leading-6 text-slate-900">
                      {t("preview.noOptions")}
                    </p>
                    <Button type="button" onClick={advanceQuestion}>
                      {isLastQuestion ? t("preview.finish") : t("preview.skip")}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <ChoiceGroup
                      options={currentQuestionItem.question.options}
                      selectedId={selectedOptionId}
                      result={gradedResult}
                      disabled={isAnswerPending || answerResult !== null}
                      onSelect={selectOption}
                      labelledBy={questionHeadingId}
                      t={learningText}
                    />

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {!answerResult ? (
                          <Button
                            type="button"
                            size="lg"
                            disabled={!selectedOptionId || isAnswerPending}
                            onClick={submitAnswer}
                            className="w-full sm:w-auto sm:min-w-48"
                          >
                            {isAnswerPending && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {isAnswerPending ? t("preview.checking") : t("preview.confirm")}
                          </Button>
                        ) : answerResult.isCorrect ? (
                          <Button
                            type="button"
                            size="lg"
                            onClick={advanceQuestion}
                            className="w-full sm:w-auto sm:min-w-48"
                          >
                            {isLastQuestion ? t("preview.finish") : t("preview.next")}
                            <ArrowRight aria-hidden="true" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="lg"
                              onClick={resetQuestionAttempt}
                              className="w-full sm:w-auto sm:min-w-48"
                            >
                              {t("preview.retry")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={advanceQuestion}
                              className="text-slate-600"
                            >
                              {isLastQuestion ? t("preview.skipFinish") : t("preview.skip")}
                              <ArrowRight aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>

                      <div aria-live="polite" aria-atomic="true" className="empty:hidden">
                        {isAnswerPending && (
                          <p role="status" className="sr-only">{t("preview.checkingStatus")}</p>
                        )}
                        {/* The green option and its check already show a right answer; announce it
                            for screen readers and keep only the explanation visible. */}
                        {answerResult?.isCorrect && <p className="sr-only">{t("preview.correct")}</p>}
                        {answerResult?.isCorrect && answerResult.explanation && (
                          <p className="leading-relaxed text-slate-900">{answerResult.explanation}</p>
                        )}
                        {answerResult && !answerResult.isCorrect && (
                          <div className="flex flex-col gap-2 rounded-lg border border-correction-line bg-correction-quiet p-4 text-slate-900">
                            <p className="flex items-center gap-2 font-bold text-correction">
                              <XCircle aria-hidden="true" className="size-5 shrink-0" />
                              {t("preview.incorrect")}
                            </p>
                            <p className="leading-relaxed">
                              {answerResult.explanation || t("preview.incorrectHint")}
                            </p>
                          </div>
                        )}
                        {answerError && (
                          <div
                            role="alert"
                            className="flex flex-col gap-1 rounded-lg border border-attention-line bg-attention-quiet p-4 text-slate-900"
                          >
                            <p className="font-bold text-attention">{t("preview.answerErrorTitle")}</p>
                            <p className="leading-relaxed">{answerError}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </StickyColumn>
            </div>
          </div>
        ) : null}
      </main>
    </section>
  );
}
