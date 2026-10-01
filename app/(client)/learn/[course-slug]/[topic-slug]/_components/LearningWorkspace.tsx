"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Lock,
} from "lucide-react";
import { Rating } from "ts-fsrs";
import { toast } from "sonner";
import { submitCardReview } from "@/app/actions/review";
import { updateStageProgress } from "@/app/actions/progress";
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

type LearningStage = "flashcard" | "memory" | "exercise";

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

  const flatLessons = useMemo(
    () => syllabus.flatMap((chapter) => chapter.topics),
    [syllabus],
  );
  const lessonNeighbors = useMemo(
    () => resolveLessonNeighbors(flatLessons, currentTopic.slug),
    [flatLessons, currentTopic.slug],
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

      const newQueue = [...learningQueue.slice(1)];
      if (rating === Rating.Again || rating === Rating.Hard) {
        newQueue.push(currentCard);
      }
      setLearningQueue(newQueue);
      setIsFlipped(false);

      if (newQueue.length === 0) {
        const progressResult = await updateStageProgress(
          currentTopic.id,
          "flashcard",
        );
        if (progressResult.error) {
          toast.error("Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học.");
          return;
        }
        setCanSkipToQuiz(true);

        if (nextStageAfterFlashcards === "memory") {
          goToStage("memory");
          toast.success("Đã nạp xong từ vựng! Chuyển sang memory check.");
        } else if (nextStageAfterFlashcards === "exercise") {
          goToStage("exercise");
          toast.success("Đã nạp xong từ vựng! Chuyển sang bài tập.");
        } else {
          toast.success("Tuyệt vời! Bạn đã hoàn thành toàn bộ bài học này!");
        }
      }
    });
  };

  const currentExercise: ExerciseDTO | undefined =
    exercises[currentExerciseIndex];
  const sortedGroups: QuestionGroupDTO[] =
    currentExercise?.groups
      ?.slice()
      .sort((left, right) => left.order_index - right.order_index) ?? [];
  const currentGroup: QuestionGroupDTO | undefined =
    sortedGroups[currentGroupIndex];
  const sortedQuestions: QuestionDTO[] =
    currentGroup?.questions
      ?.slice()
      .sort((left, right) => left.order_index - right.order_index) ?? [];
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

  const handleNextQuestion = () => {
    setSelectedOption(null);
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
      toast.success("Bạn đã hoàn thành tất cả bài tập!");
    }
  };

  const handlePrevQuestion = () => {
    setSelectedOption(null);
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
      const previousExerciseGroups =
        exercises[previousExerciseIndex]?.groups ?? [];
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
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6">
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
                  <h1 className="max-w-50 truncate text-sm font-bold text-slate-700 md:max-w-md">
                    {currentTopic.title}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
              {activeTab === "chapters" ? (
                <ChapterSidebar
                  courseSlug={courseSlug}
                  syllabus={syllabus}
                  expandedChapter={expandedChapter}
                  setExpandedChapter={setExpandedChapter}
                  currentLessonSlug={currentTopic.slug}
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
                  currentGroupIndex={currentGroupIndex}
                  totalGroups={sortedGroups.length}
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
                  topicId={currentTopic.id}
                />
              )}
            </div>
          </aside>
        </div>

        <nav
          aria-label="Điều hướng bài học"
          className="mt-auto flex flex-wrap items-center justify-center gap-3 border-t border-slate-200/50 p-4 pt-8 sm:gap-0 sm:p-5"
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
          <Button className="order-first w-full rounded-xl bg-emerald-500 px-8 py-6 font-bold text-white shadow-lg shadow-emerald-200 transition-transform hover:bg-emerald-600 active:scale-95 sm:order-none sm:mx-4 sm:w-auto sm:px-12">
            Hoàn thành bài học
          </Button>
          {lessonNeighbors.next ? (
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
