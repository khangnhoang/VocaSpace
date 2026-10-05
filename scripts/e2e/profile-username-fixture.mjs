import { ensureAuthUser } from "./support/auth-users.mjs";
import { upsertRow } from "./support/db-write.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

export const profileUsernameFixture = {
  userId: "55555555-5555-4555-8555-555555555555",
  email: "e2e-no-username@gmail.com",
  password: "123123",
  fullName: "E2E No Username",
};

// Tạo user chưa có username (giống user Google hoặc user do admin tạo) để kiểm tra ô username trên /profile.
export async function prepareProfileUsernameFixture(env = process.env) {
  const supabase = createSupabaseAdmin(env);

  await ensureAuthUser(supabase, {
    id: profileUsernameFixture.userId,
    email: profileUsernameFixture.email,
    password: profileUsernameFixture.password,
    fullName: profileUsernameFixture.fullName,
    username: null,
  });
  await upsertRow(supabase, "profiles", {
    id: profileUsernameFixture.userId,
    email: profileUsernameFixture.email,
    full_name: profileUsernameFixture.fullName,
    username: null,
    role: "student",
    removed_at: null,
  });

  return {
    E2E_STUDENT_EMAIL: profileUsernameFixture.email,
    E2E_STUDENT_PASSWORD: profileUsernameFixture.password,
  };
}

export async function getProfileUsername(env = process.env) {
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", profileUsernameFixture.userId)
    .single();

  if (error || !data) {
    throw new Error(`Cannot read profile username fixture: ${error?.message}`);
  }

  return data.username;
}
