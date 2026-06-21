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
      <div className="flex justify-center py-20" role="status">
        <Loader2
          className="animate-spin text-blue-500"
          size={40}
          aria-hidden="true"
        />
        <span className="sr-only">Đang tải danh sách chương.</span>
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
            className="flex max-w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md sm:flex-row sm:flex-wrap sm:items-center"
          >
            <div className="flex min-w-0 max-w-full flex-1 items-center gap-4 sm:min-w-64">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                {chapter.order_index}
              </div>
              <div className="min-w-0 max-w-full flex-1">
                <h3 className="wrap-break-word text-lg font-bold text-slate-900">
                  {chapter.title}
                </h3>
                <p className="text-sm text-slate-500">
                  Tạo ngày:{" "}
                  {new Date(chapter.created_at).toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>

            <div className="flex w-full max-w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-9 max-w-full whitespace-normal rounded-lg py-2 text-left"
                onClick={() => setSelectedChapter(chapter)}
              >
                <FileText size={16} aria-hidden="true" />
                Quản lý bài học
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Sửa chương ${chapter.title}`}
                className="shrink-0 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                onClick={() => onEditChapter(chapter)}
              >
                <Pencil size={18} aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Ẩn chương ${chapter.title}`}
                onClick={() => setChapterToDelete(chapter)}
                className="shrink-0 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={18} aria-hidden="true" />
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
