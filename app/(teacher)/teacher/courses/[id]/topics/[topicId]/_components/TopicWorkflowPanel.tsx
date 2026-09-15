"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  approveTopicReview,
  rejectTopicReview,
  requestTopicReview,
  resolveTopicReviewEscalation,
} from "@/app/actions/topic-review";
import type { TopicWorkflow } from "@/lib/schemas/topic-workflow";
import { getCourseOverviewPath } from "@/lib/course-authoring/routes";

interface TopicWorkflowPanelProps {
  workflow: TopicWorkflow;
  onRefresh: () => void;
}

const statusCopy: Record<TopicWorkflow["status"], { label: string; className: string }> = {
  draft: { label: "Bản nháp", className: "bg-slate-100 text-slate-700" },
  pending: { label: "Đang chờ duyệt", className: "bg-amber-100 text-amber-800" },
  published: { label: "Đã xuất bản", className: "bg-emerald-100 text-emerald-800" },
};

function getNextAction(workflow: TopicWorkflow) {
  if (workflow.status === "pending") {
    return workflow.isCurrentUserSubmitter
      ? "Chờ một reviewer khác xử lý yêu cầu này. Nội dung đang bị đóng băng."
      : workflow.canReview
        ? "Kiểm tra nội dung và phê duyệt hoặc từ chối yêu cầu."
        : "Chờ reviewer có quyền xử lý yêu cầu này.";
  }

  if (workflow.status === "published") {
    return workflow.canEdit
      ? "Nội dung đã được duyệt. Mọi thay đổi sẽ cần xác nhận và đưa bài học về bản nháp."
      : "Bạn đang xem phiên bản đã xuất bản của bài học.";
  }

  if (!workflow.canEdit) return "Bạn có quyền xem nhưng không có quyền soạn nội dung.";
  if (workflow.escalationUnresolved) return "Yêu cầu đang bị giữ do escalation chưa được xử lý.";
  if (!workflow.isReady) return "Bổ sung đủ ít nhất một flashcard và một bài tập để gửi duyệt.";
  if (!workflow.hasDistinctEligibleReviewer) return "Chưa có reviewer hợp lệ khác. Hãy thêm hoặc cấp quyền reviewer cho một cộng tác viên.";
  return "Bài học đã sẵn sàng để gửi reviewer kiểm tra.";
}

