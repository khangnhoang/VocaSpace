import React, { useState } from "react";
import { FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chapter } from "./types";
import TopicManagementSheet from "./TopicManagementSheet";

interface ChapterListProps {
  chapters: Chapter[];
  isLoading: boolean;
  setChapterToDelete: (chapter: Chapter) => void;
  onEditChapter: (chapter: Chapter) => void;
}

export default function ChapterList({
  chapters,
  isLoading,
  setChapterToDelete,
  onEditChapter,
}: ChapterListProps) {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
        <p className="text-slate-500 font-medium">
          Khóa học này chưa có chương nào. Hãy bắt đầu xây dựng cấu trúc!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {chapters.map((chapter) => (
          <article
            key={chapter.id}
            className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-blue-300 sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-center gap-4">
              <div className="bg-slate-100 text-slate-600 font-bold w-10 h-10 rounded-lg flex items-center justify-center text-sm">
                {chapter.order_index}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-lg break-words">
                  {chapter.title}
                </h3>
                <p className="text-sm text-slate-500">
                  Tạo ngày:{" "}
                  {new Date(chapter.created_at).toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => setSelectedChapter(chapter)}
              >
                <FileText size={16} />
                Quản lý bài học
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Sửa chương ${chapter.title}`}
                className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => onEditChapter(chapter)}
              >
                <Pencil size={18} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Ẩn chương ${chapter.title}`}
                onClick={() => setChapterToDelete(chapter)}
                className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={18} />
              </Button>
            </div>
          </article>
        ))}
      </div>

      <TopicManagementSheet
        key={selectedChapter?.id || "empty-sheet"}
        chapter={selectedChapter}
        onClose={() => setSelectedChapter(null)}
      />
    </>
  );
}
