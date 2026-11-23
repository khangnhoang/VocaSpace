"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Lock,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Rating } from "ts-fsrs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useCardReviewQueue,
  type CardReviewReply,
  type CardReviewRequest,
  type CardReviewSuccess,
} from "@/hooks/use-card-review-queue";
import { useCourseLearningSummary } from "@/hooks/use-course-learning-summary";
import type { Locale } from "@/lib/i18n/config";
import { formatCatalogCount } from "@/lib/i18n/format";
import { pickServerText, replyForField, useLatest, type RequestReply } from "@/lib/i18n/held-message";
import { asTranslate, type Translate } from "@/lib/i18n/translate";
import { resolveLessonNeighbors } from "@/lib/learn-navigation";
import { resolveLandingStage, resolveNextUnfinishedStage } from "@/lib/learning-landing";
import type {
  ExerciseDTO,
  FlashcardDTO,
  QuestionDTO,
  QuestionGroupDTO,
  QuestionOptionDTO,
} from "@/lib/schemas/learn";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";
import ChapterSidebar from "./ChapterSidebar";
import CourseStreakChip from "./CourseStreakChip";
import ExerciseContext from "./ExerciseContext";
import FlashcardStage from "./FlashcardStage";
import MemoryCheckStage from "./MemoryCheckStage";
import QuestionNavigator, { type QuestionNavigatorSection } from "./QuestionNavigator";
import type { AnswerAttempt, AttemptOutcome } from "./answer-attempt";
import QuestionResponse from "./QuestionResponse";
import StickyColumn from "./StickyColumn";
import TopicCompletionPanel from "./TopicCompletionPanel";
import { arrangeMaterial } from "./exercise-arrangement";
import { announceTopicProgress } from "./topic-progress-feedback";

type LearningStage = "flashcard" | "memory" | "exercise" | "complete";
// Vị trí của bước. "Đã xong" là thuộc tính riêng (LF3 AC8) để một bước vừa đang học vừa đã xong.
type StepState = "current" | "locked" | "upcoming";
type StageStep = { key: LearningStage; label: string; state: StepState; done: boolean };
// Cách một hàng đợi thẻ bắt đầu: lần học đầu của trang, ôn thẻ đến hạn, hay ôn lại toàn bộ từ vựng.
type QueueKind = "first" | "due" | "full";

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

/** Every exercise question id of the topic, standalone and grouped. */
function exerciseQuestionIds(exercises: ExerciseDTO[]) {
  return exercises.flatMap((exercise) =>
    exerciseSegments(exercise).flatMap((segment) => segment.questions.map((question) => question.id)),
  );
}

/** Tên truy cập của bước: "đã xong" đứng riêng, kể cả khi bước đang là bước hiện tại. */
function stepStateText(step: StageStep, t: Translate) {
  const state = t(`workspace.steps.${step.state}`);
  if (!step.done) return state;
  return step.state === "upcoming" ? t("workspace.steps.done") : t("workspace.steps.doneAnd", { state });
}

// Khung của một bước: dùng chung cho bước hiện tại (không điều khiển) và nút của các bước còn lại để bố cục không đổi.
const STEP_BODY_CLASS = "flex items-center gap-1.5 max-[360px]:gap-1 sm:gap-2";

// Mục tiêu bấm của bước: con trỏ tay và nền hover rõ hơn nền trang (Owner QA 2026-10-13); tối thiểu 24px; trên thiết bị cảm ứng vùng bấm cao 44px nhờ phần tử ảo trong suốt nên dòng không đổi bố cục.
const STEP_BUTTON_CLASS = `${STEP_BODY_CLASS} relative -mx-1 min-h-6 cursor-pointer rounded-md px-1 text-left transition-colors duration-[220ms] hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route motion-reduce:transition-none coarse-input:after:absolute coarse-input:after:inset-x-0 coarse-input:after:top-1/2 coarse-input:after:h-11 coarse-input:after:-translate-y-1/2`;

/**
 * Progress thread of the stages this topic really has. It reports state with words and icons. Every step except the
 * current one is a button that only calls `onSelect`; the workspace decides whether it opens the stage or, for a locked
 * step, explains the lock, so the thread cannot bypass a gate.
 */
