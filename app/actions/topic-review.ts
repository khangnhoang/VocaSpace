"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  platformModerationSchema,
  rejectTopicReviewSchema,
  requestTopicReviewSchema,
  topicReviewSubmissionSchema,
  type PlatformModerationInput,
  type RejectTopicReviewInput,
  type RequestTopicReviewInput,
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
  if (text.includes("TOPIC_AUTHOR_SUBMIT_REQUIRED")) return "Chỉ người tạo hoặc người phụ trách bài học mới được gửi yêu cầu duyệt.";
  if (text.includes("TOPIC_REVIEW_NOT_READY")) return "Bài học cần có ít nhất 1 flashcard và 1 bài tập trước khi gửi duyệt.";
  if (text.includes("TOPIC_REVIEW_SELF_REVIEW")) return "Bạn không thể tự duyệt yêu cầu của chính mình.";
  if (text.includes("TOPIC_REVIEW_FORBIDDEN")) return "Bạn không có quyền duyệt bài học này.";
  if (text.includes("TOPIC_REVIEW_STALE")) return "Yêu cầu duyệt đã thay đổi hoặc không còn hiệu lực. Vui lòng tải lại trang.";
  if (text.includes("TOPIC_REVIEW_ALREADY_PENDING")) return "Bài học đang có một yêu cầu duyệt đang chờ xử lý.";
  if (text.includes("TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER")) return "Chưa có người duyệt phù hợp khác để xử lý bài học. Hãy mở quản lý cộng tác viên và cấp quyền duyệt bài học cho biên tập viên hoặc người chỉ xem trước.";
  if (text.includes("TOPIC_REVIEW_REASON_REQUIRED")) return "Vui lòng nhập lý do từ chối.";
  if (text.includes("REVIEW_NOTE_IDENTITY_IMMUTABLE")) return "Ghi chú không thể đổi đối tượng hoặc tác giả sau khi tạo.";
  if (text.includes("REVIEW_NOTE_TARGET_TOPIC_MISMATCH")) return "Ghi chú chỉ được gắn vào flashcard hoặc bài tập của chính bài học này.";
  if (text.includes("TOPIC_REVIEW_NO_REMAINING_REVIEWER")) return "Không thể tiếp nhận xử lý vì không còn người duyệt phù hợp khác.";
  if (text.includes("TOPIC_REVIEW_RESCUE_FORBIDDEN")) return "Người gửi yêu cầu không thể tự tiếp nhận xử lý yêu cầu của mình; người duyệt phải là người khác.";
  if (text.includes("TOPIC_REVIEW_RESCUE_STALE")) return "Yêu cầu hỗ trợ không còn gắn với một yêu cầu xử lý đang mở.";
  if (text.includes("TOPIC_REVIEW_ESCALATION_NOT_FOUND")) return "Yêu cầu xử lý không còn tồn tại hoặc đã được xử lý.";
  if (text.includes("ADMIN_MODERATION_FORBIDDEN")) return "Bạn không có quyền xử lý nội dung nền tảng.";
  if (text.includes("MODERATION_TARGET_STATE_INVALID")) return "Đối tượng không còn ở trạng thái phù hợp với thao tác xử lý nền tảng.";
  if (text.includes("TOPIC_REVIEW_ESCALATION_FORBIDDEN")) return "Chỉ chủ sở hữu hoặc đồng sở hữu mới được xử lý yêu cầu này.";
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
