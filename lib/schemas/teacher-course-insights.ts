// File: lib/schemas/teacher-course-insights.ts
import { z } from "zod";

// Hợp đồng đọc của `get_teacher_course_insights(p_course_id)` (supabase/migrations/20261023120000_tov1_*).
// Mọi object là strict: payload chỉ được chứa số đếm tổng hợp, nên field lạ (ví dụ id học viên) làm parse thất bại.
const countSchema = z.number().int().nonnegative();

export const teacherCourseEnrollmentMonthSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  count: countSchema,
});

export const teacherCourseProgressDistributionSchema = z.strictObject({
  not_started: countSchema,
  in_progress: countSchema,
  completed: countSchema,
});

const ENROLLMENT_MONTH_COUNT = 6;

function monthIndex(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return year * 12 + monthNumber;
}

export const teacherCourseInsightsSchema = z
  .strictObject({
    enrollment_total: countSchema,
    // Sáu tháng gần nhất, cũ nhất trước; phần tử cuối là tháng hiện tại theo giờ Việt Nam của database.
    enrollments_by_month: z.array(teacherCourseEnrollmentMonthSchema).length(ENROLLMENT_MONTH_COUNT),
    counted_topic_total: countSchema,
    // null khi khóa học chưa có bài được tính: không có phân bố để hiển thị.
    progress: teacherCourseProgressDistributionSchema.nullable(),
  })
  .superRefine((insights, ctx) => {
    const months = insights.enrollments_by_month;
    if (months.some((entry, index) => index > 0 && monthIndex(entry.month) !== monthIndex(months[index - 1].month) + 1)) {
      ctx.addIssue({ code: "custom", message: "Enrollment months must be consecutive, oldest first." });
    }
    if (months.reduce((sum, entry) => sum + entry.count, 0) > insights.enrollment_total) {
      ctx.addIssue({ code: "custom", message: "Monthly enrollments cannot exceed the enrollment total." });
    }
    if ((insights.counted_topic_total === 0) !== (insights.progress === null)) {
      ctx.addIssue({ code: "custom", message: "Progress is present exactly when the course has counted topics." });
    }
    const progress = insights.progress;
    if (progress && progress.not_started + progress.in_progress + progress.completed !== insights.enrollment_total) {
      ctx.addIssue({ code: "custom", message: "Every enrolled learner belongs to exactly one progress category." });
    }
  });

// INVALID_INPUT: courseId không phải UUID; AUTH_REQUIRED: chưa đăng nhập;
// FORBIDDEN: profile không còn hoạt động, không có quyền tác giả, hoặc khóa học không tồn tại/đã xóa;
// UNAVAILABLE: lỗi RPC/mạng/JSON lạ. `error` là câu hiển thị được, không chứa chi tiết SQL hay Zod.
export type TeacherCourseInsightsResult =
  | { success: true; data: TeacherCourseInsights }
  | {
      success: false;
      errorCode: "INVALID_INPUT" | "AUTH_REQUIRED" | "FORBIDDEN" | "UNAVAILABLE";
      error: string;
    };

export type TeacherCourseEnrollmentMonth = z.infer<typeof teacherCourseEnrollmentMonthSchema>;
export type TeacherCourseProgressDistribution = z.infer<typeof teacherCourseProgressDistributionSchema>;
export type TeacherCourseInsights = z.infer<typeof teacherCourseInsightsSchema>;
