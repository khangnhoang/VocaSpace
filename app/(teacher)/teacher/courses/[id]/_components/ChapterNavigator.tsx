"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MoveButton, MoveErrorMessage } from "./ChapterWorkbench";
import type { Chapter, ChapterMoveRequest, MoveDirection, OrderingPendingState } from "./types";

/** Từ số chương này trở lên mới hiện ô tìm chương. */
export const CHAPTER_SEARCH_THRESHOLD = 8;

export function getChapterRowId(chapterId: string) {
  return `chapter-row-${chapterId}`;
}

interface ChapterNavigatorProps {
  chapters: Chapter[];
  selectedChapterId: string | null;
  issueChapterId?: string;
  onSelect: (chapterId: string) => void;
  announce: (message: string) => void;
  canReorder: boolean;
  pendingMove: OrderingPendingState;
  moveErrorMessage: string | null;
  onMove: (request: ChapterMoveRequest) => Promise<void>;
  onRetryMove: () => void;
  /** Vùng tóm tắt đặt giữa ô tìm chương và danh sách (thanh quota bài học xem thử). */
  summary?: React.ReactNode;
  className?: string;
}

function getMoveButtonId(chapterId: string, direction: MoveDirection) {
  return `chapter-move-${direction}-button-${chapterId}`;
}

