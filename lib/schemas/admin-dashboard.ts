import { z } from "zod";
import { Profile, Course } from "@/types/database";

const count = z.number().int().min(0);
const amount = z.number().min(0);
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// ============================================================================
// 1. KẾT QUẢ THÔ CỦA RPC `admin_dashboard_summary()` (AD4): mọi số đếm/tổng đã tính trong database
// ============================================================================
export const adminDashboardSummaryRpcSchema = z.object({
  generated_at: z.string(),
  pending: z.object({
    count,
    oldest_submitted_at: z.string().nullable(),
  }),
  users: z.object({ students: count, teachers: count, admins: count }),
  published_courses: count,
  flashcards: count,
  revenue: z.object({
    total: amount,
    months: z.array(z.object({ month: monthKey, revenue: amount })).length(6),
  }),
  top_courses: z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        enrollment_count: count,
        revenue: amount,
      }),
    )
    .max(5),
});

// ============================================================================
// 2. DTO TRẢ CHO TRANG /admin: chỉ gồm trường có nguồn thật, không giá trị mặc định thay thế
// ============================================================================
export const adminDashboardMetricsSchema = z.object({
  // Doanh thu paid VND trong sáu tháng lịch Việt Nam gần nhất (cùng cửa sổ với biểu đồ).
  revenue: amount,
  students: count,
  publishedCourses: count,
  // Số dòng `user_flashcards` (thẻ đang học), không phải lượt ôn tập.
  learningCards: count,
});

export const revenueMonthSchema = z.object({
  month: monthKey,
  revenue: amount,
});

export const userDistributionSchema = z.object({
  students: count,
  teachers: count,
  admins: count,
});

export const topCourseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  enrollmentCount: count,
  revenue: amount,
});

export const recentEnrollmentSchema = z.object({
  id: z.uuid(),
  studentName: z.string().min(1),
  // null khi hồ sơ đã gỡ/không còn hoặc chưa lưu email: không bao giờ bịa email.
  studentEmail: z.email().nullable(),
  studentAvatar: z.string().nullable(), // Giữ nguyên việc bỏ .url() để an toàn cho Storage path
  courseTitle: z.string(),
  enrolledAt: z.string(),
});

export const adminDashboardSchema = z.object({
  // Mốc thời gian của database cho lời gọi này; thời gian chờ và "x phút trước" tính từ mốc này.
  generatedAt: z.string(),
  pending: z.object({
    count,
    oldestSubmittedAt: z.string().nullable(),
  }),
  metrics: adminDashboardMetricsSchema,
  revenueMonths: z.array(revenueMonthSchema).length(6),
  userDistribution: userDistributionSchema,
  topCourses: z.array(topCourseSchema).max(5),
  recentEnrollments: z.array(recentEnrollmentSchema).max(5),
});

export type AdminDashboardSummaryRpc = z.infer<typeof adminDashboardSummaryRpcSchema>;
export type AdminDashboardDTO = z.infer<typeof adminDashboardSchema>;

// ============================================================================
// 3. TYPES ĐẦU VÀO THÔ TỪ DB (EXPORT CHO API IMPORT THEO QUY TẮC SOT)
// ============================================================================
export interface RawEnrollmentJoin {
  id: string;
  enrolled_at: string;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  courses: Pick<Course, "title"> | null;
}
