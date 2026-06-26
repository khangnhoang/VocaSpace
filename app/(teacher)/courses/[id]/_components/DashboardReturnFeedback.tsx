import { CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCourseOverviewPath } from "@/lib/course-authoring/routes";
import type { CourseAuthoringReturnFeedback } from "@/lib/course-authoring/issue-success";

interface DashboardReturnFeedbackProps {
  courseId: string;
  feedback: CourseAuthoringReturnFeedback;
  onDismiss: () => void;
}

export default function DashboardReturnFeedback({
  courseId,
  feedback,
  onDismiss,
}: DashboardReturnFeedbackProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="relative mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 pr-16 text-emerald-950 shadow-sm"
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

      <div className="flex min-w-0 gap-3">
        <CheckCircle2
          className="mt-0.5 size-5 shrink-0 text-emerald-600"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{feedback.title}</h2>
          <p className="mt-1 text-sm leading-6">{feedback.description}</p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-3 border-emerald-300 bg-white/80 text-emerald-900 hover:bg-white"
          >
            <Link href={getCourseOverviewPath(courseId)}>Quay lại tổng quan</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
