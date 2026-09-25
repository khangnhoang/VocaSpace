"use client";

import React from "react";
import type { Chapter } from "./types";
import PreviewQuotaResolutionDialog, {
  type PreviewQuotaProjection,
} from "./PreviewQuotaResolutionDialog";

interface DeleteChapterModalProps {
  chapterToDelete: Chapter | null;
  setChapterToDelete: (chapter: Chapter | null) => void;
  getPreviewProjection: (chapterId: string) => Promise<{ data?: PreviewQuotaProjection; error?: string }>;
  handleConfirmDelete: (unmarkTopicIds: string[]) => Promise<{
    success?: true;
    message?: string;
    error?: string;
    previewProjection?: PreviewQuotaProjection;
  }>;
}

// Ẩn chương (soft-delete semantics preserved for teacher course authoring workflow)
export default function DeleteChapterModal({
  chapterToDelete,
  setChapterToDelete,
  getPreviewProjection,
  handleConfirmDelete,
}: DeleteChapterModalProps) {
  return (
    <PreviewQuotaResolutionDialog
      open={!!chapterToDelete}
      setOpen={(open) => {
        if (!open) setChapterToDelete(null);
      }}
      targetType="chapter"
      targetId={chapterToDelete?.id ?? null}
      targetTitle={chapterToDelete?.title ?? "chương này"}
      description="Chương sẽ được ẩn khỏi khóa học và chuyển vào danh sách đã xóa. Nội dung bên trong được giữ lại và có thể khôi phục."
      confirmText="Xóa chương"
      loadingText="Đang xóa chương…"
      getProjection={getPreviewProjection}
      onConfirm={handleConfirmDelete}
    />
  );
}
