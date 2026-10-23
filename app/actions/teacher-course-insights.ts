// File: app/actions/teacher-course-insights.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { courseIdSchema } from "@/lib/schemas/course";
import {
  teacherCourseInsightsSchema,
  type TeacherCourseInsightsResult,
} from "@/lib/schemas/teacher-course-insights";

const unavailable = (): TeacherCourseInsightsResult => ({
  success: false,
  errorCode: "UNAVAILABLE",
  error: "Không thể tải số liệu khóa học lúc này. Vui lòng thử lại.",
});

// Quyền xem số liệu do RPC quyết định (profile còn hoạt động + has_course_authoring_access);
// ở đây chỉ parse courseId, kiểm session, parse lại payload và đổi lỗi thành kết quả an toàn (G4).
export async function getTeacherCourseInsights(courseId: string): Promise<TeacherCourseInsightsResult> {
  const parsedCourseId = courseIdSchema.safeParse(courseId);
  if (!parsedCourseId.success) {
    return { success: false, errorCode: "INVALID_INPUT", error: "ID khóa học không hợp lệ." };
  }

  try {
    const supabase = await createClient();
    // anon bị thu hồi execute nên không session sẽ nhận 42501 (không phải AUTH_REQUIRED); kiểm session trước để UI phân biệt được.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, errorCode: "AUTH_REQUIRED", error: "Vui lòng đăng nhập lại!" };
    }

    const { data, error } = await supabase.rpc("get_teacher_course_insights", {
      p_course_id: parsedCourseId.data,
    });

    if (error) {
      console.error("[TEACHER COURSE INSIGHTS RPC ERROR]:", error);
      if (error.message?.includes("AUTH_REQUIRED")) {
        return { success: false, errorCode: "AUTH_REQUIRED", error: "Vui lòng đăng nhập lại!" };
      }
      if (error.message?.includes("TEACHER_INSIGHTS_FORBIDDEN")) {
        return {
          success: false,
          errorCode: "FORBIDDEN",
          error: "Khóa học không tồn tại hoặc bạn không có quyền xem số liệu này.",
        };
      }
      return unavailable();
    }

    const parsed = teacherCourseInsightsSchema.safeParse(data);
    if (!parsed.success) {
      console.error("[TEACHER COURSE INSIGHTS SHAPE ERROR]:", parsed.error.issues);
      return unavailable();
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    console.error("[TEACHER COURSE INSIGHTS UNEXPECTED ERROR]:", error);
    return unavailable();
  }
}
