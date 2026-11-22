import { ensureAuthUserOnce } from "./auth-users.mjs";
import { upsertRow } from "./db-write.mjs";

// Tạo (hoặc đưa về trạng thái chuẩn) tài khoản của một worker, lấy từ `scope.teacher/student/extraTeacher/extraStudent`.
// Chỉ gọi cho tài khoản worker-scoped: tài khoản seed dùng chung do `ensureSharedAccounts` lo.
export async function ensureWorkerAccount(supabase, account, role) {
  await ensureAuthUserOnce(supabase, account);
  await upsertRow(supabase, "profiles", {
    id: account.id,
    email: account.email,
    full_name: account.fullName,
    username: account.username,
    role,
    removed_at: null,
  });
  if (role === "teacher") {
    await upsertRow(supabase, "teacher_profiles", {
      id: account.id,
      bio: "Worker-scoped teacher for smoke E2E.",
      experience_years: 1,
      certifications: "Local smoke fixture",
    });
  }
}
