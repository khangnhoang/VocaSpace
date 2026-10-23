"use client";

import { use, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, ClipboardCheck, Loader2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attentionIdentity, attentionPath, sortAttention } from "@/lib/course-authoring/portfolio";
import type { CourseReadinessIssue } from "@/lib/schemas/course-readiness";
import type { TeacherAttentionItem, TeacherCoursePortfolioResult } from "@/lib/schemas/teacher-course-portfolio";

type AttentionState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: TeacherAttentionItem[] };

function WorkRow({ icon, label, title, detail, href, action }: { icon: React.ReactNode; label: string; title: string; detail?: string | null; href: string; action: string }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold">{icon}{label}</p>
        <p className="mt-1 text-sm font-semibold leading-5 [overflow-wrap:anywhere]">{title}</p>
        {detail ? <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">{detail}</p> : null}
      </div>
      <Button asChild variant="link" className="h-auto min-h-9 shrink-0 justify-start whitespace-normal px-0 text-left coarse-input:min-h-11">
        <Link href={href} aria-label={`${action}: ${title}`}>{action}<ArrowRight aria-hidden="true" /></Link>
      </Button>
    </li>
  );
}

function OtherWorkView({ issues, attention }: { issues: CourseReadinessIssue[]; attention: AttentionState }) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  const items = attention.status === "ready" ? attention.items : [];
  const total = issues.length + items.length;
  if (attention.status === "ready" && total === 0) return null;

  return (
    <div className="border-t border-slate-200">
      <h3 className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
        Việc khác trong khóa học{attention.status === "ready" ? ` · ${total}` : ""}
      </h3>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto overscroll-contain px-5 pb-2 sm:px-6" aria-label="Việc khác trong khóa học">
        {issues.map((issue) => (
          <WorkRow
            key={issue.id}
            icon={<CircleAlert className="size-3.5 text-attention" aria-hidden="true" />}
            label="Cần hoàn thiện"
            title={issue.context}
            href={issue.destination.href}
            action={issue.actionLabel}
          />
        ))}
        {items.map((item) => item.kind === "topic_review" ? (
          <WorkRow
            key={attentionIdentity(item)}
            icon={<ClipboardCheck className="size-3.5 text-attention" aria-hidden="true" />}
            label="Chờ bạn duyệt"
            title={item.topic_title ?? ""}
            href={attentionPath(item)}
            action="Duyệt bài học"
          />
        ) : (
          <WorkRow
            key={attentionIdentity(item)}
            icon={<MessageSquareWarning className="size-3.5 text-correction" aria-hidden="true" />}
            label="Bài học cần sửa"
            title={item.topic_title ?? ""}
            detail={item.reason}
            href={attentionPath(item)}
            action="Xem và chỉnh sửa"
          />
        ))}
        {attention.status === "loading" ? (
          <li role="status" className="flex items-center gap-2 py-3 text-sm text-slate-600">
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />Đang tải bài chờ duyệt và bài cần sửa…
          </li>
        ) : null}
        {attention.status === "error" ? (
          <li role="alert" className="flex flex-col gap-2 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <span>Chưa tải được bài chờ duyệt và bài cần sửa.</span>
            <Button type="button" variant="outline" size="sm" disabled={isRetrying} onClick={() => startRetry(() => router.refresh())} className="coarse-input:h-11">
              {isRetrying ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : null}Thử lại
            </Button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export function CourseOtherWorkListFallback({ issues }: { issues: CourseReadinessIssue[] }) {
  return <OtherWorkView issues={issues} attention={{ status: "loading" }} />;
}

interface CourseOtherWorkListProps {
  courseId: string;
  issues: CourseReadinessIssue[];
  portfolio: Promise<TeacherCoursePortfolioResult>;
}

// Bài chờ duyệt / bài cần sửa lấy từ read portfolio (G6) rồi lọc theo khóa học này; course_rejection đã có
// ở khối lý do từ chối nên không lặp lại. Read lỗi không làm mất việc readiness đã có (AC6).
export default function CourseOtherWorkList({ courseId, issues, portfolio }: CourseOtherWorkListProps) {
  const result = use(portfolio);
  const attention: AttentionState = result.success
    ? {
        status: "ready",
        items: sortAttention(result.data.attention).filter(
          (item) => item.course_id === courseId && (item.kind === "topic_review" || item.kind === "topic_correction"),
        ),
      }
    : { status: "error" };
  return <OtherWorkView issues={issues} attention={attention} />;
}
