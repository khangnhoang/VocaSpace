"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Loader2, MailPlus, Settings2, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCourseCollaboratorOverview,
  getCourseCollaboratorInvitations,
  removeCourseCollaborator,
  revokeCourseCollaboratorInvitation,
  sendCourseCollaboratorInvitation,
  setCourseCollaboratorReviewCapability,
  updateCourseCollaboratorRole,
} from "@/app/actions/course-collaborator";
import type { CourseCollaboratorInvitation, CourseCollaboratorOverview } from "@/lib/schemas/course-collaborator";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";

interface CollaboratorManagementDialogProps {
  courseId: string;
  actorRole: CourseDashboardReadiness["role"];
}

const roleLabels: Record<CourseCollaboratorOverview["role"], string> = {
  owner: "Chủ sở hữu",
  co_owner: "Đồng sở hữu",
  editor: "Biên tập viên",
  previewer: "Chỉ xem trước",
};

function initials(member: CourseCollaboratorOverview) {
  return member.fullName?.trim().charAt(0).toUpperCase() || "U";
}

export default function CollaboratorManagementDialog({ courseId, actorRole }: CollaboratorManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<CourseCollaboratorOverview[]>([]);
  const [invitations, setInvitations] = useState<CourseCollaboratorInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"co_owner" | "editor" | "previewer">("editor");
  const [inviteCanReview, setInviteCanReview] = useState(false);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    const [membersResult, invitationsResult] = await Promise.all([
      getCourseCollaboratorOverview({ courseId }),
      getCourseCollaboratorInvitations({ courseId }),
    ]);
    if ("error" in membersResult) toast.error(membersResult.error);
    else setMembers(membersResult.data);
    if ("error" in invitationsResult) toast.error(invitationsResult.error);
    else setInvitations(invitationsResult.data);
    setIsLoading(false);
  }, [courseId]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void loadMembers();
  };

  const updateMember = async (memberId: string, task: () => Promise<{ error?: string }>) => {
    setPendingId(memberId);
    const result = await task();
    if (result.error) toast.error(result.error);
    else await loadMembers();
    setPendingId(null);
  };

  const handleCapabilityChange = (member: CourseCollaboratorOverview) => {
    void updateMember(member.id, async () =>
      setCourseCollaboratorReviewCapability({
        collaboratorId: member.id,
        canReviewTopics: !member.canReviewTopics,
      }),
    );
  };

  const handleRoleChange = (member: CourseCollaboratorOverview, role: "editor" | "previewer") => {
    if (!window.confirm(`Đổi vai trò của ${member.fullName || "cộng tác viên này"} thành ${roleLabels[role]}? Nếu đây là reviewer cuối, hệ thống sẽ từ chối thay đổi.`)) return;
    void updateMember(member.id, async () =>
      updateCourseCollaboratorRole({ collaboratorId: member.id, role }),
    );
  };

  const handleRemove = (member: CourseCollaboratorOverview) => {
    if (!window.confirm(`Xóa ${member.fullName || "cộng tác viên này"} khỏi khóa học? Nếu đây là reviewer cuối, hệ thống sẽ từ chối thay đổi.`)) return;
    void updateMember(member.id, async () =>
      removeCourseCollaborator({ collaboratorId: member.id }),
    );
  };

  const handleSendInvitation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    void (async () => {
      setPendingId("invite");
      const result = await sendCourseCollaboratorInvitation({
        courseId,
        email: inviteEmail,
        role: inviteRole,
        canReviewTopics: inviteRole === "editor" || inviteRole === "previewer" ? inviteCanReview : false,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Đã gửi lời mời cộng tác viên.");
        setInviteEmail("");
        setInviteCanReview(false);
        await loadMembers();
      }
      setPendingId(null);
    })();
  };

  const handleRevokeInvitation = (invitation: CourseCollaboratorInvitation) => {
    if (!window.confirm("Thu hồi lời mời đang chờ này?")) return;
    void (async () => {
      setPendingId(invitation.id);
      const result = await revokeCourseCollaboratorInvitation({ invitationId: invitation.id });
      if (result.error) toast.error(result.error);
      else await loadMembers();
      setPendingId(null);
    })();
  };

  const counts = members.reduce<Record<string, number>>((result, member) => {
    result[member.role] = (result[member.role] ?? 0) + 1;
    return result;
  }, {});

  return (
    <>
      <Button type="button" variant="outline" onClick={() => handleOpenChange(true)} className="min-h-10 border-blue-200 text-blue-700 hover:bg-blue-50">
        <Users /> Quản lý cộng tác viên
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 /> Cộng tác viên khóa học</DialogTitle>
            <DialogDescription>Quyền soạn nội dung và quyền duyệt topic được tính theo membership hiện tại. Lời mời được lưu để người nhận xử lý sau.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            {(["owner", "co_owner", "editor", "previewer"] as const).map((role) => (
              <span key={role} className="rounded-full bg-slate-100 px-3 py-1">{roleLabels[role]}: {counts[role] ?? 0}</span>
            ))}
          </div>

          <form onSubmit={handleSendInvitation} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-900"><MailPlus className="size-4" /> Mời cộng tác viên</div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-end">
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Email tài khoản
                <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="member@example.com" type="email" required disabled={pendingId === "invite"} className="bg-white" />
              </label>
              <div className="space-y-1 text-xs font-semibold text-slate-700">
                <span>Vai trò</span>
                <Select
                  value={inviteRole}
                  onValueChange={(value) => {
                    const nextRole = value as typeof inviteRole;
                    setInviteRole(nextRole);
                    if (nextRole === "co_owner") setInviteCanReview(false);
                  }}
                  disabled={pendingId === "invite"}
                >
                  <SelectTrigger aria-label="Vai trò lời mời" className="h-10 w-full border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:ring-blue-500/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="border-slate-200 bg-white p-1 shadow-lg">
                    {actorRole === "owner" ? <SelectItem value="co_owner" className="focus:bg-blue-50 focus:text-blue-900">Đồng sở hữu</SelectItem> : null}
                    <SelectItem value="editor" className="focus:bg-blue-50 focus:text-blue-900">Biên tập viên</SelectItem>
                    <SelectItem value="previewer" className="focus:bg-blue-50 focus:text-blue-900">Chỉ xem trước</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={pendingId === "invite"} className="min-h-10 bg-blue-600 text-white hover:bg-blue-700">{pendingId === "invite" ? <Loader2 className="animate-spin" /> : "Gửi lời mời"}</Button>
            </div>
            {inviteRole !== "co_owner" ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={inviteCanReview} onChange={(event) => setInviteCanReview(event.target.checked)} disabled={pendingId === "invite"} /> Có thể duyệt topic</label>
            ) : null}
          </form>

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">Membership hiện tại</h3>
                {members.map((member) => {
                const isOwner = member.role === "owner";
                const canChangeRole = !isOwner && !(member.role === "co_owner" && actorRole !== "owner");
                const isPending = pendingId === member.id;
                  return (
                  <div key={member.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {member.avatarUrl ? <Image src={member.avatarUrl} alt="" width={40} height={40} unoptimized className="size-10 rounded-full object-cover" /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-700">{initials(member)}</span>}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{member.fullName || "Chưa đặt tên"}</p>
                        <p className="truncate text-xs text-slate-500">ID: {member.userId}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{roleLabels[member.role]}</span>
                        {(member.role === "owner" || member.role === "co_owner") ? <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><ShieldCheck className="size-3.5" /> Duyệt theo vai trò</span> : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {canChangeRole ? (
                          <Select
                            value={member.role}
                            disabled={isPending}
                            onValueChange={(value) => handleRoleChange(member, value as "editor" | "previewer")}
                          >
                            <SelectTrigger aria-label={`Vai trò của ${member.fullName || member.userId}`} className="h-9 min-w-40 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:ring-blue-500/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" className="border-slate-200 bg-white p-1 shadow-lg">
                              <SelectItem value="editor" className="focus:bg-blue-50 focus:text-blue-900">Biên tập viên</SelectItem>
                              <SelectItem value="previewer" className="focus:bg-blue-50 focus:text-blue-900">Chỉ xem trước</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : null}
                        {(member.role === "editor" || member.role === "previewer") ? (
                          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700">
                            <input type="checkbox" checked={member.canReviewTopics} disabled={isPending} onChange={() => handleCapabilityChange(member)} />
                            Có thể duyệt topic
                          </label>
                        ) : null}
                        {!isOwner ? <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => handleRemove(member)} className="text-rose-700 hover:bg-rose-50">Xóa</Button> : <span className="flex items-center gap-1 text-xs text-slate-500"><UserRound className="size-3.5" /> Không thể xóa owner</span>}
                        {isPending ? <Loader2 className="size-4 animate-spin text-blue-600" /> : null}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">Lời mời</h3>
                {invitations.length === 0 ? <p className="text-sm text-slate-500">Chưa có lời mời nào.</p> : invitations.map((invitation) => (
                  <div key={invitation.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm"><p className="font-semibold text-slate-800">{roleLabels[invitation.role]}</p><p className="truncate text-xs text-slate-500">Tài khoản: {invitation.inviteeUserId}</p><p className="text-xs text-slate-500">Trạng thái: {invitation.status}</p></div>
                    {invitation.status === "pending" ? <Button type="button" variant="ghost" size="sm" disabled={pendingId === invitation.id} onClick={() => handleRevokeInvitation(invitation)} className="self-start text-rose-700 hover:bg-rose-50 sm:self-auto">Thu hồi</Button> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
