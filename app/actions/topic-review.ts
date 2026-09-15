"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  platformModerationSchema,
  rejectTopicReviewSchema,
  requestTopicReviewSchema,
  resolveTopicReviewEscalationSchema,
  topicReviewSubmissionSchema,
  type PlatformModerationInput,
  type RejectTopicReviewInput,
  type RequestTopicReviewInput,
  type ResolveTopicReviewEscalationInput,
  type TopicReviewSubmissionInput,
} from "@/lib/schemas/topic-review";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
} from "@/lib/course-authoring/routes";

type RpcError = { code?: string; message?: string };
type RpcResult = { course_id?: string; topic_id?: string };

function mapTopicReviewError(error?: RpcError | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`;
  if (text.includes("AUTH_REQUIRED")) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (text.includes("TOPIC_REVIEW_NOT_READY")) return "Bài học cần có ít nhất 1 flashcard và 1 bài tập trước khi gửi duyệt.";
  if (text.includes("TOPIC_REVIEW_SELF_REVIEW")) return "Bạn không thể tự duyệt yêu cầu của chính mình.";
  if (text.includes("TOPIC_REVIEW_FORBIDDEN")) return "Bạn không có quyền duyệt bài học này.";
  if (text.includes("TOPIC_REVIEW_STALE")) return "Yêu cầu duyệt đã thay đổi hoặc không còn hiệu lực. Vui lòng tải lại trang.";
  if (text.includes("TOPIC_REVIEW_ALREADY_PENDING")) return "Bài học đang có một yêu cầu duyệt đang chờ xử lý.";
  if (text.includes("TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER")) return "Chưa có reviewer hợp lệ khác để xử lý bài học. Hãy mở quản lý cộng tác viên và cấp quyền duyệt topic cho editor hoặc previewer.";
  if (text.includes("TOPIC_REVIEW_ESCALATION_HOLD") || text.includes("TOPIC_REVIEW_CREATION_HOLD")) return "Thao tác đang bị khóa bởi escalation chưa được xử lý.";
  if (text.includes("TOPIC_REVIEW_REASON_REQUIRED")) return "Vui lòng nhập lý do từ chối.";
  if (text.includes("TOPIC_REVIEW_NO_REMAINING_REVIEWER")) return "Không thể takeover vì không còn reviewer hợp lệ khác.";
  if (text.includes("TOPIC_REVIEW_RESCUE_FORBIDDEN")) return "Submitter không thể takeover escalation của chính mình và reviewer phải là một người khác.";
  if (text.includes("TOPIC_REVIEW_RESCUE_STALE")) return "Rescue không còn gắn với escalation đang mở.";
  if (text.includes("TOPIC_REVIEW_ESCALATION_NOT_FOUND")) return "Escalation không còn tồn tại hoặc đã được xử lý.";
  if (text.includes("ADMIN_MODERATION_FORBIDDEN")) return "Bạn không có quyền moderation nền tảng.";
  if (text.includes("MODERATION_TARGET_STATE_INVALID")) return "Đối tượng không còn ở trạng thái phù hợp với thao tác moderation.";
  if (text.includes("TOPIC_REVIEW_ESCALATION_FORBIDDEN")) return "Chỉ owner hoặc co-owner mới được xử lý escalation.";
  if (text.includes("COURSE_EDIT_FORBIDDEN")) return "Bạn không có quyền chỉnh sửa bài học này.";
  return "Không thể xử lý vòng duyệt bài học. Vui lòng thử lại.";
}

function revalidateCourse(result: RpcResult | null) {
  if (!result?.course_id) return;
  revalidatePath(getCourseOverviewPath(result.course_id));
  revalidatePath(getCourseStructurePath(result.course_id));
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function requestTopicReview(rawInput: RequestTopicReviewInput) {
  const parsed = requestTopicReviewSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("request_topic_review", { p_topic_id: parsed.data.topicId });
  if (error) return { error: mapTopicReviewError(error) };
  revalidateCourse(data as RpcResult | null);
  return { success: true, data };
}

export async function approveTopicReview(rawInput: TopicReviewSubmissionInput) {
  const parsed = topicReviewSubmissionSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("approve_topic_review", { p_submission_id: parsed.data.submissionId });
  if (error) return { error: mapTopicReviewError(error) };
  revalidateCourse(data as RpcResult | null);
  return { success: true, data };
}

export async function rejectTopicReview(rawInput: RejectTopicReviewInput) {
  const parsed = rejectTopicReviewSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("reject_topic_review", {
    p_submission_id: parsed.data.submissionId,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: mapTopicReviewError(error) };
  revalidateCourse(data as RpcResult | null);
  return { success: true, data };
}

export async function resolveTopicReviewEscalation(rawInput: ResolveTopicReviewEscalationInput) {
  const parsed = resolveTopicReviewEscalationSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("resolve_topic_review_escalation", {
    p_escalation_id: parsed.data.escalationId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: mapTopicReviewError(error) };
  revalidateCourse(data as RpcResult | null);
  return { success: true, data };
}

export async function moderatePlatformContent(rawInput: PlatformModerationInput) {
  const parsed = platformModerationSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu moderation không hợp lệ." };
  const supabase = await requireUser();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("moderate_platform_content", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: mapTopicReviewError(error) };
  revalidateCourse(data as RpcResult | null);
  return { success: true, data };
}
