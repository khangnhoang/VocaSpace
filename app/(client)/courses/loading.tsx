import { PublicCourseGridSkeleton } from "./_components/PublicCourseStates";

export default function CoursesLoading() {
  return (
    <div className="container mx-auto px-4 py-10 md:py-14">
      <div className="mb-9 max-w-3xl space-y-3">
        <div className="h-4 w-36 animate-pulse rounded bg-blue-100" />
        <div className="h-10 w-full max-w-2xl animate-pulse rounded-lg bg-gray-200" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded bg-gray-100" />
      </div>
      <PublicCourseGridSkeleton />
    </div>
  );
}
