import Link from "next/link";
import { AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type PublicCourseFeedbackProps = {
  kind: "empty" | "error";
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

export function PublicCourseFeedback({
  kind,
  title,
  description,
  actionHref,
  actionLabel,
}: PublicCourseFeedbackProps) {
  const Icon = kind === "error" ? AlertCircle : BookOpen;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center"
    >
      <div className="mb-4 rounded-full bg-blue-50 p-4 text-blue-500">
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
        {description}
      </p>
      <Button asChild variant="outline" className="mt-6 min-h-10 px-4">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

type PublicCourseGridSkeletonProps = {
  count?: number;
  label?: string;
};

export function PublicCourseGridSkeleton({
  count = 4,
  label = "Đang tải danh sách khóa học",
}: PublicCourseGridSkeletonProps) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-4"
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
