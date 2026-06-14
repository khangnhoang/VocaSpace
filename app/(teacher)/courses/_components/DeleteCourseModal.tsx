import React from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TeacherCourse } from "@/lib/schemas/course";

interface DeleteCourseModalProps {
  courseToDelete: TeacherCourse | null;
  setCourseToDelete: (course: TeacherCourse | null) => void;
  handleConfirmDelete: () => void;
  isPending: boolean;
}

export default function DeleteCourseModal({
  courseToDelete,
  setCourseToDelete,
  handleConfirmDelete,
  isPending,
}: DeleteCourseModalProps) {
  const title = courseToDelete?.title ?? "khóa học này";
  const slug = courseToDelete?.slug ?? "không có slug";
  const statusLabel =
    courseToDelete?.status === "published"
      ? "Đã xuất bản"
      : courseToDelete?.status === "pending"
        ? "Chờ duyệt"
        : "Bản nháp";

  return (
    <ConfirmDialog
      isOpen={!!courseToDelete}
      setIsOpen={(open) => {
        if (!open) setCourseToDelete(null);
      }}
      title="Đưa khóa học vào thùng rác?"
      description="Khóa học sẽ được ẩn khỏi danh sách đang hoạt động và có thể khôi phục lại sau nếu cần."
      details={
        <div className="flex gap-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
          <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
            {courseToDelete?.thumbnail_url ? (
              <Image
                src={courseToDelete.thumbnail_url}
                alt={title}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <BookOpen className="size-6" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <p
              className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900"
              title={title}
            >
              {title}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500" title={slug}>
              Slug: {slug}
            </p>
            <span className="mt-2 inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">
              Trạng thái: {statusLabel}
            </span>
          </div>
        </div>
      }
      confirmText="Đưa vào thùng rác"
      loadingText="Đang đưa vào thùng rác..."
      onConfirm={handleConfirmDelete}
      isLoading={isPending}
    />
  );
}
