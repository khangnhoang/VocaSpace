"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  topicContributorInputSchema,
  topicContributorRemovalSchema,
  topicResponsibilityTransferSchema,
  type TopicContributorInput,
  type TopicContributorRemovalInput,
  type TopicResponsibilityTransferInput,
} from "@/lib/schemas/topic-authorship";
import { getCourseOverviewPath, getCourseStructurePath } from "@/lib/course-authoring/routes";

function mapTopicAuthorshipError(error?: { message?: string }) {
  const text = error?.message ?? "";
  if (text.includes("AUTH_REQUIRED")) return "Vui lòng đăng nhập lại.";
  if (text.includes("TOPIC_AUTHORSHIP_MANAGEMENT_FORBIDDEN")) return "Chỉ chủ sở hữu hoặc đồng sở hữu mới được quản lý nhóm tác giả bài học.";
  if (text.includes("TOPIC_CONTRIBUTOR_MEMBERSHIP_REQUIRED")) return "Người đóng góp phải là thành viên có quyền soạn nội dung trong khóa học.";
  if (text.includes("TOPIC_RESPONSIBLE_AUTHOR_NOT_CONTRIBUTOR")) return "Người phụ trách bài học không thể đồng thời là người đóng góp.";
  if (text.includes("TOPIC_CREATOR_NOT_CONTRIBUTOR")) return "Người tạo bài học không thể đồng thời là người đóng góp.";
  if (text.includes("TOPIC_CONTRIBUTOR_CAP_REACHED")) return "Bài học đã đạt tối đa 2 người đóng góp.";
  if (text.includes("TOPIC_RESPONSIBILITY_RECIPIENT_INVALID")) return "Người nhận trách nhiệm không hợp lệ cho bài học này.";
  if (text.includes("TOPIC_PENDING_FROZEN")) return "Bài học đang chờ duyệt và tạm thời không nhận thay đổi.";
  if (text.includes("TOPIC_NOT_FOUND") || text.includes("TOPIC_REMOVED")) return "Bài học không còn khả dụng.";
  return "Không thể cập nhật nhóm tác giả bài học. Vui lòng thử lại.";
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

function revalidateTopic(result: unknown) {
  const row = result as { course_id?: string } | null;
  if (!row?.course_id) return;
  revalidatePath(getCourseOverviewPath(row.course_id));
  revalidatePath(getCourseStructurePath(row.course_id));
}

export async function addTopicContributor(rawInput: TopicContributorInput) {
  const parsed = topicContributorInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu người đóng góp không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("add_topic_contributor", {
    p_topic_id: parsed.data.topicId,
    p_user_id: parsed.data.userId,
  });
  if (error) return { error: mapTopicAuthorshipError(error) };
  revalidateTopic(data);
  return { success: true, data };
}

export async function removeTopicContributor(rawInput: TopicContributorRemovalInput) {
  const parsed = topicContributorRemovalSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ID người đóng góp không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("remove_topic_contributor", {
    p_contributor_id: parsed.data.contributorId,
  });
  if (error) return { error: mapTopicAuthorshipError(error) };
  revalidateTopic(data);
  return { success: true, data };
}

export async function transferTopicResponsibility(rawInput: TopicResponsibilityTransferInput) {
  const parsed = topicResponsibilityTransferSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu chuyển trách nhiệm không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("transfer_topic_responsibility", {
    p_topic_id: parsed.data.topicId,
    p_recipient_user_id: parsed.data.recipientUserId,
  });
  if (error) return { error: mapTopicAuthorshipError(error) };
  revalidateTopic(data);
  return { success: true, data };
}
