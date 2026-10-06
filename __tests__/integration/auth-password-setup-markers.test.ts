import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { signUpUser, setPasswordAfterConfirmation } from "@/app/actions/auth";
import SetPasswordPage from "@/app/auth/set-password/page";
import { waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: bảo vệ marker A1b khỏi ghi đè app_metadata và khỏi client sửa/xóa.
// - Loại test: integration với Auth, Data API, Mailpit và PostgreSQL local thật.
// - Đối tượng: user_password_setups, setPasswordAfterConfirmation, guard /auth/set-password.
// - Case thành công: service role đọc/thêm; xác minh email rồi đặt mật khẩu ghi row marker và không ghi cờ d7_password_set (A5); xóa auth user cascade.
// - Case thất bại: anon/authenticated bị 42501 cho SELECT/INSERT/UPDATE/DELETE; service role không sửa/xóa được.
// - Bảo mật/phân quyền: kiểm đủ bảy quyền SQL, RLS bật, không policy; session otp gốc không replay sau khi đặt mật khẩu (row marker, không cần cờ legacy).
// - Ổn định/resilience: hai insert đồng thời chỉ lưu một row; user test được xóa qua Auth admin ở afterAll.
// - Invariant cần giữ: row đã lưu chỉ mất qua cascade, không bị Admin API ghi đè metadata mở lại eligibility.
// - Kết quả verify gần nhất: passed (27 file, 288 test) bằng `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration` sau `npx supabase db reset`.
// - Ghi chú: backfill kiểm riêng ở CP1 bằng `db reset --version 20261003100000` rồi `migration up`.

const sessionBoundary = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock("server-only", () => ({}));
// Chỉ thay adapter cookies của Next.js; mọi xác minh, JWT, truy vấn và mutation đều chạy trên stack thật.
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => sessionBoundary.client! }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAILPIT_URL = process.env.A1_MAILPIT_URL ?? "http://127.0.0.1:45324";
const TABLE = "user_password_setups";
const createdUserIds = new Set<string>();

function client(key = SUPABASE_ANON_KEY) {
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const service = client(SUPABASE_SERVICE_ROLE_KEY);
let ownUserId: string;
let authenticated: SupabaseClient;

beforeAll(async () => {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true cho stack local.");
  }
  for (const value of [SUPABASE_URL, MAILPIT_URL]) {
    const url = new URL(value);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new Error("Chan test DB integration vi URL khong phai local.");
    }
  }

  const email = `a1b-grants-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { d7_server_created: true },
  });
  expect(error).toBeNull();
  ownUserId = data.user!.id;
  createdUserIds.add(ownUserId);
  authenticated = client();
  expect((await authenticated.auth.signInWithPassword({ email, password })).error).toBeNull();
  expect((await service.from(TABLE).insert({ user_id: ownUserId })).error).toBeNull();
});

afterAll(async () => {
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
});

describe("A1b database boundary", () => {
  it("has exactly select/insert for service_role, no API client grants, RLS enabled and no policies", async () => {
    const output = await waitForLocalPostgresQuery(`
      select json_build_object(
        'privileges', (select json_object_agg(r, grants) from (
          select r, json_object_agg(p, has_table_privilege(r, 'public.user_password_setups', p)) as grants
          from unnest(array['anon','authenticated','service_role']) r
          cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
          group by r
        ) roles),
        'rls', (select relrowsecurity from pg_class where oid = 'public.user_password_setups'::regclass),
        'policies', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'user_password_setups')
      )::text;`, "A1b privileges and RLS");
    const privileges = Object.fromEntries(
      ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"].map((p) => [p, false]),
    );
    expect(JSON.parse(output)).toEqual({
      privileges: {
        anon: privileges,
        authenticated: privileges,
        service_role: { ...privileges, SELECT: true, INSERT: true },
      },
      rls: true,
      policies: 0,
    });
  });

  it.each(["anon", "authenticated"])("denies %s all four Data API operations, including the user's own row", async (role) => {
    const actor = role === "anon" ? client() : authenticated;
    const results = [
      await actor.from(TABLE).select("user_id").eq("user_id", ownUserId),
      await actor.from(TABLE).insert({ user_id: ownUserId }),
      await actor.from(TABLE).update({ password_set_at: new Date().toISOString() }).eq("user_id", ownUserId),
      await actor.from(TABLE).delete().eq("user_id", ownUserId),
    ];
    for (const result of results) expect(result.error?.code).toBe("42501");
  });

  it("allows service-role select/insert but denies update/delete without changing the marker", async () => {
    const before = await service.from(TABLE).select("*").eq("user_id", ownUserId).single();
    expect(before.error).toBeNull();
    expect(before.data.user_id).toBe(ownUserId);
    expect(Number.isFinite(Date.parse(before.data.password_set_at))).toBe(true);
    expect((await service.from(TABLE).update({ password_set_at: new Date().toISOString() }).eq("user_id", ownUserId)).error?.code).toBe("42501");
    expect((await service.from(TABLE).delete().eq("user_id", ownUserId)).error?.code).toBe("42501");
    const after = await service.from(TABLE).select("*").eq("user_id", ownUserId).single();
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it("persists only one marker for concurrent inserts and removes it only when the auth user is deleted", async () => {
    const { data, error } = await service.auth.admin.createUser({
      email: `a1b-cascade-${randomUUID()}@example.com`,
      password: `${randomUUID()}aA1!`, email_confirm: true, app_metadata: { d7_server_created: true },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    createdUserIds.add(id);
    const inserts = await Promise.all([
      service.from(TABLE).insert({ user_id: id }),
      service.from(TABLE).insert({ user_id: id }),
    ]);
    expect(inserts.filter((result) => !result.error)).toHaveLength(1);
    expect(inserts.find((result) => result.error)?.error?.code).toBe("23505");
    const persisted = await service.from(TABLE).select("user_id").eq("user_id", id);
    expect(persisted.error).toBeNull();
    expect(persisted.data).toEqual([{ user_id: id }]);
    expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
    createdUserIds.delete(id);
    const removed = await service.from(TABLE).select("user_id").eq("user_id", id);
    expect(removed.error).toBeNull();
    expect(removed.data).toEqual([]);
  });
});

async function signupTokenHash(email: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Mailpit search failed: ${response.status}`);
    const body = await response.json() as { messages: { ID: string }[] };
    if (body.messages.length) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${body.messages[0].ID}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!message.ok) throw new Error(`Mailpit read failed: ${message.status}`);
      const mail = await message.json() as { HTML: string; Text: string };
      const hash = `${mail.HTML}\n${mail.Text}`.match(/token_hash=([A-Za-z0-9_-]+)/)?.[1];
      if (!hash) throw new Error("Mail khong co token_hash");
      return hash;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Khong thay mail xac minh A1b trong Mailpit.");
}

