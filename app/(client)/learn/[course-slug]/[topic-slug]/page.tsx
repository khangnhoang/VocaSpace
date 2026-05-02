"use client";

import React, { useState, use } from "react";
import { Button } from "@/components/ui/button";
import {
  BookOpenText,
  ListTodo,
  PlayCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// =====================================================================
// MOCK DATA
// =====================================================================
const INITIAL_CHAPTERS = [
  {
    id: "chap-1",
    title: "Chương 1: Khởi động",
    lessons: [
      {
        id: "les-1-1",
        title: "1.1 Giới thiệu từ vựng cốt lõi",
        isCompleted: true,
      },
      {
        id: "les-1-2",
        title: "1.2 Cách phát âm chuẩn IPA",
        isCompleted: false,
      },
      { id: "les-1-3", title: "1.3 Bài tập thực hành", isCompleted: false },
    ],
  },
  {
    id: "chap-2",
    title: "Chương 2: Vượt chướng ngại vật",
    lessons: [
      {
        id: "les-2-1",
        title: "2.1 Từ vựng chủ đề công việc",
        isCompleted: false,
      },
      { id: "les-2-2", title: "2.2 Luyện nghe hội thoại", isCompleted: false },
    ],
  },
];

const MOCK_VOCAB = [
  {
    id: 1,
    word: "Accomplish",
    type: "v",
    ipa: "/əˈkʌm.plɪʃ/",
    meaning: "Hoàn thành, đạt được",
    enExample: "The students accomplished the task.",
    viExample: "Các học sinh đã hoàn thành nhiệm vụ.",
    dialogueA: (
      <>
        Did you <span className="font-bold text-emerald-500">accomplish</span>{" "}
        your goals today?
      </>
    ),
    dialogueB: (
      <>
        Yes, I finished everything!
        <span className="font-bold text-emerald-500 ml-2">:B</span>
      </>
    ),
  },
  {
    id: 2,
    word: "Resilient",
    type: "adj",
    ipa: "/rɪˈzɪl.jənt/",
    meaning: "Kiên cường, mau phục hồi",
    enExample: "She is a resilient girl - she won't give up easily.",
    viExample:
      "Cô ấy là một cô gái kiên cường - cô ấy sẽ không dễ dàng bỏ cuộc.",
    dialogueA: <>How is she doing after the project failed?</>,
    dialogueB: (
      <>
        She&apos;s very{" "}
        <span className="font-bold text-emerald-500">resilient</span>,
        she&apos;ll bounce back soon.
      </>
    ),
  },
  {
    id: 3,
    word: "Initiative",
    type: "n",
    ipa: "/ɪˈnɪʃ.ə.tɪv/",
    meaning: "Sáng kiến, sự chủ động",
    enExample: "He showed a lot of initiative at work.",
    viExample: "Anh ấy đã cho thấy sự chủ động tuyệt vời trong công việc.",
    dialogueA: <>Why did he get the promotion?</>,
    dialogueB: (
      <>
        Because he always takes the{" "}
        <span className="font-bold text-emerald-500">initiative</span> to solve
        problems.
      </>
    ),
  },
];

export default function CourseDetailPage(props: {
  params: Promise<{ "course-slug": string }>;
}) {
  const params = use(props.params);
  const courseSlug = params["course-slug"];

  // States
  const [activeTab, setActiveTab] = useState<"quiz" | "chapters">("chapters");
  const [learningStage, setLearningStage] = useState<1 | 2>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentVocab = MOCK_VOCAB[currentIndex];

  const [chaptersData, setChaptersData] = useState(INITIAL_CHAPTERS);
  const [currentLessonId, setCurrentLessonId] = useState(
    INITIAL_CHAPTERS[0].lessons[0].id,
  );
  const [expandedChapter, setExpandedChapter] = useState(
    INITIAL_CHAPTERS[0].id,
  );

  const flatLessons = chaptersData.flatMap((chap) =>
    chap.lessons.map((lesson) => ({ ...lesson, chapterId: chap.id })),
  );
  const currentFlatIndex = flatLessons.findIndex(
    (l) => l.id === currentLessonId,
  );
  const hasPrev = currentFlatIndex > 0;
  const hasNext = currentFlatIndex < flatLessons.length - 1;

  const handlePrevLesson = () => {
    if (hasPrev) {
      const prevLesson = flatLessons[currentFlatIndex - 1];
      setCurrentLessonId(prevLesson.id);
      setExpandedChapter(prevLesson.chapterId);
    }
  };

  const handleNextLesson = () => {
    if (hasNext) {
      const nextLesson = flatLessons[currentFlatIndex + 1];
      setCurrentLessonId(nextLesson.id);
      setExpandedChapter(nextLesson.chapterId);
    }
  };

  const handleCompleteLesson = () => {
    setChaptersData((prev) =>
      prev.map((chap) => ({
        ...chap,
        lessons: chap.lessons.map((l) =>
          l.id === currentLessonId ? { ...l, isCompleted: true } : l,
        ),
      })),
    );
    if (hasNext) handleNextLesson();
  };

  const handleNextWord = () => {
    setLearningStage(1);
    setCurrentIndex((prev) => (prev + 1) % MOCK_VOCAB.length);
  };

  return (
    // ĐÃ SỬA: Dùng min-h-screen để đảm bảo nền full, nhưng không khóa cứng chiều cao
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      {/* ĐÃ SỬA: Xóa cái h-[calc...] ép cứng đi, để flex gap tự do bung ra */}
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* === PHẦN TRÊN: GRID 70 - 30 === */}
        {/* ĐÃ SỬA: Cột phải sẽ tự dài ra theo nội dung (như danh sách bài học) */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* CỘT TRÁI (70%) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50 shrink-0">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider truncate">
                Bài học: {flatLessons[currentFlatIndex]?.title}
              </span>
            </div>

            {/* Khu vực Flashcard: Thêm py-12 để đảm bảo có đủ khoảng trống trên dưới */}
            <div className="p-6 md:p-10 flex flex-col items-center justify-center bg-slate-50/30 w-full relative">
              <div className="w-full max-w-xl border border-slate-100 shadow-xl shadow-slate-200/40 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white p-8 pb-16 min-h-[360px] relative">
                {learningStage === 1 ? (
                  <div className="flex flex-col items-center text-center w-full animate-in fade-in zoom-in-95 duration-300">
                    <p className="font-bold text-3xl md:text-4xl text-slate-800 mb-3 tracking-tight">
                      {currentVocab.word}
                    </p>
                    <p className="text-sm md:text-base text-slate-500 font-medium mb-8 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100">
                      <span className="text-emerald-500 font-bold mr-2">
                        ({currentVocab.type})
                      </span>{" "}
                      | {currentVocab.ipa}
                    </p>
                    <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm w-full">
                      <p className="font-bold text-base md:text-lg text-emerald-600 mb-3">
                        Nghĩa: {currentVocab.meaning}
                      </p>
                      <p className="text-sm md:text-base text-slate-700 italic font-medium mb-2 leading-relaxed">
                        VD: &quot;{currentVocab.enExample}&quot;
                      </p>
                      <p className="text-sm text-slate-500">
                        Dịch: {currentVocab.viExample}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full animate-in fade-in zoom-in-95 duration-300 justify-center">
                    <p className="font-bold text-lg text-slate-800 mb-6 uppercase tracking-wider">
                      Đoạn hội thoại
                    </p>
                    <div className="flex flex-col gap-4 w-full">
                      <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm self-start max-w-[85%] rounded-tl-sm">
                        <p className="text-sm md:text-base text-slate-700 leading-relaxed">
                          <span className="font-bold text-blue-500 mr-2">
                            A:
                          </span>
                          {currentVocab.dialogueA}
                        </p>
                      </div>
                      <div className="bg-emerald-50 p-4 md:p-5 rounded-2xl border border-emerald-100 shadow-sm self-end max-w-[85%] rounded-tr-sm text-right">
                        <p className="text-sm md:text-base text-slate-800 leading-relaxed">
                          {currentVocab.dialogueB}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-6 flex items-center justify-center gap-3 w-full">
                  <button
                    onClick={() => setLearningStage(1)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${learningStage === 1 ? "w-8 bg-emerald-500" : "w-2.5 bg-slate-300"}`}
                  />
                  <button
                    onClick={() => setLearningStage(2)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${learningStage === 2 ? "w-8 bg-emerald-500" : "w-2.5 bg-slate-300"}`}
                  />
                </div>
              </div>
            </div>

            {/* CÁC NÚT ĐÁNH GIÁ (Sẽ không bao giờ bị mất nữa) */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-white flex flex-wrap justify-center gap-2 sm:gap-4 shrink-0 mt-auto">
              <Button
                onClick={handleNextWord}
                variant="outline"
                className="flex-1 min-w-20 max-w-35 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-xl py-5 font-bold text-sm sm:text-base transition-all"
              >
                Lại
              </Button>
              <Button
                onClick={handleNextWord}
                variant="outline"
                className="flex-1 min-w-20 max-w-35 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 rounded-xl py-5 font-bold text-sm sm:text-base transition-all"
              >
                Khó
              </Button>
              <Button
                onClick={handleNextWord}
                variant="outline"
                className="flex-1 min-w-20 max-w-35 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-xl py-5 font-bold text-sm sm:text-base transition-all"
              >
                Ổn
              </Button>
              <Button
                onClick={handleNextWord}
                variant="outline"
                className="flex-1 min-w-20 max-w-35 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 rounded-xl py-5 font-bold text-sm sm:text-base transition-all"
              >
                Dễ
              </Button>
            </div>
          </div>

          {/* CỘT PHẢI (30%) */}
          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-fit">
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

            <div className="p-6">
              {activeTab === "quiz" ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                  <h3 className="font-bold text-slate-900 text-lg">
                    Kiểm tra nhanh
                  </h3>
                  <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-5">
                    <p className="font-semibold text-slate-800 leading-relaxed">
                      Nghĩa của từ{" "}
                      <span className="text-emerald-600 font-bold">
                        {currentVocab.word}
                      </span>{" "}
                      là gì?
                    </p>
                    <div className="flex flex-col gap-3">
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4 px-5 rounded-xl text-left font-medium"
                      >
                        A. Bỏ cuộc
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4 px-5 rounded-xl text-left font-medium whitespace-normal"
                      >
                        B. {currentVocab.meaning}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="font-bold text-slate-900 text-lg">
                    Duyệt chương học
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Chọn bài học tiếp theo
                  </p>
                  <div className="mt-4">
                    <Accordion
                      type="single"
                      collapsible
                      value={expandedChapter}
                      onValueChange={setExpandedChapter}
                      className="w-full space-y-3"
                    >
                      {chaptersData.map((chapter) => (
                        <AccordionItem
                          key={chapter.id}
                          value={chapter.id}
                          className="border border-slate-200 rounded-xl px-4 bg-white hover:border-emerald-300 transition-colors data-[state=open]:border-emerald-400 data-[state=open]:shadow-sm"
                        >
                          <AccordionTrigger className="hover:no-underline py-4">
                            <span className="font-bold text-slate-800 text-sm text-left">
                              {chapter.title}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 pt-1">
                            <div className="flex flex-col gap-2">
                              {chapter.lessons.map((lesson) => {
                                const isActive = currentLessonId === lesson.id;
                                return (
                                  <button
                                    key={lesson.id}
                                    onClick={() => {
                                      setCurrentLessonId(lesson.id);
                                      setExpandedChapter(chapter.id);
                                    }}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left group ${isActive ? "bg-emerald-50 border-emerald-200 shadow-sm" : "bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-200"}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {lesson.isCompleted ? (
                                        <CheckCircle2
                                          size={16}
                                          className="text-emerald-500 shrink-0"
                                        />
                                      ) : (
                                        <PlayCircle
                                          size={16}
                                          className={`shrink-0 transition-colors ${isActive ? "text-emerald-500" : "text-slate-400 group-hover:text-emerald-500"}`}
                                        />
                                      )}
                                      <span
                                        className={`text-sm ${isActive ? "text-emerald-700 font-bold" : lesson.isCompleted ? "text-slate-500 font-normal" : "text-slate-700 font-medium"}`}
                                      >
                                        {lesson.title}
                                      </span>
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === PHẦN DƯỚI: THANH ĐIỀU HƯỚNG BÀI HỌC === */}
        <div className="p-4 sm:p-5 flex items-center justify-center mt-auto">
          <Button
            onClick={handlePrevLesson}
            disabled={!hasPrev}
            variant="ghost"
            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl px-4 py-6 font-medium"
          >
            <ChevronLeft size={20} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Bài trước</span>
          </Button>

          <Button
            onClick={handleCompleteLesson}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-6 sm:px-12 py-6 font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95"
          >
            Hoàn thành bài học
          </Button>

          <Button
            onClick={handleNextLesson}
            disabled={!hasNext}
            variant="ghost"
            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl px-4 py-6 font-medium"
          >
            <span className="hidden sm:inline">Bài sau</span>
            <ChevronRight size={20} className="ml-1 sm:ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
