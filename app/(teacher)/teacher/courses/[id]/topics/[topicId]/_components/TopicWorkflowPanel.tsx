"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Info, LockKeyhole, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  approveTopicReview,
  rejectTopicReview,
  requestTopicReview,
} from "@/app/actions/topic-review";
import { deleteTopic, withdrawReviewToDraft } from "@/app/actions/topic";
import { getTopicDeletePreviewProjection } from "@/app/actions/course-preview";
import type { TopicRejectionEntry, TopicWorkflow } from "@/lib/schemas/topic-workflow";
import { confirmPublishedTopicMutation } from "@/lib/course-authoring/topic-workflow";
import { getCourseOverviewPath, getCourseStructurePath } from "@/lib/course-authoring/routes";
import TopicAuthorshipSection from "./TopicAuthorshipSection";
import TopicReviewNotes from "./TopicReviewNotes";
import PreviewQuotaResolutionDialog from "../../../_components/PreviewQuotaResolutionDialog";

interface TopicWorkflowPanelProps {
  workflow: TopicWorkflow;
  onRefresh: () => void;
}

const statusCopy: Record<TopicWorkflow["status"], { label: string; className: string }> = {
  draft: { label: "Bản nháp", className: "bg-slate-100 text-slate-700" },
  pending: { label: "Đang chờ duyệt", className: "bg-amber-100 text-amber-800" },
  published: { label: "Đã xuất bản", className: "bg-emerald-100 text-emerald-800" },
};

// Mẫu thời gian Owner đã chốt: `HH:mm · dd/MM/yyyy`, 24 giờ — không dùng mặc
// định locale vì có thể ra "2:32 CH".
function formatReviewMoment(iso: string) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const day = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `${time} · ${day}`;
}

// D22/M18: lý do chặn gửi duyệt là MỘT nguồn duy nhất, dùng chung cho câu mô tả
// vòng đời phía trên và cho affordance ngay tại action. Trả về `null` khi action
// thật sự khả dụng, để không bao giờ hiện lý do quyền lúc nút đang bật.
function getSubmitBlockedReason(workflow: TopicWorkflow) {
  if (workflow.canRequestReview) return null;
  if (!workflow.canEdit) return "Bạn có quyền xem nhưng không có quyền soạn nội dung.";
  // D22: `d1_topic_group_member` is exactly {creator, responsible, active
  // contributor}, and after the `!canEdit` return above those are the only
  // actors that reach here. Within that set the contributor is the only one
  // forbidden to submit, so contributor is the real discriminator — testing
  // responsible/submitter would wrongly accuse a creator who transferred
  // responsibility, who may still submit.
  if (workflow.isCurrentUserContributor) {
    return "Chỉ người tạo hoặc người phụ trách có thể gửi bài học để duyệt.";
  }
  if (!workflow.isReady) return "Bổ sung đủ ít nhất một flashcard và một bài tập để gửi duyệt.";
  if (!workflow.hasDistinctEligibleReviewer) return "Chưa có người duyệt phù hợp khác. Hãy thêm hoặc cấp quyền duyệt bài học cho một cộng tác viên.";
  // Chỉ tới đây khi DTO lệch với chính các điều kiện của `canRequestReview`; giữ
  // câu trung tính thay vì khẳng định bài học đã sẵn sàng gửi duyệt.
  return "Chưa thể gửi bài học để duyệt ở trạng thái hiện tại.";
}

function getNextAction(workflow: TopicWorkflow) {
  if (workflow.status === "pending") {
    return workflow.isCurrentUserSubmitter
      ? "Chờ một người duyệt khác xử lý yêu cầu này. Nội dung đang bị đóng băng."
      : workflow.canReview
        ? "Kiểm tra nội dung và phê duyệt hoặc từ chối yêu cầu."
        : "Chờ người duyệt có quyền xử lý yêu cầu này.";
  }

  if (workflow.status === "published") {
    return workflow.canEdit
      ? "Nội dung đã được duyệt. Mọi thay đổi sẽ cần xác nhận và đưa bài học về bản nháp."
      : "Bạn đang xem phiên bản đã xuất bản của bài học.";
  }

  return getSubmitBlockedReason(workflow) ?? "Bài học đã sẵn sàng để gửi người duyệt kiểm tra.";
}

function rejectionReviewerLabel(entry: TopicRejectionEntry) {
  if (!entry.reviewer) return "không còn trong hệ thống";
  return entry.reviewer.fullName?.trim() || entry.reviewer.email || "không còn trong hệ thống";
}

