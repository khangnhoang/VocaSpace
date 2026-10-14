"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getActiveAdminUserId } from "@/lib/auth/admin-access";
import { getAdminCourseSummaryData } from "@/lib/admin/course-list";
import { ADMIN_COURSES_PATH } from "@/lib/admin/routes";
import {
  adminCourseSummarySchema,
  moderateCourseSchema,
  type AdminCourseSummary,
  type AdminCourseSummaryInput,
  type ModerateCourseInput,
} from "@/lib/schemas/admin-course";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
  getTeacherCourseListRouteFileRevalidationPath,
} from "@/lib/course-authoring/routes";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";

type RpcError = { code?: string; message?: string };

const ADMIN_REQUIRED_MESSAGE = "Bạn cần đăng nhập bằng tài khoản quản trị viên đang hoạt động.";

// Dịch mã lỗi của moderate_platform_content sang thông báo an toàn; mã lạ không lộ nội dung database.
function mapModerateCourseError(error?: RpcError | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`;
  if (text.includes("AUTH_REQUIRED")) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (text.includes("ADMIN_MODERATION_FORBIDDEN")) return "Bạn không có quyền xử lý nội dung nền tảng.";
  if (text.includes("MODERATION_REASON_REQUIRED")) return "Vui lòng nhập lý do.";
  if (text.includes("MODERATION_REASON_TOO_LONG")) return "Lý do không được vượt quá 2000 ký tự.";
  if (text.includes("MODERATION_TARGET_NOT_FOUND")) return "Khóa học không tồn tại hoặc đã bị xóa.";
  if (text.includes("MODERATION_TARGET_STATE_INVALID")) return "Khóa học không còn ở trạng thái đã xuất bản. Vui lòng tải lại trang.";
  if (text.includes("MODERATION_TARGET_ALREADY_REMOVED")) return "Khóa học đã bị gỡ trước đó. Vui lòng tải lại trang.";
  return "Không thể xử lý khóa học. Vui lòng thử lại.";
}

// Hạ về bản nháp / gỡ một khóa học đã xuất bản (AD3 AC7, AC8). Target type luôn là 'course' do server cố định.
// Action tự kiểm tra admin đang hoạt động trước khi gọi RPC vì moderate_platform_content chưa kiểm tra `removed_at`
// của admin (bổ sung ở AD7 / ADMIN-004); trạng thái khóa học và lý do vẫn do RPC kiểm tra sau khi khóa course.
export async function moderateCourse(rawInput: ModerateCourseInput) {
  const parsed = moderateCourseSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  if (!(await getActiveAdminUserId(supabase))) return { error: ADMIN_REQUIRED_MESSAGE };

  const { courseId, action, reason } = parsed.data;
  const { data, error } = await supabase.rpc("moderate_platform_content", {
    p_target_type: "course",
    p_target_id: courseId,
    p_action: action,
    p_reason: reason,
  });
  if (error) return { error: mapModerateCourseError(error) };

  revalidatePath(ADMIN_COURSES_PATH);
  revalidatePath(getCourseOverviewPath(courseId));
  revalidatePath(getCourseStructurePath(courseId));
  revalidatePath(getTeacherCourseListRouteFileRevalidationPath());
  revalidatePath(getPublicCourseCatalogPath());
  return { success: true, data };
}

// Tóm tắt khóa học cho panel của /admin/courses. Server Action là một entry point riêng nên không dựa vào cổng của page:
// tự kiểm tra admin đang hoạt động trong chính request này trước mọi truy vấn (AD3 G1).
export async function getAdminCourseSummary(
  rawInput: AdminCourseSummaryInput,
): Promise<{ success: true; data: AdminCourseSummary } | { error: string }> {
  const parsed = adminCourseSummarySchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  if (!(await getActiveAdminUserId(supabase))) return { error: ADMIN_REQUIRED_MESSAGE };

  const result = await getAdminCourseSummaryData(supabase, parsed.data.courseId);
  if (result.error) return { error: result.error };
  if (!result.data) return { error: "Khóa học không tồn tại hoặc đã bị xóa." };
  return { success: true, data: result.data };
}
