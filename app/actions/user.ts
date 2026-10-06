"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { adminUserSchema, AdminUserInput } from "@/lib/schemas/auth";

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
      return { error: CREATE_USER_ROLE_FAILED_MESSAGE };
    }
  }

  // Dùng client anon không lưu session: mail recovery chuẩn của app, không ghi cookie vào phiên của admin.
  const mailer = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { error: mailError } = await mailer.auth.resetPasswordForEmail(email);
  if (mailError) {
    console.error("createUserByAdmin recovery mail failed:", mailError.code ?? mailError.status);
    return { error: CREATE_USER_MAIL_FAILED_MESSAGE };
  }

  return { success: true, message: "Đã tạo tài khoản và gửi email đặt mật khẩu" };
}

// 3. Sửa thông tin User
export async function updateUserByAdmin(id: string, data: AdminUserInput) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return { error: authorization.error };

  const adminClient = getAdminClient();
  const validated = adminUserSchema.safeParse(data);
  if (!validated.success) return { error: "Dữ liệu không hợp lệ!" };

  const { full_name, phone, username, role } = validated.data;

  // Update bảng profiles
  const { error } = await adminClient
    .from("profiles")
    .update({ full_name, phone, username, role, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true, message: "Cập nhật thành công!" };
}

// 4. Xóa User
export async function deleteUserByAdmin(id: string) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return { error: authorization.error };
  if (authorization.userId === id) {
    return { error: "Không thể tự xóa tài khoản đang đăng nhập." };
  }

  const adminClient = getAdminClient();
  
  // Xóa tài khoản Auth (Supabase sẽ tự động cascade xóa luôn bên bảng profiles)
  const { error } = await adminClient.auth.admin.deleteUser(id);
  
  if (error) return { error: error.message };
  return { success: true, message: "Xóa tài khoản thành công!" };
}
