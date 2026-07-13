export default function LearnDashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-8">
        <div className="space-y-3">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="h-10 w-72 max-w-full rounded bg-slate-200" />
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="order-2 h-[42rem] min-w-0 rounded-3xl bg-white lg:order-none lg:col-start-2 lg:row-start-1" />
          <div className="contents lg:col-start-1 lg:row-start-1 lg:block lg:min-w-0 lg:space-y-6">
            <div className="order-1 h-72 min-w-0 rounded-3xl bg-emerald-950 lg:order-none" />
            <div className="order-3 h-96 min-w-0 rounded-3xl bg-white lg:order-none" />
          </div>
        </div>
      </div>
    </main>
  );
}
