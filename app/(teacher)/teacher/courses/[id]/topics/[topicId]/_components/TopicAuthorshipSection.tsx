"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  BellRing,
  Loader2,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  addTopicContributor,
  removeTopicContributor,
  transferTopicResponsibility,
} from "@/app/actions/topic-authorship";
import { getCourseCollaboratorMembers } from "@/app/actions/course-collaborator";
import type { CourseCollaboratorOverview } from "@/lib/schemas/course-collaborator";
import type { TopicWorkflow } from "@/lib/schemas/topic-workflow";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TopicAuthorshipSectionProps {
  workflow: TopicWorkflow;
  onRefresh: () => void;
}

function identityLabel(identity: TopicWorkflow["originalCreator"] | CourseCollaboratorOverview) {
  return identity.fullName?.trim() || identity.email || `ID ${identity.userId.slice(0, 8)}…`;
}

const roleLabels: Record<CourseCollaboratorOverview["role"], string> = {
  owner: "chủ sở hữu",
  co_owner: "đồng sở hữu",
  editor: "biên tập viên",
  previewer: "chỉ xem trước",
};

function IdentityCard({
  label,
  identity,
  tone = "slate",
}: {
  label: string;
  identity: TopicWorkflow["originalCreator"];
  tone?: "slate" | "blue" | "emerald";
}) {
  const toneClassName = {
    slate: "border-slate-200 bg-slate-50/70",
    blue: "border-blue-100 bg-blue-50/60",
    emerald: "border-emerald-100 bg-emerald-50/60",
  }[tone];

  return (
    <div className={`rounded-xl border p-3 ${toneClassName}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-900">{identityLabel(identity)}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{identity.email || identity.userId}</p>
        </div>
      </div>
    </div>
  );
}

export default function TopicAuthorshipSection({ workflow, onRefresh }: TopicAuthorshipSectionProps) {
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<CourseCollaboratorOverview[]>([]);
  const [selectedContributorId, setSelectedContributorId] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [contributorToRemove, setContributorToRemove] = useState<string | null>(null);

  const currentGroupUserIds = new Set([
    workflow.originalCreator.userId,
    workflow.responsibleAuthor.userId,
    ...workflow.contributors.map((contributor) => contributor.userId),
  ]);
  const memberByUserId = new Map(members.map((member) => [member.userId, member]));
  const contributorCandidates = members.filter(
    (member) =>
      ["owner", "co_owner", "editor"].includes(member.role) &&
      !currentGroupUserIds.has(member.userId),
  );
  const currentContributorUserIds = new Set(workflow.contributors.map((contributor) => contributor.userId));
  const responsibilityCandidates = members.filter(
    (member) =>
      member.userId !== workflow.responsibleAuthor.userId &&
      ["owner", "co_owner", "editor"].includes(member.role) &&
      ((member.userId === currentUserId && ["owner", "co_owner"].includes(member.role)) ||
        currentContributorUserIds.has(member.userId)),
  );

  const loadMembers = async () => {
    const result = await getCourseCollaboratorMembers({ courseId: workflow.courseId });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCurrentUserId(result.data.currentUserId);
    setMembers(result.data.members);
  };

  const handleOpenManagement = () => {
    if (workflow.status === "pending") return;
    setIsManagementOpen(true);
    void loadMembers();
  };

  const finishMutation = async (action: string, task: () => Promise<{ error?: string }>, successMessage: string) => {
    setPendingAction(action);
    const result = await task();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(successMessage);
      setIsManagementOpen(false);
      setSelectedContributorId("");
      setSelectedRecipientId("");
      onRefresh();
    }
    setPendingAction(null);
  };

  const handleAddContributor = () => {
    if (!selectedContributorId) return;
    void finishMutation(
      "add",
      () => addTopicContributor({ topicId: workflow.topicId, userId: selectedContributorId }),
      "Đã thêm người đóng góp vào nhóm tác giả.",
    );
  };

  const handleTransfer = () => {
    if (!selectedRecipientId) return;
    void finishMutation(
      "transfer",
      () => transferTopicResponsibility({ topicId: workflow.topicId, recipientUserId: selectedRecipientId }),
      "Đã chuyển trách nhiệm bài học.",
    );
  };

  const handleRemove = (contributorId: string) => {
    setContributorToRemove(contributorId);
  };

  const confirmRemove = () => {
    if (!contributorToRemove) return;
    const contributorId = contributorToRemove;
    setContributorToRemove(null);
    void finishMutation(
      `remove:${contributorId}`,
      () => removeTopicContributor({ contributorId }),
      "Đã gỡ người đóng góp khỏi nhóm tác giả.",
    );
  };

  // U9: the group is exactly the set the DB authorizes for content edits, so
  // ask the capability instead of re-deriving it from two of its three parts —
  // a creator who transferred responsibility is still in the group.
  const inCurrentGroup = workflow.canEdit;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5" aria-labelledby="topic-authorship-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <UsersRound className="size-4 text-blue-600" aria-hidden="true" />
              <span id="topic-authorship-title">Nhóm tác giả bài học</span>
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
              {workflow.contributors.length}/2 người đóng góp
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Người tạo và người phụ trách đều có thể gửi hoặc gửi lại yêu cầu duyệt; người đóng góp có thể hỗ trợ soạn nội dung.
          </p>
        </div>
        {workflow.canManageAuthorship ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenManagement}
            disabled={workflow.status === "pending"}
            className="shrink-0 border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
          >
            <UsersRound className="size-4" aria-hidden="true" />
            Quản lý nhóm
          </Button>
        ) : null}
      </div>

      {!inCurrentGroup ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
          Bạn là cộng tác viên của khóa học nhưng chưa thuộc nhóm tác giả bài học này, nên chỉ có thể xem nội dung.
        </p>
      ) : null}

      <div className={workflow.originalCreator.userId === workflow.responsibleAuthor.userId ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>
        {workflow.originalCreator.userId === workflow.responsibleAuthor.userId ? (
          <IdentityCard label="Người tạo và phụ trách hiện tại" identity={workflow.responsibleAuthor} tone="blue" />
        ) : (
          <>
            <IdentityCard label="Người phụ trách hiện tại" identity={workflow.responsibleAuthor} tone="blue" />
            <IdentityCard label="Người tạo ban đầu" identity={workflow.originalCreator} />
          </>
        )}
      </div>

      {workflow.contributors.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Người đóng góp hiện tại</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {workflow.contributors.map((contributor) => (
              <div key={contributor.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <UserRound className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{identityLabel(contributor)}</p>
                  <p className="truncate text-xs text-slate-500">{contributor.email || contributor.userId}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Chưa có người đóng góp. Người phụ trách vẫn có thể tự soạn bài học.</p>
      )}

      {workflow.latestAuthorshipFeedback ? (
        <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm text-violet-950" role="status">
          <BellRing className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden="true" />
          <p className="leading-6">
            Bạn có cập nhật trách nhiệm cần xử lý trên bài học này. Hãy kiểm tra người phụ trách hiện tại trước khi gửi duyệt.
          </p>
        </div>
      ) : null}

      <Dialog open={isManagementOpen} onOpenChange={(open) => !pendingAction && setIsManagementOpen(open)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quản lý nhóm tác giả</DialogTitle>
            <DialogDescription>
              Chỉ chủ sở hữu hoặc đồng sở hữu được thay đổi nhóm. Các thay đổi bị khóa khi bài học đang chờ duyệt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
                <Plus className="size-4" aria-hidden="true" /> Thêm người đóng góp
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">Tối đa 2 người đóng góp và phải là thành viên có quyền soạn nội dung.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Select value={selectedContributorId} onValueChange={setSelectedContributorId} disabled={Boolean(pendingAction) || contributorCandidates.length === 0}>
                  <SelectTrigger aria-label="Người đóng góp mới" className="h-10 min-w-0 flex-1 bg-white">
                    <SelectValue placeholder={contributorCandidates.length === 0 ? "Không còn thành viên phù hợp" : "Chọn thành viên"} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {contributorCandidates.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {identityLabel(member)} · {roleLabels[member.role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={handleAddContributor} disabled={!selectedContributorId || Boolean(pendingAction)} className="bg-blue-600 text-white hover:bg-blue-700">
                  {pendingAction === "add" ? <Loader2 className="animate-spin" aria-hidden="true" /> : "Thêm"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
                <ArrowRightLeft className="size-4" aria-hidden="true" /> Chuyển người phụ trách
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">Người nhận chỉ có thể là chủ sở hữu, đồng sở hữu đang thao tác hoặc người đóng góp hiện hữu của bài học.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId} disabled={Boolean(pendingAction) || responsibilityCandidates.length === 0}>
                  <SelectTrigger aria-label="Người phụ trách mới" className="h-10 min-w-0 flex-1 bg-white">
                    <SelectValue placeholder={responsibilityCandidates.length === 0 ? "Chưa có người nhận phù hợp" : "Chọn người nhận"} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {responsibilityCandidates.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {identityLabel(member)} · {roleLabels[member.role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={handleTransfer} disabled={!selectedRecipientId || Boolean(pendingAction)} className="bg-amber-600 text-white hover:bg-amber-700">
                  {pendingAction === "transfer" ? <Loader2 className="animate-spin" aria-hidden="true" /> : "Chuyển trách nhiệm"}
                </Button>
              </div>
              {responsibilityCandidates.length === 0 ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" role="status">
                  Chưa có người nhận phù hợp. Hãy thêm người đóng góp hiện hữu vào nhóm tác giả hoặc tải lại dữ liệu trước khi chuyển trách nhiệm.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-900">Người đóng góp hiện tại</p>
              {workflow.contributors.length === 0 ? <p className="text-sm text-slate-500">Chưa có người đóng góp để gỡ.</p> : workflow.contributors.map((contributor) => {
                const member = memberByUserId.get(contributor.userId);
                const removeAction = `remove:${contributor.id}`;
                return (
                  <div key={contributor.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{identityLabel(member ?? contributor)}</p>
                      <p className="truncate text-xs text-slate-500">{contributor.email || contributor.userId}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(contributor.id)} disabled={Boolean(pendingAction)} className="shrink-0 text-rose-700 hover:bg-rose-50">
                      {pendingAction === removeAction ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <><Trash2 className="size-4" aria-hidden="true" /> Gỡ</>}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsManagementOpen(false)} disabled={Boolean(pendingAction)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={Boolean(contributorToRemove)}
        setIsOpen={(open) => { if (!open) setContributorToRemove(null); }}
        title="Gỡ người đóng góp?"
        description="Người này sẽ không còn thuộc nhóm tác giả của bài học. Lịch sử bài học vẫn được giữ lại."
        confirmText="Gỡ khỏi nhóm"
        loadingText="Đang gỡ..."
        onConfirm={confirmRemove}
        isLoading={pendingAction?.startsWith("remove:") ?? false}
      />

      {workflow.status === "pending" ? (
        <p className="text-xs font-semibold text-amber-800">Nhóm tác giả đang bị khóa cùng bài học chờ duyệt.</p>
      ) : null}
    </section>
  );
}
