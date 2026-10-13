"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  submitCourseReviewSchema,
  type SubmitCourseReviewInput,
} from "@/lib/schemas/admin-course";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
  getTeacherCourseListRouteFileRevalidationPath,
} from "@/lib/course-authoring/routes";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";

type RpcError = { code?: string; message?: string };
type RpcResult = { course_id?: string; status?: string };

// Giáo viên gửi duyệt / rút lại khóa học. Quyền, trạng thái và điều kiện có bài đã xuất bản
// do RPC kiểm tra trong khóa course; action chỉ validate input và dịch lỗi sang thông báo an toàn.
function mapCourseReviewError(error?: RpcError | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`;
  if (text.includes("AUTH_REQUIRED")) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (text.includes("COURSE_SUBMIT_FORBIDDEN")) return "Chỉ chủ sở hữu hoặc đồng sở hữu mới được gửi duyệt hoặc rút yêu cầu duyệt khóa học.";
  if (text.includes("COURSE_NOT_FOUND")) return "Khóa học không tồn tại hoặc đã bị xóa.";
  if (text.includes("COURSE_REVIEW_STATE_INVALID")) return "Trạng thái khóa học đã thay đổi. Vui lòng tải lại trang.";
  if (text.includes("COURSE_SUBMIT_NOT_READY")) return "Cần ít nhất 1 bài học đã xuất bản để gửi duyệt.";
  return "Không thể xử lý yêu cầu duyệt khóa học. Vui lòng thử lại.";
}

function revalidateCourseReview(result: RpcResult | null) {
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

export async function submitCourseReview(rawInput: SubmitCourseReviewInput) {
  const parsed = submitCourseReviewSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("submit_course_review", { p_course_id: parsed.data.courseId });
  if (error) return { error: mapCourseReviewError(error) };
  revalidateCourseReview(data as RpcResult | null);
  return { success: true, data };
}

export async function withdrawCourseReview(rawInput: SubmitCourseReviewInput) {
  const parsed = submitCourseReviewSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("withdraw_course_review", { p_course_id: parsed.data.courseId });
  if (error) return { error: mapCourseReviewError(error) };
  revalidateCourseReview(data as RpcResult | null);
  return { success: true, data };
}
