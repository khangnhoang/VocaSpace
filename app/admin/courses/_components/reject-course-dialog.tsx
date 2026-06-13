import React, { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  rejectCourseSchema,
  type RejectCourseInput,
} from "@/lib/schemas/admin-course";
import type { AdminCourse } from "./admin-course-table";

interface RejectCourseDialogProps {
  open: boolean;
  course: AdminCourse | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: RejectCourseInput) => Promise<boolean> | boolean;
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

function getStatusLabel(status: string | null) {
  if (status === "pending") return "Chờ duyệt";
  if (status === "published") return "Xuất bản";
  if (status === "draft") return "Bản nháp";
  return "Không rõ";
}

export function RejectCourseDialog({
  open,
  course,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: RejectCourseDialogProps) {
  const [rejectMessage, setRejectMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const courseTitle = course?.title ?? "khóa học đã chọn";

  const handleOpenChange = (newOpen: boolean) => {
    if (isSubmitting) return;

    if (!newOpen) {
      setRejectMessage("");
      setError(null);
    }

    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!course) return;

    const validation = rejectCourseSchema.safeParse({
      courseId: course.id,
      rejectMessage,
    });

    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }

    setError(null);
    const confirmed = await onConfirm(validation.data);

    if (confirmed) {
      setRejectMessage("");
      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSubmitting}
        className="max-h-[calc(100vh-2rem)] overflow-y-auto border border-slate-800 bg-[#111827] text-slate-200 shadow-2xl shadow-black sm:max-w-[520px]"
      >
        <DialogHeader>
          <DialogTitle className="text-xl text-white">
            Từ chối khóa học
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Cung cấp lý do rõ ràng để giáo viên biết cần sửa những gì trước khi
            gửi lại yêu cầu.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4">
          <div className="flex gap-4">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
              {course?.thumbnail_url ? (
                <Image
                  src={course.thumbnail_url}
                  alt={course.title}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                  No img
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold text-slate-100">
                {courseTitle}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500">
                {course?.slug ?? "-"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 font-medium text-orange-300">
                  {getStatusLabel(course?.status ?? null)}
                </span>
                <span className="rounded-md border border-[#00C4D4]/20 bg-[#00C4D4]/10 px-2 py-1 font-medium text-[#00C4D4]">
                  {formatPrice(course?.price)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 py-2">
          <div className="grid gap-3">
            <Label
              htmlFor="rejectMessage"
              className="font-semibold text-slate-300"
            >
              Lý do từ chối
            </Label>
            <Textarea
              id="rejectMessage"
              placeholder="Ví dụ: Vui lòng bổ sung ảnh bìa chất lượng cao và hoàn thiện bài tập trắc nghiệm..."
              value={rejectMessage}
              onChange={(event) => setRejectMessage(event.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "rejectMessage-error" : undefined}
              className="h-32 resize-none rounded-xl border-slate-700 bg-[#0B1120] text-slate-200 placeholder:text-slate-600 transition-all hover:border-slate-600 focus-visible:border-red-500/50 focus-visible:ring-red-500/50"
            />
            {error && (
              <p
                id="rejectMessage-error"
                className="text-sm font-medium text-red-500"
              >
                {error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2 !border-none !bg-transparent">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="border-slate-700 bg-transparent text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
            aria-label={`Hủy từ chối ${courseTitle}`}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !course}
            className="bg-red-600 text-white shadow-lg shadow-red-900/20 transition-all hover:bg-red-500"
            aria-label={`Xác nhận từ chối ${courseTitle}`}
          >
            {isSubmitting ? "Đang xử lý..." : "Xác nhận từ chối"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
