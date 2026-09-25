"use client";

import React from "react";
import { Trash2, RotateCcw, Loader2, ArchiveX, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Chapter } from "./types";

interface DeletedChaptersModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  deletedChapters: Chapter[];
  onRestoreChapter?: (chapter: Chapter) => void;
  restoringChapterId?: string | null;
  readOnly?: boolean;
}

export default function DeletedChaptersModal({
  open,
  setOpen,
  deletedChapters = [],
  onRestoreChapter,
  restoringChapterId = null,
  readOnly = false,
}: DeletedChaptersModalProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl bg-white p-5 sm:max-w-xl sm:p-6 shadow-2xl">
        <DialogHeader className="gap-3 pr-8">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Trash2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold leading-snug text-slate-950 sm:text-xl">
                Chương đã xóa
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed text-slate-600">
                Danh sách các chương đã bị xóa. Bạn có thể khôi phục lại bất kỳ lúc nào.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 min-w-0">
          {deletedChapters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
              <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <ArchiveX className="size-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Không có chương nào đã xóa</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                Khi bạn xóa một chương, chương đó và nội dung bên trong sẽ xuất hiện tại đây để có thể khôi phục khi cần.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
                <span>Tổng cộng {deletedChapters.length} chương</span>
                <span>Thao tác</span>
              </div>
              <div
                className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-2xs"
                role="list"
              >
                {deletedChapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    role="listitem"
                    className="flex items-center justify-between gap-3 p-3.5 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Layers className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {chapter.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Đã lưu trữ trong thùng rác
                        </p>
                      </div>
                    </div>
                    {chapter.canManage && !readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          !onRestoreChapter ||
                          restoringChapterId !== null
                        }
                        onClick={() => onRestoreChapter?.(chapter)}
                        className="shrink-0 h-9 px-3 rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
                        aria-label={`Khôi phục chương ${chapter.title}`}
                      >
                        {restoringChapterId === chapter.id ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                        )}
                        {restoringChapterId === chapter.id ? "Đang khôi phục" : "Khôi phục"}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="rounded-xl font-medium w-full sm:w-auto"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
