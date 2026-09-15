"use server";

import { createClient } from "@/utils/supabase/server";
import {
  setCourseCollaboratorCapabilitySchema,
  updateCourseCollaboratorRoleSchema,
  courseCollaboratorIdSchema,
  type SetCourseCollaboratorCapabilityInput,
  type UpdateCourseCollaboratorRoleInput,
  courseCollaboratorOverviewInputSchema,
  courseCollaboratorOverviewSchema,
  type CourseCollaboratorOverview,
  courseCollaboratorInvitationIdSchema,
  sendCourseCollaboratorInvitationSchema,
  courseCollaboratorInvitationSchema,
  type CourseCollaboratorInvitation,
  type SendCourseCollaboratorInvitationInput,
} from "@/lib/schemas/course-collaborator";

function mapCollaboratorError(error?: { message?: string }) {
  const text = error?.message ?? "";
  if (text.includes("AUTH_REQUIRED")) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (text.includes("LAST_REVIEWER_REQUIRED")) return "Không thể thay đổi vì sẽ mất reviewer hợp lệ cuối cùng của yêu cầu đang chờ.";
  if (text.includes("MANAGEMENT_FORBIDDEN")) return "Chỉ owner hoặc co-owner mới được quản lý cộng tác viên.";
  if (text.includes("ROLE_CHANGE_OUTSIDE_D1")) return "Thay đổi vai trò này chưa thuộc phạm vi D1.";
  if (text.includes("CAPABILITY_ROLE_INVALID")) return "Chỉ editor hoặc previewer mới có thể được cấp quyền duyệt topic.";
  if (text.includes("OWNER_REMOVAL_FORBIDDEN")) return "Không thể xóa owner khỏi khóa học trong luồng này.";
  if (text.includes("INVITATION_OWNER_ROLE_FORBIDDEN")) return "Không thể mời thêm owner.";
  if (text.includes("INVITATION_CAPABILITY_ROLE_INVALID")) return "Chỉ editor hoặc previewer mới có thể nhận quyền duyệt topic.";
  if (text.includes("INVITATION_MANAGEMENT_FORBIDDEN")) return "Chỉ owner hoặc co-owner phù hợp mới được quản lý lời mời.";
  if (text.includes("INVITATION_ROLE_FORBIDDEN")) return "Vai trò này chỉ owner mới được mời hoặc thu hồi.";
  if (text.includes("INVITATION_TARGET_NOT_FOUND")) return "Không tìm thấy tài khoản đang hoạt động với email này.";
  if (text.includes("INVITATION_ALREADY_MEMBER")) return "Tài khoản này đã là cộng tác viên của khóa học.";
  if (text.includes("INVITATION_ALREADY_PENDING")) return "Tài khoản này đã có lời mời đang chờ xử lý.";
  if (text.includes("INVITATION_CAPACITY_REACHED")) return "Đã đạt giới hạn cộng tác viên cho vai trò này.";
  if (text.includes("INVITATION_FORBIDDEN")) return "Bạn không có quyền xử lý lời mời này.";
  if (text.includes("INVITATION_STALE")) return "Lời mời đã được xử lý hoặc không còn hiệu lực.";
  if (text.includes("INVITATION_NOT_FOUND")) return "Không tìm thấy lời mời.";
  return "Không thể cập nhật cộng tác viên. Vui lòng thử lại.";
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function setCourseCollaboratorReviewCapability(rawInput: SetCourseCollaboratorCapabilityInput) {
  const parsed = setCourseCollaboratorCapabilitySchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu cộng tác viên không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("set_course_collaborator_review_capability", {
    p_collaborator_id: parsed.data.collaboratorId,
    p_can_review_topics: parsed.data.canReviewTopics,
  });
  if (error) return { error: mapCollaboratorError(error) };
  return { success: true, data };
}

export async function updateCourseCollaboratorRole(rawInput: UpdateCourseCollaboratorRoleInput) {
  const parsed = updateCourseCollaboratorRoleSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu cộng tác viên không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("update_course_collaborator_role", {
    p_collaborator_id: parsed.data.collaboratorId,
    p_role: parsed.data.role,
  });
  if (error) return { error: mapCollaboratorError(error) };
  return { success: true, data };
}

export async function removeCourseCollaborator(rawInput: { collaboratorId: string }) {
  const parsed = courseCollaboratorIdSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ID cộng tác viên không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("remove_course_collaborator", {
    p_collaborator_id: parsed.data.collaboratorId,
  });
  if (error) return { error: mapCollaboratorError(error) };
  return { success: true, data };
}

export async function getCourseCollaboratorOverview(rawInput: {
  courseId: string;
}): Promise<{ data: CourseCollaboratorOverview[] } | { error: string }> {
  const parsed = courseCollaboratorOverviewInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ID khóa học không hợp lệ." };

  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data: actor, error: actorError } = await supabase
    .from("course_collaborators")
    .select("role")
    .eq("course_id", parsed.data.courseId)
    .eq("user_id", user.id)
    .single();

  if (actorError || !actor || !["owner", "co_owner"].includes(actor.role)) {
    return { error: "Chỉ owner hoặc co-owner mới được quản lý cộng tác viên." };
  }

  const { data, error } = await supabase
    .from("course_collaborators")
    .select("id, user_id, role, can_review_topics, profiles!inner(id, full_name, avatar_url)")
    .eq("course_id", parsed.data.courseId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[COLLABORATOR OVERVIEW ERROR]:", error);
    return { error: "Không thể tải danh sách cộng tác viên. Vui lòng thử lại." };
  }

  const collaborators: CourseCollaboratorOverview[] = [];
  for (const row of data ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const parsedRow = courseCollaboratorOverviewSchema.safeParse({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      canReviewTopics: row.can_review_topics,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    });
    if (!parsedRow.success) {
      console.error("[COLLABORATOR OVERVIEW SHAPE ERROR]:", parsedRow.error.issues);
      return { error: "Cấu trúc cộng tác viên không hợp lệ. Vui lòng thử lại." };
    }
    collaborators.push(parsedRow.data);
  }

  return { data: collaborators };
}

