"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { authEmailRedirect } from "@/lib/i18n/auth-email";
import { adminUserSchema, adminUserIdSchema, adminUserUpdateSchema, AdminUserInput, AdminUserUpdateInput } from "@/lib/schemas/auth";

// Khởi tạo Supabase Admin Client (Có quyền sinh sát tối cao, vượt qua mọi RLS)
const getAdminClient = () => {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

type AdminAuthorization =
  | { authorized: true; userId: string }
  | { authorized: false; error: string };

async function requireAdmin(): Promise<AdminAuthorization> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .is("removed_at", null)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { authorized: false, error: "Từ chối truy cập. Bạn không có quyền hạn quản trị viên." };
  }

  return { authorized: true, userId: user.id };
}

// 1. Lấy danh sách toàn bộ User
export async function getAllUsers() {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return { error: authorization.error };

  // AUTH-019: user client không còn quyền đọc email/phone/dob/gender; chỉ đọc bằng service role
  // sau khi requireAdmin đạt, và giữ bộ lọc `removed_at` mà RLS áp cho admin trước đây.
  const { data, error } = await getAdminClient()
    .from("profiles")
    .select("*")
    .is("removed_at", null)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data };
}

// 2. Thêm User mới: không đặt mật khẩu, gửi mail đặt mật khẩu cho chủ email (AUTH-004)
const CREATE_USER_MAIL_FAILED_MESSAGE =
  "Đã tạo tài khoản nhưng chưa gửi được email đặt mật khẩu. Hãy nhờ người dùng chọn \"Quên mật khẩu?\" ở trang đăng nhập.";
const CREATE_USER_ROLE_FAILED_MESSAGE =
  "Đã tạo tài khoản nhưng chưa gán được vai trò. Hãy mở Chỉnh sửa để đặt lại vai trò, rồi nhờ người dùng chọn \"Quên mật khẩu?\" để đặt mật khẩu.";

// `accountCreated: true` đi kèm `error` khi tài khoản đã được tạo nhưng bước sau (gán vai trò, gửi mail) thất bại,
// để form đóng lại và danh sách tải lại, tránh admin gửi lại cùng một lần tạo.
export async function createUserByAdmin(data: AdminUserInput) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return { error: authorization.error };

  const adminClient = getAdminClient();
  const validated = adminUserSchema.safeParse(data);
  if (!validated.success) return { error: "Dữ liệu không hợp lệ!" };

  const { email, username, full_name, phone, role } = validated.data;

  // G4: không có `password` (không ai biết mật khẩu nào của tài khoản này) và có marker d7_server_created
  // để hook "Before User Created" coi đây là tài khoản do server tạo.
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { d7_server_created: true },
    user_metadata: { username, full_name, phone }, // Trigger handle_new_user chép các trường này vào profiles
  });

  if (authError) return { error: authError.message };

  // Trigger luôn tạo profile 'student'; vai trò admin chọn được gán ở đây.
  if (authData.user) {
    const { error: roleError } = await adminClient.from("profiles").update({ role }).eq("id", authData.user.id);
    if (roleError) {
      console.error("createUserByAdmin role update failed:", roleError.code);
      return { error: CREATE_USER_ROLE_FAILED_MESSAGE, accountCreated: true as const };
    }
  }

  // Dùng client anon không lưu session: mail recovery chuẩn của app, không ghi cookie vào phiên của admin.
  const mailer = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  // English localization U6 AC7: ngôn ngữ email theo giao diện của admin; khu admin bị khóa tiếng Việt đến bước B nên tới lúc
  // đó lời gọi giữ nguyên tham số cũ.
  const redirectTo = await authEmailRedirect();
  const { error: mailError } = redirectTo
    ? await mailer.auth.resetPasswordForEmail(email, { redirectTo })
    : await mailer.auth.resetPasswordForEmail(email);
  if (mailError) {
    console.error("createUserByAdmin recovery mail failed:", mailError.code ?? mailError.status);
    return { error: CREATE_USER_MAIL_FAILED_MESSAGE, accountCreated: true as const };
  }

  return { success: true, message: "Đã tạo tài khoản và gửi email đặt mật khẩu" };
}

// 3. Sửa thông tin User
export async function updateUserByAdmin(id: string, data: AdminUserUpdateInput | AdminUserInput) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return { error: authorization.error };

  const target = adminUserIdSchema.safeParse(id);
  const validated = adminUserUpdateSchema.safeParse(data);
  if (!target.success || !validated.success) return { error: "Dữ liệu không hợp lệ!" };

  const { full_name, phone, username, role } = validated.data;
  if (authorization.userId === target.data && role !== "admin") {
    return { error: "Không thể tự thay đổi vai trò của tài khoản đang đăng nhập." };
  }

  const adminClient = getAdminClient();
  const { data: updated, error } = await adminClient
    .from("profiles")
    .update({ full_name, phone, username, role, updated_at: new Date().toISOString() })
    .eq("id", target.data)
    .is("removed_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateUserByAdmin failed:", error.code);
    return { error: "Không thể cập nhật tài khoản, vui lòng thử lại." };
  }
  if (!updated) return { error: "Không tìm thấy tài khoản đang hoạt động." };
  return { success: true, message: "Cập nhật thành công!" };
}

