"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileEdit,
  Info,
  LockKeyhole,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
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
import { PUBLISHED_DELETE_IMPACT } from "@/lib/course-authoring/published-edit-impact";
import type { TopicRejectionEntry, TopicWorkflow } from "@/lib/schemas/topic-workflow";
import { getCourseOverviewPath, getCourseStructurePath, type TopicBuilderTab } from "@/lib/course-authoring/routes";
import TopicTeamAndNotes from "./TopicTeamAndNotes";
import TopicTitleEditor from "./TopicTitleEditor";
import PreviewQuotaResolutionDialog from "../../../_components/PreviewQuotaResolutionDialog";
import BackButton from "./BackButton";
import { useAuthoringGuard, useAuthoringNavigate } from "./authoring-guard";

interface TopicWorkflowPanelProps {
  workflow: TopicWorkflow;
  onRefresh: () => void;
  activeTab: TopicBuilderTab;
  onOpenTab: (tab: TopicBuilderTab) => void;
}

const statusCopy: Record<
  TopicWorkflow["status"],
  { label: string; className: string; Icon: typeof FileEdit }
> = {
  draft: { label: "Bản nháp", className: "border-slate-300 bg-slate-100 text-slate-800", Icon: FileEdit },
  pending: {
    label: "Đang chờ duyệt",
    className: "border-attention-line bg-attention-quiet text-attention",
    Icon: Clock3,
  },
  published: { label: "Đã xuất bản", className: "border-growth-line bg-growth-quiet text-growth", Icon: CheckCircle2 },
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

const MEMORY_CHECK_GAP = "Mỗi câu memory check cần ít nhất 2 đáp án và 1 đáp án đúng trước khi gửi duyệt.";

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
  if (!workflow.isMemoryCheckReady) return MEMORY_CHECK_GAP;
  if (!workflow.isReady) return "Bổ sung đủ ít nhất một flashcard và một bài tập để gửi duyệt.";
  if (!workflow.hasDistinctEligibleReviewer) return "Chưa có người duyệt phù hợp khác. Hãy thêm hoặc cấp quyền duyệt bài học cho một cộng tác viên.";
  // Chỉ tới đây khi DTO lệch với chính các điều kiện của `canRequestReview`; giữ
  // câu trung tính thay vì khẳng định bài học đã sẵn sàng gửi duyệt.
  return "Chưa thể gửi bài học để duyệt ở trạng thái hiện tại.";
}

// Chỉ người đang soạn bản nháp mới cần biết còn thiếu gì; đủ rồi thì không hiện gì cả.
function getContentGaps(workflow: TopicWorkflow) {
  if (workflow.status !== "draft" || !workflow.canEdit) return null;
  const missing: string[] = [];
  const tabs: { tab: TopicBuilderTab; label: string }[] = [];
  if (workflow.activeFlashcardCount === 0) {
    missing.push("1 flashcard");
    tabs.push({ tab: "flashcards", label: "Mở tab Từ vựng" });
  }
  if (workflow.activeExerciseCount === 0) {
    missing.push("1 bài tập");
    tabs.push({ tab: "exercises", label: "Mở tab Bài tập" });
  }
  const messages = missing.length > 0 ? [`Còn thiếu ${missing.join(" và ")} để gửi duyệt.`] : [];
  if (!workflow.isMemoryCheckReady) {
    messages.push(MEMORY_CHECK_GAP);
    tabs.push({ tab: "memory-check", label: "Mở tab Memory check" });
  }
  return messages.length > 0 ? { messages, tabs } : null;
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
      ? "Bài học đang xuất bản: chỉnh sửa được lưu và hiển thị cho học viên ngay, không cần duyệt lại. Xóa nội dung hoặc đổi đáp án đúng sẽ hỏi xác nhận trước."
      : "Bạn đang xem phiên bản đã xuất bản của bài học.";
  }

  // Đủ điều kiện thì nút Gửi duyệt đã tự nói; thiếu nội dung thì khung cảnh báo nói, không lặp lại ở đây.
  if (workflow.canEdit && !workflow.isCurrentUserContributor && getContentGaps(workflow)) return null;
  return getSubmitBlockedReason(workflow);
}

