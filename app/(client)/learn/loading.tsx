export default function LearnDashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-8">
        <div className="space-y-3">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="h-10 w-72 max-w-full rounded bg-slate-200" />
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="h-64 rounded-3xl bg-white lg:col-span-2" />
          <div className="h-64 rounded-3xl bg-white lg:col-span-3" />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="h-80 rounded-3xl bg-white" />
          <div className="h-80 rounded-3xl bg-white" />
        </div>
      </div>
    </main>
  );
}
