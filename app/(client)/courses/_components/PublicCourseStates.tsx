import Link from "next/link";
import { AlertCircle, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { retryLabels } from "@/lib/i18n/courses-text";
import { asTranslate } from "@/lib/i18n/translate";
import { PublicCourseRetryButton } from "./PublicCourseRetryButton";

type PublicCourseFeedbackBaseProps = {
  title: string;
  description: string;
};

type PublicCourseFeedbackProps = PublicCourseFeedbackBaseProps &
  (
    | {
        kind: "empty";
        actionHref: string;
        actionLabel: string;
      }
    | {
        kind: "error";
      }
  );

export function PublicCourseFeedback(props: PublicCourseFeedbackProps) {
  const { kind, title, description } = props;
  const t = useTranslations("courses");
  const Icon = kind === "error" ? AlertCircle : BookOpen;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
    >
      <div
        className={
          kind === "error"
            ? "mb-4 rounded-full bg-correction-quiet p-4 text-correction"
            : "mb-4 rounded-full bg-recall-quiet p-4 text-recall"
        }
      >
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
        {description}
      </p>
      {kind === "error" ? (
        <PublicCourseRetryButton labels={retryLabels(asTranslate(t))} />
      ) : (
        <Button asChild variant="outline" className="mt-6 min-h-10 px-4">
          <Link href={props.actionHref}>{props.actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

type PublicCourseGridSkeletonProps = {
  count?: number;
  label?: string;
};

export function PublicCourseGridSkeleton({ count = 4, label }: PublicCourseGridSkeletonProps) {
  const t = useTranslations("courses");
  const accessibleLabel = label ?? t("catalog.loading");
  return (
    <div aria-busy="true" aria-label={accessibleLabel} role="status">
      <span className="sr-only">{accessibleLabel}</span>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4"
          >
            <Skeleton className="aspect-4/3 w-full rounded-xl" />
            <div className="space-y-3 pt-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="mt-6 h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
