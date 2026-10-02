"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Lock,
} from "lucide-react";
import { Rating } from "ts-fsrs";
import { toast } from "sonner";
import { submitCardReview } from "@/app/actions/review";
import { Button } from "@/components/ui/button";
import { resolveLessonNeighbors } from "@/lib/learn-navigation";
import type {
  ExerciseDTO,
  FlashcardDTO,
  QuestionDTO,
  QuestionGroupDTO,
  QuestionOptionDTO,
} from "@/lib/schemas/learn";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";
import ChapterSidebar from "./ChapterSidebar";
import ExerciseContext from "./ExerciseContext";
import FlashcardStage from "./FlashcardStage";
import MemoryCheckStage from "./MemoryCheckStage";
import QuizSidebar from "./QuizSidebar";
import { announceTopicProgress } from "./topic-progress-feedback";

type LearningStage = "flashcard" | "memory" | "exercise";

type ExerciseSegment = QuestionGroupDTO & { isStandalone: boolean };

const byOrderIndex = (
  left: { order_index: number },
  right: { order_index: number },
) => left.order_index - right.order_index;

/** Standalone questions form a passage-less first segment, followed by the groups. */
function exerciseSegments(exercise: ExerciseDTO | undefined): ExerciseSegment[] {
  if (!exercise) return [];
  const groups = exercise.groups
    .slice()
    .sort(byOrderIndex)
    .map((group) => ({ ...group, isStandalone: false }));
  if (exercise.questions.length === 0) return groups;
  return [
    {
      id: exercise.id,
      passage_text: null,
      audio_url: null,
      image_url: null,
      order_index: 0,
      questions: exercise.questions,
      isStandalone: true,
    },
    ...groups,
  ];
}

const MEMORY_LOCK_REASON =
  "Trả lời đúng hết memory check để mở khóa phần bài tập.";

