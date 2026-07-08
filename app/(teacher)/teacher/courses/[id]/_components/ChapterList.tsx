import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Chapter,
  type ChapterMoveRequest,
  type OrderingPendingState,
  type TopicMoveRequest,
} from "./types";
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
  onMoveChapter?: (request: ChapterMoveRequest) => Promise<void> | void;
  onMoveTopic?: (request: TopicMoveRequest) => Promise<void> | void;
  pendingMove?: OrderingPendingState;
  moveError?: string | null;
}

export default function ChapterList({
  chapters,
  isLoading,
  setChapterToDelete,
  onEditChapter,
  onTopicsChanged,
  onAuthoringSuccess,
  highlightedChapterId,
  onMoveChapter,
  onMoveTopic,
  pendingMove = null,
  moveError = null,
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
      {moveError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          {moveError}
        </div>
      ) : null}

      <div className="space-y-4">
        {chapters.map((chapter, index) => {
          const isFirst = index === 0;
          const isLast = index === chapters.length - 1;
          const hasMoveHandler = Boolean(onMoveChapter);
          const isMovePending = Boolean(pendingMove);
          const isMovingUp =
            pendingMove?.type === "chapter" &&
            pendingMove.id === chapter.id &&
            pendingMove.direction === "up";
          const isMovingDown =
            pendingMove?.type === "chapter" &&
            pendingMove.id === chapter.id &&
            pendingMove.direction === "down";
          const upDisabled = isFirst || isMovePending || !hasMoveHandler;
          const downDisabled = isLast || isMovePending || !hasMoveHandler;
          const upDescriptionId = `chapter-move-up-${chapter.id}`;
          const downDescriptionId = `chapter-move-down-${chapter.id}`;
          const missingHandlerTitle = "Chưa kết nối thao tác đổi thứ tự";
          const upTitle = !hasMoveHandler
            ? missingHandlerTitle
            : isFirst
              ? "Đã ở đầu danh sách"
              : `Di chuyển chương "${chapter.title}" lên`;
          const downTitle = !hasMoveHandler
            ? missingHandlerTitle
            : isLast
              ? "Đã ở cuối danh sách"
              : `Di chuyển chương "${chapter.title}" xuống`;

          return (
            <article
              key={chapter.id}
              id={`dashboard-chapter-${chapter.id}`}
              className={`flex max-w-full flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md sm:flex-row sm:flex-wrap sm:items-center ${
                highlightedChapterId === chapter.id
                  ? "border-blue-400 ring-2 ring-blue-200"
                  : "border-slate-200"
              }`}
            >
              <div className="flex min-w-0 max-w-full flex-1 flex-col gap-3 sm:min-w-64 sm:flex-row sm:items-center">
                <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                    {chapter.order_index}
                  </div>
                  <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:ml-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Sửa chương ${chapter.title}`}
                      className="size-10 shrink-0 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 sm:hidden"
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
                      className="size-10 shrink-0 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 sm:hidden"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Di chuyển chương "${chapter.title}" lên`}
                      aria-describedby={upDescriptionId}
                      title={upTitle}
                      disabled={upDisabled}
                      className="size-10 rounded-md text-slate-500 hover:bg-white hover:text-blue-600 disabled:cursor-not-allowed sm:size-7"
                      onClick={() =>
                        onMoveChapter?.({
                          chapterId: chapter.id,
                          direction: "up",
                        })
                      }
                    >
                      {isMovingUp ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <ArrowUp size={16} aria-hidden="true" />
                      )}
                    </Button>
                    <span id={upDescriptionId} className="sr-only">
                      {upTitle}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Di chuyển chương "${chapter.title}" xuống`}
                      aria-describedby={downDescriptionId}
                      title={downTitle}
                      disabled={downDisabled}
                      className="size-10 rounded-md text-slate-500 hover:bg-white hover:text-blue-600 disabled:cursor-not-allowed sm:size-7"
                      onClick={() =>
                        onMoveChapter?.({
                          chapterId: chapter.id,
                          direction: "down",
                        })
                      }
                    >
                      {isMovingDown ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <ArrowDown size={16} aria-hidden="true" />
                      )}
                    </Button>
                    <span id={downDescriptionId} className="sr-only">
                      {downTitle}
                    </span>
                  </div>
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

              <div className="flex w-full max-w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 w-full max-w-full justify-center whitespace-normal rounded-lg px-3 py-2 text-center sm:min-h-9 sm:w-auto sm:text-left"
                  onClick={() => setSelectedChapter(chapter)}
                >
                  <FileText size={16} aria-hidden="true" />
                  Quản lý bài học
                </Button>
                <div className="hidden items-center gap-2 sm:flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Sửa chương ${chapter.title}`}
                    className="size-11 shrink-0 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 sm:size-8"
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
                    className="size-11 shrink-0 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 sm:size-8"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <TopicManagementSheet
        key={selectedChapter?.id || "empty-sheet"}
        chapter={selectedChapter}
        onClose={() => setSelectedChapter(null)}
        onTopicsChanged={onTopicsChanged}
        onAuthoringSuccess={onAuthoringSuccess}
        onMoveTopic={onMoveTopic}
        pendingMove={pendingMove}
        moveError={moveError}
      />
    </>
  );
}