function RejectionHistoryItem({
  entry,
  emphasis,
}: {
  entry: TopicRejectionEntry;
  emphasis: boolean;
}) {
  return (
    <li
      className={
        emphasis
          ? "rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2"
          : "rounded-lg border border-slate-200 bg-white px-3 py-2"
      }
    >
      <p className={emphasis ? "text-xs font-bold text-rose-900" : "text-xs font-semibold text-slate-700"}>
        {`Lần ${entry.index}`}
      </p>
      <p className="mt-1 text-sm leading-6 wrap-break-word text-slate-800">{entry.reason}</p>
      <p className="mt-1 text-xs text-slate-600">
        {`Người đánh giá: ${rejectionReviewerLabel(entry)}`}
      </p>
      <p className="mt-0.5 text-xs text-slate-600">{formatReviewMoment(entry.reviewedAt)}</p>
    </li>
  );
}

export default function TopicWorkflowPanel({ workflow, onRefresh }: TopicWorkflowPanelProps) {
  const router = useRouter();
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const status = statusCopy[workflow.status];
  const frozen = workflow.status === "pending";
  const reviewerActionAllowed = frozen && workflow.canReview && !workflow.isCurrentUserSubmitter && Boolean(workflow.pendingSubmissionId);
  const rejectionHistory = workflow.rejectionHistory;
  const newestRejection = rejectionHistory[rejectionHistory.length - 1] ?? null;
  const hasCollapsibleHistory = rejectionHistory.length >= 3;
  const visibleHistory =
    hasCollapsibleHistory && !isHistoryExpanded
      ? newestRejection
        ? [newestRejection]
        : []
      : rejectionHistory;
  const submitDescriptionId = `topic-submit-reason-${workflow.topicId}`;
  const withdrawDescriptionId = `topic-withdraw-reason-${workflow.topicId}`;
  // M18: khi action bị chặn vì quyền, lý do phải nằm ngay tại action. Dùng chung
  // một nguồn với câu vòng đời để copy không bao giờ nói "sẵn sàng gửi duyệt"
  // trong lúc `canRequestReview === false`.
  const submitBlockedReason = getSubmitBlockedReason(workflow);
  const submitReasonCopy = submitBlockedReason ?? "Bài học đã sẵn sàng để gửi người duyệt kiểm tra.";

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

  const handleWithdrawReview = () => {
    if (!workflow.canWithdrawReview) return;
    startTransition(async () => {
      const result = await withdrawReviewToDraft({ topicId: workflow.topicId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã hủy yêu cầu duyệt và quay về chỉnh sửa.");
      onRefresh();
    });
  };

  // D33: one RPC for every actor. Creator and responsible author cancel a
  // pending submission on the way out; an owner outside the group just deletes.
  const handleDeleteTopic = async (unmarkTopicIds: string[]) => {
    if (!workflow.canDeleteTopic) return { error: "Bạn không có quyền ẩn bài học này." };
    const fromPending = frozen;
    const confirmPublished = workflow.status === "published"
      ? confirmPublishedTopicMutation("Việc xóa bài học")
      : false;
    if (workflow.status === "published" && !confirmPublished) return { cancelled: true };

    const result = await deleteTopic({
      topicId: workflow.topicId,
      confirmPublished,
      unmarkTopicIds,
    });
    if (result.error) return result;
    toast.success(
      fromPending
        ? "Đã hủy yêu cầu duyệt và xóa bài học."
        : "Đã xóa bài học khỏi khóa học.",
    );
    // M27: `router.refresh()` sẽ render lại chính route topic vừa bị xóa và
    // ném TOPIC_NOT_FOUND. Điều hướng về Structure là nơi duy nhất còn dữ
    // liệu đúng; `deleteTopic` đã revalidate course overview + structure.
    router.push(getCourseStructurePath(workflow.courseId));
    return result;
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
              {workflow.role === "owner" || workflow.role === "co_owner" ? "Có quyền duyệt theo vai trò" : workflow.canReview ? "Có quyền duyệt" : "Chỉ xem / soạn"}
            </span>
          </div>
          <h2 id="topic-workflow-title" className="mt-3 wrap-break-word text-xl font-bold text-slate-950">
            {workflow.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{getNextAction(workflow)}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          {workflow.status === "draft" && workflow.canEdit ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                onClick={handleRequestReview}
                disabled={!workflow.canRequestReview || isPending}
                aria-disabled={!workflow.canRequestReview || isPending}
                aria-describedby={submitDescriptionId}
                className="min-h-10 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isPending ? <Clock3 className="animate-spin" /> : <Send />}
                Gửi duyệt
              </Button>
              {/* M18: một `button` disabled không nhận pointer/focus event, nên
                  tooltip bọc quanh nó sẽ không bao giờ mở. Dùng affordance info
                  liền kề — một button thật, mở được bằng cả hover và keyboard
                  focus — để lý do quyền nằm ngay tại action thay vì chỉ ở câu
                  mô tả phía trên. */}
              {submitBlockedReason ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Vì sao chưa gửi duyệt được"
                      className="text-slate-500 hover:text-slate-900"
                    >
                      <Info />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{submitBlockedReason}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          ) : null}
          {frozen && (workflow.canWithdrawReview || workflow.isCurrentUserContributor) ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleWithdrawReview}
              disabled={!workflow.canWithdrawReview || isPending}
              aria-disabled={!workflow.canWithdrawReview || isPending}
              aria-describedby={!workflow.canWithdrawReview ? withdrawDescriptionId : undefined}
              className="min-h-10 border-slate-200 text-slate-700"
            >
              Quay về chỉnh sửa 🔒
            </Button>
          ) : null}
          {frozen && workflow.canDeleteTopic ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isPending}
              className="min-h-10 border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <Trash2 /> {workflow.canWithdrawReview ? "Hủy gửi duyệt và xóa bài học" : "Xóa bài học"}
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

      {/* D28/M18: a disabled button cannot take focus, so its `title` never
          reaches keyboard users. The same permission-aware reason is rendered
          as text here for `aria-describedby` AND at the action via the adjacent
          info tooltip, so sighted and AT users read the same sentence. */}
      <span id={submitDescriptionId} className="sr-only">
        {submitReasonCopy}
      </span>
      {/* U6 (D28/D34): a contributor sees the withdraw action disabled, with the
          verbatim reason the Owner specified — otherwise the frozen `pending`
          state has no affordance explaining who can unlock it. */}
      <span id={withdrawDescriptionId} className="sr-only">
        Chỉ người tạo hoặc người phụ trách có thể hủy yêu cầu duyệt.
      </span>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-xl border p-4 ${workflow.activeFlashcardCount > 0 ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {workflow.activeFlashcardCount > 0 ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-amber-600" />}
            Flashcard hoạt động
          </div>
          <p className="mt-2 text-2xl font-black text-slate-950">{workflow.activeFlashcardCount}</p>
          <p className="mt-1 text-xs text-slate-600">Cần ít nhất 1 để gửi duyệt.</p>
        </div>
        <div className={`rounded-xl border p-4 ${workflow.activeExerciseCount > 0 ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {workflow.activeExerciseCount > 0 ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-amber-600" />}
            Bài tập hoạt động
          </div>
          <p className="mt-2 text-2xl font-black text-slate-950">{workflow.activeExerciseCount}</p>
          <p className="mt-1 text-xs text-slate-600">Cần ít nhất 1 để gửi duyệt.</p>
        </div>
      </div>

      <TopicAuthorshipSection workflow={workflow} onRefresh={onRefresh} />

      {frozen ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <LockKeyhole className="mt-0.5 shrink-0" />
          <p>Yêu cầu đang chờ duyệt. Thao tác thêm, sửa và khôi phục nội dung đang bị khóa; thao tác xóa riêng sẽ hủy yêu cầu duyệt trước khi ẩn bài học.</p>
        </div>
      ) : null}

      {workflow.status !== "published" && newestRejection ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-bold">{`Đã bị từ chối duyệt: ${rejectionHistory.length} lần`}</p>
          <ul className="mt-2 space-y-2">
            {visibleHistory.map((entry) => (
              <RejectionHistoryItem
                key={entry.index}
                entry={entry}
                emphasis={entry.index === newestRejection.index}
              />
            ))}
          </ul>
          {hasCollapsibleHistory ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setIsHistoryExpanded((expanded) => !expanded)}
            >
              {isHistoryExpanded ? "Thu gọn lịch sử" : `Xem tất cả ${rejectionHistory.length} lần`}
            </Button>
          ) : null}
        </div>
      ) : null}

      <TopicReviewNotes />

      {!workflow.hasDistinctEligibleReviewer && workflow.canEdit ? (
        <Link
          href={`${getCourseOverviewPath(workflow.courseId)}#collaborators`}
          className="block rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          Mở quản lý cộng tác viên để thêm hoặc cấp quyền duyệt bài học.
        </Link>
      ) : null}

      <PreviewQuotaResolutionDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        targetType="topic"
        targetId={workflow.topicId}
        targetTitle={workflow.title}
        description={frozen
          ? "Bài học đang chờ duyệt. Tiếp tục sẽ hủy yêu cầu duyệt và ẩn bài học; nội dung vẫn có thể khôi phục."
          : "Bài học sẽ được ẩn khỏi cấu trúc đang hoạt động. Nội dung bên trong được giữ lại và có thể khôi phục."}
        confirmText={frozen && workflow.canWithdrawReview ? "Hủy gửi duyệt và xóa bài học" : "Xóa bài học"}
        loadingText="Đang cập nhật bài học…"
        getProjection={getTopicDeletePreviewProjection}
        onConfirm={handleDeleteTopic}
      />

      <Dialog open={isRejectOpen} onOpenChange={(open) => !isPending && setIsRejectOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu duyệt</DialogTitle>
            <DialogDescription>Lý do sẽ được lưu trong lịch sử duyệt và gửi lại cho người gửi yêu cầu.</DialogDescription>
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

    </section>
  );
}