function passwordForm(password: string) {
  const form = new FormData();
  form.set("password", password);
  form.set("confirmPassword", password);
  return form;
}

describe("A1b original verification session", () => {
  it("rejects the original otp session at the action and page after the password was set, relying on the row marker alone", async () => {
    const email = `a1b-replay-${randomUUID()}@example.com`;
    sessionBoundary.client = client();
    const registration = new FormData();
    for (const [key, value] of Object.entries({
      email, username: `a1b_${randomUUID().slice(0, 8)}`, full_name: "Nguyễn Văn A",
      phone: "0912345678", dob: "2000-01-01", gender: "male",
    })) registration.set(key, value);
    expect(await signUpUser(registration)).toEqual({ success: true, needsEmailConfirmation: true });
    const listed = await service.auth.admin.listUsers({ perPage: 1000 });
    expect(listed.error).toBeNull();
    const id = listed.data.users.find((user) => user.email === email)!.id;
    createdUserIds.add(id);

    const verified = await sessionBoundary.client.auth.verifyOtp({ token_hash: await signupTokenHash(email), type: "email" });
    expect(verified.error).toBeNull();
    const originalSession = verified.data.session!;
    const original = client();
    expect((await original.auth.setSession(originalSession)).error).toBeNull();
    sessionBoundary.client = original;
    const originalClaims = await original.auth.getClaims();
    expect(originalClaims.error).toBeNull();
    expect(originalClaims.data?.claims.amr).toEqual(expect.arrayContaining([expect.objectContaining({ method: "otp" })]));
    await expect(SetPasswordPage()).resolves.toBeTruthy();

    const password = `${randomUUID()}aA1!`;
    await expect(setPasswordAfterConfirmation(passwordForm(password))).rejects.toThrow("NEXT_REDIRECT:/");
    const marker = await service.from(TABLE).select("*").eq("user_id", id).single();
    expect(marker.error).toBeNull();
    // A5: app không còn ghi cờ legacy; chỉ row user_password_setups chặn replay.
    expect((await service.auth.admin.getUserById(id)).data.user?.app_metadata.d7_password_set).toBeUndefined();
    const replay = client();
    expect((await replay.auth.setSession(originalSession)).error).toBeNull();
    expect((await replay.auth.getSession()).data.session?.access_token).toBe(originalSession.access_token);
    sessionBoundary.client = replay;
    const update = vi.spyOn(replay.auth, "updateUser");
    const replayPassword = `${randomUUID()}bB2!`;
    try {
      await expect(setPasswordAfterConfirmation(passwordForm(replayPassword))).resolves.toEqual({
        error: "Phiên xác minh không còn hợp lệ để đặt mật khẩu. Vui lòng đăng nhập lại.",
      });
      await expect(SetPasswordPage()).rejects.toThrow("NEXT_REDIRECT:/");
      expect(update).not.toHaveBeenCalled();
    } finally {
      update.mockRestore();
    }
    const remaining = await service.from(TABLE).select("*").eq("user_id", id).single();
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual(marker.data);
    expect((await client().auth.signInWithPassword({ email, password })).error).toBeNull();
    expect((await client().auth.signInWithPassword({ email, password: replayPassword })).error).not.toBeNull();
  }, 30_000); // Chờ mail tối đa 15 giây cộng các bước Auth; mặc định 5 giây của Vitest không đủ.
});
