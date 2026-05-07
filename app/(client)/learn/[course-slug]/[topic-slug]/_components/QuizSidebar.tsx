"use client";
import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, BookOpenText, XCircle } from "lucide-react";
import { QuestionDTO, QuestionOptionDTO } from "@/lib/schemas/learn";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuizSidebarProps {
  learningStage: 1 | 2;
  currentQuestion?: QuestionDTO;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentGroupIndex: number;
  totalGroups: number;
  sortedOptions: QuestionOptionDTO[];
  selectedOption: string | null;
  setSelectedOption: (id: string | null) => void; // Sửa lại type để nhận null
  handlePrevQuestion: () => void;
  handleNextQuestion: () => void;
}

export default function QuizSidebar({
  learningStage, currentQuestion, currentQuestionIndex, totalQuestions,
  currentGroupIndex, totalGroups, sortedOptions, selectedOption,
  setSelectedOption, handlePrevQuestion, handleNextQuestion,
}: QuizSidebarProps) {
  
  const [isPending, startTransition] = useTransition();

  // STATE QUẢN LÝ HỘP THOẠI GIẢI THÍCH LỖI SAI
  const [explanationData, setExplanationData] = useState({
    isOpen: false,
    content: "",
  });

  if (learningStage === 1) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center gap-4 mt-20">
        <BookOpenText size={48} className="opacity-20" />
        <p>Hoàn thành học từ vựng để mở khóa phần bài tập nhé!</p>
      </div>
    );
  }

  if (!currentQuestion) {
    return <div className="flex items-center justify-center h-full text-slate-400">Không có câu hỏi nào.</div>;
  }

  // HÀM XỬ LÝ CHẤM ĐIỂM
  const onSubmitAnswer = () => {
    if (!selectedOption) return toast.error("Vui lòng chọn một đáp án!");
    if (!currentQuestion) return;

    startTransition(async () => {
      const res = await submitQuestionAnswer(currentQuestion.id, selectedOption);
      if (res.error) {
        toast.error(res.error);
        return;
      }

      if (res.isCorrect) {
        toast.success("Chính xác!");
        setTimeout(() => handleNextQuestion(), 500); 
      } else {
        // NẾU SAI: Bật Dialog hiển thị giải thích
        setExplanationData({
          isOpen: true,
          content: res.explanation || "Rất tiếc đáp án chưa chính xác. Bạn hãy đọc lại ngữ liệu và thử lại nhé!",
        });
      }
    });
  };

  const handleCloseExplanation = () => {
    setExplanationData({ isOpen: false, content: "" });
    setSelectedOption(null); // Bỏ chọn đáp án sai để user chọn lại
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300 h-full flex flex-col relative">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 text-lg">Câu hỏi {currentQuestionIndex + 1}/{totalQuestions}</h3>
        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Nhóm {currentGroupIndex + 1}/{totalGroups}</span>
      </div>

      <div className="mt-2 flex-1">
        <p className="font-bold text-slate-800 leading-relaxed mb-6 text-base">{currentQuestion.content}</p>
        <div className="flex flex-col gap-3">
          {sortedOptions.map((opt: QuestionOptionDTO, index: number) => {
            const isSelected = selectedOption === opt.id;
            const label = String.fromCharCode(65 + index);
            return (
              <button
                key={opt.id} onClick={() => setSelectedOption(opt.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 font-medium ${isSelected ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}
              >
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>{label}</span>
                {opt.content}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 mt-auto flex flex-col gap-3">
        <Button 
          disabled={isPending} 
          onClick={onSubmitAnswer} 
          className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-6 font-bold shadow-md"
        >
          {isPending ? "Đang kiểm tra..." : "Xác nhận đáp án"}
        </Button>
        <div className="flex items-center justify-between">
          <Button onClick={handlePrevQuestion} variant="ghost" className="text-slate-500 hover:text-slate-800 px-2"><ChevronLeft size={18} className="mr-1"/> Câu trước</Button>
          <Button onClick={handleNextQuestion} variant="ghost" className="text-slate-500 hover:text-slate-800 px-2">Câu sau <ChevronRight size={18} className="ml-1"/></Button>
        </div>
      </div>

      {/* HỘP THOẠI GIẢI THÍCH (SHADCN DIALOG) */}
      <Dialog open={explanationData.isOpen} onOpenChange={handleCloseExplanation}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl border-rose-100 shadow-2xl z-100">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                <XCircle size={24} />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Chưa chính xác!
              </DialogTitle>
            </div>
            {/* Ẩn description để tránh warning của Radix UI */}
            <DialogDescription className="hidden">Giải thích đáp án sai</DialogDescription>
          </DialogHeader>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 mt-2">
            <p className="text-slate-700 leading-relaxed font-medium">
              {explanationData.content}
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button 
              onClick={handleCloseExplanation} 
              className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-8 font-bold"
            >
              Đã hiểu, Thử lại
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}