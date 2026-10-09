// Same shell, gutters and width as the settled workspace so the page does not jump
// when content arrives. The blocks are decorative and never look like answers.
export default function LearningWorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải bài học"
      className="min-h-screen bg-slate-50 px-3 py-4 min-[400px]:px-4 md:px-6 md:py-8"
    >
      <div className="mx-auto flex w-full max-w-[1280px] animate-pulse flex-col gap-5 motion-reduce:animate-none">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="h-6 w-64 max-w-full rounded bg-slate-200" />
            </div>
          </div>
          <div className="h-9 w-10 rounded-lg bg-slate-200 sm:w-40" />
        </div>
        <div className="h-6 w-56 rounded bg-slate-200" />
        <div className="min-h-96 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8">
          <div className="mx-auto h-72 max-w-3xl rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
