"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approveCourseReview, rejectCourseReview } from "@/app/actions/admin-course-review";
import { moderateCourse } from "@/app/actions/admin-course-moderation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  moderateCourseSchema,
  rejectCourseSchema,
  type AdminCourseListRow,
} from "@/lib/schemas/admin-course";
import { formatPrice, type CourseActionKind } from "./admin-course-format";

// Các Server Action trả `{ error }` khi thất bại, `{ success, data }` khi thành công.
type ActionResult = { error?: string; success?: boolean; data?: unknown };

type ActionConfig = {
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel: string;
  successMessage: string;
  destructive: boolean;
  // Chỉ các action cần lý do mới có: nhãn ô nhập, gợi ý, giới hạn độ dài và hậu quả hiển thị trước khi xác nhận.
  reason?: {
    label: string;
    placeholder: string;
    max: number;
    consequence: string;
    validate: (value: string) => string | null;
  };
};

function firstIssue(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : (result.error?.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
}

const REASON_PLACEHOLDER = "Nêu cụ thể để giáo viên biết cần sửa gì...";

const actionConfigs: Record<CourseActionKind, ActionConfig> = {
  approve: {
    title: "Duyệt khóa học này?",
    description: "Khóa học sẽ được xuất bản và hiển thị công khai trong danh mục khóa học, học viên có thể đăng ký ngay.",
    confirmLabel: "Duyệt khóa học",
    busyLabel: "Đang duyệt...",
    successMessage: "Đã duyệt khóa học.",
    destructive: false,
  },
  reject: {
    title: "Từ chối khóa học",
    description: "Khóa học quay về bản nháp. Giáo viên sẽ thấy lý do này, chỉnh sửa rồi có thể gửi duyệt lại.",
    confirmLabel: "Từ chối khóa học",
    busyLabel: "Đang từ chối...",
    successMessage: "Đã từ chối khóa học.",
    destructive: true,
    reason: {
      label: "Lý do từ chối",
      placeholder: REASON_PLACEHOLDER,
      max: 1000,
      consequence: "Lý do hiển thị cho giáo viên ở khóa học bản nháp.",
      validate: (value) => firstIssue(rejectCourseSchema.shape.rejectMessage.safeParse(value)),
    },
  },
  demote: {
    title: "Hạ khóa học về bản nháp",
    description:
      "Khóa học rời khỏi danh mục công khai và quay về bản nháp. Giáo viên có thể chỉnh sửa và gửi duyệt lại.",
    confirmLabel: "Hạ về bản nháp",
    busyLabel: "Đang hạ về bản nháp...",
    successMessage: "Đã hạ khóa học về bản nháp.",
    destructive: false,
    reason: {
      label: "Lý do hạ khóa học",
      placeholder: REASON_PLACEHOLDER,
      max: 2000,
      consequence: "Lý do được lưu lại trong nhật ký xử lý nội dung.",
      validate: (value) => firstIssue(moderateCourseSchema.shape.reason.safeParse(value)),
    },
  },
  takedown: {
    title: "Gỡ khóa học",
    description:
      "Khóa học bị gỡ khỏi danh mục công khai và khỏi việc giảng dạy, các đánh dấu xem thử bị xóa. Khóa học sẽ nằm ở tab Đã gỡ và màn hình này không có chức năng khôi phục.",
    confirmLabel: "Gỡ khóa học",
    busyLabel: "Đang gỡ...",
    successMessage: "Đã gỡ khóa học.",
    destructive: true,
    reason: {
      label: "Lý do gỡ khóa học",
      placeholder: "Nêu lý do gỡ để lưu vào nhật ký xử lý nội dung...",
      max: 2000,
      consequence: "Lý do được lưu lại trong nhật ký xử lý nội dung.",
      validate: (value) => firstIssue(moderateCourseSchema.shape.reason.safeParse(value)),
    },
  },
};

async function runAction(kind: CourseActionKind, courseId: string, reason: string): Promise<ActionResult> {
  if (kind === "approve") return approveCourseReview({ courseId });
  if (kind === "reject") return rejectCourseReview({ courseId, rejectMessage: reason });
  return moderateCourse({ courseId, action: kind, reason });
}

type CourseActionDialogProps = {
  kind: CourseActionKind;
  course: AdminCourseListRow;
  onClose: () => void;
  // Radix trả focus khi dialog đóng; caller chặn mặc định và đặt focus về nút đã mở.
  onCloseAutoFocus: (event: Event) => void;
  // Gọi sau khi server xác nhận thành công; caller đóng dialog và làm mới danh sách.
  onDone: () => void;
};

/**
 * Dialog xác nhận một hành động duyệt/từ chối/hạ/gỡ trên một khóa học (AD3 AC5-AC7).
 * Mount mới cho mỗi lần mở (caller dùng key) nên lý do cũ không lọt sang lần sau; khi server từ chối, lý do và dialog được giữ
 * nguyên để sửa rồi thử lại. Danh sách được làm mới sau mỗi lần server từ chối vì dòng trên màn hình có thể đã cũ (AD3 G5).
 */
export function CourseActionDialog({ kind, course, onClose, onCloseAutoFocus, onDone }: CourseActionDialogProps) {
  const router = useRouter();
  const config = actionConfigs[kind];
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Khóa đồng bộ: state chưa kịp render giữa hai lần bấm rất nhanh, ref chặn gửi hai lần.
  const submittingRef = useRef(false);

  const trimmedLength = reason.trim().length;
  const reasonId = `course-action-reason-${kind}`;
  const reasonDescribedBy = [fieldError ? `${reasonId}-error` : null, `${reasonId}-help`].filter(Boolean).join(" ");

  const handleOpenChange = (open: boolean) => {
    if (!open && !submittingRef.current) onClose();
  };

  const submit = async () => {
    if (submittingRef.current) return;
    if (config.reason) {
      const problem = config.reason.validate(reason);
      if (problem) {
        setFieldError(problem);
        return;
      }
    }
    setFieldError(null);
    setServerError(null);
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await runAction(kind, course.id, reason);
      if (result.error) {
        setServerError(result.error);
        router.refresh();
        return;
      }
      toast.success(config.successMessage);
      onDone();
    } catch {
      setServerError("Không thể xử lý yêu cầu. Vui lòng thử lại.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSubmitting}
        onCloseAutoFocus={onCloseAutoFocus}
        className="dark max-h-[calc(100dvh-2rem)] overflow-y-auto border border-slate-700 bg-[#111827] text-slate-200 shadow-2xl shadow-black sm:max-w-[520px]"
      >
        <DialogHeader>
          <DialogTitle className="text-xl leading-snug text-white">{config.title}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-300">{config.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-slate-700 bg-[#0B1120] p-3">
          <p className="text-xs font-semibold text-slate-400">Khóa học</p>
          <p className="mt-1 font-semibold break-words text-white">{course.title}</p>
          <p className="mt-0.5 text-xs break-all text-slate-400">
            {course.slug} · {formatPrice(course.price)}
          </p>
        </div>

        {config.reason ? (
          <div className="grid gap-2">
            <Label htmlFor={reasonId} className="font-semibold text-slate-200">
              {config.reason.label}
            </Label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isSubmitting}
              placeholder={config.reason.placeholder}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={reasonDescribedBy}
              aria-required="true"
              className="h-32 resize-none rounded-lg border-slate-500 bg-[#0B1120] text-slate-100 placeholder:text-slate-400 focus-visible:border-route focus-visible:ring-route/50"
            />
            <div className="flex items-start justify-between gap-3 text-xs">
              <p id={`${reasonId}-help`} className="text-slate-400">
                {config.reason.consequence}
              </p>
              <p className="shrink-0 text-slate-300 tabular-nums">
                {trimmedLength}/{config.reason.max}
              </p>
            </div>
            {fieldError ? (
              <p id={`${reasonId}-error`} className="text-sm font-medium text-red-300">
                {fieldError}
              </p>
            ) : null}
          </div>
        ) : null}

        {serverError ? (
          <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
            {serverError}
          </p>
        ) : null}

        <DialogFooter className="border-slate-700 bg-[#0B1120]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white"
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant={config.destructive ? "destructive" : "default"}
            onClick={() => void submit()}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {isSubmitting ? config.busyLabel : config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