function StageThread({
  steps,
  onSelect,
  lockReason,
}: {
  steps: StageStep[];
  onSelect: (step: StageStep) => void;
  lockReason: string | null;
}) {
  const t = asTranslate(useTranslations("learn"));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="relative">
        {/* Owner Q14: one line down to 320 px. The steps never wrap, so no connector can dangle at the start of a line;
            gaps, connectors and the label shrink on narrow widths instead. */}
        <ol
          aria-label={t("workspace.steps.label")}
          className="flex min-w-0 flex-nowrap items-center gap-x-1.5 max-[360px]:gap-x-1 sm:gap-x-2"
        >
          {steps.map((step, index) => {
            const body = (
              <>
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold max-[360px]:size-5 transition-colors duration-[220ms] motion-reduce:transition-none ${
                    step.state === "current"
                      ? "border-route bg-route text-white"
                      : step.state !== "locked" && step.done
                        ? "border-growth-line bg-growth-quiet text-growth"
                        : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  {/* Khóa thắng dấu xong (AC6): bước đã xong nhưng bị khóa lại vẫn hiện ổ khóa; "đã xong" nằm ở tên truy cập. */}
                  {step.state === "locked" ? (
                    <Lock className="size-3" />
                  ) : step.done ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span>
                  {step.label}
                  <span className="sr-only"> ({stepStateText(step, t)})</span>
                </span>
              </>
            );
            return (
              <li
                key={step.key}
                aria-current={step.state === "current" ? "step" : undefined}
                className={`flex shrink-0 items-center gap-1.5 text-[13px] max-[360px]:gap-1 max-[360px]:text-xs sm:gap-2 sm:text-sm transition-colors duration-[220ms] motion-reduce:transition-none ${
                  step.state === "current"
                    ? "font-bold text-slate-900"
                    : step.done
                      ? "font-semibold text-slate-700"
                      : "font-medium text-slate-600"
                }`}
              >
                {index > 0 && (
                  <span aria-hidden="true" className="h-px w-2 bg-slate-300 max-[360px]:w-1.5 sm:w-6" />
                )}
                {step.state === "current" ? (
                  <span className={STEP_BODY_CLASS}>{body}</span>
                ) : (
                  <button
                    type="button"
                    data-step-locked={step.state === "locked" ? "" : undefined}
                    className={STEP_BUTTON_CLASS}
                    onClick={() => onSelect(step)}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {/* Vùng thông báo luôn có mặt trong DOM để lời giải thích bước khóa được đọc khi xuất hiện. */}
      <div aria-live="polite">
        {lockReason && <p className="text-sm font-medium text-slate-700">{lockReason}</p>}
      </div>
      {/* Dòng gợi ý nằm dưới lý do khóa; `w-0 min-w-full` giữ độ rộng bằng cột của thanh để dòng tự xuống hàng và không đẩy
          cụm hành động bên phải hay làm tràn ngang ở 320px. Không có gì để chuyển khi chủ đề chỉ có một bước. */}
      {steps.length > 1 && (
        // LF6 AC4 (Owner QA 2026-10-13): một dòng gợi ý nhỏ dưới thanh tiến trình thay cho nút "Xem lại" của màn hình hoàn thành.
        <p data-thread-hint="" className="w-0 min-w-full text-xs leading-5 text-slate-500">
          {t("workspace.steps.hint")}
        </p>
      )}
    </div>
  );
}

// Owner Q14: the footer destinations are subordinate text beside a mouse or trackpad, but a touch-primary input needs a
// visible bordered 44px target (button.md), so the border and background come from the input capability, not the width.
const FOOTER_TOUCH_CLASS = "coarse-input:border-border coarse-input:bg-background";
const FOOTER_GHOST_CLASS = `text-slate-700 ${FOOTER_TOUCH_CLASS}`;
// The filled primary variants keep their action background; on touch input they replace the transparent border with a visible one.
const FOOTER_PRIMARY_CLASS = "coarse-input:border-action";

function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!ids.has(id)) return ids;
  const next = new Set(ids);
  next.delete(id);
  return next;
}

// Dấu "memory check vừa khóa lại vì có thẻ mới" mang qua lần remount do `router.refresh()` (state component mất khi key đổi).
// Biến module (không phải sessionStorage hay URL): cùng một tab, không cần quyền truy cập trình duyệt, không đổi URL;
// F5 xóa nó cùng với toàn bộ trang nên không bao giờ báo nhầm sau khi tải lại trang.
const relockedTopicIds = new Set<string>();

export default function LearningWorkspace({
  data,
  learningSummary,
}: {
  data: LearningWorkspaceData;
  // FEAT3 AC7: chuỗi ngày học của khóa lúc tải trang; vắng mặt thì header không hiện chip.
  learningSummary?: CourseLearningSummaryResult;
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
  const router = useRouter();
  const t = asTranslate(useTranslations("learn"));
  const learningText = asTranslate(useTranslations("learning"));
  const locale: Locale = useLocale() === "en" ? "en" : "vi";
  const count = (value: number) => formatCatalogCount(locale, value);
  // Toast phát từ callback async (kết quả của lần gửi đáp án, lần lưu thẻ) phải dùng ngôn ngữ LÚC phát, không phải lúc gửi (U3 H4).
  const latestT = useLatest(t);
  const latestLocale = useLatest(locale);
  // Cảnh báo tiến độ của câu trả lời đã lưu: các màn hình câu hỏi có thể đã unmount khi phản hồi về, nên workspace dịch bằng ngôn ngữ LÚC phát.
  const resolveProgressNotice = (text: string, reply: RequestReply) =>
    pickServerText(text, reply, latestLocale.current, latestT.current, "actions.progress.progressSync", "learn");
  // LF6: ghi chú thông báo khóa của thanh tiến trình lấy từ cùng nguồn chữ với màn hình khóa.
  const memoryCardsLockReason = t("workspace.lock.memoryCards");
  const memoryLockReason = t("workspace.lock.exercises");
  const { summary: courseSummary, noteLearningAction } = useCourseLearningSummary(data.courseId, learningSummary);
  const initialClearedMemoryCards = new Set(data.memoryGateClearedCardIds ?? []);
  const initialPendingMemoryCards = memoryCheck
    ? flashcards.filter((card) => !initialClearedMemoryCards.has(card.id)).map((card) => card.id)
    : [];
  // LF5 AC1/AC2: vào chủ đề ở bước đầu tiên còn phải làm (thứ tự: thẻ -> memory check -> bài tập), hoặc ở màn hình hoàn thành
  // khi chủ đề đã hoàn thành. Chỉ dùng dữ liệu server đã có (G1).
  const initialStage: LearningStage = resolveLandingStage({
    flashcardCount: flashcards.length,
    hasUnseenCard: data.unseenCardIds.length > 0,
    hasPendingMemoryCards: initialPendingMemoryCards.length > 0,
    isFlashcardCompleted: progress?.isFlashcardCompleted ?? false,
    hasMemoryCheck: memoryCheck !== null,
    isMemoryCheckPassed,
    exerciseCount: exercises.length,
    remainingExerciseQuestions: exerciseQuestionIds(exercises).filter((id) => !answers[id]).length,
    isTopicCompleted: progress?.isTopicCompleted ?? false,
  });

  const [learningStage, setLearningStage] =
    useState<LearningStage>(initialStage);
  // LF4 AC3: báo số thẻ chưa học đúng một lần lúc tải trang (cả khi remount do key đổi sau `cards_locked`), và không báo
  // khi mọi thẻ đều chưa xem (lần đầu). Ref chặn hiệu ứng chạy hai lần của StrictMode ở môi trường dev.
  // Sau `cards_locked` chỉ báo MỘT toast "vừa có thêm N thẻ mới" (N chỉ biết sau khi tải lại) và bỏ toast số thẻ chưa học
  // thường lệ ở lần remount đó; dấu hiệu được tiêu thụ đúng một lần, nên F5 hay lần vào sau vẫn báo như thường.
  const unseenNoticeShown = useRef(false);
  useEffect(() => {
    if (unseenNoticeShown.current) return;
    unseenNoticeShown.current = true;
    const unseenCount = data.unseenCardIds.length;
    const relocked = relockedTopicIds.delete(currentTopic.id);
    if (relocked && unseenCount > 0) {
      toast.info(t("workspace.toast.newCards", { count: unseenCount, shown: count(unseenCount) }));
    } else if (unseenCount > 0 && unseenCount < flashcards.length) {
      toast.info(t("workspace.toast.unseen", { count: unseenCount, shown: count(unseenCount) }));
    }
    // Chỉ chạy một lần lúc mount (ref chặn); `t`/`count` đổi theo ngôn ngữ không được báo lại.
  }, [currentTopic.id, data.unseenCardIds.length, flashcards.length, t, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const [memoryPassed, setMemoryPassed] = useState(isMemoryCheckPassed);
  // Sticky on the server (G4), so it only ever turns on.
  const [isTopicCompleted, setIsTopicCompleted] = useState(
    progress?.isTopicCompleted ?? false,
  );
  // LF5 AC4: kết quả ghi trong phiên báo chủ đề vừa hoàn thành (`newlyCompleted`) thì giữ lại đến khi màn hình hoàn thành hiện lần đầu.
  // Ref để callback async đọc đúng giá trị vừa đặt; state để render nút hành động của câu hỏi cuối.
  const [pendingCompletion, setPendingCompletionState] = useState(false);
  const pendingCompletionRef = useRef(false);
  const setPendingCompletion = (value: boolean) => {
    pendingCompletionRef.current = value;
    setPendingCompletionState(value);
  };
  // `animate`: chuỗi chuyển động chỉ chạy cho lần hiện đầu của một lần hoàn thành vừa xảy ra; `focus`: chỉ khi vào bằng thao tác.
  const [completionEntry, setCompletionEntry] = useState({ animate: false, focus: false });
  // Owner QA FEAT12 (Decision 41): câu vừa được trả lời đúng trong phiên này và là câu cuối cùng còn mở của một chủ đề đã hoàn thành.
  // Chỉ câu đó mới đổi nút kết thúc thành "Hoàn thành"; đổi bước hay nhảy sang câu khác thì xóa, nên các câu khác giữ nút như cũ.
  const [closedLastOpenId, setClosedLastOpenId] = useState<string | null>(null);
  // Bản sao ref của cờ trên: callback async cuối hàng đợi thẻ đọc cờ tại thời điểm hết hàng, không phải lúc bắt đầu chấm (LF6 AC10).
  const topicCompletedRef = useRef(progress?.isTopicCompleted ?? false);
  const markTopicCompleted = (newlyCompleted: boolean) => {
    topicCompletedRef.current = true;
    setIsTopicCompleted(true);
    if (newlyCompleted) setPendingCompletion(true);
  };
  // Quyền đi tiếp (nút "Tới ..."): chỉ bật lên, không bao giờ tắt, như trước LF1.
  const [canSkipToQuiz, setCanSkipToQuiz] = useState(
    progress?.isFlashcardCompleted ?? false,
  );
  // Chỉ để hiển thị bước "Từ vựng" đã xong trên StageThread. Server quyết định theo lần chấm
  // gần nhất của mọi thẻ nên một lần Lại/Khó sau đó tắt nó đi (LF1 AC3); không điều khiển điều hướng.
  const [flashcardStageDone, setFlashcardStageDone] = useState(
    progress?.isFlashcardCompleted ?? false,
  );
  // Tập thẻ có lần chấm gần nhất chưa Ổn/Dễ chỉ đổi theo kết quả đã lưu.
  const [unratedCardIds, setUnratedCardIds] = useState<ReadonlySet<string>>(
    () => new Set(data.unratedCardIds),
  );
  const unratedCardsRef = useRef(new Set(data.unratedCardIds));
  const clearedMemoryCardsRef = useRef(initialClearedMemoryCards);
  const memoryGateOpenedRef = useRef(data.memoryGateClearedCardIds !== null);
  const [pendingMemoryCardIds, setPendingMemoryCardIds] = useState<ReadonlySet<string>>(
    () => new Set(initialPendingMemoryCards),
  );
  const [queueProgressUnavailable, setQueueProgressUnavailable] = useState(false);
  // LF4: thẻ đã xem nhưng đến hạn FSRS hoặc chưa Ổn/Dễ, từ server lúc tải; Ổn/Dễ trong phiên đưa thẻ ra khỏi tập,
  // Lại/Khó đưa vào. Chỉ phục vụ lời mời "Ôn ngay" ở màn hình kết thúc, không điều khiển cổng nào.
  const [dueCardIds, setDueCardIds] = useState<ReadonlySet<string>>(
    () => new Set(data.dueCardIds),
  );
  const [userAnswers, setUserAnswers] =
    useState<Record<string, string>>(answers);
  // LF5 AC9: giải thích memory check chỉ của câu mà đáp án đã lưu đang đúng: giá trị từ loader, cộng giải thích của câu đúng
  // trong phiên này; câu trả lời sai sau đó bỏ mục của câu đó.
  const [memoryExplanations, setMemoryExplanations] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (memoryCheck?.questions ?? [])
        .filter((question) => question.explanation && answers[question.id])
        .map((question) => [question.id, question.explanation as string]),
    ),
  );
  const keepMemoryExplanation = (questionId: string, explanation?: string) =>
    setMemoryExplanations((current) => {
      if (explanation) return { ...current, [questionId]: explanation };
      if (!(questionId in current)) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  // Questions answered wrongly in this session and not yet answered right; only the
  // review list reads it, the server never stores a wrong attempt.
  const [incorrectIds, setIncorrectIds] = useState<Record<string, true>>({});
  // Submissions by question, kept here so leaving a question or stage while its answer
  // is in flight neither allows a second submit nor loses the result that lands later.
  const [attempts, setAttempts] = useState<Record<string, AnswerAttempt>>({});
  const startAttempt = (questionId: string, optionId: string) =>
    setAttempts((current) => ({ ...current, [questionId]: { status: "pending", optionId } }));
  const settleAttempt = (questionId: string, optionId: string, outcome: AttemptOutcome) => {
    // Câu trả lời đã được server lưu (đúng hoặc sai) là một hành động học: làm mới chuỗi ngày học của header (AC7).
    if (outcome.kind !== "error") noteLearningAction();
    setAttempts((current) => ({
      ...current,
      [questionId]: { status: "settled", optionId, outcome },
    }));
  };
  const clearAttempt = (questionId: string) =>
    setAttempts((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  const [expandedChapter, setExpandedChapter] = useState(
    currentTopic.chapterId,
  );
  // Xếp thẻ chưa xem và thẻ chưa đạt cổng theo thứ tự soạn; thẻ đã đạt không bị bắt học lại chỉ vì Lại/Khó.
  const [learningQueue, setLearningQueue] = useState<FlashcardDTO[]>(() => {
    const unseen = new Set(data.unseenCardIds);
    return flashcards.filter((card) => unseen.has(card.id)
      || (initialPendingMemoryCards.includes(card.id) && data.unratedCardIds.includes(card.id)));
  });
  // Số thẻ của lượt ôn hiện tại: bộ đếm "còn X / Y" và thanh tiến độ tính theo lượt, không theo cả bài.
  const [queueTotal, setQueueTotal] = useState(learningQueue.length);
  const [isFlipped, setIsFlipped] = useState(false);
  // LF8: bản sao ref của hàng đợi để mọi lần chấm và lần xếp lại đọc/ghi đúng hàng đợi mới nhất, kể cả khi nhiều lần chấm chồng nhau (G2).
  const queueRef = useRef(learningQueue);
  const updateQueue = (next: FlashcardDTO[]) => {
    queueRef.current = next;
    setLearningQueue(next);
  };
  // LF8 G4: thế hệ của hàng đợi, đổi mỗi khi `startQueue` thay hàng đợi; lần lưu lỗi của thế hệ cũ không được chèn thẻ vào hàng đợi mới.
  const queueGenerationRef = useRef(0);
  // LF8 AC5: hết hàng đợi chỉ "lên cò" khi một lần chấm làm rỗng hàng đợi của thế hệ hiện tại (không lên cò lúc tải với hàng đợi rỗng, LF4).
  // Ref để callback async đọc đúng; state để hiện trạng thái đang lưu (vùng thông báo lịch sự) thay cho màn hình kết thúc; đây là chỗ duy nhất báo đang lưu (AC5b).
  const armedGenerationRef = useRef<number | null>(null);
  const [queueEndArmed, setQueueEndArmed] = useState(false);
  const setArmedGeneration = (generation: number | null) => {
    armedGenerationRef.current = generation;
    setQueueEndArmed(generation !== null);
  };
  // Số lần chấm đang chờ theo thẻ: lần lưu lỗi chỉ xếp lại thẻ khi không còn lần chấm sau của chính thẻ đó đang chờ.
  const pendingByCardRef = useRef(new Map<string, number>());
  // Snapshot của lần lưu cuối: hết hàng đợi không được dùng closure cũ để quyết định phần còn thiếu.
  const lastSavedRef = useRef<{ generation: number; progress: CardReviewSuccess["topicProgress"] } | null>(null);
  // Phản hồi (ngôn ngữ + khóa thông báo) của lần lưu vừa xong, để dịch lại `progressError` khi trang đang hiện ngôn ngữ khác.
  const lastReplyRef = useRef<CardReviewReply | null>(null);
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
  // LF6 AC10: cách hàng đợi hiện tại bắt đầu quyết định thông báo và nơi quay về khi hết thẻ. Chỉ `startQueue` đổi nó
  // (không đổi khi Lại/Khó xếp lại thẻ, lưu lỗi hay đổi bước). Hàng đợi lúc vào trang là lần học đầu.
  const [queueKind, setQueueKind] = useState<QueueKind>("first");
  // LF6 AC2: bước bị khóa vừa được bấm; lời giải thích chỉ hiện khi khóa đó vẫn còn và học viên chưa đổi bước.
  const [lockNotice, setLockNotice] = useState<"memory" | "exercise" | null>(null);
  // LF6 AC1: yêu cầu đưa focus về khung bước học sau khi bước mới đã dựng xong.
  const [planeFocusRequest, setPlaneFocusRequest] = useState(0);

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
  const memoryCardsLocked = memoryCheck !== null && pendingMemoryCardIds.size > 0;
  const nextStageAfterFlashcards: LearningStage | null =
    memoryCheck && !memoryPassed
      ? "memory"
      : exerciseQuestionIds(exercises).some((id) => !userAnswers[id])
        ? "exercise"
        : null;

  // Mọi lần đổi bước đi qua đây để lời giải thích bước khóa luôn tắt khi bước đổi.
  const changeStage = (stage: LearningStage) => {
    setLockNotice(null);
    setClosedLastOpenId(null);
    setLearningStage(stage);
  };

  const goToStage = (stage: LearningStage) => {
    changeStage(stage);
  };

  // Vào màn hình hoàn thành: dùng và xóa dấu "vừa hoàn thành", nên lần vào sau trong phiên chỉ hiện màn hình đã ổn định (AC8).
  const goToComplete = () => {
    setCompletionEntry({ animate: pendingCompletionRef.current, focus: true });
    setPendingCompletion(false);
    changeStage("complete");
  };

  const skipToQuiz = () => goToStage("exercise");

  const backToFlashcard = () => goToStage("flashcard");

  const returnToMemoryCheck = () => {
    setMemoryPassed(false);
    goToStage("memory");
    toast.error(latestT.current("workspace.lock.exercises"));
  };

  // `cards_locked` từ server: dữ liệu thẻ của trang đã cũ (thẻ mới thêm sau khi tải). Về bước từ vựng và xin server
  // tải lại; trang đổi `key` theo dữ liệu mới nên workspace dựng lại state, hàng đợi thẻ có thẻ mới.
  const recoverFromCardsRequired = () => {
    // Không toast lỗi: toast thông tin duy nhất do lần remount sau khi tải lại phát (cần số thẻ mới).
    relockedTopicIds.add(currentTopic.id);
    goToStage("flashcard");
    // LF8 AC6: chờ các lần chấm đang lưu xong rồi mới tải lại, để lần remount không làm rơi lần chấm hay đưa lại thẻ đang lưu dở.
    whenSavesDrained(() => router.refresh());
  };

  const startQueue = (cards: FlashcardDTO[], kind: QueueKind) => {
    queueGenerationRef.current += 1;
    setArmedGeneration(null);
    setQueueProgressUnavailable(false);
    updateQueue(cards);
    setQueueTotal(cards.length);
    setQueueKind(kind);
    setIsFlipped(false);
  };

  const restartFlashcards = () => startQueue(flashcards, "full");

  // Thứ tự soạn của `flashcards` giữ nguyên; id lạ trong `dueCardIds` (không phải thẻ active) bị bỏ qua.
  const dueCards = flashcards.filter((card) => dueCardIds.has(card.id));
  const reviewDueCards = () => startQueue(dueCards, "due");

  // LF8: chấm thẻ chỉ đổi thứ tự hàng đợi ngay; mọi giá trị suy ra từ server chỉ đổi khi lần lưu của chính lần chấm đó thành công.
  const handleRateCard = (rating: Rating) => {
    const currentCard = queueRef.current[0];
    if (!currentCard) return;
    const generation = queueGenerationRef.current;

    pendingByCardRef.current.set(currentCard.id, (pendingByCardRef.current.get(currentCard.id) ?? 0) + 1);
    const nextQueue = queueRef.current.slice(1);
    if (rating === Rating.Again || rating === Rating.Hard) nextQueue.push(currentCard);
    updateQueue(nextQueue);
    setIsFlipped(false);
    enqueueSave({ cardId: currentCard.id, rating, generation });

    if (nextQueue.length === 0) {
      setArmedGeneration(generation);
      whenSavesDrained(() => runQueueEndRef.current(generation));
    }
  };

  const settlePendingCard = (cardId: string) => {
    const left = (pendingByCardRef.current.get(cardId) ?? 1) - 1;
    if (left > 0) pendingByCardRef.current.set(cardId, left);
    else pendingByCardRef.current.delete(cardId);
    return left;
  };

  const handleCardSaved = (request: CardReviewRequest, result: CardReviewSuccess) => {
    settlePendingCard(request.cardId);
    noteLearningAction();
    // `onReply` chạy ngay trước `onSaved` của cùng lần lưu nên `lastReplyRef` là phản hồi của đúng lần lưu này.
    const reply = lastReplyRef.current;
    const progressError = result.progressError
      ? reply
        ? pickServerText(result.progressError, replyForField(reply, "progressError"), locale, t, "actions.review.progressSync", "learn")
        : t("actions.review.progressSync")
      : undefined;
    announceTopicProgress(result, markTopicCompleted, progressError);
    // Lần chấm đã ghi: thẻ này đã xem; Ổn/Dễ thì xong, Lại/Khó thì chưa (lần chấm gần nhất quyết định, như server).
    const passed = request.rating === Rating.Good || request.rating === Rating.Easy;
    const nextUnrated = new Set(unratedCardsRef.current);
    if (passed) nextUnrated.delete(request.cardId);
    else nextUnrated.add(request.cardId);
    unratedCardsRef.current = nextUnrated;
    // Mở lần đầu cần snapshot server: cache có thể đã cũ vì lần chấm ở phiên khác.
    // Nếu sync lỗi, capture vẫn bền trong DB nhưng UI phải tải lại để xác nhận.
    if (!memoryGateOpenedRef.current && result.topicProgress?.isFlashcardCompleted === true) {
      memoryGateOpenedRef.current = true;
      clearedMemoryCardsRef.current = new Set(flashcards.map((card) => card.id));
    } else if (memoryGateOpenedRef.current && passed) {
      clearedMemoryCardsRef.current.add(request.cardId);
    }
    setPendingMemoryCardIds(new Set(flashcards.filter((card) => !clearedMemoryCardsRef.current.has(card.id)).map((card) => card.id)));
    setUnratedCardIds(nextUnrated);
    setDueCardIds((current) =>
      passed ? withoutId(current, request.cardId) : new Set(current).add(request.cardId),
    );
    if (result.topicProgress?.isFlashcardCompleted) setCanSkipToQuiz(true);
    // Kết quả server thắng theo cả hai chiều chỉ với dấu "đã xong" của StageThread.
    if (result.topicProgress) setFlashcardStageDone(result.topicProgress.isFlashcardCompleted);
    lastSavedRef.current = { generation: request.generation, progress: result.topicProgress };
  };

  // Lưu lỗi sau một lần thử lại: không đổi giá trị suy ra từ server. Thẻ quay lại cuối hàng đợi hiện tại (trừ khi đã nằm trong đó
  // hoặc lần chấm sau của chính thẻ còn đang chờ), và hàng đợi không còn rỗng nên cuối hàng đợi hết "lên cò" (G4, AC4).
  const handleCardSaveFailed = (request: CardReviewRequest) => {
    const card = flashcards.find((candidate) => candidate.id === request.cardId);
    const later = settlePendingCard(request.cardId);
    const word = card?.front_content?.word ?? "";
    const base = t("review.saveFailed", { word });
    if (!card || request.generation !== queueGenerationRef.current) {
      toast.error(base);
      return;
    }
    const queued = queueRef.current.some((candidate) => candidate.id === card.id);
    if (!queued && later > 0) {
      toast.error(base);
      return;
    }
    if (!queued) updateQueue([...queueRef.current, card]);
    setArmedGeneration(null);
    toast.error(t("review.saveFailedRequeued", { word }));
  };

  const { enqueue: enqueueSave, whenDrained: whenSavesDrained } =
    useCardReviewQueue({
      onSaved: handleCardSaved,
      onFailed: handleCardSaveFailed,
      onReply: (_request, reply) => {
        lastReplyRef.current = reply;
      },
    });

  // Đặt trước `runQueueEnd`: các lần tự vào bước bài tập (cuối hàng đợi thẻ, xong memory check) cũng mở câu đầu tiên chưa đúng.
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

  // Lần tự vào bước bài tập đã xin focus cho khung bước (planeFocusRequest) thì không xin thêm focus tiêu đề câu hỏi:
  // hai yêu cầu trong cùng lần commit tranh nhau, và StrictMode chạy lại effect của câu vừa mount sau effect của khung.
  const goToFirstRemainingQuestion = (focusQuestion = true) => {
    const [first] = remainingQuestions;
    if (!first) return;
    setEntry({ direction: "next", focus: focusQuestion });
    setCurrentExerciseIndex(first.exerciseIndex);
    setCurrentGroupIndex(first.groupIndex);
    setCurrentQuestionIndex(first.questionIndex);
  };

  // Quyết định cuối hàng đợi chạy một lần sau khi lưu xong, ưu tiên snapshot server vừa nhận thay vì closure trước render.
  const runQueueEnd = (generation: number) => {
    if (armedGenerationRef.current !== generation) return;
    setArmedGeneration(null);
    setCanSkipToQuiz(true);
    const lastSaved = lastSavedRef.current;
    const savedProgress = lastSaved?.generation === generation ? lastSaved.progress : undefined;
    if (savedProgress) setMemoryPassed(savedProgress.isMemoryCheckPassed);
    if (memoryCheck && flashcards.some((card) => !clearedMemoryCardsRef.current.has(card.id))) {
      setQueueProgressUnavailable(true);
      goToStage("flashcard");
      setPlaneFocusRequest((current) => current + 1);
      return;
    }
    const knownRemaining = exerciseQuestionIds(exercises).filter((id) => !userAnswers[id]).length;
    if (savedProgress?.isExerciseCompleted === false && knownRemaining === 0
      && (!memoryCheck || savedProgress.isMemoryCheckPassed)) {
      setQueueProgressUnavailable(true);
      goToStage("flashcard");
      setPlaneFocusRequest((current) => current + 1);
      return;
    }
    const next = resolveNextUnfinishedStage({
      hasMemoryCheck: memoryCheck !== null,
      isMemoryCheckPassed: savedProgress?.isMemoryCheckPassed ?? memoryPassed,
      remainingExerciseQuestions: savedProgress?.isExerciseCompleted === true ? 0
        : savedProgress?.isExerciseCompleted === false && exerciseQuestionIds(exercises).length > 0
          ? Math.max(knownRemaining, 1) : knownRemaining,
      isTopicCompleted: topicCompletedRef.current || pendingCompletionRef.current,
    });
    if (next === "complete") {
      if (queueKind !== "first" && !pendingCompletionRef.current) {
        toast.success(t(queueKind === "due" ? "workspace.toast.dueDone" : "workspace.toast.fullDone"));
      }
      goToComplete();
    } else if (next === "memory") {
      goToStage("memory");
      setPlaneFocusRequest((current) => current + 1);
      toast.success(t(queueKind === "first" ? "workspace.toast.firstToMemory"
        : queueKind === "due" ? "workspace.toast.dueDone" : "workspace.toast.fullDone"));
    } else if (next === "exercise") {
      // Owner QA FEAT12: vào bài tập sau khi xong bước trước thì mở câu đầu tiên chưa đúng, không phải câu 1.
      goToFirstRemainingQuestion(false);
      goToStage("exercise");
      setPlaneFocusRequest((current) => current + 1);
      toast.success(t(queueKind === "first" ? "workspace.toast.firstToExercise"
        : queueKind === "due" ? "workspace.toast.dueDone" : "workspace.toast.fullDone"));
    } else {
      setQueueProgressUnavailable(true);
    }
  };
  // Callback của hàng đợi lưu chạy sau render hiện tại nên phải gọi bản mới nhất của hàm trên, không phải bản của lúc chấm.
  const runQueueEndRef = useRef(runQueueEnd);
  useEffect(() => {
    runQueueEndRef.current = runQueueEnd;
  });

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

  // FEAT12 G1: số câu còn lại của hộp "Bài học vừa được cập nhật" lấy từ cùng `userAnswers` với dấu tích bước và danh sách câu hỏi.
  const memoryRemainingCount = (memoryCheck?.questions ?? []).filter(
    (question) => !userAnswers[question.id],
  ).length;

  // FEAT12 G3: đích của "Làm ngay" đi theo các cổng (thẻ chờ, rồi memory check, rồi bài tập), không theo số đếm,
  // nên không bao giờ mở bước đang khóa; việc chuyển bước và định vị câu dùng lại đúng các hàm hiện có.
  const startCatchUp = () => {
    if (memoryCardsLocked) {
      goToStage("flashcard");
    } else if (exercisesLocked) {
      // Câu memory đã đúng mà học viên chưa bấm "Câu tiếp theo" sẽ hiện lại phản hồi khi vào bước; bỏ riêng kết quả đã chốt đúng đó
      // để vào thẳng câu chưa đúng. Lần gửi đang chạy và lần lưu lỗi vẫn được giữ.
      memoryCheck?.questions.forEach((question) => {
        const attempt = attempts[question.id];
        if (userAnswers[question.id] && attempt?.status === "settled" && attempt.outcome.kind === "correct") {
          clearAttempt(question.id);
        }
      });
      goToStage("memory");
    } else {
      goToFirstRemainingQuestion();
      goToStage("exercise");
    }
    setPlaneFocusRequest((current) => current + 1);
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
    setClosedLastOpenId(null);
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

  // Focus về khung bước học chạy trong effect của component cha: effect con (ví dụ nút "Tiếp tục" của memory check hay tiêu đề
  // câu hỏi) đã chạy trước trong cùng lần commit, nên focus của luồng chuyển bước bằng thanh tiến trình là focus cuối cùng.
  useEffect(() => {
    if (planeFocusRequest === 0) return;
    const plane = planeRef.current;
    if (!plane) return;
    plane.focus({ preventScroll: true });
    // Chỉ cuộn khi đỉnh khung nằm trên khung nhìn, như khi đổi nhóm câu hỏi.
    if (plane.getBoundingClientRect().top < 0) plane.scrollIntoView?.({ block: "start" });
  }, [planeFocusRequest]);

  const exerciseQuestionCount = exerciseQuestionPositions.length;
  // Bước "Từ vựng" chỉ hiện đã xong khi server báo xong và không còn thẻ nào chưa Ổn/Dễ (LF3 AC6/AC8).
  const flashcardStepDone = flashcardStageDone && unratedCardIds.size === 0;
  const exercisesDone = exerciseQuestionCount > 0 && remainingQuestions.length === 0;
  const stageSteps: StageStep[] = [];
  if (flashcards.length > 0) {
    stageSteps.push({
      key: "flashcard",
      label: t("workspace.steps.flashcard"),
      state: learningStage === "flashcard" ? "current" : "upcoming",
      done: flashcardStepDone,
    });
  }
  if (memoryCheck) {
    stageSteps.push({
      key: "memory",
      label: t("workspace.steps.memory"),
      state: memoryCardsLocked ? "locked" : learningStage === "memory" ? "current" : "upcoming",
      done: memoryPassed,
    });
  }
  if (exercises.length > 0) {
    stageSteps.push({
      key: "exercise",
      label: t("workspace.steps.exercise"),
      state: exercisesLocked ? "locked" : learningStage === "exercise" ? "current" : "upcoming",
      done: !exercisesLocked && exercisesDone,
    });
  }
  // LF6 G1: thanh tiến trình chỉ gọi `goToStage`, hàm mà chân trang đã dùng để đổi bước, và không bao giờ dựng hàng đợi thẻ
  // (kể cả bước Từ vựng: hàng đợi hiện có, rỗng thì là màn hình kết thúc). Bước khóa không đổi bước, chỉ nói lý do.
  const selectStep = (step: StageStep) => {
    if (step.state === "locked") {
      setLockNotice(step.key === "memory" ? "memory" : "exercise");
      return;
    }
    goToStage(step.key);
    setPlaneFocusRequest((current) => current + 1);
  };
  const lockReason =
    lockNotice === "memory" && memoryCardsLocked
      ? memoryCardsLockReason
      : lockNotice === "exercise" && exercisesLocked
        ? memoryLockReason
        : null;

  const arrangement =
    currentExercise && currentGroup
      ? arrangeMaterial(currentExercise.part_type, currentGroup, currentGroup.isStandalone)
      : null;
  const hasMaterial =
    arrangement !== null && (arrangement.kinds.length > 0 || arrangement.missing.length > 0);
  const isSplit = hasMaterial && arrangement.layout === "split";
  const chapterTitle = syllabus.find((chapter) => chapter.id === currentTopic.chapterId)?.title;

  // LF5 AC3/G3: giá trị của màn hình hoàn thành lấy từ cùng `completedTopicIds` với thanh bên, gồm cả hoàn thành trong phiên.
  const chapterIndex = syllabus.findIndex((chapter) => chapter.id === currentTopic.chapterId);
  const currentChapter = syllabus[chapterIndex];
  const chapterTopics = currentChapter?.topics ?? [];
  const chapterCompletedCount = chapterTopics.filter((topic) => completedTopicIds.has(topic.id)).length;
  // Chuỗi chuyển động bắt đầu từ giá trị trước khi chủ đề này hoàn thành (nó chưa được tính).
  const countBefore = completionEntry.animate && isTopicCompleted ? 1 : 0;
  const nextTopic = lessonNeighbors.next;
  const nextTopicChapterIndex = nextTopic
    ? syllabus.findIndex((chapter) => chapter.id === nextTopic.chapterId)
    : -1;
  const completionNext =
    nextTopic && nextTopicChapterIndex >= 0
      ? nextTopic.chapterId === currentTopic.chapterId
        ? {
            kind: "topic" as const,
            href: `/learn/${courseSlug}/${nextTopic.slug}`,
            unitLabel: t("workspace.completion.topicLabel", {
              number: chapterTopics.findIndex((topic) => topic.id === nextTopic.id) + 1,
              title: nextTopic.title,
            }),
            detail: null,
          }
        : {
            kind: "topic" as const,
            href: `/learn/${courseSlug}/${nextTopic.slug}`,
            unitLabel: t("workspace.completion.chapterLabel", {
              number: nextTopicChapterIndex + 1,
              title: syllabus[nextTopicChapterIndex].title,
            }),
            detail: t("workspace.completion.topicLabel", { number: 1, title: nextTopic.title }),
          }
      : { kind: "overview" as const, href: `/learn/${courseSlug}` };
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
          label: segment.isStandalone
            ? undefined
            : t("workspace.navigator.group", { number: passageNumber, total: passageTotal }),
          items: segment.questions
            .slice()
            .sort(byOrderIndex)
            .map((question) => ({
              id: question.id,
              number: questionNumbers.get(question.id) ?? 0,
              text: question.content.trim() || t("workspace.navigator.fallbackText"),
              status: userAnswers[question.id]
                ? ("correct" as const)
                : incorrectIds[question.id]
                  ? ("incorrect" as const)
                  : ("unanswered" as const),
              current: question.id === currentQuestion?.id,
              disabledReason: exercisesLocked ? memoryLockReason : undefined,
            })),
        };
      }),
    };
  });
  const questionNavigator = (
    <QuestionNavigator sections={navigatorSections} onSelect={jumpToQuestion} t={learningText} />
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

  const closesLastOpen = closedLastOpenId !== null && closedLastOpenId === currentQuestion?.id && remainingQuestions.length === 0;

  const renderExercise = () => {
    if (!currentExercise || !currentGroup || !currentQuestion || !arrangement) {
      return (
        <p className="text-center text-slate-600">
          {t("workspace.stage.noQuestions")}
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
                t={learningText}
              />
              {isSplit && (
                // Stacked layouts put the question below a long passage; wide ones keep it beside.
                <div className="mt-3 flex justify-end lg:hidden">
                  <Button type="button" variant="link" size="lg" className="px-2" onClick={scrollToQuestion}>
                    {t("workspace.stage.jumpToQuestion")}
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </div>
              )}
            </StickyColumn>
          )}
          <StickyColumn enabled={isSplit} className="min-w-0">
            <QuestionResponse
              key={currentQuestion.id}
              resolveProgressNotice={resolveProgressNotice}
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
              // An answer that just completed the topic ends here even mid-list: its action is "Hoàn thành", not "Câu tiếp theo".
              hasNext={hasNextQuestion && !pendingCompletion && !closesLastOpen}
              endAction={
                pendingCompletion
                  ? { label: t("workspace.end.complete"), onClick: goToComplete }
                  : remainingQuestions.length > 0
                  ? { label: t("workspace.end.remaining"), onClick: () => goToFirstRemainingQuestion() }
                  : isTopicCompleted
                  ? { label: t("workspace.end.complete"), onClick: goToComplete }
                  : lessonNeighbors.next
                    ? {
                        label: t("workspace.end.nextLesson"),
                        href: `/learn/${courseSlug}/${lessonNeighbors.next.slug}`,
                      }
                    : { label: t("workspace.nav.overview"), href: `/learn/${courseSlug}` }
              }
              onNext={handleNextQuestion}
              onCorrectAnswer={(questionId, optionId) => {
                // Giá trị ở closure là của lúc gửi đáp án: chỉ khi câu này là câu mở duy nhất của chủ đề đã hoàn thành từ trước.
                if (isTopicCompleted && !pendingCompletion && remainingQuestions.length === 1 && remainingQuestions[0].questionId === questionId) {
                  setClosedLastOpenId(questionId);
                }
                setUserAnswers((current) => ({
                  ...current,
                  [questionId]: optionId,
                }));
              }}
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
    // LF5 AC2/AC3: a completed topic stays completed when its active content was removed, so the completion screen wins.
    if (learningStage !== "complete" && flashcards.length === 0 && exercises.length === 0 && !memoryCheck) {
      return (
        <div className="text-center text-slate-600" role="status">
          <h2 className="mb-2 text-2xl font-bold">{t("workspace.stage.noContent")}</h2>
        </div>
      );
    }
    if (learningStage === "complete") {
      return (
        <TopicCompletionPanel
          topicTitle={currentTopic.title}
          course={{
            completed: completedTopicIds.size,
            total: flatLessons.length,
            previous: completedTopicIds.size - countBefore,
          }}
          chapter={{
            title: currentChapter
              ? t("workspace.completion.chapterLabel", { number: chapterIndex + 1, title: currentChapter.title })
              : t("workspace.completion.chapterFallback"),
            completed: chapterCompletedCount,
            total: chapterTopics.length,
            previous: chapterCompletedCount - countBefore,
          }}
          nextHint={
            completionNext.kind === "topic"
              ? completionNext.detail
                ? t("workspace.completion.nextHintDetail", { unit: completionNext.unitLabel, detail: completionNext.detail })
                : completionNext.unitLabel
              : t("workspace.completion.nextHintOverview")
          }
          animate={completionEntry.animate}
          focusOnEntry={completionEntry.focus}
          dueCount={dueCards.length}
          onReviewDue={() => {
            reviewDueCards();
            goToStage("flashcard");
          }}
          // FEAT12 AC7: khi đã biết tiến độ local chưa được xác nhận thì không hiện hộp; màn hình tải lại đã lo trạng thái đó.
          catchUp={
            queueProgressUnavailable
              ? undefined
              : {
                  memoryCount: memoryRemainingCount,
                  exerciseCount: remainingQuestions.length,
                  onStart: startCatchUp,
                }
          }
          next={completionNext}
        />
      );
    }
    if (learningStage === "memory" && memoryCheck && memoryCardsLocked) {
      return (
        <section
          role="status"
          className="mx-auto flex max-w-md flex-col items-center gap-4 text-center"
        >
          <Lock aria-hidden="true" className="size-10 text-attention" />
          <h2 className="text-xl font-bold text-slate-900">{t("workspace.stage.memoryLockedTitle")}</h2>
          <p className="text-slate-700">{memoryCardsLockReason}</p>
          <Button onClick={backToFlashcard} size="lg" className="px-8">
            {t("workspace.stage.backToFlashcard")}
          </Button>
        </section>
      );
    }
    if (learningStage === "memory" && memoryCheck) {
      return (
        <div className="mx-auto flex w-full justify-center">
          <MemoryCheckStage
            resolveProgressNotice={resolveProgressNotice}
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
            answers={userAnswers}
            explanations={memoryExplanations}
            onCorrectAnswer={(questionId, optionId, explanation) => {
              setUserAnswers((current) => ({
                ...current,
                [questionId]: optionId,
              }));
              keepMemoryExplanation(questionId, explanation);
            }}
            onIncorrectAnswer={(questionId) => keepMemoryExplanation(questionId)}
            onMemoryPassed={(newlyCompleted) => {
              // LF4 AC1/G2: chỉ báo ở bước chuyển từ chưa qua sang qua, theo kết quả của chính câu trả lời này; bài vừa hoàn thành
              // thì màn hình hoàn thành thay cho toast này. Dữ liệu tải trang (isMemoryCheckPassed) không bao giờ báo.
              if (!memoryPassed && !newlyCompleted) toast.success(latestT.current("workspace.toast.memoryPassed"));
              setMemoryPassed(true);
            }}
            onPassed={(confirmedProgress) => {
              setMemoryPassed(true);
              // Server có câu chưa xong mà local không biết câu nào: cần dữ liệu mới trước khi đi tiếp.
              const exercisesChanged = confirmedProgress?.isExerciseCompleted === false && remainingQuestions.length === 0;
              const next = resolveNextUnfinishedStage({
                hasMemoryCheck: true,
                isMemoryCheckPassed: true,
                remainingExerciseQuestions: confirmedProgress?.isExerciseCompleted === true ? 0 : remainingQuestions.length,
                isTopicCompleted: pendingCompletionRef.current || topicCompletedRef.current,
              });
              if (exercisesChanged) {
                setQueueProgressUnavailable(true);
                goToStage("flashcard");
                setPlaneFocusRequest((current) => current + 1);
              } else if (next === "complete") {
                goToComplete();
              } else if (next) {
                if (next === "exercise") goToFirstRemainingQuestion(false);
                goToStage(next);
                setPlaneFocusRequest((current) => current + 1);
              } else {
                setQueueProgressUnavailable(true);
                goToStage("flashcard");
                setPlaneFocusRequest((current) => current + 1);
              }
            }}
            onGoToExercises={() => {
              goToFirstRemainingQuestion();
              goToStage("exercise");
            }}
            onTopicCompleted={markTopicCompleted}
            onCardsRequired={recoverFromCardsRequired}
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
          <h2 className="text-xl font-bold text-slate-900">{t("workspace.stage.exercisesLockedTitle")}</h2>
          <p className="text-slate-700">{memoryLockReason}</p>
          <Button onClick={() => goToStage("memory")} size="lg" className="px-8">
            {t("workspace.stage.doMemory")}
          </Button>
        </section>
      );
    }
    if (learningStage === "flashcard") {
      // LF8 AC5: hàng đợi vừa rỗng do một lần chấm mà còn lần lưu đang chờ thì hiện trạng thái đang lưu thay cho màn hình kết thúc.
      if (learningQueue.length === 0 && queueEndArmed) {
        return (
          <section role="status" className="mx-auto flex max-w-md flex-col items-center gap-3 py-8 text-center">
            <Loader2 aria-hidden="true" className="size-8 text-recall motion-safe:animate-spin" />
            <p className="text-lg font-semibold text-slate-900">{t("review.saving")}</p>
          </section>
        );
      }
      if (learningQueue.length === 0 && (queueProgressUnavailable || memoryCardsLocked)) {
        return (
          <section role="status" className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
            <h2 className="text-xl font-bold text-slate-900">{t("workspace.stage.unconfirmedTitle")}</h2>
            <p className="text-slate-700">{t("workspace.stage.unconfirmedBody")}</p>
            <Button onClick={() => window.location.reload()} size="lg">{t("workspace.stage.reload")}</Button>
          </section>
        );
      }
      if (learningQueue.length === 0) {
        return (
          <section
            aria-labelledby="flashcards-done-title"
            className="mx-auto flex max-w-md flex-col items-center gap-4 text-center"
          >
            <CheckCircle2 aria-hidden="true" className="size-10 text-growth" />
            <h2 id="flashcards-done-title" className="text-xl font-bold text-slate-900">
              {t("workspace.stage.flashcardsDone")}
            </h2>
            {dueCards.length > 0 && (
              <p className="text-slate-700">
                {t("workspace.stage.dueNote", { count: dueCards.length, shown: count(dueCards.length) })}
              </p>
            )}
            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              {dueCards.length > 0 && (
                <Button size="lg" onClick={reviewDueCards}>
                  {t("workspace.stage.reviewDue", { count: dueCards.length, shown: count(dueCards.length) })}
                </Button>
              )}
              <Button variant="outline" size="lg" onClick={restartFlashcards}>
                <RotateCcw aria-hidden="true" />
                {t("workspace.stage.restart")}
              </Button>
              {!memoryCardsLocked && nextStageAfterFlashcards === "memory" && (
                <Button
                  size="lg"
                  variant={dueCards.length > 0 ? "outline" : "default"}
                  onClick={() => goToStage("memory")}
                >
                  {t("workspace.header.nextMemory")}
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </section>
        );
      }
      return (
        <FlashcardStage
          currentCard={learningQueue[0]}
          cardsLeft={learningQueue.length}
          totalCards={queueTotal}
          isFlipped={isFlipped}
          setIsFlipped={setIsFlipped}
          handleRateCard={handleRateCard}
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
              aria-label={t("workspace.header.backToOverview", { title: courseTitle })}
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
                    {t("workspace.header.completed")}
                  </span>
                )}
                <CourseStreakChip summary={courseSummary} />
              </div>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" aria-label={t("workspace.header.openList")}>
                <ListTodo aria-hidden="true" />
                <span className="hidden sm:inline">{t("workspace.header.list")}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="text-lg font-bold">{t("workspace.header.browse")}</SheetTitle>
                <SheetDescription className="sr-only">
                  {t("workspace.header.browseDescription")}
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
          {stageSteps.length > 0 ? (
            <StageThread
              steps={stageSteps}
              onSelect={selectStep}
              lockReason={lockReason}
            />
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* LF5 AC5: chủ đề đã hoàn thành và đang xem một bước khác thì có đúng một lối quay lại màn hình hoàn thành (nút "Xem kết quả chủ đề"). */}
            {isTopicCompleted && learningStage !== "complete" && (
              <Button onClick={goToComplete} variant="outline">
                <CheckCircle2 aria-hidden="true" />
                {t("workspace.header.viewResult")}
              </Button>
            )}
            {learningStage === "complete" ? null : learningStage === "exercise" && memoryCheck ? (
              <Button onClick={() => goToStage("memory")} variant="outline">
                <ChevronLeft aria-hidden="true" />
                {t("workspace.header.toMemory")}
              </Button>
            ) : learningStage !== "flashcard" && flashcards.length > 0 ? (
              <Button onClick={backToFlashcard} variant="outline">
                <ChevronLeft aria-hidden="true" />
                {t("workspace.header.toFlashcard")}
              </Button>
            ) : null}
            {learningStage !== "complete" &&
              learningStage === "flashcard" &&
              learningQueue.length > 0 &&
              !memoryCardsLocked &&
              nextStageAfterFlashcards === "memory" && (
                <Button onClick={() => goToStage("memory")} variant="outline">
                  {t("workspace.header.nextMemory")}
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            {learningStage !== "exercise" &&
              learningStage !== "complete" &&
              exercises.length > 0 &&
              !exercisesLocked &&
              (learningStage === "memory" || canSkipToQuiz) && (
                <Button onClick={skipToQuiz} variant="outline">
                  {t("workspace.header.nextExercise")}
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
          </div>
        </div>

        <main
          ref={planeRef}
          tabIndex={-1}
          className="min-w-0 scroll-mt-4 rounded-2xl outline-none border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8"
        >
          <div
            key={`${learningStage}:${exercisesLocked}`}
            className="min-h-64 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-[240ms]"
          >
            {renderStage()}
          </div>
        </main>

        <nav
          aria-label={t("workspace.nav.label")}
          className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-5"
        >
          {lessonNeighbors.previous ? (
            <Button asChild variant="ghost" size="lg" className={FOOTER_GHOST_CLASS}>
              <Link href={`/learn/${courseSlug}/${lessonNeighbors.previous.slug}`}>
                <ChevronLeft aria-hidden="true" />
                {t("workspace.nav.previous")}
              </Link>
            </Button>
          ) : (
            <Button disabled variant="ghost" size="lg" className={FOOTER_TOUCH_CLASS}>
              <ChevronLeft aria-hidden="true" />
              {t("workspace.nav.previous")}
            </Button>
          )}
          {/* Completion is derived by the server (D4); once the topic is done the
              next topic becomes the primary action, or the course overview when
              this is the last topic. */}
          {isTopicCompleted && learningStage !== "complete" && lessonNeighbors.next ? (
            <Button asChild size="lg" className={FOOTER_PRIMARY_CLASS}>
              <Link href={`/learn/${courseSlug}/${lessonNeighbors.next.slug}`}>
                {t("workspace.nav.next")}
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : isTopicCompleted && learningStage !== "complete" ? (
            <Button asChild size="lg" className={FOOTER_PRIMARY_CLASS}>
              <Link href={`/learn/${courseSlug}`}>{t("workspace.nav.overview")}</Link>
            </Button>
          ) : learningStage === "complete" && !lessonNeighbors.next ? (
            // LF5 AC3: màn hình hoàn thành giữ đúng một hành động chính, nên đích cuối khóa ở chân trang là hành động phụ.
            <Button asChild variant="ghost" size="lg" className={FOOTER_GHOST_CLASS}>
              <Link href={`/learn/${courseSlug}`}>{t("workspace.nav.overview")}</Link>
            </Button>
          ) : lessonNeighbors.next ? (
            <Button asChild variant="ghost" size="lg" className={FOOTER_GHOST_CLASS}>
              <Link href={`/learn/${courseSlug}/${lessonNeighbors.next.slug}`}>
                {t("workspace.nav.next")}
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button disabled variant="ghost" size="lg" className={FOOTER_TOUCH_CLASS}>
              {t("workspace.nav.next")}
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </nav>
      </div>
    </div>
  );
}
