"use client";
import React from "react";
import { Headphones } from "lucide-react";
import { ExerciseDTO, QuestionGroupDTO } from "@/lib/schemas/learn";

interface ExerciseContextProps {
  currentExercise: ExerciseDTO;
  currentGroup?: QuestionGroupDTO;
}

export default function ExerciseContext({ currentExercise, currentGroup }: ExerciseContextProps) {
  if (!currentGroup) {
    return <div className="flex items-center justify-center h-full text-slate-500 font-medium">Không có dữ liệu bài tập.</div>;
  }

  return (
    <div className="w-full h-full border border-slate-100 shadow-sm rounded-3xl flex flex-col bg-white p-6 md:p-8 relative overflow-y-auto">
      <div className="flex flex-col gap-6 pb-12 animate-in fade-in duration-300 h-full">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-bold text-lg text-slate-800">
            {currentExercise?.title}{" "}
            <span className="text-sm font-normal text-slate-500 ml-2 uppercase bg-slate-100 px-2 py-1 rounded-md">
              {currentExercise?.part_type}
            </span>
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          {currentGroup.audio_url && (
            <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                <Headphones size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-700 mb-2">Nghe đoạn hội thoại:</p>
                <audio controls className="w-full h-10">
                  <source src={currentGroup.audio_url} type="audio/mpeg" />
                  Trình duyệt của bạn không hỗ trợ thẻ audio.
                </audio>
              </div>
            </div>
          )}

          {currentGroup.passage_text && (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
              {currentGroup.passage_text}
            </div>
          )}

          {!currentGroup.audio_url && !currentGroup.passage_text && (
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
    </div>
  );
}