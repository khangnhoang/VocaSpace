"use client";

import { use, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCheck, CircleAlert, ClipboardCheck, Loader2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attentionIdentity, attentionPath, type CourseAttentionResult } from "@/lib/course-authoring/portfolio";
import type { CourseReadinessIssue } from "@/lib/schemas/course-readiness";
import type { TeacherAttentionItem } from "@/lib/schemas/teacher-course-portfolio";

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

type FilterId = "all" | "issue" | "review" | "correction";

function OtherWorkView({ issues, attention }: { issues: CourseReadinessIssue[]; attention: AttentionState }) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  const [filter, setFilter] = useState<FilterId>("all");
  const items = attention.status === "ready" ? attention.items : [];
  const reviews = items.filter((item) => item.kind === "topic_review");
  const corrections = items.filter((item) => item.kind === "topic_correction");
  const total = issues.length + items.length;
  if (attention.status === "ready" && total === 0) return null;

  // Cùng cách lọc với "Cần bạn xử lý" ở /teacher/courses: nhóm theo loại việc, mỗi nút kèm số đếm.
  // Khi bài chờ duyệt / cần sửa chưa tải được thì hai bộ lọc đó chưa có số và không chọn được.
  const attentionKnown = attention.status === "ready";
  const filters: { id: FilterId; label: string; count: number | null }[] = [
    { id: "all", label: "Tất cả", count: attentionKnown ? total : null },
    { id: "issue", label: "Hoàn thiện", count: issues.length },
    { id: "review", label: "Chờ duyệt", count: attentionKnown ? reviews.length : null },
    { id: "correction", label: "Cần sửa", count: attentionKnown ? corrections.length : null },
  ];
  const filterIndex = filters.findIndex((entry) => entry.id === filter);
  const showIssues = filter === "all" || filter === "issue";
  const visibleItems = filter === "all" ? items : filter === "review" ? reviews : filter === "correction" ? corrections : [];
  const visibleCount = (showIssues ? issues.length : 0) + visibleItems.length;
  const showAttentionStatus = filter !== "issue";

  return (
    <div className="border-t border-slate-200">
      {/* Cùng bố cục với "Cần bạn xử lý" ở /teacher/courses: tiêu đề và bộ lọc cố định trên nền trắng, chỉ danh sách bên dưới cuộn. */}
      <div className="px-5 pt-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Việc khác trong khóa học</h3>
          {attentionKnown ? <span className="shrink-0 text-sm font-semibold text-slate-600">{total} việc</span> : null}
        </div>
        <div role="group" aria-label="Lọc việc khác trong khóa học" className="relative mt-3 grid grid-cols-4 border-b border-slate-200">
          {filters.map((entry) => {
            const disabled = entry.count === null && entry.id !== "all";
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={filter === entry.id}
                disabled={disabled}
                onClick={() => setFilter(entry.id)}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-xs leading-4 font-semibold whitespace-nowrap outline-none transition-colors duration-220 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
                  filter === entry.id ? "text-route" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{entry.label}</span>
                <span className="text-xs font-medium tabular-nums">{entry.count ?? "…"}</span>
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/4 bg-route transition-transform duration-220 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${filterIndex * 100}%)` }}
          />
        </div>
      </div>
      {/* Đổi bộ lọc thì dựng lại vùng cuộn để bắt đầu từ việc đầu tiên. */}
      <ul key={filter} className="max-h-72 divide-y divide-slate-100 overflow-y-auto overscroll-contain px-5 pt-1 pb-2 sm:px-6" aria-label="Việc khác trong khóa học">
        {showIssues ? issues.map((issue) => (
          <WorkRow
            key={issue.id}
            icon={<CircleAlert className="size-3.5 text-attention" aria-hidden="true" />}
            label="Cần hoàn thiện"
            title={issue.context}
            href={issue.destination.href}
            action={issue.actionLabel}
          />
        )) : null}
        {visibleItems.map((item) => item.kind === "topic_review" ? (
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
        {/* "Hoàn thiện" chỉ phụ thuộc readiness nên báo rỗng được cả khi bài chờ duyệt / cần sửa chưa tải xong. */}
        {visibleCount === 0 && (attentionKnown || filter === "issue") ? (
          <li className="flex items-center gap-2 py-4 text-sm text-slate-600">
            <CheckCheck className="size-4 text-growth" aria-hidden="true" />Không có việc trong bộ lọc này.
          </li>
        ) : null}
        {attention.status === "loading" && showAttentionStatus ? (
          <li className="py-3 text-sm text-slate-600">
            <span role="status" className="flex items-center gap-2"><Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />Đang tải bài chờ duyệt và bài cần sửa…</span>
          </li>
        ) : null}
        {attention.status === "error" && showAttentionStatus ? (
          <li className="flex flex-col gap-2 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <span role="alert">Chưa tải được bài chờ duyệt và bài cần sửa.</span>
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
  issues: CourseReadinessIssue[];
  attention: Promise<CourseAttentionResult>;
}

// Mục chờ duyệt / cần sửa đã được lọc theo khóa học trên server (selectCourseAttention, G6). Read lỗi không
// làm mất việc readiness đã có (AC6).
export default function CourseOtherWorkList({ issues, attention }: CourseOtherWorkListProps) {
  const result = use(attention);
  return <OtherWorkView issues={issues} attention={result.success ? { status: "ready", items: result.items } : { status: "error" }} />;
}