export default function ChapterNavigator({
  chapters,
  selectedChapterId,
  issueChapterId,
  onSelect,
  announce,
  canReorder,
  pendingMove,
  moveErrorMessage,
  onMove,
  onRetryMove,
  summary,
  className,
}: ChapterNavigatorProps) {
  const [query, setQuery] = useState("");
  const showSearch = chapters.length >= CHAPTER_SEARCH_THRESHOLD;
  const normalizedQuery = showSearch ? query.trim().toLocaleLowerCase("vi") : "";

  const visibleChapters = useMemo(
    () =>
      chapters
        .map((chapter, index) => ({ chapter, position: index + 1 }))
        .filter(({ chapter }) =>
          normalizedQuery
            ? chapter.title.toLocaleLowerCase("vi").includes(normalizedQuery)
            : true,
        ),
    [chapters, normalizedQuery],
  );

  useEffect(() => {
    if (!normalizedQuery) return;
    announce(
      visibleChapters.length > 0
        ? `Tìm thấy ${visibleChapters.length} chương`
        : "Không tìm thấy chương phù hợp",
    );
  }, [announce, normalizedQuery, visibleChapters.length]);

  // Nút di chuyển chỉ đổi chỗ với chương kề bên thật, nên ẩn khi đang lọc để không đổi chỗ với chương bị ẩn.
  const showMoves = canReorder && !normalizedQuery;
  const isMovePending = Boolean(pendingMove);

  const focusAfterMoveRef = useRef<{ chapterId: string; direction: MoveDirection } | null>(null);

  const handleMove = (chapterId: string, direction: MoveDirection) => {
    if (!showMoves || isMovePending) return;
    focusAfterMoveRef.current = { chapterId, direction };
    void onMove({ chapterId, direction });
  };

  // Mọi nút di chuyển bị khóa khi đang lưu nên focus rơi mất; khi lưu xong, trả focus về
  // nút vừa bấm, hoặc nút còn lại nếu chương đã tới đầu/cuối.
  useEffect(() => {
    const target = focusAfterMoveRef.current;
    if (pendingMove || !target) return;
    focusAfterMoveRef.current = null;
    const pressed = document.getElementById(getMoveButtonId(target.chapterId, target.direction));
    const other = document.getElementById(
      getMoveButtonId(target.chapterId, target.direction === "up" ? "down" : "up"),
    );
    if (pressed instanceof HTMLButtonElement && !pressed.disabled) pressed.focus();
    else other?.focus();
  }, [pendingMove, chapters]);

  useEffect(() => {
    if (!issueChapterId) return;
    document
      .getElementById(getChapterRowId(issueChapterId))
      ?.scrollIntoView?.({ block: "nearest" });
  }, [issueChapterId]);

  return (
    <nav
      id="course-chapter-list"
      aria-labelledby="chapter-navigator-heading"
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-border bg-background",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="chapter-navigator-heading" className="text-base font-semibold text-foreground">
          Chương
        </h2>
        <span className="text-sm text-muted-foreground">{chapters.length} chương</span>
      </div>

      {showSearch ? (
        <div className="border-b border-border px-3 py-3">
          <label htmlFor="chapter-navigator-search" className="sr-only">
            Tìm chương
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="chapter-navigator-search"
              type="search"
              value={query}
              placeholder="Tìm chương"
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-[8px] border border-border bg-background pl-8 pr-9 text-sm outline-none focus-visible:border-route focus-visible:ring-2 focus-visible:ring-route/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Xóa tìm kiếm"
                className="absolute right-0.5 top-1/2 -translate-y-1/2"
                onClick={() => {
                  setQuery("");
                  document.getElementById("chapter-navigator-search")?.focus();
                }}
              >
                <X aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {summary}

      {moveErrorMessage ? (
        <div className="border-b border-border px-3 pb-1">
          <MoveErrorMessage message={moveErrorMessage} onRetry={onRetryMove} />
        </div>
      ) : null}

      {visibleChapters.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Không tìm thấy chương phù hợp.
        </p>
      ) : (
        <ol className="relative min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {visibleChapters.map(({ chapter, position }) => {
            const isSelected = chapter.id === selectedChapterId;
            const isIssueTarget = chapter.id === issueChapterId;
            const movingDirection =
              pendingMove?.type === "chapter" && pendingMove.id === chapter.id
                ? pendingMove.direction
                : null;

            return (
              <li
                key={chapter.id}
                id={`dashboard-chapter-${chapter.id}`}
                className="flex items-start gap-0.5"
              >
                <button
                  id={getChapterRowId(chapter.id)}
                  type="button"
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => onSelect(chapter.id)}
                  className={cn(
                    "flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-[8px] border px-3 py-2.5 text-left outline-none transition-[background-color,border-color] duration-[120ms] focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-1 motion-reduce:transition-none",
                    isSelected
                      ? "border-route/40 bg-route-quiet"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 w-6 shrink-0 text-sm font-semibold tabular-nums",
                      isSelected ? "text-route" : "text-muted-foreground",
                    )}
                  >
                    {position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "line-clamp-2 break-words text-sm",
                        isSelected ? "font-semibold text-foreground" : "font-medium text-foreground",
                      )}
                    >
                      {chapter.title}
                    </span>
                    {typeof chapter.topicCount === "number" ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {chapter.topicCount} bài học
                      </span>
                    ) : null}
                  </span>
                  {isIssueTarget ? (
                    <span className="mt-1.5 flex shrink-0 items-center">
                      <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
                      <span className="sr-only">Cần xử lý</span>
                    </span>
                  ) : null}
                </button>
                {showMoves ? (
                  <div
                    role="group"
                    aria-label={`Thứ tự chương ${chapter.title}`}
                    className="flex shrink-0 items-center pt-1.5"
                  >
                    <MoveButton
                      id={getMoveButtonId(chapter.id, "up")}
                      label={`Di chuyển chương "${chapter.title}" lên`}
                      descriptionId={`chapter-move-up-${chapter.id}`}
                      reason={position === 1 ? "Đã ở đầu danh sách" : undefined}
                      direction="up"
                      disabled={position === 1 || isMovePending}
                      isPending={movingDirection === "up"}
                      onClick={() => handleMove(chapter.id, "up")}
                    />
                    <MoveButton
                      id={getMoveButtonId(chapter.id, "down")}
                      label={`Di chuyển chương "${chapter.title}" xuống`}
                      descriptionId={`chapter-move-down-${chapter.id}`}
                      reason={position === chapters.length ? "Đã ở cuối danh sách" : undefined}
                      direction="down"
                      disabled={position === chapters.length || isMovePending}
                      isPending={movingDirection === "down"}
                      onClick={() => handleMove(chapter.id, "down")}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
