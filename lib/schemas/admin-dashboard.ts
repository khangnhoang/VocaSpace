import { z } from "zod";
import { Profile, Course } from "@/types/database";

export const adminMetricsSchema = z.object({
  totalRevenue: z.number().min(0),
  totalStudents: z.number().min(0),
  activeCourses: z.number().min(0),
  totalFlashcardReviews: z.number().min(0),
});

export const revenueTrendSchema = z.object({
  month: z.string(),
  revenue: z.number().min(0),
});

export const userDistributionSchema = z.object({
  students: z.number().min(0),
  teachers: z.number().min(0),
  admins: z.number().min(0),
});

export const topCourseSchema = z.object({
  id: z.uuid(), // 🔥 KHÔI PHỤC: Bắt buộc phải là định dạng UUID nghiêm ngặt
  title: z.string(),
  enrollmentCount: z.number().min(0),
  revenue: z.number().min(0),
});

export const recentEnrollmentSchema = z.object({
  id: z.uuid(), // 🔥 KHÔI PHỤC: Thống nhất chuẩn UUID toàn hệ thống
  studentName: z.string().nullable(),
  studentEmail: z.email(),
  studentAvatar: z.string().nullable(), // Giữ nguyên việc bỏ .url() để an toàn cho Storage path
  courseTitle: z.string(),
  price: z.number().min(0),
  enrolledAt: z.string(),
});

export const adminDashboardSchema = z.object({
  metrics: adminMetricsSchema,
  revenueTrends: z.array(revenueTrendSchema),
  userDistribution: userDistributionSchema,
  topCourses: z.array(topCourseSchema).max(5),
  recentEnrollments: z.array(recentEnrollmentSchema),
});

export type AdminDashboardDTO = z.infer<typeof adminDashboardSchema>;

// ============================================================================
// 2. TYPES ĐẦU VÀO THÔ TỪ DB (EXPORT CHO API IMPORT THEO QUY TẮC SOT)
// ============================================================================
export interface RawEnrollmentJoin {
  id: string;
  enrolled_at: string;
  profiles: Pick<Profile, "full_name" | "email" | "avatar_url"> | null;
  courses: Pick<Course, "title" | "price"> | null;
}

export interface RawCourseWithEnrollments {
  id: string;
  title: string;
  price: number;
  enrollments: { id: string }[];
}