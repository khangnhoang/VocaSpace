"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { getCourseCollaboratorMembers } from "@/app/actions/course-collaborator";
import type { CourseCollaboratorOverview } from "@/lib/schemas/course-collaborator";

interface CourseCollaboratorSummaryProps {
  courseId: string;
}

const roleLabels: Record<CourseCollaboratorOverview["role"], string> = {
  owner: "chủ sở hữu",
  co_owner: "đồng sở hữu",
  editor: "biên tập viên",
  previewer: "chỉ xem trước",
};

function initials(member: CourseCollaboratorOverview) {
  return member.fullName?.trim().charAt(0).toUpperCase() || "U";
}

export default function CourseCollaboratorSummary({ courseId }: CourseCollaboratorSummaryProps) {
  const [members, setMembers] = useState<CourseCollaboratorOverview[]>([]);

  useEffect(() => {
    let active = true;
    void getCourseCollaboratorMembers({ courseId }).then((result) => {
      if (!active) return;
      setMembers("error" in result ? [] : result.data.members);
    });
    return () => {
      active = false;
    };
  }, [courseId]);

  if (members.length === 0) return null;

  const counts = members.reduce<Record<string, number>>((result, member) => {
    result[member.role] = (result[member.role] ?? 0) + 1;
    return result;
  }, {});

  return (
    <div className="flex flex-wrap items-center gap-3" aria-label="Tóm tắt cộng tác viên">
      <div className="flex -space-x-2" aria-hidden="true">
        {members.slice(0, 4).map((member) => (
          <span key={member.id} className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-blue-50 text-xs font-bold text-blue-700">
            {initials(member)}
          </span>
        ))}
        {members.length > 4 ? <span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-600">+{members.length - 4}</span> : null}
      </div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <UsersRound className="size-3.5" aria-hidden="true" />
        {members.length} thành viên
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-500">
        {(["owner", "co_owner", "editor", "previewer"] as const).filter((role) => counts[role]).map((role) => (
          <span key={role} className="rounded-full bg-slate-100 px-2 py-1">
            {counts[role]} {roleLabels[role]}
          </span>
        ))}
      </div>
    </div>
  );
}
