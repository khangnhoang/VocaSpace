import React, { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chapter } from "./types";
import TopicManagementSheet from "./TopicManagementSheet";
import type { CourseAuthoringSuccessEvent } from "@/lib/course-authoring/issue-success";

interface ChapterListProps {
  chapters: Chapter[];
  isLoading: boolean;
  setChapterToDelete: (chapter: Chapter) => void;
  onEditChapter: (chapter: Chapter) => void;
  onTopicsChanged?: (chapterId: string) => Promise<void> | void;
  onAuthoringSuccess?: (event: CourseAuthoringSuccessEvent) => boolean;
  highlightedChapterId?: string;
}

export default function ChapterList({
  chapters,
  isLoading,
  setChapterToDelete,
  onEditChapter,
  onTopicsChanged,
  onAuthoringSuccess,
  highlightedChapterId,
}: ChapterListProps) {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const scrolledChapterIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightedChapterId || isLoading) return;
    if (scrolledChapterIdRef.current === highlightedChapterId) return;

    scrolledChapterIdRef.current = highlightedChapterId;
    document
      .getElementById(`dashboard-chapter-${highlightedChapterId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedChapterId, isLoading]);

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
            id={`dashboard-chapter-${chapter.id}`}
            className={`flex max-w-full flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md sm:flex-row sm:flex-wrap sm:items-center ${
              highlightedChapterId === chapter.id
                ? "border-blue-400 ring-2 ring-blue-200"
                : "border-slate-200"
            }`}
          >
            <div className="flex min-w-0 max-w-full flex-1 items-center gap-4 sm:min-w-64">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                {chapter.order_index}
              </div>
              <div className="min-w-0 max-w-full flex-1">
                <h3 className="wrap-break-word text-lg font-bold text-slate-900">
                  {chapter.title}
                </h3>
                {highlightedChapterId === chapter.id ? (
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    Dashboard đang đánh dấu chương này.
                  </p>
                ) : null}
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
        onTopicsChanged={onTopicsChanged}
        onAuthoringSuccess={onAuthoringSuccess}
      />
    </>
  );
}
