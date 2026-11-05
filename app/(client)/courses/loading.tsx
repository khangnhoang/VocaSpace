import { Skeleton } from "@/components/ui/skeleton";
import { CatalogResultsSkeleton } from "./_components/catalog/CatalogSkeleton";

export default function CoursesLoading() {
  return (
    <div className="pb-16">
      <div className="mx-auto w-full max-w-[1200px] space-y-3 px-4 pt-8 pb-4 sm:px-6 sm:pt-12 sm:pb-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <CatalogResultsSkeleton />
    </div>
  );
}