export default function TopicWorkflowPanel({ workflow, onRefresh }: TopicWorkflowPanelProps) {
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isEscalationOpen, setIsEscalationOpen] = useState(false);
  const [escalationAction, setEscalationAction] = useState<"rescue" | "close" | "abandon">("rescue");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const status = statusCopy[workflow.status];
  const frozen = workflow.status === "pending";
  const reviewerActionAllowed = frozen && workflow.canReview && !workflow.isCurrentUserSubmitter && Boolean(workflow.pendingSubmissionId);

  const handleRequestReview = () => {
    if (!workflow.canRequestReview) return;
    startTransition(async () => {
      const result = await requestTopicReview({ topicId: workflow.topicId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã gửi bài học vào hàng chờ duyệt.");
      onRefresh();
    });
  };

  const handleApprove = () => {
    if (!reviewerActionAllowed || !workflow.pendingSubmissionId) return;
    startTransition(async () => {
      const result = await approveTopicReview({ submissionId: workflow.pendingSubmissionId! });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã phê duyệt bài học.");
      onRefresh();
    });
  };

  const handleReject = () => {
    if (!reviewerActionAllowed || !workflow.pendingSubmissionId) return;
    startTransition(async () => {
      const result = await rejectTopicReview({
        submissionId: workflow.pendingSubmissionId!,
        reason,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã từ chối bài học và trả về bản nháp.");
      setReason("");
      setIsRejectOpen(false);
      onRefresh();
    });
  };

  const handleResolveEscalation = () => {
    const escalationId = workflow.escalationId;
    if (!workflow.canResolveEscalation || !escalationId || reason.trim().length < 10) return;
    startTransition(async () => {
      const result = await resolveTopicReviewEscalation({
        escalationId,
        action: escalationAction,
        reason,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(escalationAction === "rescue" ? "Đã tạo rescue submission." : "Đã xử lý escalation.");
      setReason("");
      setIsEscalationOpen(false);
      onRefresh();
    });
  };

  return (
    <section
      className="mb-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      aria-labelledby="topic-workflow-title"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
              {status.label}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {workflow.role === "owner" || workflow.role === "co_owner" ? "Reviewer theo vai trò" : workflow.canReview ? "Reviewer được cấp quyền" : "Chỉ xem / soạn"}
            </span>
          </div>
          <h2 id="topic-workflow-title" className="mt-3 wrap-break-word text-xl font-bold text-slate-950">
            {workflow.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{getNextAction(workflow)}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          {workflow.status === "draft" ? (
            <Button
              type="button"
              onClick={handleRequestReview}
              disabled={!workflow.canRequestReview || isPending}
              title={!workflow.isReady ? "Cần ít nhất 1 flashcard và 1 bài tập hoạt động" : undefined}
              className="min-h-10 bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending ? <Clock3 className="animate-spin" /> : <Send />}
              Gửi duyệt
            </Button>
          ) : null}
          {reviewerActionAllowed ? (
            <div className="flex gap-2">
              <Button type="button" onClick={handleApprove} disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-700">
                <ShieldCheck /> Duyệt
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsRejectOpen(true)} disabled={isPending} className="border-rose-200 text-rose-700 hover:bg-rose-50">
                Từ chối
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-xl border p-4 ${workflow.activeFlashcardCount > 0 ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {workflow.activeFlashcardCount > 0 ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-rose-600" />}
            Flashcard hoạt động
          </div>
          <p className="mt-2 text-2xl font-black text-slate-950">{workflow.activeFlashcardCount}</p>
          <p className="mt-1 text-xs text-slate-600">Cần ít nhất 1 để gửi duyệt.</p>
        </div>
        <div className={`rounded-xl border p-4 ${workflow.activeExerciseCount > 0 ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {workflow.activeExerciseCount > 0 ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-rose-600" />}
            Bài tập hoạt động
          </div>
          <p className="mt-2 text-2xl font-black text-slate-950">{workflow.activeExerciseCount}</p>
          <p className="mt-1 text-xs text-slate-600">Cần ít nhất 1 để gửi duyệt.</p>
        </div>
      </div>

      {frozen ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <LockKeyhole className="mt-0.5 shrink-0" />
          <p>Yêu cầu đang chờ duyệt. Các thao tác thêm, sửa, ẩn hoặc khôi phục nội dung đã bị khóa cho đến khi reviewer xử lý.</p>
        </div>
      ) : null}

      {workflow.latestRejectionReason ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-bold">Lý do từ chối gần nhất</p>
          <p className="mt-1 leading-6">{workflow.latestRejectionReason}</p>
          {workflow.rejectionCount > 0 ? <p className="mt-2 text-xs font-semibold">Đã từ chối {workflow.rejectionCount}/3 lần cho submitter hiện tại.</p> : null}
        </div>
      ) : null}

      {workflow.escalationUnresolved ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900" role="alert">
          <p>Bài học đang bị giữ bởi escalation chưa được owner/co-owner xử lý.</p>
          {workflow.canResolveEscalation && workflow.escalationId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => { setEscalationAction("rescue"); setIsEscalationOpen(true); }} disabled={isPending} className="bg-orange-600 text-white hover:bg-orange-700">Rescue và gửi reviewer</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setEscalationAction("close"); setIsEscalationOpen(true); }} disabled={isPending}>Đóng escalation</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setEscalationAction("abandon"); setIsEscalationOpen(true); }} disabled={isPending} className="text-rose-700">Bỏ escalation</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!workflow.hasDistinctEligibleReviewer && workflow.canEdit ? (
        <Link
          href={`${getCourseOverviewPath(workflow.courseId)}#collaborators`}
          className="block rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          Mở quản lý cộng tác viên để thêm hoặc cấp quyền reviewer.
        </Link>
      ) : null}

      <Dialog open={isRejectOpen} onOpenChange={(open) => !isPending && setIsRejectOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu duyệt</DialogTitle>
            <DialogDescription>Lý do sẽ được lưu trong lịch sử review và gửi lại cho người submit.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nêu rõ nội dung cần chỉnh sửa..."
            minLength={10}
            maxLength={2000}
            aria-label="Lý do từ chối"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRejectOpen(false)} disabled={isPending}>Hủy</Button>
            <Button type="button" onClick={handleReject} disabled={isPending || reason.trim().length < 10} className="bg-rose-600 text-white hover:bg-rose-700">{isPending ? "Đang lưu..." : "Xác nhận từ chối"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEscalationOpen} onOpenChange={(open) => !isPending && setIsEscalationOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{escalationAction === "rescue" ? "Tạo rescue submission" : escalationAction === "close" ? "Đóng escalation" : "Bỏ escalation"}</DialogTitle>
            <DialogDescription>Thao tác sẽ được lưu như lifecycle escalation và không tính là reviewer approve/reject.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nêu lý do xử lý escalation..."
            minLength={10}
            maxLength={2000}
            aria-label="Lý do xử lý escalation"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEscalationOpen(false)} disabled={isPending}>Hủy</Button>
            <Button type="button" onClick={handleResolveEscalation} disabled={isPending || reason.trim().length < 10} className="bg-orange-600 text-white hover:bg-orange-700">{isPending ? "Đang lưu..." : "Xác nhận"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
