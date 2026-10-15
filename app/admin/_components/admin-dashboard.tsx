import type { AdminDashboardDTO } from "@/lib/schemas/admin-dashboard";
import { DashboardErrorState } from "./dashboard-error-state";
import { MetricBand } from "./metric-band";
import { NeedsAttentionPanel } from "./needs-attention-panel";
import { RecentEnrollments } from "./recent-enrollments";
import { RevenueCard } from "./revenue-card";
import { TopCourses } from "./top-courses";
import { UserComposition } from "./user-composition";

type AdminDashboardProps = {
  // data và error loại trừ nhau: khi có lỗi chỉ hiện trạng thái lỗi, không bao giờ số liệu một phần (G6).
  data: AdminDashboardDTO | null;
  error: string | null;
};

// Thứ tự theo Admin design mục 14: cần xử lý, dải chỉ số, doanh thu, cơ cấu, top khóa học, ghi danh mới.
export function AdminDashboard({ data, error }: AdminDashboardProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1184px] flex-col gap-6">
      <header className="space-y-1">
        {/* Giữ nguyên chữ của h1: e2e/smoke/admin-gate.smoke.spec.ts dùng nó để chứng minh người không phải admin không thấy dashboard (G8). */}
        <h1 className="text-2xl leading-8 font-bold tracking-[-0.01em] text-slate-50">Tổng quan Quản trị</h1>
        <p className="text-sm text-slate-300">Số liệu tính từ dữ liệu hiện tại; mỗi chỉ số nêu rõ cách tính.</p>
      </header>

      {error || !data ? (
        <DashboardErrorState message={error} />
      ) : (
        <>
          <NeedsAttentionPanel pending={data.pending} generatedAt={data.generatedAt} />
          <MetricBand metrics={data.metrics} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-3">
              <RevenueCard months={data.revenueMonths} />
            </div>
            <div className="min-w-0 lg:col-span-2">
              <UserComposition distribution={data.userDistribution} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TopCourses courses={data.topCourses} />
            <RecentEnrollments enrollments={data.recentEnrollments} generatedAt={data.generatedAt} />
          </div>
        </>
      )}
    </div>
  );
}
