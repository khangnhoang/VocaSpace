import { ensureAuthUser } from "./support/auth-users.mjs";
import { upsertRow } from "./support/db-write.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

export const adminGateFixture = {
  userId: "66666666-6666-4666-8666-666666666666",
  email: "e2e-revocable-admin@gmail.com",
  password: "123123",
  fullName: "E2E Revocable Admin",
  username: "e2e_revocable_admin",
};

// Tạo một admin riêng cho case thu quyền (AD1 AC3); không dùng admin@gmail.com của seed để không làm hỏng các test khác.
export async function prepareRevocableAdmin(env = process.env) {
  const supabase = createSupabaseAdmin(env);

  await ensureAuthUser(supabase, {
    id: adminGateFixture.userId,
    email: adminGateFixture.email,
    password: adminGateFixture.password,
    fullName: adminGateFixture.fullName,
    username: adminGateFixture.username,
  });
  await upsertRow(supabase, "profiles", {
    id: adminGateFixture.userId,
    email: adminGateFixture.email,
    full_name: adminGateFixture.fullName,
    username: adminGateFixture.username,
    role: "admin",
    removed_at: null,
  });

  return {
    E2E_STUDENT_EMAIL: adminGateFixture.email,
    E2E_STUDENT_PASSWORD: adminGateFixture.password,
  };
}

// Thu quyền admin bằng service role (giống một admin khác đổi vai trò của người này).
export async function revokeAdminRole(env = process.env) {
  const supabase = createSupabaseAdmin(env);
  const { error } = await supabase.from("profiles").update({ role: "student" }).eq("id", adminGateFixture.userId);
  if (error) throw new Error(`Cannot revoke the fixture admin role: ${error.message}`);
}

// Xóa user fixture (profile bị xóa theo auth user); chạy trong finally nên không ném lỗi che kết quả test.
export async function removeRevocableAdmin(env = process.env) {
  const supabase = createSupabaseAdmin(env);
  const { error } = await supabase.auth.admin.deleteUser(adminGateFixture.userId);
  if (error) console.warn(`Cannot delete the admin gate fixture user: ${error.message}`);
}
