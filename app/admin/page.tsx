// app/admin/page.tsx
import { getAdminDashboardData } from "@/app/actions/admin-dashboard";
import StatsCards from "./_components/stats-cards";
import AnalyticsCharts from "./_components/analytics-charts";
import RecentActivities from "./_components/recent-activities";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  // Gọi API Server Action trực tiếp trên môi trường Server bảo mật tuyệt đối
  const { data, error } = await getAdminDashboardData();

  // Xử lý cổng bảo mật RBAC hoặc sự cố sập DB chặn từ xa
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Truy cập thất bại</h2>
            <p className="text-sm text-slate-400">
              {error || "Gặp sự cố khi đồng bộ báo cáo quản trị."}
            </p>
          </div>
          <div className="pt-2">
            <Link 
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Quay lại trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Khai phá dữ liệu live sạch bóng sau khi vượt qua bộ gọt Zod Schema
  const {
    metrics,
    revenueTrends,
    userDistribution,
    topCourses,
    recentEnrollments,
  } = data;

  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Tổng quan Quản trị
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Theo dõi các chỉ số cốt lõi và tình hình hoạt động của VocaSpace.
        </p>
      </div>

      {/* Hàng 1: 4 Thẻ Metric Số liệu */}
      <StatsCards data={metrics} />

      {/* Hàng 2: Biểu đồ Đường Xu hướng (70%) và Biểu đồ Tròn Cơ cấu (30%) */}
      <AnalyticsCharts trends={revenueTrends} distribution={userDistribution} />

      {/* Hàng 3: Biểu đồ Cột ngang (Top Khóa học) và Bảng Ghi danh mới */}
      <RecentActivities
        topCourses={topCourses}
        enrollments={recentEnrollments}
      />
    </div>
  );
}