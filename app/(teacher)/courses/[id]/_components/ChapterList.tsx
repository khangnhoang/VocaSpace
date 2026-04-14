import React from "react";
import { GripVertical, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Chapter } from "./types";

interface ChapterListProps {
  chapters: Chapter[];
  isLoading: boolean;
  setChapterToDelete: (id: string) => void;
}

export default function ChapterList({ chapters, isLoading, setChapterToDelete }: ChapterListProps) {
  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  }

  if (chapters.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
        <p className="text-slate-500 font-medium">Khóa học này chưa có chương nào. Hãy bắt đầu xây dựng cấu trúc!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {chapters.map((chapter) => (
        <div key={chapter.id} className="group flex items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
          <div className="p-2 text-slate-300 group-hover:text-slate-500 cursor-grab mr-2">
            <GripVertical size={20} />
          </div>
          
          <div className="flex-1 flex items-center gap-4">
            <div className="bg-slate-100 text-slate-600 font-bold w-10 h-10 rounded-lg flex items-center justify-center text-sm">
              {chapter.order_index}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">{chapter.title}</h3>
              <p className="text-sm text-slate-500">Tạo ngày: {new Date(chapter.created_at).toLocaleDateString('vi-VN')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600 hover:bg-blue-50">
              <Pencil size={18} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => { e.stopPropagation(); setChapterToDelete(chapter.id); }}
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={18} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}