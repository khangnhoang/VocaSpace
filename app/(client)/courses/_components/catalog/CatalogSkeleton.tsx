import { Skeleton } from "@/components/ui/skeleton";

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4";

export function CatalogResultsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải danh sách khóa học" role="status" className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <span className="sr-only">Đang tải danh sách khóa học</span>
      <div className="flex flex-wrap items-center gap-3 py-3">
        <Skeleton className="h-11 w-full rounded-xl lg:w-110" />
        <Skeleton className="h-11 w-64 rounded-xl" />
        <Skeleton className="h-11 w-32 rounded-full" />
        <Skeleton className="h-11 w-44 rounded-xl lg:ml-auto" />
      </div>
      <Skeleton className="mt-2 mb-5 h-4 w-48" />
      <div className={GRID}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Skeleton className="aspect-4/3 w-full rounded-none max-sm:aspect-video" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
