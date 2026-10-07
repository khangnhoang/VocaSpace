import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getUserProfile, updateUserProfile } from "@/app/actions/profile";
import { runLocalPsql } from "./helpers/local-psql";

// Test plan:
// - Mục tiêu: bảo vệ AUTH-016 (A5 CP3) — một bộ giá trị giới tính male/female/other cho /register và /profile, DB chặn giá trị lạ.
// - Loại test: integration — Server Action + Auth + trigger handle_new_user + CHECK PostgreSQL local thật.
// - Đối tượng: migration 20261007120000_a5_profiles_gender_values.sql, CHECK profiles_gender_check, updateUserProfile, getUserProfile.
// - Case thành công: user đăng ký với gender male/female/other (metadata như signUpUser) có profile đúng giá trị và lưu /profile
//   mà không đụng gender; migration đổi dòng cũ 'nam'→'male', 'nữ'→'female', giữ nguyên null/other; user Google/admin tạo
//   không có metadata gender có gender null.
// - Case thất bại: ghi 'nam', 'nữ' hoặc chuỗi lạ vào profiles.gender → vi phạm CHECK; đăng ký với metadata 'nam' bị trigger/CHECK từ chối.
// - Bảo mật/phân quyền: không áp dụng (quyền cột kiểm ở a5-admin-reads-and-profile-owner).
// - Ổn định/resilience: migration chạy lại trên dữ liệu đã chuẩn không đổi gì; dữ liệu cũ được dựng trong một transaction tạm bỏ CHECK.
// - Invariant cần giữ: profiles.gender chỉ là null, male, female hoặc other.
// - Kết quả verify gần nhất: xem milestone A5 CP3 trong progress.md (`ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- a5-profile-gender-values`).
// - Ghi chú: luồng signUpUser đầy đủ (mail, set-password) nằm ở auth-email-signup-flow, ở đây chỉ dựng cùng metadata.

// Chỉ thay adapter cookies của Next.js bằng client phiên thật; mọi truy vấn, RLS và UPDATE chạy trên stack local.
const sessionBoundary = vi.hoisted(() => ({ clients: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => sessionBoundary.clients.shift()!,
}));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const createdUserIds = new Set<string>();

function client(key = SUPABASE_ANON_KEY) {
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const service = client(SUPABASE_SERVICE_ROLE_KEY);

interface TestUser {
  id: string;
  email: string;
  password: string;
}

async function createUser(metadata: Record<string, unknown> = {}): Promise<TestUser> {
  const email = `a5-gender-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Người Dùng A5", ...metadata },
    app_metadata: { d7_server_created: true },
  });
  expect(error).toBeNull();
  createdUserIds.add(data.user!.id);
  return { id: data.user!.id, email, password };
}

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const session = client();
  expect((await session.auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
  return session;
}

async function readGender(id: string) {
  const { data, error } = await service.from("profiles").select("gender").eq("id", id).single();
  expect(error).toBeNull();
  return data!.gender;
}

beforeAll(() => {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true cho stack local.");
  }
  if (!["127.0.0.1", "localhost"].includes(new URL(SUPABASE_URL).hostname)) {
    throw new Error("Chan test DB integration vi URL khong phai local.");
  }
});

afterAll(async () => {
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
});

describe("A5 profiles.gender values", () => {
  it.each(["male", "female", "other"])("keeps gender %s from registration metadata and saves /profile without touching it", async (gender) => {
    const user = await createUser({ gender, username: `a5g_${randomUUID().slice(0, 8)}` });
    expect(await readGender(user.id)).toBe(gender);

    sessionBoundary.clients.push(await signIn(user));
    const saved = await updateUserProfile({ full_name: "Tên Đã Lưu", username: "", dob: "", gender });
    expect(saved).toEqual({ success: true });
    expect(await readGender(user.id)).toBe(gender);

    sessionBoundary.clients.push(await signIn(user));
    const loaded = await getUserProfile();
    expect(loaded.data?.gender).toBe(gender);
  });

  it("saves a different valid gender from /profile and still rejects the old Vietnamese values at the action", async () => {
    const user = await createUser({ gender: "male" });
    sessionBoundary.clients.push(await signIn(user));
    expect(await updateUserProfile({ full_name: "Đổi Giới Tính", username: "", dob: "", gender: "female" })).toEqual({ success: true });
    expect(await readGender(user.id)).toBe("female");

    sessionBoundary.clients.push(await signIn(user));
    const invalid = await updateUserProfile({ full_name: "Đổi Giới Tính", username: "", dob: "", gender: "nam" });
    expect(invalid).toMatchObject({ error: expect.any(String) });
    expect(await readGender(user.id)).toBe("female");
  });

  it("leaves gender null for a user created without gender metadata (Google or admin created)", async () => {
    const user = await createUser();
    expect(await readGender(user.id)).toBeNull();
  });

  it.each(["nam", "nữ", "Male", "unknown"])("refuses %s on profiles.gender through the CHECK", async (value) => {
    const user = await createUser();
    const result = await service.from("profiles").update({ gender: value }).eq("id", user.id);
    expect(result.error?.message).toContain("profiles_gender_check");
    expect(await readGender(user.id)).toBeNull();
  });

  it("rejects a signup whose metadata gender is a legacy Vietnamese value", async () => {
    const email = `a5-gender-${randomUUID()}@example.com`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: `${randomUUID()}aA1!`,
      email_confirm: true,
      user_metadata: { gender: "nam" },
      app_metadata: { d7_server_created: true },
    });
    if (data.user) createdUserIds.add(data.user.id);
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("maps legacy nam/nữ rows to male/female and leaves null/other alone when the migration statements run", async () => {
    const legacyMale = await createUser();
    const legacyFemale = await createUser();
    const other = await createUser({ gender: "other" });
    const untouched = await createUser();

    // Dựng dữ liệu cũ: tạm bỏ CHECK trong một transaction, ghi 'nam'/'nữ', rồi chạy lại đúng nội dung migration.
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20261007120000_a5_profiles_gender_values.sql"),
      "utf8",
    );
    runLocalPsql(`
      begin;
      alter table public.profiles drop constraint profiles_gender_check;
      update public.profiles set gender = 'nam' where id = '${legacyMale.id}';
      update public.profiles set gender = 'nữ' where id = '${legacyFemale.id}';
      ${migration}
      commit;
    `);

    expect(await readGender(legacyMale.id)).toBe("male");
    expect(await readGender(legacyFemale.id)).toBe("female");
    expect(await readGender(other.id)).toBe("other");
    expect(await readGender(untouched.id)).toBeNull();

    // CHECK được dựng lại sau transaction.
    const refused = await service.from("profiles").update({ gender: "nam" }).eq("id", untouched.id);
    expect(refused.error?.message).toContain("profiles_gender_check");
  });
});
