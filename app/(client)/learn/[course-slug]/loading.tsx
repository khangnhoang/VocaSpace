export default function EnrolledCourseOverviewLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải tổng quan khóa học"
      className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 md:py-10 lg:px-8 lg:py-12"
    >
      <div className="mx-auto max-w-[1180px] animate-pulse">
        <div className="mb-4 h-10 w-44 rounded-xl bg-slate-100" />
        <div className="grid gap-5 rounded-[24px] border border-slate-200 bg-white p-5 sm:grid-cols-[144px_minmax(0,1fr)] sm:items-center sm:p-6">
          <div className="aspect-[16/10] rounded-2xl bg-blue-100 sm:aspect-square" />
          <div className="space-y-3">
            <div className="h-3 w-40 rounded bg-blue-100" />
            <div className="h-10 w-[32rem] max-w-full rounded bg-slate-200" />
            <div className="h-5 w-[38rem] max-w-full rounded bg-slate-100" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8 lg:col-start-1 lg:row-start-1">
            <div className="h-8 w-56 rounded bg-slate-200" />
            <div className="h-52 rounded-[24px] border border-slate-200 bg-white" />
            <div className="h-44 rounded-[24px] border border-slate-200 bg-white" />
          </div>
          <div className="h-96 rounded-[24px] border border-blue-100 bg-white lg:col-span-4 lg:col-start-9 lg:row-start-1" />
        </div>
      </div>
    </div>
  );
}
