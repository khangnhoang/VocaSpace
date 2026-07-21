function CourseRowSkeleton() {
  return (
    <div className="grid min-h-40 grid-cols-[92px_minmax(0,1fr)] gap-4 rounded-[20px] border border-blue-100 bg-white p-4 md:flex md:min-h-[184px] md:items-center md:gap-5 md:p-5">
      <div className="size-[92px] shrink-0 rounded-2xl bg-blue-100 md:h-[120px] md:w-[160px]" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="h-5 w-2/3 rounded bg-slate-200" />
        <div className="h-2 w-full rounded-full bg-cyan-100" />
        <div className="h-3 w-24 rounded bg-blue-100" />
        <div className="h-4 w-4/5 rounded bg-slate-100" />
      </div>
      <div className="col-span-2 h-11 w-full rounded-xl bg-blue-100 md:w-[152px]" />
    </div>
  );
}

export default function LearnDashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải không gian học tập"
      className="min-h-screen bg-slate-50 px-4 py-8 md:px-8 md:py-10 lg:py-12"
    >
      <div className="mx-auto max-w-[1260px] animate-pulse">
        <div className="space-y-3">
          <div className="h-3 w-36 rounded bg-blue-100" />
          <div className="h-10 w-[34rem] max-w-full rounded bg-slate-200" />
          <div className="h-5 w-[40rem] max-w-full rounded bg-slate-100" />
        </div>

        <div className="mt-8 grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-12">
          <section className="space-y-5 lg:col-span-8 lg:col-start-1 lg:row-start-1">
            <div className="space-y-2">
              <div className="h-8 w-36 rounded bg-slate-200" />
              <div className="h-5 w-72 max-w-full rounded bg-slate-100" />
            </div>
            <CourseRowSkeleton />
            <CourseRowSkeleton />
          </section>

          <aside className="space-y-5 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
            <div className="h-64 rounded-3xl bg-cyan-100" />
            <div className="h-36 rounded-[20px] border border-blue-100 bg-white" />
            <div className="h-44 rounded-[20px] border border-slate-200 bg-white" />
          </aside>

          <section className="space-y-5 lg:col-span-8 lg:col-start-1 lg:row-start-2">
            <div className="space-y-2">
              <div className="h-8 w-64 rounded bg-slate-200" />
              <div className="h-5 w-80 max-w-full rounded bg-slate-100" />
            </div>
            <div className="flex gap-2">
              <div className="h-11 w-24 rounded-full bg-blue-100" />
              <div className="h-11 w-32 rounded-full bg-slate-100" />
              <div className="h-11 w-36 rounded-full bg-slate-100" />
            </div>
            <CourseRowSkeleton />
            <CourseRowSkeleton />
          </section>
        </div>
      </div>
    </div>
  );
}
