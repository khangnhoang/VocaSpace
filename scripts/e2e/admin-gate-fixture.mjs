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

// G5: chỉ ghi vào runtime E2E cô lập (cùng điều kiện với review-session-fixture.mjs): HTTP loopback, cổng 45441, workdir `.e2e-runtime`.
// Chặn root dev (45321) và hosted trước khi tạo client, nên không có lời gọi ghi nào xảy ra khi từ chối.
function isolatedUrl(env) {
  let url;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error("Admin gate fixture requires NEXT_PUBLIC_SUPABASE_URL of the isolated loopback E2E runtime on port 45441.");
  }
  if (
    env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" ||
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "45441"
  ) {
    throw new Error("Admin gate fixture requires the isolated loopback E2E runtime on port 45441.");
  }
  return url;
}

// Script kiểm tra production cũng chỉ được chạy với app loopback cổng 3100 và Supabase cô lập 45441.
export function assertIsolatedAdminGateTargets(env = process.env, baseURL = "") {
  isolatedUrl(env);
  const app = new URL(baseURL);
  if (app.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(app.hostname) || app.port !== "3100") {
    throw new Error("Admin gate status check requires the e2e app on loopback port 3100.");
  }
}

function isolatedAdmin(env) {
  isolatedUrl(env);
  return createSupabaseAdmin(env);
}

// Tạo một admin riêng cho case thu quyền (AD1 AC3); không dùng admin@gmail.com của seed để không làm hỏng các test khác.
export async function prepareRevocableAdmin(env = process.env) {
  const supabase = isolatedAdmin(env);

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
  const supabase = isolatedAdmin(env);
  const { error } = await supabase.from("profiles").update({ role: "student" }).eq("id", adminGateFixture.userId);
  if (error) throw new Error(`Cannot revoke the fixture admin role: ${error.message}`);
}

// Xóa user fixture (profile bị xóa theo auth user). Lỗi xóa thật phải ném ra để test fail; user chưa từng được tạo
// (chuẩn bị lỗi sớm) thì không phải lỗi.
export async function removeRevocableAdmin(env = process.env) {
  const supabase = isolatedAdmin(env);
  const { error } = await supabase.auth.admin.deleteUser(adminGateFixture.userId);
  // GoTrue phân loại lỗi bằng `code`; trên runtime 45441 deleteUser với UUID không tồn tại trả 404 / `user_not_found`.
  // Chỉ code này nghĩa là "user không tồn tại"; mọi lỗi khác (kể cả 404 khác code hay message có chữ not found) phải ném.
  if (error && error.code !== "user_not_found") {
    throw new Error(`Cannot delete the admin gate fixture user: ${error.message}`);
  }
}