function getReviewAccessLabel(workflow: TopicWorkflow) {
  if (workflow.canReview) {
    return workflow.role === "owner" || workflow.role === "co_owner" ? "Có quyền duyệt theo vai trò" : "Có quyền duyệt";
  }
  // Nhóm tác giả không được duyệt bài của chính mình, kể cả khi là chủ sở hữu hay đồng sở hữu khóa học.
  return workflow.canEdit ? "Tác giả bài này, không tự duyệt được" : "Chỉ xem";
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

function personLabel(identity: TopicWorkflow["responsibleAuthor"]) {
  return identity.fullName?.trim() || identity.email || "Không rõ";
}

export default function TopicWorkflowPanel({ workflow, onRefresh, activeTab, onOpenTab }: TopicWorkflowPanelProps) {
  const guard = useAuthoringGuard();
  const navigate = useAuthoringNavigate();
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
  const nextAction = getNextAction(workflow);
  const contentGaps = getContentGaps(workflow);

  // AC6: hành động vòng đời chỉ chạy sau khi editor đang sửa đã lưu thành công hoặc bị bỏ thay đổi.
  const runAfterLeave = async (action: () => void) => {
    if (guard.hasDirtyEditor() && !(await guard.confirmLeave())) return;
    action();
  };

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
    const isPublished = workflow.status === "published";
    const result = await deleteTopic({
      topicId: workflow.topicId,
      // Hộp thoại xóa chính là bước xác nhận (có cảnh báo ảnh hưởng học viên), nên gửi cờ xác nhận mà server yêu cầu.
      confirmPublished: isPublished,
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
    void navigate(getCourseStructurePath(workflow.courseId), "replace");
    return result;
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      <TopicTeamAndNotes workflow={workflow} onRefresh={onRefresh} />
      {workflow.status === "draft" && workflow.canEdit ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            onClick={() => void runAfterLeave(handleRequestReview)}
            disabled={!workflow.canRequestReview || isPending}
            aria-disabled={!workflow.canRequestReview || isPending}
            aria-describedby={submitDescriptionId}
            className="min-h-11 sm:min-h-9"
          >
            {isPending ? <Clock3 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
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
                  className="text-slate-600 hover:text-slate-900"
                >
                  <Info aria-hidden="true" />
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
          onClick={() => void runAfterLeave(handleWithdrawReview)}
          disabled={!workflow.canWithdrawReview || isPending}
          aria-disabled={!workflow.canWithdrawReview || isPending}
          aria-describedby={!workflow.canWithdrawReview ? withdrawDescriptionId : undefined}
          className="min-h-11 sm:min-h-9"
        >
          <LockKeyhole aria-hidden="true" /> Quay về chỉnh sửa
        </Button>
      ) : null}
      {reviewerActionAllowed ? (
        <>
          <Button
            type="button"
            onClick={() => void runAfterLeave(handleApprove)}
            disabled={isPending}
            className="min-h-11 sm:min-h-9"
          >
            <ShieldCheck aria-hidden="true" /> Duyệt
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void runAfterLeave(() => setIsRejectOpen(true))}
            disabled={isPending}
            className="min-h-11 text-correction sm:min-h-9"
          >
            Từ chối
          </Button>
        </>
      ) : null}
      {workflow.canDeleteTopic ? (
        <Button
          type="button"
          variant="destructive-quiet"
          onClick={() => void runAfterLeave(() => setIsDeleteDialogOpen(true))}
          disabled={isPending}
          className="min-h-11 sm:min-h-9"
        >
          <Trash2 aria-hidden="true" />{" "}
          {frozen && workflow.canWithdrawReview ? "Hủy gửi duyệt và xóa bài học" : "Xóa bài học"}
        </Button>
      ) : null}
    </div>
  );

  return (
    <header
      className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5"
      aria-labelledby="topic-workflow-title"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-600">
        <BackButton courseId={workflow.courseId} chapterId={workflow.chapterId} />
        <span aria-hidden="true">/</span>
        <span>Soạn bài học</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2 lg:flex-1">
          <TopicTitleEditor
            id="topic-workflow-title"
            topicId={workflow.topicId}
            title={workflow.title}
            canEdit={workflow.canEdit && !frozen}
            onSaved={onRefresh}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-bold ${status.className}`}
            >
              <status.Icon className="size-3.5" aria-hidden="true" />
              {status.label}
            </span>
            <span className="text-slate-700">
              Phụ trách:{" "}
              <span className="font-semibold text-slate-900">{personLabel(workflow.responsibleAuthor)}</span>
            </span>
            <span className="text-slate-600">
              ·{" "}
              {getReviewAccessLabel(workflow)}
            </span>
          </div>
          {nextAction ? <p className="max-w-3xl text-sm leading-6 text-slate-700">{nextAction}</p> : null}
        </div>
        <div className="min-w-0 lg:max-w-[60%]">{actions}</div>
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

      {contentGaps ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-attention-line bg-attention-quiet px-4 py-2.5 text-sm leading-6 text-slate-900">
          <div className="flex min-w-0 items-start gap-2.5">
            <AlertTriangle className="mt-1 size-4 shrink-0 text-attention" aria-hidden="true" />
            <div className="min-w-0">
              {contentGaps.messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {contentGaps.tabs
              .filter(({ tab }) => tab !== activeTab)
              .map(({ tab, label }) => (
                <Button
                  key={tab}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 bg-white sm:min-h-8"
                  onClick={() => onOpenTab(tab)}
                >
                  {label}
                </Button>
              ))}
          </div>
        </div>
      ) : null}

      {frozen ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-attention-line bg-attention-quiet px-4 py-3 text-sm text-slate-900"
          role="status"
        >
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden="true" />
          <p>
            Yêu cầu đang chờ duyệt. Thao tác thêm, sửa và khôi phục nội dung đang bị khóa; thao tác xóa riêng sẽ
            hủy yêu cầu duyệt trước khi ẩn bài học.
          </p>
        </div>
      ) : null}

      {workflow.status !== "published" && newestRejection ? (
        <div className="rounded-xl border border-correction-line bg-correction-quiet px-4 py-3 text-sm text-slate-900">
          <p className="font-bold text-correction">{`Đã bị từ chối duyệt: ${rejectionHistory.length} lần`}</p>
          <ul className="mt-2 space-y-2" aria-label="Lịch sử từ chối duyệt">
            {visibleHistory.map((entry) => (
              <RejectionHistoryItem key={entry.index} entry={entry} emphasis={entry.index === newestRejection.index} />
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

      {!workflow.hasDistinctEligibleReviewer && workflow.canEdit ? (
        <Link
          href={`${getCourseOverviewPath(workflow.courseId)}#collaborators`}
          className="block rounded-xl border border-route-line bg-route-quiet px-4 py-3 text-sm font-semibold text-route hover:bg-white"
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
        publishedImpact={workflow.status === "published" ? PUBLISHED_DELETE_IMPACT.topic : undefined}
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
            <Button type="button" variant="destructive" onClick={handleReject} disabled={isPending || reason.trim().length < 10}>{isPending ? "Đang lưu..." : "Xác nhận từ chối"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