export default function LearningWorkspace({
  data,
}: {
  data: LearningWorkspaceData;
}) {
  const {
    courseSlug,
    courseTitle,
    syllabus,
    currentTopic,
    flashcards,
    exercises,
    answers,
    progress,
    memoryCheck,
    isMemoryCheckPassed,
  } = data;
  // Stage order: flashcards -> memory check (when the topic has one) -> exercises.
  const initialStage: LearningStage =
    flashcards.length > 0
      ? "flashcard"
      : memoryCheck && (!isMemoryCheckPassed || exercises.length === 0)
        ? "memory"
        : exercises.length > 0
          ? "exercise"
          : "flashcard";

  const [activeTab, setActiveTab] = useState<"quiz" | "chapters">(
    initialStage === "exercise" ? "quiz" : "chapters",
  );
  const [learningStage, setLearningStage] =
    useState<LearningStage>(initialStage);
  const [memoryPassed, setMemoryPassed] = useState(isMemoryCheckPassed);
  // Sticky on the server (G4), so it only ever turns on.
  const [isTopicCompleted, setIsTopicCompleted] = useState(
    progress?.isTopicCompleted ?? false,
  );
  const markTopicCompleted = () => setIsTopicCompleted(true);
  const [isPending, startTransition] = useTransition();
  const [canSkipToQuiz, setCanSkipToQuiz] = useState(
    progress?.isFlashcardCompleted ?? false,
  );
  const [userAnswers, setUserAnswers] =
    useState<Record<string, string>>(answers);
  const [expandedChapter, setExpandedChapter] = useState(
    currentTopic.chapterId,
  );
  const [learningQueue, setLearningQueue] =
    useState<FlashcardDTO[]>(flashcards);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isChainEnded, setIsChainEnded] = useState(false);

  const flatLessons = useMemo(
    () => syllabus.flatMap((chapter) => chapter.topics),
    [syllabus],
  );
  const lessonNeighbors = useMemo(
    () => resolveLessonNeighbors(flatLessons, currentTopic.slug),
    [flatLessons, currentTopic.slug],
  );
  // The current topic follows live server results; the others use the stored
  // completion loaded with the syllabus.
  const completedTopicIds = useMemo(
    () =>
      new Set(
        flatLessons
          .filter((topic) =>
            topic.id === currentTopic.id ? isTopicCompleted : topic.isCompleted,
          )
          .map((topic) => topic.id),
      ),
    [flatLessons, currentTopic.id, isTopicCompleted],
  );

  const exercisesLocked = memoryCheck !== null && !memoryPassed;
  const nextStageAfterFlashcards: LearningStage | null =
    memoryCheck && (exercisesLocked || exercises.length === 0)
      ? "memory"
      : exercises.length > 0
        ? "exercise"
        : null;

  const goToStage = (stage: LearningStage) => {
    setLearningStage(stage);
    setActiveTab(stage === "exercise" ? "quiz" : "chapters");
  };

  const skipToQuiz = () => goToStage("exercise");

  const backToFlashcard = () => goToStage("flashcard");

  const returnToMemoryCheck = () => {
    setMemoryPassed(false);
    goToStage("memory");
    toast.error(MEMORY_LOCK_REASON);
  };

  const handleRateCard = (rating: Rating) => {
    const currentCard = learningQueue[0];
    if (!currentCard) return;

    startTransition(async () => {
      const result = await submitCardReview(currentCard.id, rating);
      if (result?.error) {
        toast.error("Lỗi đồng bộ tiến độ học!");
        return;
      }
      announceTopicProgress(result, markTopicCompleted);
      if (result.topicProgress?.isFlashcardCompleted) setCanSkipToQuiz(true);

      const newQueue = [...learningQueue.slice(1)];
      if (rating === Rating.Again || rating === Rating.Hard) {
        newQueue.push(currentCard);
      }
      setLearningQueue(newQueue);
      setIsFlipped(false);

      if (newQueue.length === 0) {
        setCanSkipToQuiz(true);

        if (nextStageAfterFlashcards === "memory") {
          goToStage("memory");
          toast.success("Đã nạp xong từ vựng! Chuyển sang memory check.");
        } else if (nextStageAfterFlashcards === "exercise") {
          goToStage("exercise");
          toast.success("Đã nạp xong từ vựng! Chuyển sang bài tập.");
        } else if (!result.topicProgress?.newlyCompleted) {
          toast.success("Đã nạp xong từ vựng!");
        }
      }
    });
  };

  const currentExercise: ExerciseDTO | undefined =
    exercises[currentExerciseIndex];
  const sortedGroups = exerciseSegments(currentExercise);
  const currentGroup: ExerciseSegment | undefined =
    sortedGroups[currentGroupIndex];
  // Standalone questions are not a group, so groups are numbered without them.
  const passageGroupCount = sortedGroups.filter((group) => !group.isStandalone).length;
  const groupPosition =
    currentGroup && !currentGroup.isStandalone
      ? {
          current: currentGroupIndex - (sortedGroups.length - passageGroupCount) + 1,
          total: passageGroupCount,
        }
      : null;
  const sortedQuestions: QuestionDTO[] =
    currentGroup?.questions?.slice().sort(byOrderIndex) ?? [];
  const currentQuestion: QuestionDTO | undefined =
    sortedQuestions[currentQuestionIndex];
  const sortedOptions: QuestionOptionDTO[] =
    currentQuestion?.options
      ?.slice()
      .sort(
        (left, right) =>
          (left.order_index ?? Number.MAX_SAFE_INTEGER) -
            (right.order_index ?? Number.MAX_SAFE_INTEGER) ||
          (left.label || "").localeCompare(right.label || "") ||
          left.id.localeCompare(right.id),
      ) ?? [];

  // Every exercise question in learning order; "done" follows the local
  // `answers` map, which uses the same current-answer-key predicate as the server.
  const exerciseQuestionPositions = useMemo(
    () =>
      exercises.flatMap((exercise, exerciseIndex) =>
        exerciseSegments(exercise).flatMap((segment, groupIndex) =>
          segment.questions
            .slice()
            .sort(byOrderIndex)
            .map((question, questionIndex) => ({
              questionId: question.id,
              exerciseIndex,
              groupIndex,
              questionIndex,
            })),
        ),
      ),
    [exercises],
  );
  const remainingQuestions = exerciseQuestionPositions.filter(
    (position) => !userAnswers[position.questionId],
  );

  const goToFirstRemainingQuestion = () => {
    const [first] = remainingQuestions;
    if (!first) return;
    setSelectedOption(null);
    setIsChainEnded(false);
    setCurrentExerciseIndex(first.exerciseIndex);
    setCurrentGroupIndex(first.groupIndex);
    setCurrentQuestionIndex(first.questionIndex);
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setIsChainEnded(false);
    if (currentQuestionIndex < sortedQuestions.length - 1) {
      setCurrentQuestionIndex((current) => current + 1);
    } else if (currentGroupIndex < sortedGroups.length - 1) {
      setCurrentGroupIndex((current) => current + 1);
      setCurrentQuestionIndex(0);
    } else if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((current) => current + 1);
      setCurrentGroupIndex(0);
      setCurrentQuestionIndex(0);
    } else {
      // The remaining count is rendered from the latest answers, not from this
      // (possibly stale) closure.
      setIsChainEnded(true);
    }
  };

  const handlePrevQuestion = () => {
    setSelectedOption(null);
    setIsChainEnded(false);
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((current) => current - 1);
    } else if (currentGroupIndex > 0) {
      const previousGroupIndex = currentGroupIndex - 1;
      setCurrentGroupIndex(previousGroupIndex);
      setCurrentQuestionIndex(
        Math.max(
          0,
          (sortedGroups[previousGroupIndex]?.questions ?? []).length - 1,
        ),
      );
    } else if (currentExerciseIndex > 0) {
      const previousExerciseIndex = currentExerciseIndex - 1;
      setCurrentExerciseIndex(previousExerciseIndex);
      const previousExerciseGroups = exerciseSegments(
        exercises[previousExerciseIndex],
      );
      const lastGroupIndex = Math.max(0, previousExerciseGroups.length - 1);
      setCurrentGroupIndex(lastGroupIndex);
      setCurrentQuestionIndex(
        Math.max(
          0,
          (previousExerciseGroups[lastGroupIndex]?.questions ?? []).length - 1,
        ),
      );
    } else if (memoryCheck) {
      goToStage("memory");
    } else if (flashcards.length > 0) {
      setLearningStage("flashcard");
      setLearningQueue(flashcards);
      setIsFlipped(false);
      setActiveTab("chapters");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans md:p-8">
      <div className="max-w-8xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
          <main className="flex min-h-150 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-7">
            <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
              <div className="flex min-w-0 items-center gap-4">
                <Link
                  href={`/learn/${courseSlug}`}
                  aria-label={`Về tổng quan khóa học ${courseTitle}`}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <ArrowLeft aria-hidden="true" className="size-5" />
                </Link>
                <div className="flex min-w-0 flex-col">
                  <span
                    title={courseTitle}
                    className="max-w-50 truncate text-[10px] font-black uppercase tracking-widest text-emerald-600 md:max-w-md"
                  >
                    {courseTitle}
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                    <h1 className="max-w-50 truncate text-sm font-bold text-slate-700 md:max-w-md">
                      {currentTopic.title}
                    </h1>
                    {isTopicCompleted && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-green-700">
                        <CheckCircle2 aria-hidden="true" className="size-3.5" />
                        Đã hoàn thành
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {learningStage === "exercise" && memoryCheck ? (
                  <Button
                    onClick={() => goToStage("memory")}
                    variant="outline"
                    size="sm"
                    className="min-h-11 rounded-xl border-slate-200 font-medium text-slate-600 shadow-sm hover:bg-white sm:min-h-9"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Về Memory check
                  </Button>
                ) : learningStage !== "flashcard" && flashcards.length > 0 ? (
                  <Button
                    onClick={backToFlashcard}
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-200 font-medium text-slate-600 shadow-sm hover:bg-white"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Về Từ vựng
                  </Button>
                ) : null}
                {learningStage === "flashcard" &&
                  canSkipToQuiz &&
                  nextStageAfterFlashcards === "memory" && (
                    <Button
                      onClick={() => goToStage("memory")}
                      variant="outline"
                      size="sm"
                      className="min-h-11 rounded-xl border-emerald-200 font-bold text-emerald-600 shadow-sm hover:bg-emerald-50 sm:min-h-9"
                    >
                      Tới Memory check
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </Button>
                  )}
                {learningStage !== "exercise" &&
                  exercises.length > 0 &&
                  (learningStage === "memory" ||
                    (canSkipToQuiz && !exercisesLocked)) && (
                    <Button
                      onClick={skipToQuiz}
                      variant="outline"
                      size="sm"
                      className="animate-in rounded-xl border-emerald-200 font-bold text-emerald-600 shadow-sm fade-in hover:bg-emerald-50"
                    >
                      {exercisesLocked && (
                        <Lock aria-hidden="true" className="size-4" />
                      )}
                      Tới Bài tập
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </Button>
                  )}
              </div>
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-center bg-slate-50/30 p-6 md:p-10">
              {flashcards.length === 0 &&
              exercises.length === 0 &&
              !memoryCheck ? (
                <div className="text-center text-slate-400" role="status">
                  <h2 className="mb-2 text-2xl font-bold">
                    Bài học này chưa có nội dung
                  </h2>
                </div>
              ) : learningStage === "memory" && memoryCheck ? (
                <MemoryCheckStage
                  questions={memoryCheck.questions}
                  initiallyCorrectIds={memoryCheck.questions
                    .filter((question) => userAnswers[question.id])
                    .map((question) => question.id)}
                  isPassed={memoryPassed}
                  hasExercises={exercises.length > 0}
                  onCorrectAnswer={(questionId, optionId) =>
                    setUserAnswers((current) => ({
                      ...current,
                      [questionId]: optionId,
                    }))
                  }
                  onPassed={() => {
                    setMemoryPassed(true);
                    if (exercises.length > 0) goToStage("exercise");
                  }}
                  onGoToExercises={() => goToStage("exercise")}
                  onTopicCompleted={markTopicCompleted}
                />
              ) : learningStage === "exercise" && exercisesLocked ? (
                <section
                  role="status"
                  className="flex max-w-md flex-col items-center gap-4 text-center"
                >
                  <Lock aria-hidden="true" className="size-10 text-slate-400" />
                  <h2 className="text-xl font-bold text-slate-800">
                    Bài tập đang khóa
                  </h2>
                  <p className="text-slate-600">{MEMORY_LOCK_REASON}</p>
                  <Button
                    onClick={() => goToStage("memory")}
                    className="min-h-11 rounded-xl bg-slate-800 px-8 font-bold text-white hover:bg-slate-900"
                  >
                    Làm memory check
                  </Button>
                </section>
              ) : learningStage === "flashcard" ? (
                <FlashcardStage
                  currentCard={learningQueue[0]}
                  cardsLeft={learningQueue.length}
                  totalCards={flashcards.length}
                  isFlipped={isFlipped}
                  setIsFlipped={setIsFlipped}
                  handleRateCard={handleRateCard}
                  isPending={isPending}
                />
              ) : (
                <ExerciseContext
                  currentExercise={currentExercise}
                  currentGroup={currentGroup}
                  isStandalone={currentGroup?.isStandalone ?? false}
                />
              )}
            </div>
          </main>

          <aside className="sticky top-4 flex h-fit max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
            <div className="flex shrink-0 items-center justify-center gap-4 border-b border-slate-100 bg-slate-50/50 p-4">
              <Button
                onClick={() => setActiveTab("quiz")}
                variant={activeTab === "quiz" ? "default" : "outline"}
                aria-label="Mở phần câu hỏi"
                className={`rounded-xl px-8 transition-all ${activeTab === "quiz" ? "bg-emerald-500 text-white shadow-md" : "border-emerald-200 text-emerald-600"}`}
              >
                <BookOpenText aria-hidden="true" className="size-5" />
              </Button>
              <Button
                onClick={() => setActiveTab("chapters")}
                variant={activeTab === "chapters" ? "default" : "outline"}
                aria-label="Mở danh sách chương và bài học"
                className={`rounded-xl px-8 transition-all ${activeTab === "chapters" ? "bg-emerald-500 text-white shadow-md" : "border-emerald-200 text-emerald-600"}`}
              >
                <ListTodo aria-hidden="true" className="size-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "quiz" &&
                learningStage === "exercise" &&
                !exercisesLocked &&
                isChainEnded && (
                  <div
                    role="status"
                    className={`mb-6 flex flex-col gap-3 rounded-xl border p-4 ${
                      remainingQuestions.length > 0
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900"
                    }`}
                  >
                    {remainingQuestions.length > 0 ? (
                      <>
                        <p className="font-bold">
                          Còn {remainingQuestions.length} câu chưa trả lời đúng
                        </p>
                        <Button
                          size="lg"
                          onClick={goToFirstRemainingQuestion}
                        >
                          Làm câu còn thiếu
                        </Button>
                      </>
                    ) : (
                      <p className="font-bold">Bạn đã trả lời đúng hết bài tập.</p>
                    )}
                  </div>
                )}
              {activeTab === "chapters" ? (
                <ChapterSidebar
                  courseSlug={courseSlug}
                  syllabus={syllabus}
                  expandedChapter={expandedChapter}
                  setExpandedChapter={setExpandedChapter}
                  currentLessonSlug={currentTopic.slug}
                  completedTopicIds={completedTopicIds}
                />
              ) : (
                <QuizSidebar
                  learningStage={
                    learningStage === "exercise" && !exercisesLocked ? 2 : 1
                  }
                  lockedMessage={
                    learningStage === "flashcard"
                      ? undefined
                      : MEMORY_LOCK_REASON
                  }
                  onMemoryCheckRequired={returnToMemoryCheck}
                  currentQuestion={currentQuestion}
                  currentQuestionIndex={currentQuestionIndex}
                  totalQuestions={sortedQuestions.length}
                  groupPosition={groupPosition}
                  sortedOptions={sortedOptions}
                  selectedOption={selectedOption}
                  setSelectedOption={setSelectedOption}
                  handlePrevQuestion={handlePrevQuestion}
                  handleNextQuestion={handleNextQuestion}
                  userAnswers={userAnswers}
                  onCorrectAnswer={(questionId, optionId) =>
                    setUserAnswers((current) => ({
                      ...current,
                      [questionId]: optionId,
                    }))
                  }
                  onTopicCompleted={markTopicCompleted}
                />
              )}
            </div>
          </aside>
        </div>

        <nav
          aria-label="Điều hướng bài học"
          className="mt-auto flex flex-wrap items-center justify-center gap-4 border-t border-slate-200/50 p-4 pt-8 sm:p-5"
        >
          {lessonNeighbors.previous ? (
            <Button
              asChild
              variant="ghost"
              className="rounded-xl px-4 py-6 font-medium text-slate-600 hover:bg-slate-100"
            >
              <Link
                href={`/learn/${courseSlug}/${lessonNeighbors.previous.slug}`}
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
                Bài trước
              </Link>
            </Button>
          ) : (
            <Button
              disabled
              variant="ghost"
              className="rounded-xl px-4 py-6 font-medium text-slate-600"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
              Bài trước
            </Button>
          )}
          {/* Completion is derived by the server (D4); once the topic is done the
              next topic becomes the primary action, or the course overview when
              this is the last topic. */}
          {isTopicCompleted && lessonNeighbors.next ? (
            <Button asChild size="lg">
              <Link href={`/learn/${courseSlug}/${lessonNeighbors.next.slug}`}>
                Bài sau
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : isTopicCompleted ? (
            <Button asChild size="lg">
              <Link href={`/learn/${courseSlug}`}>Về tổng quan khóa học</Link>
            </Button>
          ) : lessonNeighbors.next ? (
            <Button
              asChild
              variant="ghost"
              className="rounded-xl px-4 py-6 font-medium text-slate-600 hover:bg-slate-100"
            >
              <Link href={`/learn/${courseSlug}/${lessonNeighbors.next.slug}`}>
                Bài sau
                <ChevronRight aria-hidden="true" className="size-5" />
              </Link>
            </Button>
          ) : (
            <Button
              disabled
              variant="ghost"
              className="rounded-xl px-4 py-6 font-medium text-slate-600"
            >
              Bài sau
              <ChevronRight aria-hidden="true" className="size-5" />
            </Button>
          )}
        </nav>
      </div>
    </div>
  );
}
