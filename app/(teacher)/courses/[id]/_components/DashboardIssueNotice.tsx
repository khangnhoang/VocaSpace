import { AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardIssueGuidance } from "@/lib/course-authoring/issue-guidance";

interface DashboardIssueNoticeProps {
  guidance: DashboardIssueGuidance;
  onDismiss: () => void;
  onAction?: () => void;
}

export default function DashboardIssueNotice({
  guidance,
  onDismiss,
  onAction,
}: DashboardIssueNoticeProps) {
  const isWarning = guidance.tone === "warning";
  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <section
      role={isWarning ? "alert" : "status"}
      aria-live={isWarning ? "assertive" : "polite"}
      className={`relative mb-6 rounded-xl border p-4 pr-16 shadow-sm ${
        isWarning
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-blue-200 bg-blue-50 text-blue-950"
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Đóng thông báo"
        className="absolute right-3 top-3 size-10 shrink-0 rounded-full border border-transparent text-current hover:border-current/20 hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
        onClick={onDismiss}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <Icon
            className={`mt-0.5 size-5 shrink-0 ${
              isWarning ? "text-amber-600" : "text-blue-600"
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold">{guidance.title}</h2>
            <p className="mt-1 text-sm leading-6">{guidance.description}</p>
            {guidance.actionLabel && onAction ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-current bg-white/70 text-current hover:bg-white"
                onClick={onAction}
              >
                {guidance.actionLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
