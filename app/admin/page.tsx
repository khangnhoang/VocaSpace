import { AdminDashboardDTO } from "@/lib/schemas/admin-dashboard";
// (Bạn sẽ tạo các component này ở bước tiếp theo)
import StatsCards from "./_components/stats-cards";
import AnalyticsCharts from "./_components/analytics-charts";
import RecentActivities from "./_components/recent-activities";

// ============================================================================
// DỮ LIỆU GIẢ LẬP (MOCK DATA) THEO CHUẨN ZOD DTO
// ============================================================================
const mockAdminDashboardData: AdminDashboardDTO = {
  metrics: {
    totalRevenue: 125500000,
    totalStudents: 2450,
    activeCourses: 15,
    totalFlashcardReviews: 45230,
  },
  revenueTrends: [
    { month: "T1", revenue: 4000000 },
    { month: "T2", revenue: 7500000 },
    { month: "T3", revenue: 6000000 },
    { month: "T4", revenue: 11500000 },
    { month: "T5", revenue: 7000000 },
    { month: "T6", revenue: 6500000 },
    { month: "T7", revenue: 12000000 },
  ],
  userDistribution: {
    students: 2450, // 85%
    teachers: 288, // 10%
    admins: 144, // 5%
  },
  topCourses: [
    {
      id: "c1",
      title: "TOEIC 750+ Cấp tốc",
      enrollmentCount: 1245,
      revenue: 62250000,
    },
    {
      id: "c2",
      title: "Từ vựng IT Nền tảng",
      enrollmentCount: 850,
      revenue: 42500000,
    },
    {
      id: "c3",
      title: "Giao tiếp Công sở",
      enrollmentCount: 420,
      revenue: 21000000,
    },
    {
      id: "c4",
      title: "Ngữ pháp Nâng cao",
      enrollmentCount: 310,
      revenue: 15500000,
    },
    {
      id: "c5",
      title: "Phát âm chuẩn Mỹ",
      enrollmentCount: 180,
      revenue: 9000000,
    },
  ],
  recentEnrollments: [
    {
      id: "e1",
      studentName: "Nguyễn Văn A",
      studentEmail: "nva@gmail.com",
      studentAvatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&q=80",
      courseTitle: "TOEIC 750+ Cấp tốc",
      price: 500000,
      enrolledAt: "10 phút trước",
    },
    {
      id: "e2",
      studentName: "Trần Thị B",
      studentEmail: "ttb@gmail.com",
      studentAvatar: null, // Test Fallback UX
      courseTitle: "Từ vựng IT Nền tảng",
      price: 500000,
      enrolledAt: "1 giờ trước",
    },
    {
      id: "e3",
      studentName: "Lê Hoàng C",
      studentEmail: "lhc@gmail.com",
      studentAvatar:
        "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop&q=80",
      courseTitle: "Giao tiếp Công sở",
      price: 500000,
      enrolledAt: "3 giờ trước",
    },
  ],
};

// ============================================================================
// GIAO DIỆN CHÍNH (PAGE COMPONENT)
// ============================================================================
export default function AdminDashboardPage() {
  const {
    metrics,
    revenueTrends,
    userDistribution,
    topCourses,
    recentEnrollments,
  } = mockAdminDashboardData;

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

      {/* Hàng 1: 4 Thẻ Metric */}
      <StatsCards data={metrics} />

      {/* Hàng 2: Biểu đồ Đường (70%) và Biểu đồ Tròn (30%) */}
      <AnalyticsCharts trends={revenueTrends} distribution={userDistribution} />

      {/* Hàng 3: Biểu đồ Cột ngang (Top Khóa học) và Bảng Ghi danh */}
      <RecentActivities
        topCourses={topCourses}
        enrollments={recentEnrollments}
      />
    </div>
  );
}
