"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Rating } from "ts-fsrs";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  Headphones,
  XCircle,
} from "lucide-react";
import {
  answerPublicCoursePreviewQuestion,
  getPublicCoursePreview,
} from "@/app/actions/public-course-preview";
import { getFirstTopicSlugByCourseSlug } from "@/app/actions/course-navigation";
import { Button } from "@/components/ui/button";
import type { PublicCoursePreview } from "@/lib/schemas/public-course-preview";
import FlashcardStage from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage";
import { PublicCoursePreviewUnavailable } from "./PublicCoursePreviewUnavailable";

type PreviewExercise = PublicCoursePreview["exercises"][number];
type PreviewQuestion = PreviewExercise["questions"][number];
type PreviewGroup = PreviewExercise["groups"][number];

type PreviewQuestionItem = {
  exerciseTitle: string;
  exercisePartType: string;
  question: PreviewQuestion;
  group: PreviewGroup | null;
};

type PublicCoursePreviewExperienceProps = {
  data: PublicCoursePreview;
  isEnrolled: boolean;
  returnToCourseHref: string;
};

function flattenQuestions(exercises: PublicCoursePreview["exercises"]) {
  return exercises.flatMap((exercise) => [
    ...exercise.questions.map((question) => ({
      exerciseTitle: exercise.title,
      exercisePartType: exercise.part_type,
      question,
      group: null,
    })),
    ...exercise.groups.flatMap((group) =>
      group.questions.map((question) => ({
        exerciseTitle: exercise.title,
        exercisePartType: exercise.part_type,
        question,
        group,
      })),
    ),
  ]) as PreviewQuestionItem[];
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
  const questions = flattenQuestions(data.exercises);
  const [remainingCards, setRemainingCards] = useState(() => data.flashcards);
  const [isFlipped, setIsFlipped] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    explanation: string | null;
  } | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isAnswerPending, startAnswerTransition] = useTransition();
  const [isContinuePending, startContinueTransition] = useTransition();
  const [continueError, setContinueError] = useState<string | null>(null);
  const answerInFlight = useRef(false);
  const continueInFlight = useRef(false);
  const mediaRevalidationInFlight = useRef(false);
  const currentCard = remainingCards[0];
  const currentQuestionItem = questions[questionIndex];

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
    if (
      !currentQuestionItem ||
      !selectedOptionId ||
      isAnswerPending ||
      answerInFlight.current
    ) {
      return;
    }

    answerInFlight.current = true;
    setAnswerError(null);
    startAnswerTransition(async () => {
      try {
        const result = await answerPublicCoursePreviewQuestion({
          courseSlug: data.course.slug,
          topicSlug: data.topic.slug,
          questionId: currentQuestionItem.question.id,
          selectedOptionId,
        });

        if (result.status === "unavailable") {
          setIsUnavailable(true);
          return;
        }
        if (result.status === "error") {
          setAnswerError(result.error);
          return;
        }

        setAnswerResult(result.data);
      } catch {
        setAnswerError("Không thể kiểm tra câu trả lời lúc này. Vui lòng thử lại.");
      } finally {
        answerInFlight.current = false;
      }
    });
  }

  function resetQuestionAttempt() {
    setSelectedOptionId(null);
    setAnswerResult(null);
    setAnswerError(null);
  }

  function advanceQuestion() {
    setQuestionIndex((index) => index + 1);
    resetQuestionAttempt();
  }

  function continueLearning() {
    if (!isEnrolled || continueInFlight.current) return;
    continueInFlight.current = true;
    setContinueError(null);
    startContinueTransition(async () => {
      try {
        const result = await getFirstTopicSlugByCourseSlug(data.course.slug);
        if (result.error || !result.topicSlug) {
          setContinueError(result.error || "Không tìm thấy chủ đề học đầu tiên.");
          return;
        }
        router.push(
          `/learn/${encodeURIComponent(data.course.slug)}/${encodeURIComponent(result.topicSlug)}`,
        );
      } catch {
        setContinueError("Chưa thể mở chủ đề học. Vui lòng thử lại sau.");
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

  const isEmpty = data.flashcards.length === 0 && questions.length === 0;
  const isComplete = !isEmpty && remainingCards.length === 0 && questionIndex >= questions.length;

  return (
    <section aria-labelledby="public-course-preview-title" className="mx-auto max-w-4xl">
      <nav aria-label="Điều hướng xem thử" className="mb-6">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
          <li className="min-w-0">
            <Link
              href={returnToCourseHref}
              className="block max-w-[45vw] truncate rounded-sm transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-400/50 sm:max-w-xs"
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

      <header className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
              <BookOpenText aria-hidden="true" className="size-4" />
              Đang xem thử
            </p>
            <h1
              id="public-course-preview-title"
              className="mt-2 break-words text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl"
            >
              {data.topic.title}
            </h1>
            {data.topic.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {data.topic.description}
              </p>
            )}
          </div>
          <p className="max-w-xs rounded-xl bg-cyan-50 px-3.5 py-2.5 text-sm leading-5 text-cyan-950 sm:text-right">
            Tiến độ trong lượt xem thử này không được lưu.
          </p>
        </div>
      </header>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8">
        {isEmpty ? (
          <div role="status" className="py-12 text-center">
            <BookOpenText aria-hidden="true" className="mx-auto size-10 text-slate-400" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">Nội dung xem thử đang được cập nhật</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              Chủ đề này chưa có nội dung để xem trong phiên này.
            </p>
            <Button asChild variant="outline" className="mt-6 min-h-11 px-5">
              <Link href={returnToCourseHref}><ArrowLeft aria-hidden="true" />Về khóa học</Link>
            </Button>
          </div>
        ) : isComplete ? (
          <div role="status" className="py-10 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-emerald-600" />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              Hoàn tất lượt xem thử
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-950">
              Bạn đã xem hết nội dung mẫu.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
              Lượt xem thử kết thúc tại đây. Nội dung trong phiên này không được lưu thành tiến độ học.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="outline" className="min-h-11 px-5">
                <Link href={returnToCourseHref}>Về khóa học</Link>
              </Button>
              {isEnrolled && (
                <Button
                  type="button"
                  className="min-h-11 bg-blue-700 px-5 text-white hover:bg-blue-800"
                  onClick={continueLearning}
                  disabled={isContinuePending}
                >
                  {isContinuePending ? "Đang mở bài học..." : "Tiếp tục học"}
                  <ArrowRight aria-hidden="true" />
                </Button>
              )}
            </div>
            {continueError && <p role="alert" className="mt-4 text-sm text-rose-700">{continueError}</p>}
          </div>
        ) : currentCard ? (
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-700">Từ vựng · còn {remainingCards.length} thẻ trong lượt</p>
              <Link
                href={returnToCourseHref}
                className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-400/50"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Về khóa học
              </Link>
            </div>
            {currentCard.image_url && (
              <div className="mb-4">
                <PreviewImage
                  src={currentCard.image_url}
                  alt={`Hình minh họa cho ${currentCard.front_content.word}`}
                  onPrivateMediaError={handlePrivateMediaError}
                />
              </div>
            )}
            {currentCard.audio_url && (
              <div className="mx-auto mb-5 flex max-w-2xl items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 sm:p-4">
                <Headphones aria-hidden="true" className="size-5 shrink-0 text-blue-700" />
                <audio
                  aria-label="Âm thanh từ vựng"
                  controls
                  preload="none"
                  className="h-10 min-w-0 flex-1"
                  src={currentCard.audio_url}
                  onError={() => handlePrivateMediaError(currentCard.audio_url!)}
                >
                  Trình duyệt của bạn không hỗ trợ thẻ âm thanh.
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
              isPending={false}
              presentation="review"
            />
          </div>
        ) : currentQuestionItem ? (
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">{currentQuestionItem.exerciseTitle}</h2>
                <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                  {currentQuestionItem.exercisePartType}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-500">
                Câu {questionIndex + 1}/{questions.length}
              </p>
            </div>

            {currentQuestionItem.group && (
              <div className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                {currentQuestionItem.group.image_url && (
                  <PreviewImage
                    src={currentQuestionItem.group.image_url}
                    alt="Hình ảnh ngữ liệu"
                    onPrivateMediaError={handlePrivateMediaError}
                  />
                )}
                {currentQuestionItem.group.audio_url && (
                  <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 sm:p-4">
                    <Headphones aria-hidden="true" className="size-5 shrink-0 text-blue-700" />
                    <audio
                      aria-label="Âm thanh ngữ liệu"
                      controls
                      preload="none"
                      className="h-10 min-w-0 flex-1"
                      src={currentQuestionItem.group.audio_url}
                      onError={() => handlePrivateMediaError(currentQuestionItem.group!.audio_url!)}
                    >
                      Trình duyệt của bạn không hỗ trợ thẻ âm thanh.
                    </audio>
                  </div>
                )}
                {currentQuestionItem.group.passage_text && (
                  <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700 sm:p-5">
                    {currentQuestionItem.group.passage_text}
                  </p>
                )}
                {!currentQuestionItem.group.image_url &&
                  !currentQuestionItem.group.audio_url &&
                  !currentQuestionItem.group.passage_text && (
                    <p className="text-sm italic text-slate-500">
                      Nhóm câu hỏi này không có ngữ liệu đi kèm.
                    </p>
                  )}
              </div>
            )}

            {currentQuestionItem.question.options.length === 0 ? (
              <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm leading-6 text-amber-950">
                  Câu hỏi này hiện chưa có lựa chọn để trả lời.
                </p>
                <Button
                  type="button"
                  onClick={advanceQuestion}
                  className="mt-4 min-h-10 bg-blue-700 px-4 text-white hover:bg-blue-800"
                >
                  {questionIndex === questions.length - 1 ? "Xem kết quả" : "Bỏ qua câu này"}
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <fieldset disabled={isAnswerPending || answerResult !== null}>
                <legend className="mb-5 text-lg font-bold leading-7 text-slate-900 sm:text-xl">
                  {currentQuestionItem.question.content}
                </legend>
                <div className="space-y-3">
                  {currentQuestionItem.question.options.map((option, index) => {
                    const isSelected = selectedOptionId === option.id;
                    const optionLabel = option.label || String.fromCharCode(65 + index);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${optionLabel}. ${option.content}`}
                        onClick={() => selectOption(option.id)}
                        className={`flex min-h-14 w-full items-start gap-3 rounded-xl border-2 p-4 text-left text-sm font-medium leading-6 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-400/50 disabled:cursor-default ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-950"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {optionLabel}
                        </span>
                        <span className="min-w-0 flex-1 break-words">{option.content}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {answerError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">{answerError}</p>}

            {answerResult ? (
              <div
                role="status"
                aria-live="polite"
                className={`mt-5 rounded-2xl border p-4 sm:p-5 ${answerResult.isCorrect ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
              >
                <div className={`flex items-center gap-2 font-bold ${answerResult.isCorrect ? "text-emerald-900" : "text-rose-900"}`}>
                  {answerResult.isCorrect ? (
                    <CheckCircle2 aria-hidden="true" className="size-5" />
                  ) : (
                    <XCircle aria-hidden="true" className="size-5" />
                  )}
                  {answerResult.isCorrect ? "Chính xác!" : "Chưa chính xác."}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {answerResult.explanation ||
                    (answerResult.isCorrect
                      ? "Lựa chọn của bạn đúng."
                      : "Hãy xem lại ngữ liệu rồi thử lại hoặc chuyển sang câu tiếp theo.")}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {!answerResult.isCorrect && (
                    <Button type="button" variant="outline" onClick={resetQuestionAttempt} className="min-h-10 px-4">
                      Thử lại
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={advanceQuestion}
                    className="min-h-10 bg-blue-700 px-4 text-white hover:bg-blue-800"
                  >
                    {questionIndex === questions.length - 1 ? "Xem kết quả" : "Câu tiếp theo"}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={!selectedOptionId || isAnswerPending}
                  onClick={submitAnswer}
                  className="min-h-11 bg-slate-900 px-5 text-white hover:bg-slate-800"
                >
                  {isAnswerPending ? "Đang kiểm tra..." : "Kiểm tra đáp án"}
                </Button>
                {isAnswerPending && <span role="status" className="text-sm text-slate-500">Đang kiểm tra câu trả lời...</span>}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {!isEmpty && !isComplete && (
        <p aria-live="polite" className="mt-4 text-center text-xs font-medium text-slate-500">
          Phiên xem thử chỉ giữ lựa chọn hiện tại trên trang này.
        </p>
      )}
    </section>
  );
}
