import { Skeleton } from "@/components/ui/skeleton";

export default function PublicCourseDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải thông tin khóa học"
      className="container mx-auto px-4 py-8 md:py-12"
    >
      <span className="sr-only">Đang tải thông tin khóa học</span>
      <Skeleton className="mb-8 h-5 w-64" />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <header className="rounded-3xl border border-gray-100 bg-white p-6 md:p-8 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-4 h-10 w-full max-w-2xl" />
          <Skeleton className="mt-3 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-4/5" />
        </header>

        <aside
          aria-label="Đang tải phần đăng ký khóa học"
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <Skeleton className="aspect-4/5 rounded-3xl" />
        </aside>

        <section
          aria-label="Đang tải nội dung khóa học"
          className="space-y-8 lg:col-start-1 lg:row-start-2"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </section>
      </div>
    </div>
  );
}
