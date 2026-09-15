"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Loader2, Settings2, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getCourseCollaboratorOverview,
  removeCourseCollaborator,
  setCourseCollaboratorReviewCapability,
  updateCourseCollaboratorRole,
} from "@/app/actions/course-collaborator";
import type { CourseCollaboratorOverview } from "@/lib/schemas/course-collaborator";
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
  const [isLoading, setIsLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    const result = await getCourseCollaboratorOverview({ courseId });
    if ("error" in result) toast.error(result.error);
    else setMembers(result.data);
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
            <DialogDescription>Quyền soạn nội dung và quyền duyệt topic được tính theo membership hiện tại. D1 không mở rộng luồng mời thành viên.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            {(["owner", "co_owner", "editor", "previewer"] as const).map((role) => (
              <span key={role} className="rounded-full bg-slate-100 px-3 py-1">{roleLabels[role]}: {counts[role] ?? 0}</span>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <div className="space-y-3">
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
                          <select
                            aria-label={`Vai trò của ${member.fullName || member.userId}`}
                            value={member.role}
                            disabled={isPending}
                            onChange={(event) => handleRoleChange(member, event.target.value as "editor" | "previewer")}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                          >
                            <option value="editor">Biên tập viên</option>
                            <option value="previewer">Chỉ xem trước</option>
                          </select>
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
