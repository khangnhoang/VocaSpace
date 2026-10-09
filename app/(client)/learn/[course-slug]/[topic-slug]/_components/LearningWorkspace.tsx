"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Lock,
  RotateCcw,
} from "lucide-react";
import { Rating } from "ts-fsrs";
import { toast } from "sonner";
import { submitCardReview } from "@/app/actions/review";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import QuestionNavigator, { type QuestionNavigatorSection } from "./QuestionNavigator";
import type { AnswerAttempt, AttemptOutcome } from "./answer-attempt";
import QuestionResponse from "./QuestionResponse";
import StickyColumn from "./StickyColumn";
import { arrangeMaterial } from "./exercise-arrangement";
import { announceTopicProgress } from "./topic-progress-feedback";

type LearningStage = "flashcard" | "memory" | "exercise";
type StepState = "current" | "done" | "locked" | "upcoming";

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

const STEP_STATE_TEXT: Record<StepState, string> = {
  current: "đang học",
  done: "đã xong",
  locked: "đang khóa",
  upcoming: "chưa mở",
};

/**
 * Progress thread of the stages this topic really has. It reports state with
 * words and icons and is not a control, so it cannot bypass a server gate.
 */
function StageThread({
  steps,
}: {
  steps: Array<{ key: LearningStage; label: string; state: StepState }>;
}) {
  return (
    <ol aria-label="Các bước của bài học" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={step.state === "current" ? "step" : undefined}
          className={`flex items-center gap-2 text-sm transition-colors duration-[220ms] motion-reduce:transition-none ${
            step.state === "current"
              ? "font-bold text-slate-900"
              : step.state === "done"
                ? "font-semibold text-slate-700"
                : "font-medium text-slate-600"
          }`}
        >
          {index > 0 && (
            <span aria-hidden="true" className="h-px w-4 bg-slate-300 sm:w-6" />
          )}
          <span
            aria-hidden="true"
            className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors duration-[220ms] motion-reduce:transition-none ${
              step.state === "current"
                ? "border-route bg-route text-white"
                : step.state === "done"
                  ? "border-growth-line bg-growth-quiet text-growth"
                  : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {step.state === "done" ? (
              <CheckCircle2 className="size-4" />
            ) : step.state === "locked" ? (
              <Lock className="size-3" />
            ) : (
              index + 1
            )}
          </span>
          <span>
            {step.label}
            <span className="sr-only"> ({STEP_STATE_TEXT[step.state]})</span>
          </span>
        </li>
      ))}
    </ol>
  );
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

  const [learningStage, setLearningStage] =
    useState<LearningStage>(initialStage);
  const [memoryPassed, setMemoryPassed] = useState(isMemoryCheckPassed);
  // Sticky on the server (G4), so it only ever turns on.
  const [isTopicCompleted, setIsTopicCompleted] = useState(
    progress?.isTopicCompleted ?? false,
  );
  const markTopicCompleted = () => setIsTopicCompleted(true);
  const [isPending, startTransition] = useTransition();
  // Quyền đi tiếp (nút "Tới ..."): chỉ bật lên, không bao giờ tắt, như trước LF1.
  const [canSkipToQuiz, setCanSkipToQuiz] = useState(
    progress?.isFlashcardCompleted ?? false,
  );
  // Chỉ để hiển thị bước "Từ vựng" đã xong trên StageThread. Server quyết định theo lần chấm
  // gần nhất của mọi thẻ nên một lần Lại/Khó sau đó tắt nó đi (LF1 AC3); không điều khiển điều hướng.
  const [flashcardStageDone, setFlashcardStageDone] = useState(
    progress?.isFlashcardCompleted ?? false,
  );
  const [userAnswers, setUserAnswers] =
    useState<Record<string, string>>(answers);
  // Questions answered wrongly in this session and not yet answered right; only the
  // review list reads it, the server never stores a wrong attempt.
  const [incorrectIds, setIncorrectIds] = useState<Record<string, true>>({});
  // Submissions by question, kept here so leaving a question or stage while its answer
  // is in flight neither allows a second submit nor loses the result that lands later.
  const [attempts, setAttempts] = useState<Record<string, AnswerAttempt>>({});
  const startAttempt = (questionId: string, optionId: string) =>
    setAttempts((current) => ({ ...current, [questionId]: { status: "pending", optionId } }));
  const settleAttempt = (questionId: string, optionId: string, outcome: AttemptOutcome) =>
    setAttempts((current) => ({
      ...current,
      [questionId]: { status: "settled", optionId, outcome },
    }));
  const clearAttempt = (questionId: string) =>
    setAttempts((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  const [expandedChapter, setExpandedChapter] = useState(
    currentTopic.chapterId,
  );
  const [learningQueue, setLearningQueue] =
    useState<FlashcardDTO[]>(flashcards);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // How the learner reached the current question: drives the entrance direction
  // and whether the new question heading takes focus.
  const [entry, setEntry] = useState<{
    direction: "next" | "previous" | "none";
    focus: boolean;
  }>({ direction: "none", focus: false });
  const planeRef = useRef<HTMLElement>(null);

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
  };

  const skipToQuiz = () => goToStage("exercise");

  const backToFlashcard = () => goToStage("flashcard");

  const returnToMemoryCheck = () => {
    setMemoryPassed(false);
    goToStage("memory");
    toast.error(MEMORY_LOCK_REASON);
  };

  const restartFlashcards = () => {
    setLearningQueue(flashcards);
    setIsFlipped(false);
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
      // Kết quả server thắng theo cả hai chiều chỉ với dấu "đã xong" của StageThread.
      if (result.topicProgress) setFlashcardStageDone(result.topicProgress.isFlashcardCompleted);

      const newQueue = [...learningQueue.slice(1)];
      if (rating === Rating.Again || rating === Rating.Hard) {
        newQueue.push(currentCard);
      }
      setLearningQueue(newQueue);
      setIsFlipped(false);

      if (newQueue.length === 0) {
        setCanSkipToQuiz(true);
        // Không có kết quả server (đồng bộ lỗi) thì hết hàng đợi vẫn coi như đã xong, như trước.
        if (!result.topicProgress) setFlashcardStageDone(true);

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
    setEntry({ direction: "next", focus: true });
    setCurrentExerciseIndex(first.exerciseIndex);
    setCurrentGroupIndex(first.groupIndex);
    setCurrentQuestionIndex(first.questionIndex);
  };

  const currentPositionIndex = exerciseQuestionPositions.findIndex(
    (position) => position.questionId === currentQuestion?.id,
  );
  // "Next" is only offered while a later question exists.
  const hasNextQuestion =
    currentPositionIndex >= 0 && currentPositionIndex < exerciseQuestionPositions.length - 1;

  // The review list reports a pick; the memory-check gate is still enforced here.
  const jumpToQuestion = (questionId: string) => {
    if (exercisesLocked) return;
    const targetIndex = exerciseQuestionPositions.findIndex(
      (position) => position.questionId === questionId,
    );
    const target = exerciseQuestionPositions[targetIndex];
    if (!target) return;
    setEntry({
      direction: targetIndex <= currentPositionIndex ? "previous" : "next",
      focus: true,
    });
    setCurrentExerciseIndex(target.exerciseIndex);
    setCurrentGroupIndex(target.groupIndex);
    setCurrentQuestionIndex(target.questionIndex);
  };

  const handleNextQuestion = () => {
    if (!hasNextQuestion) return;
    setEntry({ direction: "next", focus: true });
    if (currentQuestionIndex < sortedQuestions.length - 1) {
      setCurrentQuestionIndex((current) => current + 1);
    } else if (currentGroupIndex < sortedGroups.length - 1) {
      setCurrentGroupIndex((current) => current + 1);
      setCurrentQuestionIndex(0);
    } else if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((current) => current + 1);
      setCurrentGroupIndex(0);
      setCurrentQuestionIndex(0);
    }
  };

  const handlePrevQuestion = () => {
    setEntry({ direction: "previous", focus: true });
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
    }
  };

  const groupKey =
    learningStage === "exercise" && currentGroup
      ? `${currentExercise?.id}:${currentGroup.id}`
      : null;
  const previousGroupKey = useRef(groupKey);
  useEffect(() => {
    if (previousGroupKey.current === groupKey) return;
    previousGroupKey.current = groupKey;
    if (!groupKey) return;
    // Only a real group boundary re-orients the page, and only when the new
    // material starts above the viewport. Selection and feedback never scroll it.
    const plane = planeRef.current;
    if (plane && plane.getBoundingClientRect().top < 0) {
      plane.scrollIntoView?.({ block: "start" });
    }
  }, [groupKey]);

  const exerciseQuestionCount = exerciseQuestionPositions.length;
  const stageSteps: Array<{ key: LearningStage; label: string; state: StepState }> = [];
  if (flashcards.length > 0) {
    stageSteps.push({
      key: "flashcard",
      label: "Từ vựng",
      state: learningStage === "flashcard" ? "current" : flashcardStageDone ? "done" : "upcoming",
    });
  }
  if (memoryCheck) {
    stageSteps.push({
      key: "memory",
      label: "Memory check",
      state: learningStage === "memory" ? "current" : memoryPassed ? "done" : "upcoming",
    });
  }
  if (exercises.length > 0) {
    stageSteps.push({
      key: "exercise",
      label: "Bài tập",
      state: exercisesLocked
        ? "locked"
        : learningStage === "exercise"
          ? "current"
          : exerciseQuestionCount > 0 && remainingQuestions.length === 0
            ? "done"
            : "upcoming",
    });
  }

  const arrangement =
    currentExercise && currentGroup
      ? arrangeMaterial(currentExercise.part_type, currentGroup, currentGroup.isStandalone)
      : null;
  const hasMaterial =
    arrangement !== null && (arrangement.kinds.length > 0 || arrangement.missing.length > 0);
  const isSplit = hasMaterial && arrangement.layout === "split";
  const chapterTitle = syllabus.find((chapter) => chapter.id === currentTopic.chapterId)?.title;

  // Review list: every question in learning order, numbered across the whole topic.
  const questionNumbers = new Map(
    exerciseQuestionPositions.map((position, index) => [position.questionId, index + 1]),
  );
  const navigatorSections: QuestionNavigatorSection[] = exercises.map((exercise) => {
    const segments = exerciseSegments(exercise);
    const passageTotal = segments.filter((segment) => !segment.isStandalone).length;
    let passageNumber = 0;
    return {
      id: exercise.id,
      title: exercise.title,
      groups: segments.map((segment) => {
        if (!segment.isStandalone) passageNumber += 1;
        return {
          id: segment.id,
          label: segment.isStandalone ? undefined : `Nhóm ${passageNumber}/${passageTotal}`,
          items: segment.questions
            .slice()
            .sort(byOrderIndex)
            .map((question) => ({
              id: question.id,
              number: questionNumbers.get(question.id) ?? 0,
              text: question.content.trim() || "Chọn đáp án đúng",
              status: userAnswers[question.id]
                ? ("correct" as const)
                : incorrectIds[question.id]
                  ? ("incorrect" as const)
                  : ("unanswered" as const),
              current: question.id === currentQuestion?.id,
              disabledReason: exercisesLocked ? MEMORY_LOCK_REASON : undefined,
            })),
        };
      }),
    };
  });
  const questionNavigator = (
    <QuestionNavigator sections={navigatorSections} onSelect={jumpToQuestion} />
  );

  // Moves the learner from the end of a stacked passage to the question; reduced motion jumps.
  const scrollToQuestion = () => {
    const heading = document.querySelector<HTMLElement>("[data-question-heading]");
    if (!heading) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView?.({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  };

  const renderExercise = () => {
    if (!currentExercise || !currentGroup || !currentQuestion || !arrangement) {
      return (
        <p className="text-center text-slate-600">
          Bài tập này chưa có câu hỏi để làm.
        </p>
      );
    }

    return (
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-semibold text-slate-600 [overflow-wrap:anywhere]">
            {currentExercise.title}
          </p>
          {questionNavigator}
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
          {hasMaterial && (
            <StickyColumn
              key={`${currentExercise.id}:${currentGroup.id}`}
              enabled={isSplit}
              className="min-w-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[240ms]"
            >
              <ExerciseContext
                group={currentGroup}
                arrangement={arrangement}
                enlargeableImage={currentExercise.part_type === "part1"}
              />
              {isSplit && (
                // Stacked layouts put the question below a long passage; wide ones keep it beside.
                <div className="mt-3 flex justify-end lg:hidden">
                  <Button type="button" variant="link" size="lg" className="px-2" onClick={scrollToQuestion}>
                    Tới câu hỏi
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </div>
              )}
            </StickyColumn>
          )}
          <StickyColumn enabled={isSplit} className="min-w-0">
            <QuestionResponse
              key={currentQuestion.id}
              question={currentQuestion}
              options={sortedOptions}
              questionNumber={currentPositionIndex + 1}
              totalQuestions={exerciseQuestionCount}
              groupPosition={groupPosition}
              savedOptionId={userAnswers[currentQuestion.id]}
              attempt={attempts[currentQuestion.id]}
              onAttemptStart={startAttempt}
              onAttemptSettled={settleAttempt}
              direction={entry.direction}
              focusOnEntry={entry.focus}
              hasNext={hasNextQuestion}
              endAction={
                remainingQuestions.length > 0
                  ? { label: "Làm câu còn thiếu", onClick: goToFirstRemainingQuestion }
                  : lessonNeighbors.next
                    ? {
                        label: "Bài tiếp theo",
                        href: `/learn/${courseSlug}/${lessonNeighbors.next.slug}`,
                      }
                    : { label: "Về tổng quan khóa học", href: `/learn/${courseSlug}` }
              }
              onPrevious={handlePrevQuestion}
              onNext={handleNextQuestion}
              onCorrectAnswer={(questionId, optionId) =>
                setUserAnswers((current) => ({
                  ...current,
                  [questionId]: optionId,
                }))
              }
              onIncorrectAnswer={(questionId) =>
                setIncorrectIds((current) => ({ ...current, [questionId]: true }))
              }
              onTopicCompleted={markTopicCompleted}
              onMemoryCheckRequired={returnToMemoryCheck}
            />
          </StickyColumn>
        </div>
      </div>
    );
  };

  const renderStage = () => {
    if (flashcards.length === 0 && exercises.length === 0 && !memoryCheck) {
      return (
        <div className="text-center text-slate-600" role="status">
          <h2 className="mb-2 text-2xl font-bold">Bài học này chưa có nội dung</h2>
        </div>
      );
    }
    if (learningStage === "memory" && memoryCheck) {
      return (
        <div className="mx-auto flex w-full justify-center">
          <MemoryCheckStage
            questions={memoryCheck.questions}
            initiallyCorrectIds={memoryCheck.questions
              .filter((question) => userAnswers[question.id])
              .map((question) => question.id)}
            attempts={attempts}
            onAttemptStart={startAttempt}
            onAttemptSettled={settleAttempt}
            onAttemptCleared={clearAttempt}
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
        </div>
      );
    }
    if (learningStage === "exercise" && exercisesLocked) {
      return (
        <section
          role="status"
          className="mx-auto flex max-w-md flex-col items-center gap-4 text-center"
        >
          <Lock aria-hidden="true" className="size-10 text-attention" />
          <h2 className="text-xl font-bold text-slate-900">Bài tập đang khóa</h2>
          <p className="text-slate-700">{MEMORY_LOCK_REASON}</p>
          <Button onClick={() => goToStage("memory")} size="lg" className="px-8">
            Làm memory check
          </Button>
        </section>
      );
    }
    if (learningStage === "flashcard") {
      if (learningQueue.length === 0) {
        return (
          <section
            aria-labelledby="flashcards-done-title"
            className="mx-auto flex max-w-md flex-col items-center gap-4 text-center"
          >
            <CheckCircle2 aria-hidden="true" className="size-10 text-growth" />
            <h2 id="flashcards-done-title" className="text-xl font-bold text-slate-900">
              Bạn đã ôn xong từ vựng
            </h2>
            <Button variant="outline" size="lg" onClick={restartFlashcards}>
              <RotateCcw aria-hidden="true" />
              Ôn lại từ vựng
            </Button>
          </section>
        );
      }
      return (
        <FlashcardStage
          currentCard={learningQueue[0]}
          cardsLeft={learningQueue.length}
          totalCards={flashcards.length}
          isFlipped={isFlipped}
          setIsFlipped={setIsFlipped}
          handleRateCard={handleRateCard}
          isPending={isPending}
        />
      );
    }
    return renderExercise();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 font-sans min-[400px]:px-4 md:px-6 md:py-8">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href={`/learn/${courseSlug}`}
              aria-label={`Về tổng quan khóa học ${courseTitle}`}
              className="-ml-1 mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors duration-[120ms] hover:bg-white hover:text-route focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route sm:size-9"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            <div className="flex min-w-0 flex-col gap-1">
              <p title={courseTitle} className="truncate text-sm font-medium text-slate-600">
                {courseTitle}
                {chapterTitle ? ` · ${chapterTitle}` : ""}
              </p>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="min-w-0 break-words text-xl font-bold leading-snug text-slate-900 [overflow-wrap:anywhere] md:text-2xl">
                  {currentTopic.title}
                </h1>
                {isTopicCompleted && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-growth-line bg-growth-quiet px-2 py-0.5 text-sm font-bold text-growth">
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    Đã hoàn thành
                  </span>
                )}
              </div>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" aria-label="Mở danh sách chương và bài học">
                <ListTodo aria-hidden="true" />
                <span className="hidden sm:inline">Danh sách bài học</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="text-lg font-bold">Duyệt chương học</SheetTitle>
                <SheetDescription className="sr-only">
                  Chọn bài học khác trong khóa học này.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <ChapterSidebar
                  courseSlug={courseSlug}
                  syllabus={syllabus}
                  expandedChapter={expandedChapter}
                  setExpandedChapter={setExpandedChapter}
                  currentLessonSlug={currentTopic.slug}
                  completedTopicIds={completedTopicIds}
                />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {stageSteps.length > 0 ? <StageThread steps={stageSteps} /> : <span />}

          <div className="flex flex-wrap items-center gap-2">
            {learningStage === "exercise" && memoryCheck ? (
              <Button onClick={() => goToStage("memory")} variant="outline">
                <ChevronLeft aria-hidden="true" />
                Về Memory check
              </Button>
            ) : learningStage !== "flashcard" && flashcards.length > 0 ? (
              <Button onClick={backToFlashcard} variant="outline">
                <ChevronLeft aria-hidden="true" />
                Về Từ vựng
              </Button>
            ) : null}
            {learningStage === "flashcard" &&
              canSkipToQuiz &&
              nextStageAfterFlashcards === "memory" && (
                <Button onClick={() => goToStage("memory")} variant="outline">
                  Tới Memory check
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            {learningStage !== "exercise" &&
              exercises.length > 0 &&
              (learningStage === "memory" ||
                (canSkipToQuiz && !exercisesLocked)) && (
                <Button onClick={skipToQuiz} variant="outline">
                  {exercisesLocked && <Lock aria-hidden="true" />}
                  Tới Bài tập
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
          </div>
        </div>

        <main
          ref={planeRef}
          className="min-w-0 scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8"
        >
          <div
            key={`${learningStage}:${exercisesLocked}`}
            className="min-h-64 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-[240ms]"
          >
            {renderStage()}
          </div>
        </main>

        <nav
          aria-label="Điều hướng bài học"
          className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-5"
        >
          {lessonNeighbors.previous ? (
            <Button asChild variant="ghost" size="lg" className="text-slate-700">
              <Link href={`/learn/${courseSlug}/${lessonNeighbors.previous.slug}`}>
                <ChevronLeft aria-hidden="true" />
                Bài trước
              </Link>
            </Button>
          ) : (
            <Button disabled variant="ghost" size="lg">
              <ChevronLeft aria-hidden="true" />
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
            <Button asChild variant="ghost" size="lg" className="text-slate-700">
              <Link href={`/learn/${courseSlug}/${lessonNeighbors.next.slug}`}>
                Bài sau
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button disabled variant="ghost" size="lg">
              Bài sau
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </nav>
      </div>
    </div>
  );
}
