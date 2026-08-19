export default function LearningWorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải bài học"
      className="min-h-screen bg-slate-50 p-4 md:p-8"
    >
      <div className="mx-auto grid max-w-[1440px] animate-pulse grid-cols-1 gap-6 lg:grid-cols-10">
        <div className="min-h-[600px] rounded-3xl border border-slate-200 bg-white lg:col-span-7">
          <div className="flex h-16 items-center gap-4 border-b border-slate-100 px-6">
            <div className="size-8 rounded-lg bg-slate-100" />
            <div className="space-y-2">
              <div className="h-3 w-48 rounded bg-emerald-100" />
              <div className="h-4 w-64 rounded bg-slate-200" />
            </div>
          </div>
          <div className="mx-auto mt-24 h-72 max-w-xl rounded-3xl bg-slate-100" />
        </div>
        <div className="h-[520px] rounded-3xl border border-slate-200 bg-white lg:col-span-3" />
      </div>
    </div>
  );
}
