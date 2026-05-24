import { z } from "zod";

// 1. Schema cho 4 thẻ con số cốt lõi (Metric Cards)
export const adminMetricsSchema = z.object({
  totalRevenue: z.number().min(0),
  totalStudents: z.number().min(0),
  activeCourses: z.number().min(0),
  totalFlashcardReviews: z.number().min(0),
});

// 2. Schema cho Biểu đồ đường (Xu hướng doanh thu theo tháng)
export const revenueTrendSchema = z.object({
  month: z.string(), // Định dạng "T1", "T2", ... hoặc "Tháng 01"
  revenue: z.number().min(0),
});

// 3. Schema cho Biểu đồ tròn/vành khuyên (Cơ cấu User)
export const userDistributionSchema = z.object({
  students: z.number().min(0),
  teachers: z.number().min(0),
  admins: z.number().min(0),
});

// 4. Schema cho Biểu đồ cột ngang (Top 5 Khóa học phổ biến)
export const topCourseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  enrollmentCount: z.number().min(0),
  revenue: z.number().min(0),
});

// 5. Schema cho Bảng danh sách ghi danh mới nhất (Recent Enrollments)
export const recentEnrollmentSchema = z.object({
  id: z.string().uuid(),
  studentName: z.string().nullable(),
  studentEmail: z.string().email(),
  studentAvatar: z.string().url().nullable(),
  courseTitle: z.string(),
  price: z.number().min(0),
  enrolledAt: z.string(), // Định dạng ISO String hoặc chuỗi thời gian tương đối
});

// ============================================================================
// HỢP ĐỒNG DƯ LIỆU TỔNG HỢP CHO TRANG ADMIN DASHBOARD (SSOT)
// ============================================================================
export const adminDashboardSchema = z.object({
  metrics: adminMetricsSchema,
  revenueTrends: z.array(revenueTrendSchema),
  userDistribution: userDistributionSchema,
  topCourses: z.array(topCourseSchema).max(5), // Giới hạn top 5 phần tử
  recentEnrollments: z.array(recentEnrollmentSchema),
});

// Tự động xuất kiểu dữ liệu (Type) chính thức cho Frontend sử dụng
export type AdminDashboardDTO = z.infer<typeof adminDashboardSchema>;
