import { Skeleton } from "@/components/ui/skeleton";

export default function PublicCoursePreviewLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải nội dung xem thử"
      role="status"
      className="min-h-[70vh] bg-slate-50 px-4 py-8 sm:px-6 md:py-12"
    >
      <span className="sr-only">Đang tải nội dung xem thử</span>
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-5 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
        <Skeleton className="h-[26rem] w-full rounded-3xl" />
      </div>
    </div>
  );
}
