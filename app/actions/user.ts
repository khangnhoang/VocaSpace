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

// 1. Lấy danh sách toàn bộ User
export async function getAllUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data };
}

// 2. Thêm User mới (Mật khẩu mặc định: 123456)
export async function createUserByAdmin(data: AdminUserInput) {
  const adminClient = getAdminClient();
  const validated = adminUserSchema.safeParse(data);
  if (!validated.success) return { error: "Dữ liệu không hợp lệ!" };

  const { email, username, full_name, phone, role } = validated.data;

  // Dùng quyền Admin tạo Auth User (Không làm văng phiên đăng nhập hiện tại)
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: "123456", // Password mặc định như Khang yêu cầu
    email_confirm: true,
    user_metadata: { username, full_name, phone, role }, // Trigger sẽ hốt đống này bỏ vào profiles
  });

  if (authError) return { error: authError.message };

  // Đảm bảo Role được cập nhật đúng trong bảng profiles (Phòng trường hợp Trigger bị mặc định là 'student')
  if (authData.user) {
    await adminClient.from("profiles").update({ role }).eq("id", authData.user.id);
  }

  return { success: true, message: "Thêm người dùng thành công!" };
}

// 3. Sửa thông tin User
export async function updateUserByAdmin(id: string, data: AdminUserInput) {
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
  const adminClient = getAdminClient();
  
  // Xóa tài khoản Auth (Supabase sẽ tự động cascade xóa luôn bên bảng profiles)
  const { error } = await adminClient.auth.admin.deleteUser(id);
  
  if (error) return { error: error.message };
  return { success: true, message: "Xóa tài khoản thành công!" };
}