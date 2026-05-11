"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  BookOpenText,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { getTopicContent } from "@/app/actions/learn";
import { submitCardReview } from "@/app/actions/review";
import { Rating } from "ts-fsrs";
import Link from "next/link";
import { toast } from "sonner";

// 1. ĐÃ SỬA IMPORT: Gọi API mới từ progress.ts
import {
  getTopicLearningHistory,
  updateStageProgress,
} from "@/app/actions/progress";
import {
  ChapterSyllabusDTO,
  TopicSyllabusDTO,
  FlashcardDTO,
  ExerciseDTO,
  QuestionGroupDTO,
  QuestionDTO,
  QuestionOptionDTO,
} from "@/lib/schemas/learn";

import FlashcardStage from "./FlashcardStage";
import ExerciseContext from "./ExerciseContext";
import ChapterSidebar from "./ChapterSidebar";
import QuizSidebar from "./QuizSidebar";

interface LearningWorkspaceProps {
  courseTitle: string;
  syllabus: ChapterSyllabusDTO[];
}

export default function LearningWorkspace({
  courseTitle,
  syllabus,
}: LearningWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"quiz" | "chapters">("chapters");
  const [expandedChapter, setExpandedChapter] = useState(syllabus[0]?.id);
  const [learningStage, setLearningStage] = useState<1 | 2>(1);
  const [isPending, startTransition] = useTransition();
  const [canSkipToQuiz, setCanSkipToQuiz] = useState(false);

  // 2. THÊM STATE: Quản lý bộ nhớ đệm lịch sử làm bài
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  const flatLessons = useMemo(() => {
    return syllabus.flatMap((chap) =>
      chap.topics.map((topic: TopicSyllabusDTO) => ({
        ...topic,
        chapterId: chap.id,
      })),
    );
  }, [syllabus]);

  const [currentLessonSlug, setCurrentLessonSlug] = useState(
    flatLessons[0]?.slug,
  );
  const currentFlatIndex = flatLessons.findIndex(
    (l) => l.slug === currentLessonSlug,
  );
  const hasPrev = currentFlatIndex > 0;
  const hasNext = currentFlatIndex < flatLessons.length - 1;

  // 3. THÊM MEMO: Tách ID bài học ra chuỗi tĩnh để tránh domino re-render
  const currentTopicId = useMemo(() => {
    return flatLessons.find((l) => l.slug === currentLessonSlug)?.id;
  }, [flatLessons, currentLessonSlug]);

  const [originalCards, setOriginalCards] = useState<FlashcardDTO[]>([]);
  const [learningQueue, setLearningQueue] = useState<FlashcardDTO[]>([]);

  const [exercises, setExercises] = useState<ExerciseDTO[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    if (!currentLessonSlug) return;
    const fetchContent = async () => {
      setIsLoadingContent(true);
      const res = await getTopicContent(currentLessonSlug);

      const fetchedCards = res.flashcards || [];
      setOriginalCards(fetchedCards);
      setLearningQueue(fetchedCards);
      setExercises(res.exercises || []);

      // 4. ĐÃ CẬP NHẬT LOGIC FETCH: Lấy cả tiến độ và lịch sử userAnswers
      if (currentTopicId) {
        const historyRes = await getTopicLearningHistory(currentTopicId);
        setUserAnswers(historyRes.answers);
        setCanSkipToQuiz(historyRes.progress?.is_flashcard_completed || false);
      }

      setIsFlipped(false);
      setCurrentExerciseIndex(0);
      setCurrentGroupIndex(0);
      setCurrentQuestionIndex(0);
      setSelectedOption(null);

      if (fetchedCards.length > 0) {
        setLearningStage(1);
        setActiveTab("chapters");
      } else if (res.exercises && res.exercises.length > 0) {
        setLearningStage(2);
        setActiveTab("quiz");
      } else {
        setLearningStage(1);
      }
      setIsLoadingContent(false);
    };
    fetchContent();

    // 5. ĐÃ FIX DEPENDENCY: Dùng currentTopicId tĩnh thay cho flatLessons
  }, [currentLessonSlug, currentTopicId]);

  const skipToQuiz = () => {
    setLearningStage(2);
    setActiveTab("quiz");
  };

  const backToFlashcard = () => {
    setLearningStage(1);
    setActiveTab("chapters");
  };

  const handlePrevLesson = () => {
    if (hasPrev) {
      const prevLesson = flatLessons[currentFlatIndex - 1];
      setCurrentLessonSlug(prevLesson.slug);
      setExpandedChapter(prevLesson.chapterId);
    }
  };
  const handleNextLesson = () => {
    if (hasNext) {
      const nextLesson = flatLessons[currentFlatIndex + 1];
      setCurrentLessonSlug(nextLesson.slug);
      setExpandedChapter(nextLesson.chapterId);
    }
  };

  const handleRateCard = (rating: Rating) => {
    const currentCard = learningQueue[0];
    if (!currentCard) return;

    const newQueue = [...learningQueue.slice(1)];

    if (rating === Rating.Again || rating === Rating.Hard) {
      newQueue.push(currentCard);
    }

    setLearningQueue(newQueue);
    setIsFlipped(false);

    if (newQueue.length === 0) {
      // 6. ĐÃ CẬP NHẬT CHỐT SỔ: Ghi nhận hoàn thành Stage 1 vào DB
      if (currentTopicId) {
        updateStageProgress(currentTopicId, "flashcard");
        setCanSkipToQuiz(true);
      }

      if (exercises.length > 0) {
        setLearningStage(2);
        setActiveTab("quiz");
        toast.success("Đã nạp xong từ vựng! Chuyển sang bài tập.");
      } else {
        toast.success("Tuyệt vời! Bạn đã hoàn thành toàn bộ bài học này!");
      }
    }

    startTransition(async () => {
      // ĐÃ FIX: Truyền Khóa chính (currentTopicId) thay vì truyền Slug
      const res = await submitCardReview(
        currentCard.id,
        currentTopicId || "",
        rating,
      );
      if (res?.error) toast.error("Lỗi đồng bộ tiến độ học!");
    });
  };

  const currentExercise = exercises[currentExerciseIndex];
  const sortedGroups: QuestionGroupDTO[] =
    currentExercise?.groups
      ?.slice()
      .sort((a, b) => a.order_index - b.order_index) || [];
  const currentGroup: QuestionGroupDTO | undefined =
    sortedGroups[currentGroupIndex];
  const sortedQuestions: QuestionDTO[] =
    currentGroup?.questions
      ?.slice()
      .sort((a, b) => a.order_index - b.order_index) || [];
  const currentQuestion: QuestionDTO | undefined =
    sortedQuestions[currentQuestionIndex];
  const sortedOptions: QuestionOptionDTO[] =
    currentQuestion?.options
      ?.slice()
      .sort((a, b) => a.id.localeCompare(b.id)) || [];

  const handleNextQuestion = () => {
    setSelectedOption(null);
    if (currentQuestionIndex < sortedQuestions.length - 1)
      setCurrentQuestionIndex((prev) => prev + 1);
    else if (currentGroupIndex < sortedGroups.length - 1) {
      setCurrentGroupIndex((prev) => prev + 1);
      setCurrentQuestionIndex(0);
    } else if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((prev) => prev + 1);
      setCurrentGroupIndex(0);
      setCurrentQuestionIndex(0);
    } else toast.success("Bạn đã hoàn thành tất cả bài tập!");
  };

  const handlePrevQuestion = () => {
    setSelectedOption(null);
    if (currentQuestionIndex > 0) setCurrentQuestionIndex((prev) => prev - 1);
    else if (currentGroupIndex > 0) {
      const prevGroupIndex = currentGroupIndex - 1;
      setCurrentGroupIndex(prevGroupIndex);
      setCurrentQuestionIndex(
        Math.max(0, (sortedGroups[prevGroupIndex]?.questions || []).length - 1),
      );
    } else if (currentExerciseIndex > 0) {
      const prevExIndex = currentExerciseIndex - 1;
      setCurrentExerciseIndex(prevExIndex);
      const prevExGroups = exercises[prevExIndex]?.groups || [];
      const lastGroupIndex = Math.max(0, prevExGroups.length - 1);
      setCurrentGroupIndex(lastGroupIndex);
      setCurrentQuestionIndex(
        Math.max(0, (prevExGroups[lastGroupIndex]?.questions || []).length - 1),
      );
    } else if (originalCards.length > 0) {
      setLearningStage(1);
      setLearningQueue(originalCards);
      setIsFlipped(false);
      setActiveTab("chapters");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-8xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-150">
            {/* 7. QUY HOẠCH TOPBAR: Gom toàn bộ nút điều hướng về một thanh duy nhất */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="text-slate-400 hover:text-emerald-500 transition-colors p-1"
                >
                  <ArrowLeft size={20} />
                </Link>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                    Bài học
                  </span>
                  <span className="text-sm font-bold text-slate-700 truncate max-w-50 md:max-w-md">
                    {flatLessons[currentFlatIndex]?.title || "Đang tải..."}
                  </span>
                </div>
              </div>

              {/* KHU VỰC ĐIỀU HƯỚNG BÊN PHẢI TOPBAR */}
              <div className="flex items-center gap-2">
                {learningStage === 2 && originalCards.length > 0 ? (
                  <Button
                    onClick={backToFlashcard}
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-200 text-slate-600 hover:bg-white font-medium shadow-sm"
                  >
                    <ChevronLeft size={16} className="mr-1" /> Về Từ vựng
                  </Button>
                ) : (
                  canSkipToQuiz &&
                  exercises.length > 0 && (
                    <Button
                      onClick={skipToQuiz}
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold shadow-sm animate-in fade-in"
                    >
                      Tới Bài tập <ChevronRight size={16} className="ml-1" />
                    </Button>
                  )
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 bg-slate-50/30 relative">
              {isLoadingContent ? (
                <Loader2 className="animate-spin text-emerald-500 w-12 h-12" />
              ) : originalCards.length === 0 && exercises.length === 0 ? (
                <div className="text-center text-slate-400">
                  <h2 className="text-2xl font-bold mb-2">
                    Bài học này chưa có nội dung
                  </h2>
                </div>
              ) : learningStage === 1 ? (
                // 8. ĐÃ DỌN DẸP PROPS: Bỏ canSkip, onSkip thừa thãi
                <FlashcardStage
                  currentCard={learningQueue[0]}
                  cardsLeft={learningQueue.length}
                  totalCards={originalCards.length}
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
          </div>

          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-fit max-h-[calc(100vh-2rem)] sticky top-4">
            <div className="flex gap-4 items-center justify-center p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <Button
                onClick={() => setActiveTab("quiz")}
                variant={activeTab === "quiz" ? "default" : "outline"}
                className={`rounded-xl px-8 transition-all ${activeTab === "quiz" ? "bg-emerald-500 text-white shadow-md" : "border-emerald-200 text-emerald-600"}`}
              >
                <BookOpenText size={20} />
              </Button>
              <Button
                onClick={() => setActiveTab("chapters")}
                variant={activeTab === "chapters" ? "default" : "outline"}
                className={`rounded-xl px-8 transition-all ${activeTab === "chapters" ? "bg-emerald-500 text-white shadow-md" : "border-emerald-200 text-emerald-600"}`}
              >
                <ListTodo size={20} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "chapters" ? (
                <ChapterSidebar
                  syllabus={syllabus}
                  expandedChapter={expandedChapter}
                  setExpandedChapter={setExpandedChapter}
                  currentLessonSlug={currentLessonSlug}
                  setCurrentLessonSlug={setCurrentLessonSlug}
                />
              ) : (
                // 9. ĐÃ TRUYỀN PROPS: Nối userAnswers và topicId cho QuizSidebar
                <QuizSidebar
                  learningStage={learningStage}
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
                  topicId={currentTopicId || ""}
                />
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-center mt-auto border-t border-slate-200/50 pt-8">
          <Button
            onClick={handlePrevLesson}
            disabled={!hasPrev}
            variant="ghost"
            className="text-slate-600 hover:bg-slate-100 rounded-xl px-4 py-6 font-medium"
          >
            <ChevronLeft size={20} className="mr-2" /> Bài trước
          </Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-12 py-6 font-bold shadow-lg shadow-emerald-200 mx-4 active:scale-95 transition-transform">
            Hoàn thành bài học
          </Button>
          <Button
            onClick={handleNextLesson}
            disabled={!hasNext}
            variant="ghost"
            className="text-slate-600 hover:bg-slate-100 rounded-xl px-4 py-6 font-medium"
          >
            Bài sau <ChevronRight size={20} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
