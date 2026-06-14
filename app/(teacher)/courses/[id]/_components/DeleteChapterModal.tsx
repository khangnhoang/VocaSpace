import React from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Chapter } from "./types";

interface DeleteChapterModalProps {
  chapterToDelete: Chapter | null;
  setChapterToDelete: (chapter: Chapter | null) => void;
  handleConfirmDelete: () => void;
  isPending: boolean;
}

export default function DeleteChapterModal({
  chapterToDelete,
  setChapterToDelete,
  handleConfirmDelete,
  isPending,
}: DeleteChapterModalProps) {
  const title = chapterToDelete?.title ?? "chương này";

  return (
    <ConfirmDialog
      isOpen={!!chapterToDelete}
      setIsOpen={(open) => {
        if (!open) setChapterToDelete(null);
      }}
      title="Ẩn chương?"
      description="Chương này sẽ được ẩn khỏi khóa học. Nội dung không còn hiển thị trong luồng học đang hoạt động."
      details={
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Chương
          </p>
          <p
            className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900"
            title={title}
          >
            {title}
          </p>
        </div>
      }
      confirmText="Ẩn chương"
      loadingText="Đang ẩn chương..."
      onConfirm={handleConfirmDelete}
      isLoading={isPending}
    />
  );
}
