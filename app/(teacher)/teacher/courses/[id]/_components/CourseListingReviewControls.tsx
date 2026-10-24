"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  submitCourseReview,
  withdrawCourseReview,
} from "@/app/actions/course-review";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";

export const courseStatusLabels: Record<
  NonNullable<CourseDashboardReadiness["course"]["status"]>,
  string
> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Đã xuất bản",
};

interface CourseListingReviewControlsProps {
  readiness: CourseDashboardReadiness;
  // Chỉ đổi cách trình bày; mặc định giữ nguyên giao diện cũ (EmptyCourseDashboard dùng mặc định).
  // Trang Tổng quan hạ nút "Gửi duyệt" xuống outline khi có hành động chính khác và tự hiển thị lý do từ chối.
  emphasis?: "filled" | "outline";
  showRejectionReason?: boolean;
}

// Gửi duyệt / rút yêu cầu duyệt khóa học (AD2). Quyền thật nằm ở RPC; component chỉ ẩn nút với
// vai trò không được dùng và hiển thị lý do bị từ chối gần nhất của admin.
export default function CourseListingReviewControls({
  readiness,
  emphasis = "filled",
  showRejectionReason = true,
}: CourseListingReviewControlsProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { course, role, publishedTopicCount } = readiness;

  const canManage = role === "owner" || role === "co_owner";
  const status = course.status ?? "draft";
  const rejectionReason =
    status === "draft" && course.reviewed_at && course.reject_message
      ? course.reject_message
      : null;

  const run = async (
    action: typeof submitCourseReview,
    successMessage: string,
  ) => {
    setIsPending(true);
    try {
      const result = await action({ courseId: course.id });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      setIsConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Không thể xử lý yêu cầu duyệt khóa học. Vui lòng thử lại.");
    } finally {
      setIsPending(false);
    }
  };

  const hasPublishedTopic = publishedTopicCount > 0;

  return (
    <div className="flex flex-col gap-2">
      {rejectionReason && showRejectionReason ? (
        <div
          role="note"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800"
        >
          <p className="font-bold">Yêu cầu duyệt bị từ chối</p>
          <p className="wrap-break-word">{rejectionReason}</p>
        </div>
      ) : null}

      {canManage && status === "draft" ? (
        <>
          <Button
            type="button"
            variant={emphasis === "outline" ? "outline" : "default"}
            disabled={isPending || !hasPublishedTopic}
            aria-busy={isPending}
            size="lg"
            onClick={() =>
              void run(submitCourseReview, "Đã gửi khóa học để duyệt.")
            }
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            {isPending ? "Đang gửi duyệt..." : "Gửi duyệt"}
          </Button>
          {!hasPublishedTopic ? (
            <p className="text-xs leading-5 text-slate-500">
              Cần ít nhất 1 bài học đã xuất bản để gửi duyệt.
            </p>
          ) : null}
        </>
      ) : null}

      {canManage && status === "pending" ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setIsConfirmOpen(true)}
            className="w-full"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Rút yêu cầu duyệt
          </Button>
          <ConfirmDialog
            isOpen={isConfirmOpen}
            setIsOpen={setIsConfirmOpen}
            title="Rút yêu cầu duyệt?"
            description="Khóa học sẽ quay về bản nháp. Bạn có thể gửi duyệt lại bất cứ lúc nào."
            confirmText="Rút yêu cầu"
            loadingText="Đang rút..."
            isLoading={isPending}
            onConfirm={() =>
              void run(withdrawCourseReview, "Đã rút yêu cầu duyệt.")
            }
          />
        </>
      ) : null}
    </div>
  );
}
