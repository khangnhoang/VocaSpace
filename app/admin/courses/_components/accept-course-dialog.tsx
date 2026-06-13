import React from "react";
import Image from "next/image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdminCourse } from "./admin-course-table";

interface AcceptCourseDialogProps {
  open: boolean;
  course: AdminCourse | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean> | boolean;
}

function formatPrice(price?: number | null) {
  if (typeof price !== "number") return "-";
  if (price === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
}

export function AcceptCourseDialog({
  open,
  course,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: AcceptCourseDialogProps) {
  const courseTitle = course?.title ?? "khóa học đã chọn";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className="max-h-[calc(100vh-2rem)] w-[95vw] overflow-y-auto border border-slate-800 bg-[#111827] p-6 text-slate-200 shadow-2xl shadow-black sm:w-full sm:p-8 !max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-left text-2xl text-white">
            Xuất bản khóa học này?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-base text-slate-400">
            Hành động này sẽ đưa khóa học lên trang chủ và cho phép học viên bắt
            đầu đăng ký.
          </AlertDialogDescription>

          <div className="mt-5 flex w-full flex-col items-start gap-4 overflow-hidden rounded-xl border border-slate-800 bg-[#0B1120] p-4 text-left sm:flex-row sm:gap-6 sm:p-5">
            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-inner sm:w-[200px]">
              {course?.thumbnail_url ? (
                <Image
                  src={course.thumbnail_url}
                  alt={course.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 200px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-500">
                  Không có ảnh
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
              <div className="min-w-0">
                <p className="line-clamp-2 text-lg font-bold leading-snug text-slate-100 sm:text-xl">
                  {courseTitle}
                </p>
                <p className="mt-1.5 block w-full truncate text-sm text-slate-500 sm:mt-2">
                  {course?.slug ?? "-"}
                </p>
              </div>

              <div className="mt-4 pt-2 sm:mt-auto">
                <span className="inline-flex items-center rounded-md border border-[#00C4D4]/20 bg-[#00C4D4]/10 px-3 py-1.5 text-sm font-bold text-[#00C4D4] shadow-sm">
                  {formatPrice(course?.price)}
                </span>
              </div>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-8 !border-none !bg-transparent">
          <AlertDialogCancel
            disabled={isSubmitting}
            className="mt-3 w-full px-6 py-2.5 transition-all hover:!bg-slate-800 hover:!text-white sm:mt-0 sm:w-auto !border-slate-700 !bg-transparent !text-slate-300"
            aria-label={`Hủy xuất bản ${courseTitle}`}
          >
            Hủy bỏ
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              if (!isSubmitting && course) void onConfirm();
            }}
            disabled={isSubmitting || !course}
            className="w-full px-6 py-2.5 text-white shadow-lg shadow-emerald-900/20 transition-all sm:w-auto !border-0 !bg-emerald-600 hover:!bg-emerald-500 !text-white"
            aria-label={`Đồng ý xuất bản ${courseTitle}`}
          >
            {isSubmitting ? "Đang xử lý..." : "Đồng ý xuất bản"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
