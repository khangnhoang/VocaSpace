// File: app/actions/teacher-course-portfolio.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import {
  teacherCoursePortfolioSchema,
  type TeacherCoursePortfolioResult,
} from "@/lib/schemas/teacher-course-portfolio";

const unavailable = (): TeacherCoursePortfolioResult => ({
  success: false,
  errorCode: "UNAVAILABLE",
  error: "Không thể tải danh sách khóa học lúc này. Vui lòng thử lại.",
});

// Không nhận tham số: người gọi luôn là auth.uid() trong RPC nên không có danh tính nào để client giả mạo (G3).
// Quyền duyệt/sửa được database quyết định; ở đây chỉ parse lại payload và đổi lỗi thành kết quả an toàn.
export async function getTeacherCoursePortfolio(): Promise<TeacherCoursePortfolioResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_teacher_course_portfolio");

    if (error) {
      console.error("[TEACHER PORTFOLIO RPC ERROR]:", error);
      if (error.message?.includes("AUTH_REQUIRED")) {
        return {
          success: false,
          errorCode: "AUTH_REQUIRED",
          error: "Vui lòng đăng nhập lại!",
        };
      }
      if (error.message?.includes("TEACHER_PORTFOLIO_FORBIDDEN")) {
        return {
          success: false,
          errorCode: "FORBIDDEN",
          error: "Bạn không có quyền xem danh sách khóa học này.",
        };
      }
      return unavailable();
    }

    const parsed = teacherCoursePortfolioSchema.safeParse(data);
    if (!parsed.success) {
      console.error("[TEACHER PORTFOLIO SHAPE ERROR]:", parsed.error.issues);
      return unavailable();
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    console.error("[TEACHER PORTFOLIO UNEXPECTED ERROR]:", error);
    return unavailable();
  }
}
