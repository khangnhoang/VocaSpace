"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Chapter } from "./types";

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
  className?: string;
}

export default function ChapterNavigator({
  chapters,
  selectedChapterId,
  issueChapterId,
  onSelect,
  announce,
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

      {visibleChapters.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Không tìm thấy chương phù hợp.
        </p>
      ) : (
        <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {visibleChapters.map(({ chapter, position }) => {
            const isSelected = chapter.id === selectedChapterId;
            const isIssueTarget = chapter.id === issueChapterId;

            return (
              <li key={chapter.id} id={`dashboard-chapter-${chapter.id}`}>
                <button
                  id={getChapterRowId(chapter.id)}
                  type="button"
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => onSelect(chapter.id)}
                  className={cn(
                    "flex min-h-11 w-full items-start gap-3 rounded-[8px] border px-3 py-2.5 text-left outline-none transition-[background-color,border-color] duration-[120ms] focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-1 motion-reduce:transition-none",
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
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
