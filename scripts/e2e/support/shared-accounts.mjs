import { ensureAuthUser } from "./auth-users.mjs";
import { upsertRow } from "./db-write.mjs";
import { createSupabaseAdmin } from "./supabase-admin.mjs";
import { assertIsolatedRuntime } from "./worker-scope.mjs";

// Tài khoản seed mà nhiều worker cùng tham chiếu hoặc đăng nhập. Chúng được đưa về trạng thái chuẩn đúng một lần
// trước khi test chạy (global setup, G3), thay vì mỗi lần dựng fixture gọi `updateUserById` lại.
export const sharedAccounts = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@gmail.com",
    password: "123123",
    fullName: "Local Admin",
    username: "local_admin",
    role: "admin",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "teacher@gmail.com",
    password: "123123",
    fullName: "Local Teacher",
    username: "local_teacher",
    role: "teacher",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    email: "student@gmail.com",
    password: "123123",
    fullName: "Local Student",
    username: "local_student",
    role: "student",
  },
];

export async function ensureSharedAccounts(env = process.env) {
  assertIsolatedRuntime(env);
  const supabase = createSupabaseAdmin(env);

  for (const account of sharedAccounts) {
    await ensureAuthUser(supabase, account);
    await upsertRow(supabase, "profiles", {
      id: account.id,
      email: account.email,
      full_name: account.fullName,
      username: account.username,
      role: account.role,
      removed_at: null,
    });
  }
}
