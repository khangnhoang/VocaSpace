"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BookOpenText, ListTodo, PlayCircle, ChevronLeft, ChevronRight, Loader2, ArrowLeft, Headphones } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getTopicContent } from "@/app/actions/learn";
import Link from "next/link"; 
import { toast } from "sonner";
import { 
  ChapterSyllabusDTO, 
  TopicSyllabusDTO, 
  FlashcardDTO, 
  ExerciseDTO, 
  QuestionGroupDTO, 
  QuestionDTO, 
  QuestionOptionDTO 
} from "@/lib/schemas/learn";

interface LearningWorkspaceProps {
  courseTitle: string;
  syllabus: ChapterSyllabusDTO[];
}

export default function LearningWorkspace({ courseTitle, syllabus }: LearningWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"quiz" | "chapters">("chapters");
  const [expandedChapter, setExpandedChapter] = useState(syllabus[0]?.id);
  const [learningStage, setLearningStage] = useState<1 | 2>(1); // 1: Flashcard, 2: Exercise
  
  // FLAT LESSONS
  const flatLessons = syllabus.flatMap((chap) =>
    chap.topics.map((topic: TopicSyllabusDTO) => ({ ...topic, chapterId: chap.id })),
  );

  const [currentLessonSlug, setCurrentLessonSlug] = useState(flatLessons[0]?.slug);
  const currentFlatIndex = flatLessons.findIndex((l) => l.slug === currentLessonSlug);
  const hasPrev = currentFlatIndex > 0;
  const hasNext = currentFlatIndex < flatLessons.length - 1;

  // STATES: DỮ LIỆU BÀI HỌC
  const [flashcards, setFlashcards] = useState<FlashcardDTO[]>([]);
  const [exercises, setExercises] = useState<ExerciseDTO[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // STATES: ANKI FLASHCARD LOGIC
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // STATES: EXERCISE LOGIC
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // LOAD DỮ LIỆU KHI ĐỔI BÀI HỌC
  useEffect(() => {
    if (!currentLessonSlug) return;
    const fetchContent = async () => {
      setIsLoadingContent(true);
      const res = await getTopicContent(currentLessonSlug);
      
      setFlashcards(res.flashcards || []);
      setExercises(res.exercises || []);
      
      // Reset state mỗi khi sang bài mới
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setCurrentExerciseIndex(0);
      setCurrentGroupIndex(0);
      setCurrentQuestionIndex(0);
      setSelectedOption(null);
      
      // Quyết định Stage ban đầu dựa trên dữ liệu
      if (res.flashcards && res.flashcards.length > 0) {
          setLearningStage(1);
          setActiveTab("chapters");
      } else if (res.exercises && res.exercises.length > 0) {
          setLearningStage(2);
          setActiveTab("quiz");
      } else {
          setLearningStage(1); // Mặc định nếu trống
      }
      
      setIsLoadingContent(false);
    };
    fetchContent();
  }, [currentLessonSlug]);

  // NAVIGATION GIỮA CÁC BÀI HỌC
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

  // NAVIGATION BÊN TRONG FLASHCARD
  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const handleNextCardOrStage = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      if(exercises.length > 0) {
          setLearningStage(2);
          setActiveTab("quiz");
      } else {
          toast.success("Bạn đã học xong bài này!");
      }
    }
  };

  // Lấy dữ liệu bài tập hiện tại
  const currentExercise = exercises[currentExerciseIndex];
  // Sort groups and questions by order_index to ensure correct order
  const sortedGroups: QuestionGroupDTO[] = currentExercise?.groups?.slice().sort((a, b) => a.order_index - b.order_index) || [];
  const currentGroup: QuestionGroupDTO | undefined = sortedGroups[currentGroupIndex];
  
  const sortedQuestions: QuestionDTO[] = currentGroup?.questions?.slice().sort((a, b) => a.order_index - b.order_index) || [];
  const currentQuestion: QuestionDTO | undefined = sortedQuestions[currentQuestionIndex];
  
  const sortedOptions: QuestionOptionDTO[] = currentQuestion?.options?.slice().sort((a, b) => a.id.localeCompare(b.id)) || [];

  // NAVIGATION BÊN TRONG EXERCISE
  const handleNextQuestion = () => {
    setSelectedOption(null); // Reset lựa chọn
    if (currentQuestionIndex < sortedQuestions.length - 1) {
        // Next câu hỏi trong cùng group
        setCurrentQuestionIndex(prev => prev + 1);
    } else if (currentGroupIndex < sortedGroups.length - 1) {
        // Next group trong cùng exercise
        setCurrentGroupIndex(prev => prev + 1);
        setCurrentQuestionIndex(0);
    } else if (currentExerciseIndex < exercises.length - 1) {
        // Next exercise
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentGroupIndex(0);
        setCurrentQuestionIndex(0);
    } else {
        toast.success("Bạn đã hoàn thành tất cả bài tập!");
    }
  };

  const handlePrevQuestion = () => {
      setSelectedOption(null);
      if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(prev => prev - 1);
      } else if (currentGroupIndex > 0) {
          const prevGroupIndex = currentGroupIndex - 1;
          setCurrentGroupIndex(prevGroupIndex);
          const prevGroupQuestions = sortedGroups[prevGroupIndex]?.questions || [];
          setCurrentQuestionIndex(Math.max(0, prevGroupQuestions.length - 1));
      } else if (currentExerciseIndex > 0) {
          const prevExIndex = currentExerciseIndex - 1;
          setCurrentExerciseIndex(prevExIndex);
          const prevExGroups = exercises[prevExIndex]?.groups || [];
          const lastGroupIndex = Math.max(0, prevExGroups.length - 1);
          setCurrentGroupIndex(lastGroupIndex);
          const lastGroupQs = prevExGroups[lastGroupIndex]?.questions || [];
          setCurrentQuestionIndex(Math.max(0, lastGroupQs.length - 1));
      } else if (flashcards.length > 0) {
          // Quay lại flashcard
          setLearningStage(1);
          setCurrentCardIndex(flashcards.length - 1);
          setIsFlipped(false);
          setActiveTab("chapters");
      }
  };

  const handleSubmitAnswer = () => {
      if(!selectedOption) {
          toast.error("Vui lòng chọn một đáp án!");
          return;
      }
      toast.info("Đã gửi đáp án (Tính năng chấm điểm đang phát triển)");
      // Tự động next sang câu tiếp theo sau 1s
      setTimeout(() => handleNextQuestion(), 1000);
  };

  const currentCard = flashcards[currentCardIndex];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-8xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          
          {/* CỘT TRÁI (70%) - KHU VỰC HỌC TẬP */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-150">
            {/* Heder cột trái */}
            <div className="h-14 border-b border-slate-100 flex items-center gap-4 px-6 bg-slate-50/50 shrink-0">
              <Link href="/" className="text-slate-400 hover:text-emerald-500 transition-colors p-1">
                <ArrowLeft size={20} />
              </Link>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider truncate">
                Bài học: {flatLessons[currentFlatIndex]?.title || "Đang tải..."}
              </span>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 bg-slate-50/30 relative">
              {isLoadingContent ? (
                <Loader2 className="animate-spin text-emerald-500 w-12 h-12" />
              ) : (flashcards.length === 0 && exercises.length === 0) ? (
                <div className="text-center text-slate-400">
                  <h2 className="text-2xl font-bold mb-2">Bài học này chưa có nội dung</h2>
                  <p>Giáo viên đang cập nhật nội dung.</p>
                </div>
              ) : learningStage === 1 ? (
                <div className="w-full flex flex-col items-center">
                  <div className="w-full max-w-3xl border border-slate-100 shadow-xl shadow-slate-200/40 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white p-8 pb-16 min-h-90 md:min-h-105 relative">
                    
                    <button onClick={handlePrevCard} disabled={currentCardIndex === 0} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-emerald-500 disabled:opacity-30 transition-colors">
                      <ChevronLeft size={32} />
                    </button>

                    <div className="flex flex-col items-center text-center w-full px-8 animate-in fade-in zoom-in-95 duration-300">
                      <p className="font-bold text-3xl md:text-5xl text-slate-800 mb-4 tracking-tight">
                        {currentCard?.front_content?.word}
                      </p>
                      <p className="text-sm md:text-base text-slate-500 font-medium mb-8 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100">
                        <span className="text-emerald-500 font-bold mr-2">
                          ({currentCard?.front_content?.pos})
                        </span> 
                        | {currentCard?.front_content?.phonetic}
                      </p>

                      {isFlipped && (
                        <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
                          <p className="font-bold text-lg md:text-xl text-emerald-600 mb-3">
                            Nghĩa: {currentCard?.back_content?.translation}
                          </p>
                          <p className="text-base md:text-lg text-slate-700 italic font-medium mb-2 leading-relaxed">
                            VD: &quot;{currentCard?.back_content?.example_en}&quot;
                          </p>
                          <p className="text-sm md:text-base text-slate-500">
                            Dịch: {currentCard?.back_content?.example_vi}
                          </p>
                          {currentCard?.back_content?.mnemonics && (
                            <p className="text-sm text-orange-500 font-bold mt-4 bg-orange-50 inline-block px-4 py-2 rounded-lg border border-orange-100">
                              💡 Mẹo: {currentCard?.back_content?.mnemonics}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <button onClick={handleNextCardOrStage} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-emerald-500 transition-colors">
                      <ChevronRight size={32} />
                    </button>

                    {/* INDICATORS CỦA STAGE 1 */}
                    <div className="absolute bottom-6 flex items-center justify-center gap-3 w-full">
                      <div className="h-2.5 rounded-full transition-all duration-300 w-8 bg-emerald-500" />
                      <div className="h-2.5 rounded-full transition-all duration-300 w-2.5 bg-slate-300" />
                    </div>
                  </div>

                  <div className="w-full max-w-2xl mt-6">
                    {!isFlipped ? (
                      <Button onClick={() => setIsFlipped(true)} className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-2xl py-6 md:py-8 font-bold text-lg md:text-xl shadow-lg">
                        Hiện đáp án
                      </Button>
                    ) : (
                      <div className="flex gap-2 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Button onClick={handleNextCardOrStage} variant="outline" className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm">Lại</Button>
                        <Button onClick={handleNextCardOrStage} variant="outline" className="flex-1 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm">Khó</Button>
                        <Button onClick={handleNextCardOrStage} variant="outline" className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm">Ổn</Button>
                        <Button onClick={handleNextCardOrStage} variant="outline" className="flex-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 rounded-2xl py-6 md:py-8 font-bold text-base md:text-lg transition-all shadow-sm">Dễ</Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center mt-5 text-slate-400 font-bold text-sm">
                    {currentCardIndex + 1} / {flashcards.length}
                  </div>
                </div>
              ) : (
                // ==========================================
                // STAGE 2: EXERCISE (HIỂN THỊ NGỮ LIỆU BÊN TRÁI)
                // ==========================================
                <div className="w-full h-full border border-slate-100 shadow-sm rounded-3xl flex flex-col bg-white p-6 md:p-8 relative overflow-y-auto">
                    {currentGroup ? (
                        <div className="flex flex-col gap-6 pb-12 animate-in fade-in duration-300 h-full">
                            <div className="border-b border-slate-100 pb-4">
                                <h3 className="font-bold text-lg text-slate-800">{currentExercise?.title} <span className="text-sm font-normal text-slate-500 ml-2 uppercase bg-slate-100 px-2 py-1 rounded-md">{currentExercise?.part_type}</span></h3>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto">
                                {/* Audio nếu có */}
                                {currentGroup.audio_url && (
                                    <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-4">
                                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Headphones size={24} /></div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-700 mb-2">Nghe đoạn hội thoại:</p>
                                            <audio controls className="w-full h-10">
                                                <source src={currentGroup.audio_url} type="audio/mpeg" />
                                                Trình duyệt của bạn không hỗ trợ thẻ audio.
                                            </audio>
                                        </div>
                                    </div>
                                )}

                                {/* Đoạn văn nếu có */}
                                {currentGroup.passage_text && (
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                                        {currentGroup.passage_text}
                                    </div>
                                )}

                                {(!currentGroup.audio_url && !currentGroup.passage_text) && (
                                    <div className="flex items-center justify-center h-40 text-slate-400 italic">
                                        Nhóm câu hỏi này không có ngữ liệu đi kèm.
                                    </div>
                                )}
                            </div>
                            
                            {/* INDICATORS CỦA STAGE 2 */}
                            <div className="absolute bottom-6 flex items-center justify-center gap-3 w-full left-0">
                                <div className="h-2.5 rounded-full transition-all duration-300 w-2.5 bg-slate-300" />
                                <div className="h-2.5 rounded-full transition-all duration-300 w-8 bg-emerald-500" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 font-medium">Không có dữ liệu bài tập.</div>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI (30%) - MỤC LỤC & QUIZ */}
          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-fit max-h-[calc(100vh-2rem)] sticky top-4">
            <div className="flex gap-4 items-center justify-center p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <Button onClick={() => setActiveTab("quiz")} variant={activeTab === "quiz" ? "default" : "outline"} className={`rounded-xl px-8 transition-all ${activeTab === "quiz" ? "bg-emerald-500 text-white shadow-md" : "border-emerald-200 text-emerald-600"}`}>
                <BookOpenText size={20} />
              </Button>
              <Button onClick={() => setActiveTab("chapters")} variant={activeTab === "chapters" ? "default" : "outline"} className={`rounded-xl px-8 transition-all ${activeTab === "chapters" ? "bg-emerald-500 text-white shadow-md" : "border-emerald-200 text-emerald-600"}`}>
                <ListTodo size={20} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "chapters" ? (
                // TAB DUYỆT CHƯƠNG GIỮ NGUYÊN
                <div className="space-y-4 animate-in fade-in duration-300">
                  <h3 className="font-bold text-slate-900 text-lg">Duyệt chương học</h3>
                  <Accordion type="single" collapsible value={expandedChapter} onValueChange={setExpandedChapter} className="w-full space-y-3 mt-4">
                    {syllabus.map((chapter) => (
                      <AccordionItem key={chapter.id} value={chapter.id} className="border border-slate-200 rounded-xl px-4 bg-white hover:border-emerald-300 transition-colors data-[state=open]:border-emerald-400">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <span className="font-bold text-slate-800 text-sm">{chapter.title}</span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 pt-1">
                          <div className="flex flex-col gap-2">
                            {chapter.topics.map((topic: TopicSyllabusDTO) => {
                              const isActive = currentLessonSlug === topic.slug;
                              return (
                                <button key={topic.id} onClick={() => { setCurrentLessonSlug(topic.slug); setExpandedChapter(chapter.id); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left group ${isActive ? "bg-emerald-50 border-emerald-200 shadow-sm" : "bg-transparent border-transparent hover:bg-slate-50"}`}>
                                  <div className="flex items-center gap-3">
                                    <PlayCircle size={16} className={`shrink-0 transition-colors ${isActive ? "text-emerald-500" : "text-slate-400 group-hover:text-emerald-500"}`} />
                                    <span className={`text-sm ${isActive ? "text-emerald-700 font-bold" : "text-slate-700 font-medium"}`}>{topic.title}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ) : (
                // ==========================================
                // TAB QUIZ: HIỂN THỊ CÂU HỎI VÀ ĐÁP ÁN (STAGE 2)
                // ==========================================
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300 h-full flex flex-col">
                  {learningStage === 1 ? (
                       <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center gap-4 mt-20">
                           <BookOpenText size={48} className="opacity-20" />
                           <p>Hoàn thành học từ vựng để mở khóa phần bài tập nhé!</p>
                       </div>
                  ) : currentQuestion ? (
                      <>
                          <div className="flex items-center justify-between">
                             <h3 className="font-bold text-slate-900 text-lg">Câu hỏi {currentQuestionIndex + 1}/{sortedQuestions.length}</h3>
                             <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Nhóm {currentGroupIndex + 1}/{sortedGroups.length}</span>
                          </div>
                          
                          <div className="mt-2 flex-1">
                            <p className="font-bold text-slate-800 leading-relaxed mb-6 text-base">
                              {currentQuestion.content}
                            </p>
                            <div className="flex flex-col gap-3">
                                {sortedOptions.map((opt: QuestionOptionDTO, index: number) => {
                                    const isSelected = selectedOption === opt.id;
                                    const label = String.fromCharCode(65 + index); // A, B, C, D
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => setSelectedOption(opt.id)}
                                            className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 font-medium
                                                ${isSelected 
                                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800" 
                                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                                                }
                                            `}
                                        >
                                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                                                {label}
                                            </span>
                                            {opt.content}
                                        </button>
                                    )
                                })}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-100 mt-auto flex flex-col gap-3">
                              <Button onClick={handleSubmitAnswer} className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-6 font-bold shadow-md">Xác nhận đáp án</Button>
                              <div className="flex items-center justify-between">
                                  <Button onClick={handlePrevQuestion} variant="ghost" className="text-slate-500 hover:text-slate-800 px-2"><ChevronLeft size={18} className="mr-1"/> Câu trước</Button>
                                  <Button onClick={handleNextQuestion} variant="ghost" className="text-slate-500 hover:text-slate-800 px-2">Câu sau <ChevronRight size={18} className="ml-1"/></Button>
                              </div>
                          </div>
                      </>
                  ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">Không có câu hỏi nào.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* THANH ĐIỀU HƯỚNG BÀI HỌC DƯỚI CÙNG */}
        <div className="p-4 sm:p-5 flex items-center justify-center mt-auto border-t border-slate-200/50 pt-8">
          <Button onClick={handlePrevLesson} disabled={!hasPrev} variant="ghost" className="text-slate-600 hover:bg-slate-100 rounded-xl px-4 py-6 font-medium">
            <ChevronLeft size={20} className="mr-2" /> Bài trước
          </Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-12 py-6 font-bold shadow-lg shadow-emerald-200 mx-4 active:scale-95 transition-transform">
            Hoàn thành bài học
          </Button>
          <Button onClick={handleNextLesson} disabled={!hasNext} variant="ghost" className="text-slate-600 hover:bg-slate-100 rounded-xl px-4 py-6 font-medium">
            Bài sau <ChevronRight size={20} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}