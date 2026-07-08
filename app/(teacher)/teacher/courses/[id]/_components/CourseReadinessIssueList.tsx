import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseReadinessIssue } from "@/lib/schemas/course-readiness";

interface CourseReadinessIssueListProps {
  issues: CourseReadinessIssue[];
}

export default function CourseReadinessIssueList({
  issues,
}: CourseReadinessIssueListProps) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="readiness-issues-title"
    >
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <CircleAlert className="size-5 text-amber-600" aria-hidden="true" />
          <h2
            id="readiness-issues-title"
            className="wrap-break-word text-lg font-bold text-slate-950"
          >
            Các việc cần xử lý
          </h2>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {issues.length} việc đang chờ xử lý, theo thứ tự nên thực hiện.
        </p>
      </div>

      <ol className="max-h-136 divide-y divide-slate-100 overflow-y-auto overscroll-contain">
        {issues.map((issue, index) => (
          <li
            key={issue.id}
            className="flex min-w-0 flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <p className="min-w-0 wrap-break-word text-sm leading-6 text-slate-700">
                {issue.context}
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-auto min-h-9 w-full shrink-0 whitespace-normal border-blue-200 px-3 py-2 text-center leading-5 text-blue-700 hover:bg-blue-50 sm:w-auto sm:max-w-xs"
            >
              <Link
                href={issue.destination.href}
                aria-label={`${issue.actionLabel}: ${issue.context}`}
              >
                {issue.actionLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
