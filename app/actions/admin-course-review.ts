"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  acceptCourseSchema,
  rejectCourseSchema,
  type AcceptCourseInput,
  type RejectCourseInput,
} from "@/lib/schemas/admin-course";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
  getTeacherCourseListRouteFileRevalidationPath,
} from "@/lib/course-authoring/routes";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import { ADMIN_COURSES_PATH } from "@/lib/admin/routes";

type RpcError = { code?: string; message?: string };
type RpcResult = { course_id?: string; status?: string };

// Admin duyệt / từ chối khóa học đang chờ. Quyền admin, trạng thái và lý do do RPC kiểm tra;
// action chỉ validate input và dịch lỗi sang thông báo an toàn. Màn hình gọi các action này là /admin/courses (AD3).
function mapAdminCourseReviewError(error?: RpcError | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`;
  if (text.includes("AUTH_REQUIRED")) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (text.includes("ADMIN_COURSE_REVIEW_FORBIDDEN")) return "Bạn không có quyền duyệt khóa học.";
  if (text.includes("COURSE_NOT_FOUND")) return "Khóa học không tồn tại hoặc đã bị xóa.";
  if (text.includes("COURSE_REVIEW_STATE_INVALID")) return "Khóa học không còn ở trạng thái chờ duyệt. Vui lòng tải lại trang.";
  if (text.includes("COURSE_SUBMIT_NOT_READY")) return "Khóa học không còn bài học nào đã xuất bản nên chưa thể duyệt.";
  if (text.includes("COURSE_REJECT_REASON_INVALID")) return "Lý do từ chối phải có từ 10 đến 1000 ký tự.";
  return "Không thể xử lý duyệt khóa học. Vui lòng thử lại.";
}

function revalidateCourseReview(result: RpcResult | null) {
  revalidatePath(ADMIN_COURSES_PATH);
  if (!result?.course_id) return;
  revalidatePath(getCourseOverviewPath(result.course_id));
  revalidatePath(getCourseStructurePath(result.course_id));
  revalidatePath(getTeacherCourseListRouteFileRevalidationPath());
  revalidatePath(getPublicCourseCatalogPath());
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function approveCourseReview(rawInput: AcceptCourseInput) {
  const parsed = acceptCourseSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("approve_course_review", { p_course_id: parsed.data.courseId });
  if (error) return { error: mapAdminCourseReviewError(error) };
  revalidateCourseReview(data as RpcResult | null);
  return { success: true, data };
}

export async function rejectCourseReview(rawInput: RejectCourseInput) {
  const parsed = rejectCourseSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("reject_course_review", {
    p_course_id: parsed.data.courseId,
    p_reason: parsed.data.rejectMessage,
  });
  if (error) return { error: mapAdminCourseReviewError(error) };
  revalidateCourseReview(data as RpcResult | null);
  return { success: true, data };
}