// 4. Xóa học viên (AUTH-018): xóa tài khoản và dữ liệu học, đơn thanh toán ở lại ẩn danh
const DELETE_MESSAGES = {
  LEARNER_NOT_FOUND: "Không tìm thấy tài khoản.",
  LEARNER_NOT_STUDENT: "Chỉ xóa được tài khoản học viên. Tài khoản giáo viên hoặc quản trị viên cần xử lý thủ công.",
  LEARNER_HAS_ACTIVE_PAYMENT:
    "Học viên đang có giao dịch thanh toán chưa hoàn tất. Hãy đợi giao dịch hoàn tất hoặc hết hạn rồi thử lại.",
  LEARNER_HAS_STAFF_HISTORY:
    "Tài khoản này có lịch sử cộng tác hoặc kiểm duyệt khóa học nên không thể xóa tại đây. Hãy báo Owner xử lý thủ công.",
} as const;
const DELETE_FAILED_MESSAGE = "Không thể xóa tài khoản, vui lòng thử lại.";

// Bảng và cột nhân sự/kiểm duyệt mà RPC admin_delete_learner cũng kiểm. Ở đây chỉ để báo lỗi nhanh;
// RPC mới là nơi quyết định (nó chạy lại trong transaction sau khi khóa hồ sơ).
const STAFF_HISTORY_COLUMNS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["course_collaborators", ["user_id", "added_by"]],
  ["course_collaborator_invitations", ["invited_by_user_id", "invitee_user_id", "actioned_by_user_id"]],
  ["topic_review_submissions", ["submitted_by_user_id", "reviewed_by_user_id", "cancelled_by_user_id"]],
  ["review_notes", ["author_user_id", "removed_by_user_id"]],
  ["topic_authorship_feedback", ["actor_user_id", "recipient_user_id", "previous_responsible_user_id", "new_responsible_user_id"]],
  ["topic_contributors", ["user_id", "added_by_user_id", "removed_by_user_id"]],
  ["topic_author_review_exclusions", ["user_id", "recorded_by_user_id"]],
  ["platform_moderation_audits", ["actor_user_id"]],
  ["courses", ["reviewed_by"]],
  ["chapters", ["created_by_user_id"]],
  ["topics", ["original_creator_user_id", "responsible_author_user_id"]],
];

// Trả về mã từ chối đầu tiên (hoặc null nếu qua) hay "ERROR" khi không đọc được dữ liệu.
async function checkLearnerDeletable(
  adminClient: ReturnType<typeof getAdminClient>,
  id: string,
): Promise<keyof typeof DELETE_MESSAGES | "ERROR" | null> {
  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (targetError) return "ERROR";
  if (!target) return "LEARNER_NOT_FOUND";
  if (target.role !== "student") return "LEARNER_NOT_STUDENT";

  const { data: active, error: activeError } = await adminClient
    .from("payments")
    .select("id")
    .eq("user_id", id)
    .in("status", ["creating", "pending"])
    .limit(1);
  if (activeError) return "ERROR";
  if (active && active.length > 0) return "LEARNER_HAS_ACTIVE_PAYMENT";

  for (const [table, columns] of STAFF_HISTORY_COLUMNS) {
    const { data: rows, error } = await adminClient
      .from(table)
      .select(columns[0])
      .or(columns.map((column) => `${column}.eq.${id}`).join(","))
      .limit(1);
    if (error) return "ERROR";
    if (rows && rows.length > 0) return "LEARNER_HAS_STAFF_HISTORY";
  }
  return null;
}

export async function deleteUserByAdmin(id: string) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return { error: authorization.error };
  if (authorization.userId === id) {
    return { error: "Không thể tự xóa tài khoản đang đăng nhập." };
  }

  const adminClient = getAdminClient();

  const refusal = await checkLearnerDeletable(adminClient, id);
  if (refusal === "ERROR") return { error: DELETE_FAILED_MESSAGE };
  if (refusal) return { error: DELETE_MESSAGES[refusal] };

  // Xóa trong một transaction ở database; RPC khóa và kiểm lại, nên lời mời/đổi role/đơn mới commit sau bước kiểm
  // nhanh ở trên vẫn khiến lần xóa bị từ chối mà không đổi gì.
  const { data: avatarNames, error } = await adminClient.rpc("admin_delete_learner", { target: id });
  if (error) {
    const code = (Object.keys(DELETE_MESSAGES) as Array<keyof typeof DELETE_MESSAGES>).find((key) =>
      error.message.includes(key),
    );
    if (!code) console.error("deleteUserByAdmin rpc failed:", error.code);
    return { error: code ? DELETE_MESSAGES[code] : DELETE_FAILED_MESSAGE };
  }

  // Chỉ xóa file sau khi database đã xóa xong; lỗi Storage không hoàn tác việc xóa tài khoản mà báo cho admin.
  const names = Array.isArray(avatarNames) ? (avatarNames as string[]) : [];
  if (names.length > 0) {
    const { error: removeError } = await adminClient.storage.from("avatars").remove(names);
    if (removeError) {
      console.error("deleteUserByAdmin avatar remove failed:", removeError.message);
      return {
        success: true,
        message: "Xóa tài khoản thành công!",
        warning: `Đã xóa tài khoản nhưng chưa xóa được ${names.length} ảnh đại diện trong kho lưu trữ.`,
      };
    }
  }

  return { success: true, message: "Xóa tài khoản thành công!" };
}