export async function sendCourseCollaboratorInvitation(rawInput: SendCourseCollaboratorInvitationInput) {
  const parsed = sendCourseCollaboratorInvitationSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu lời mời không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("send_course_collaborator_invitation", {
    p_course_id: parsed.data.courseId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_can_review_topics: parsed.data.canReviewTopics,
  });
  if (error) return { error: mapCollaboratorError(error) };
  return { success: true, data };
}

export async function acceptCourseCollaboratorInvitation(rawInput: { invitationId: string }) {
  const parsed = courseCollaboratorInvitationIdSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ID lời mời không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("accept_course_collaborator_invitation", {
    p_invitation_id: parsed.data.invitationId,
  });
  if (error) return { error: mapCollaboratorError(error) };
  return { success: true, data };
}

export async function rejectCourseCollaboratorInvitation(rawInput: { invitationId: string }) {
  const parsed = courseCollaboratorInvitationIdSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ID lời mời không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("reject_course_collaborator_invitation", {
    p_invitation_id: parsed.data.invitationId,
  });
  if (error) return { error: mapCollaboratorError(error) };
  return { success: true, data };
}

export async function revokeCourseCollaboratorInvitation(rawInput: { invitationId: string }) {
  const parsed = courseCollaboratorInvitationIdSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ID lời mời không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("revoke_course_collaborator_invitation", {
    p_invitation_id: parsed.data.invitationId,
  });
  if (error) return { error: mapCollaboratorError(error) };
  return { success: true, data };
}

export async function getCourseCollaboratorInvitations(rawInput: { courseId: string }): Promise<{ data: CourseCollaboratorInvitation[] } | { error: string }> {
  const parsed = courseCollaboratorOverviewInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ID khóa học không hợp lệ." };
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase
    .from("course_collaborator_invitations")
    .select("id, course_id, invitee_user_id, role, can_review_topics, status, created_at, actioned_at")
    .eq("course_id", parsed.data.courseId)
    .order("created_at", { ascending: false });
  if (error) return { error: "Không thể tải danh sách lời mời. Vui lòng thử lại." };
  const invitations: CourseCollaboratorInvitation[] = [];
  for (const row of data ?? []) {
    const parsedRow = courseCollaboratorInvitationSchema.safeParse({
      id: row.id,
      courseId: row.course_id,
      inviteeUserId: row.invitee_user_id,
      role: row.role,
      canReviewTopics: row.can_review_topics,
      status: row.status,
      createdAt: row.created_at,
      actionedAt: row.actioned_at,
    });
    if (!parsedRow.success) return { error: "Cấu trúc lời mời không hợp lệ. Vui lòng thử lại." };
    invitations.push(parsedRow.data);
  }
  return { data: invitations };
}

export async function getMyPendingCourseCollaboratorInvitations(): Promise<{ data: CourseCollaboratorInvitation[] } | { error: string }> {
  const supabase = await getAuthenticatedClient();
  if (!supabase) return { error: "Vui lòng đăng nhập lại." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase
    .from("course_collaborator_invitations")
    .select("id, course_id, invitee_user_id, role, can_review_topics, status, created_at, actioned_at")
    .eq("invitee_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return { error: "Không thể tải lời mời cộng tác. Vui lòng thử lại." };
  const invitations: CourseCollaboratorInvitation[] = [];
  for (const row of data ?? []) {
    const parsedRow = courseCollaboratorInvitationSchema.safeParse({
      id: row.id,
      courseId: row.course_id,
      inviteeUserId: row.invitee_user_id,
      role: row.role,
      canReviewTopics: row.can_review_topics,
      status: row.status,
      createdAt: row.created_at,
      actionedAt: row.actioned_at,
    });
    if (parsedRow.success) invitations.push(parsedRow.data);
  }
  return { data: invitations };
}
