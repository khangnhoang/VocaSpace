"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getCourseCollaboratorMembers,
  leaveCourseCollaboration,
  getCurrentUserGlobalRole,
} from "@/app/actions/course-collaborator";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";
import type { CourseCollaboratorOverview } from "@/lib/schemas/course-collaborator";
import { getTeacherCourseListPath } from "@/lib/course-authoring/routes";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
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

interface CourseCollaborationLeaveDialogProps {
  courseId: string;
  actorRole: CourseDashboardReadiness["role"];
}

export function getCourseLeaveDestination(role: "admin" | "teacher" | "student" | null) {
  if (role === "student") return getPublicCourseCatalogPath();
  if (role === "admin") return "/admin";
  return getTeacherCourseListPath();
}

function memberLabel(member: CourseCollaboratorOverview) {
  return member.fullName?.trim() || member.email || `ID ${member.userId.slice(0, 8)}…`;
}

export default function CourseCollaborationLeaveDialog({
  courseId,
  actorRole,
}: CourseCollaborationLeaveDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<CourseCollaboratorOverview[]>([]);
  const [responsibleTopicCount, setResponsibleTopicCount] = useState(0);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (actorRole === "owner") return null;

  const recipientCandidates = members.filter(
    (member) =>
      member.userId !== currentUserId &&
      (member.role === "owner" || member.role === "co_owner"),
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;

    setIsLoading(true);
    void (async () => {
      const result = await getCourseCollaboratorMembers({ courseId });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setCurrentUserId(result.data.currentUserId);
        setMembers(result.data.members);
        setResponsibleTopicCount(result.data.responsibleTopicCount);
        const defaultRecipient = result.data.members.find(
          (member) =>
            member.userId !== result.data.currentUserId && member.role === "owner",
        );
        setRecipientUserId(defaultRecipient?.userId ?? "");
        if (result.data.responsibleTopicCount === 0) {
          setOpen(false);
          setIsConfirmOpen(true);
        }
      }
      setIsLoading(false);
    })();
  };

  const handleLeave = () => {
    if (responsibleTopicCount > 0 && !recipientUserId) return;
    setIsConfirmOpen(true);
  };

  const confirmLeave = () => {
    setIsPending(true);
    void (async () => {
      const result = await leaveCourseCollaboration({
        courseId,
        recipientUserId: recipientUserId || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }
      toast.success("Đã rời khóa học.");
      const roleResult = await getCurrentUserGlobalRole();
      const globalRole = "error" in roleResult ? null : roleResult.data.role;
      window.location.assign(getCourseLeaveDestination(globalRole));
    })();
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => handleOpenChange(true)} className="min-h-10 border-rose-200 text-rose-700 hover:bg-rose-50">
        <LogOut className="size-4" aria-hidden="true" /> Rời khóa học
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rời khóa học</DialogTitle>
            <DialogDescription>
              {isLoading
                ? "Đang kiểm tra trách nhiệm bài học..."
                : "Hệ thống sẽ kiểm tra trách nhiệm bài học trong cùng giao dịch trước khi xóa tư cách thành viên của bạn."}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" aria-label="Đang tải" /></div>
          ) : (
            <div className="space-y-4">
              {responsibleTopicCount > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                  Bạn đang là người phụ trách <strong>{responsibleTopicCount} bài học chưa được duyệt</strong>. Hãy chọn chủ sở hữu hoặc đồng sở hữu nhận trách nhiệm trước khi rời.
                </div>
              ) : null}

              {responsibleTopicCount > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="leave-recipient">Người nhận trách nhiệm</label>
                  <Select value={recipientUserId} onValueChange={setRecipientUserId} disabled={isPending || recipientCandidates.length === 0}>
                    <SelectTrigger id="leave-recipient" className="h-10 w-full bg-white">
                      <SelectValue placeholder={recipientCandidates.length === 0 ? "Không có chủ sở hữu phù hợp" : "Chọn chủ sở hữu hoặc đồng sở hữu"} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {recipientCandidates.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>{memberLabel(member)} · {member.role === "owner" ? "chủ sở hữu" : "đồng sở hữu"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Hủy</Button>
            <Button type="button" onClick={handleLeave} disabled={isLoading || isPending || (responsibleTopicCount > 0 && !recipientUserId)} className="bg-rose-600 text-white hover:bg-rose-700">
              {isPending || isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
              {isLoading ? "Đang kiểm tra..." : "Xác nhận rời khóa học"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        setIsOpen={(nextOpen) => { if (!isPending) setIsConfirmOpen(nextOpen); }}
        title="Rời khóa học?"
        description={responsibleTopicCount > 0
          ? "Tư cách thành viên của bạn sẽ bị xóa sau khi trách nhiệm các bài học chưa được duyệt được chuyển cho người đã chọn."
          : "Sau khi rời khóa học, bạn sẽ mất các quyền cộng tác hiện tại."}
        confirmText="Xác nhận rời khóa học"
        loadingText="Đang rời khóa học..."
        onConfirm={confirmLeave}
        isLoading={isPending}
      />
    </>
  );
}
