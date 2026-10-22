"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptCourseCollaboratorInvitation,
  getMyPendingCourseCollaboratorInvitations,
  rejectCourseCollaboratorInvitation,
} from "@/app/actions/course-collaborator";
import type { CourseCollaboratorInvitation } from "@/lib/schemas/course-collaborator";

const roleLabels = {
  co_owner: "Đồng sở hữu",
  editor: "Biên tập viên",
  previewer: "Chỉ xem trước",
};

function InvitationResponseButton({ accept, pending, disabled, onClick }: {
  accept: boolean;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = accept ? Check : X;
  const label = accept ? "Chấp nhận" : "Từ chối";
  const progressive = accept ? "Đang nhận…" : "Đang từ chối…";
  return (
    <Button
      type="button"
      variant={accept ? "default" : "outline"}
      disabled={disabled}
      aria-busy={pending}
      onClick={onClick}
      className="coarse-input:h-11 coarse-input:px-5"
    >
      <span className="inline-grid">
        <span aria-hidden={pending} className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${pending ? "invisible" : ""}`}>
          <Icon className="size-4.5 coarse-input:size-5" aria-hidden="true" />{label}
        </span>
        <span aria-hidden={!pending} className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${pending ? "" : "invisible"}`}>
          <Loader2 className="size-4.5 motion-safe:animate-spin coarse-input:size-5" aria-hidden="true" />{progressive}
        </span>
      </span>
    </Button>
  );
}

export default function CollaboratorInvitationPanel({ onAccepted }: {
  onAccepted?: () => Promise<void> | void;
}) {
  const [invitations, setInvitations] = useState<CourseCollaboratorInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<{ id: string; accept: boolean } | null>(null);
  const responding = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

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
    }).catch(() => {
      if (!cancelled) {
        toast.error("Chưa tải được lời mời cộng tác. Vui lòng tải lại trang.");
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function respond(invitation: CourseCollaboratorInvitation, accept: boolean) {
    if (responding.current) return;
    responding.current = true;
    setPending({ id: invitation.id, accept });
    let confirmed = false;
      try {
        const result = accept
          ? await acceptCourseCollaboratorInvitation({ invitationId: invitation.id })
          : await rejectCourseCollaboratorInvitation({ invitationId: invitation.id });
        if (result.error) toast.error(result.error);
        else {
          confirmed = true;
          toast.success(accept ? "Đã chấp nhận lời mời cộng tác." : "Đã từ chối lời mời cộng tác.");
          await onAccepted?.();
          await loadInvitations();
          requestAnimationFrame(() => heading.current?.focus());
        }
      } catch {
        toast.error(confirmed
          ? "Lời mời đã được xử lý nhưng chưa tải lại được danh sách. Vui lòng tải lại trang."
          : "Chưa xác nhận được kết quả xử lý lời mời. Vui lòng tải lại trang trước khi thử lại.");
      } finally {
        setPending(null);
        responding.current = false;
      }
  }

  if (isLoading || !invitations.length) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-route-line bg-white" aria-labelledby="collaborator-invitations-title">
      <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <Mail className="mt-0.5 size-5 shrink-0 text-route" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 ref={heading} tabIndex={-1} id="collaborator-invitations-title" className="font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-route">Lời mời cộng tác đang chờ</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Chấp nhận lời mời để bắt đầu cộng tác.</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-slate-600" aria-label={`${invitations.length} lời mời`}>{invitations.length}</span>
      </div>
      <div role="region" aria-label="Danh sách lời mời cộng tác" tabIndex={0} className="max-h-64 overflow-y-auto overscroll-y-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route">
        <ul className="divide-y divide-slate-200">
          {invitations.map(invitation => (
            <li key={invitation.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0 text-sm leading-6">
                <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{invitation.courseTitle || "Khóa học chưa có tên"}</p>
                <p className="mt-1 text-slate-600">{roleLabels[invitation.role]}{invitation.canReviewTopics ? " · Có quyền duyệt bài học" : ""}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <InvitationResponseButton accept pending={pending?.id === invitation.id && pending.accept} disabled={pending !== null} onClick={() => respond(invitation, true)} />
                <InvitationResponseButton accept={false} pending={pending?.id === invitation.id && !pending.accept} disabled={pending !== null} onClick={() => respond(invitation, false)} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
