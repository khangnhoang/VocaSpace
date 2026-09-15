"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Loader2, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptCourseCollaboratorInvitation,
  getMyPendingCourseCollaboratorInvitations,
  rejectCourseCollaboratorInvitation,
} from "@/app/actions/course-collaborator";
import type { CourseCollaboratorInvitation } from "@/lib/schemas/course-collaborator";

const roleLabels: Record<CourseCollaboratorInvitation["role"], string> = {
  co_owner: "Đồng sở hữu",
  editor: "Biên tập viên",
  previewer: "Chỉ xem trước",
};

export default function CollaboratorInvitationPanel() {
  const [invitations, setInvitations] = useState<CourseCollaboratorInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadInvitations = useCallback(async () => {
    const result = await getMyPendingCourseCollaboratorInvitations();
    if ("error" in result) toast.error(result.error);
    else setInvitations(result.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getMyPendingCourseCollaboratorInvitations().then((result) => {
      if (cancelled) return;
      if ("error" in result) toast.error(result.error);
      else setInvitations(result.data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const respond = (invitation: CourseCollaboratorInvitation, accept: boolean) => {
    startTransition(async () => {
      setPendingId(invitation.id);
      const result = accept
        ? await acceptCourseCollaboratorInvitation({ invitationId: invitation.id })
        : await rejectCourseCollaboratorInvitation({ invitationId: invitation.id });
      if (result.error) toast.error(result.error);
      else {
        toast.success(accept ? "Đã chấp nhận lời mời cộng tác." : "Đã từ chối lời mời cộng tác.");
        await loadInvitations();
      }
      setPendingId(null);
    });
  };

  if (isLoading || invitations.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm" aria-labelledby="collaborator-invitations-title">
      <div className="flex items-start gap-3">
        <Mail className="mt-1 shrink-0 text-blue-700" aria-hidden="true" />
        <div>
          <h2 id="collaborator-invitations-title" className="font-bold text-slate-950">Lời mời cộng tác đang chờ</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Bạn có thể chấp nhận để mở quyền truy cập khóa học hoặc từ chối lời mời.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {invitations.map((invitation) => {
          const isPending = pendingId === invitation.id;
          return (
            <div key={invitation.id} className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-slate-900">Khóa học {invitation.courseId}</p>
                <p className="mt-1 text-slate-600">Vai trò: {roleLabels[invitation.role]}{invitation.canReviewTopics ? " · Có quyền duyệt topic" : ""}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" onClick={() => respond(invitation, true)} disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-700"><Check /> Chấp nhận</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => respond(invitation, false)} disabled={isPending} className="text-rose-700"><X /> Từ chối</Button>
                {isPending ? <Loader2 className="self-center animate-spin text-blue-600" aria-label="Đang xử lý" /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
