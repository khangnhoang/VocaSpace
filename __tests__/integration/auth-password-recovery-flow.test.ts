import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { requestPasswordRecovery, setPasswordAfterConfirmation, signUpUser } from "@/app/actions/auth";
import { updateUserPassword } from "@/app/actions/profile";
import { GET as confirm } from "@/app/auth/confirm/route";
import { getPasswordSetupEligibility } from "@/lib/auth/password-setup";
import { waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: chứng minh recovery A2 và G8-R bằng Auth, JWT, bảng app, mail và SSR local thật.
// - Loại test: integration Server Action + Route Handler + Data API + Mailpit + PostgreSQL.
// - Đối tượng: requestPasswordRecovery, /auth/confirm, eligibility, consume, user_password_recoveries.
// - Case thành công: email → route → bằng chứng session → đặt mật khẩu → marker còn, bằng chứng mất;
//   pending/không có marker/Google-only mô phỏng; magiclink qua type=recovery theo default 5.
// - A2b (secure_password_change = true): session recovery quá 24 giờ nhận thông báo xin link mới, mật khẩu cũ
//   giữ nguyên, không ghi marker, bằng chứng recovery còn nguyên; /profile gửi current_password vẫn đổi được
//   (toggle current-password không bật được ở CLI local), sai/trùng mật khẩu trả thông báo tiếng Việt.
// - Case thất bại: link cũ/reused/sai/thiếu, session password/magiclink trực tiếp/xác minh gốc/recovery đã dùng.
// - Bảo mật/phân quyền: catalog đủ 7 quyền, PUBLIC không grant, RLS bật/0 policy; anon/authenticated bị từ chối CRUD.
// - Ổn định/resilience: S1 hoàn tất không xóa S2; access token còn hạn của S2 bị action từ chối trước refresh,
//   không PUT đổi mật khẩu; rate-limit được tạo bằng fixture local và kiểm tra thẳng 429/error code thật.
// - Invariant cần giữ: chỉ otp chưa đặt mật khẩu hoặc session khớp bằng chứng mới qua G8; kết quả gửi luôn trung tính.
// - Kết quả verify gần nhất: passed (13 test) bằng `ALLOW_DB_INTEGRATION_TESTS=true npx vitest run
//   --config vitest.integration.config.ts __tests__/integration/auth-password-recovery-flow.test.ts` sau review
//   implementation A2b, với `secure_password_change = true`; AC6 (cả hai toggle tắt) chưa chạy ở đây.
// - Ghi chú: URL local bị kiểm trước mọi mutation; user được dọn ở afterAll. Google thật thuộc A4/R6.

type CookieRecord = { name: string; value: string; options?: Record<string, unknown> };
type CookieStore = { getAll: () => CookieRecord[]; set: (name: string, value: string, options?: Record<string, unknown>) => void };
const boundary = vi.hoisted(() => ({ store: null as CookieStore | null }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => boundary.store! }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); } }));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAILPIT = process.env.A1_MAILPIT_URL ?? "http://127.0.0.1:45324";
const ORIGIN = "http://127.0.0.1:3000";
const TABLE = "user_password_recoveries";
const NOT_ALLOWED = { error: "Phiên xác minh không còn hợp lệ để đặt mật khẩu. Vui lòng đăng nhập lại." };
const NEUTRAL = { success: true, message: "Đã gửi yêu cầu! Bạn kiểm tra hộp thư (cả mục Spam) trong vài phút nhé." };
const EXPIRED = { error: "Phiên xác minh đã quá 24 giờ. Bạn yêu cầu link mới ở trang Quên mật khẩu nhé." };
const users = new Set<string>();
const service = client(process.env.SUPABASE_SERVICE_ROLE_KEY!);

function client(key = ANON) {
  return createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function store(): CookieStore {
  const records = new Map<string, CookieRecord>();
  return { getAll: () => [...records.values()], set: (name, value, options) => { records.set(name, { name, value, options }); } };
}
function sessionClient(cookies: CookieStore) {
  return createServerClient(URL, ANON, { cookies: {
    getAll: cookies.getAll,
    setAll: (changes) => { for (const { name, value, options } of changes) cookies.set(name, value, options); },
  } });
}
async function fixture({ pending = false, marker = true } = {}) {
  const email = `a2-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: !pending, app_metadata: { d7_server_created: true } });
  expect(error).toBeNull();
  const id = data.user!.id;
  users.add(id);
  if (marker) expect((await service.from("user_password_setups").insert({ user_id: id })).error).toBeNull();
  return { email, password, id };
}
async function messages(email: string) {
  const response = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  expect(response.ok).toBe(true);
  const result = await response.json() as { messages: { ID: string; Created: string }[] };
  return result.messages.sort((a, b) => Date.parse(a.Created) - Date.parse(b.Created));
}
async function recoveryMail(email: string, count = 1) {
  boundary.store = store();
  expect(await requestPasswordRecovery(email)).toEqual(NEUTRAL);
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const mails = await messages(email);
    if (mails.length >= count) {
      const response = await fetch(`${MAILPIT}/api/v1/message/${mails[mails.length - 1].ID}`);
      const mail = await response.json() as { HTML: string; Text: string; Subject: string };
      expect(mail.Subject).toBe("Đặt lại mật khẩu VocaSpace");
      expect(mail.HTML).toContain("mật khẩu hiện tại không đổi");
      expect(mail.HTML).toContain(`${ORIGIN}/auth/confirm?token_hash=`);
      expect(mail.HTML).toContain("type=recovery");
      const hash = `${mail.HTML}\n${mail.Text}`.match(/token_hash=([A-Za-z0-9_-]+)/)?.[1];
      expect(hash).toMatch(/^pkce_/);
      return hash!;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Không thấy mail recovery local trong 15s.");
}
async function click(hash: string, cookies = store(), type = "recovery") {
  boundary.store = cookies;
  const response = await confirm(new NextRequest(`${ORIGIN}/auth/confirm?token_hash=${hash}&type=${type}`, {
    headers: { cookie: cookies.getAll().map(({ name, value }) => `${name}=${value}`).join("; ") },
  }));
  for (const cookie of response.cookies.getAll()) cookies.set(cookie.name, cookie.value);
  return { response, cookies, supabase: sessionClient(cookies) };
}
function passwordForm(password: string) {
  const form = new FormData();
  form.set("password", password);
  form.set("confirmPassword", password);
  return form;
}
async function setPassword(cookies: CookieStore, password: string) {
  boundary.store = cookies;
  try { return await setPasswordAfterConfirmation(passwordForm(password)); }
  catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT:/") return { redirectedTo: "/" };
    throw error;
  }
}
async function evidence(userId: string) {
  const result = await service.from(TABLE).select("*").eq("user_id", userId).maybeSingle();
  expect(result.error).toBeNull();
  return result.data;
}
async function magiclink(email: string) {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  expect(error).toBeNull();
  return data.properties!.hashed_token;
}
async function deniedAction(supabase: SupabaseClient, cookies: CookieStore, status = "not_eligible") {
  const alreadyObserved = vi.isMockFunction(globalThis.fetch);
  const observedFetch = vi.spyOn(globalThis, "fetch");
  const start = observedFetch.mock.calls.length;
  try {
    expect(await getPasswordSetupEligibility(supabase)).toEqual({ status });
    expect(await setPassword(cookies, `${randomUUID()}aA1!`)).toEqual(NOT_ALLOWED);
    expect(observedFetch.mock.calls.slice(start).filter(([input, init]) => String(input).endsWith("/auth/v1/user") && init?.method === "PUT").length).toBe(0);
  } finally { if (!alreadyObserved) observedFetch.mockRestore(); }
}

beforeAll(() => {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") throw new Error("ALLOW_DB_INTEGRATION_TESTS=true required.");
  for (const value of [URL, MAILPIT]) {
    const parsed = new globalThis.URL(value);
    if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) throw new Error("Refusing non-local A2 integration.");
  }
});
afterAll(async () => {
  for (const id of users) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
});

describe("A2 recovery database", () => {
  it("grants exactly CRUD to service_role, no PUBLIC grants, RLS on and no policies", async () => {
    const output = await waitForLocalPostgresQuery(`select json_build_object(
      'privileges', (select json_object_agg(r, grants) from (
        select r, json_object_agg(p, has_table_privilege(r, 'public.${TABLE}', p)) grants
        from unnest(array['anon','authenticated','service_role']) r
        cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p group by r) roles),
      'public_grants', (select count(*) from pg_class, lateral aclexplode(relacl) acl where oid='public.${TABLE}'::regclass and acl.grantee=0),
      'rls', (select relrowsecurity from pg_class where oid='public.${TABLE}'::regclass),
      'policies', (select count(*) from pg_policies where schemaname='public' and tablename='${TABLE}'))::text;`, "A2 privileges");
    const none = Object.fromEntries(["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER"].map((p) => [p, false]));
    expect(JSON.parse(output)).toEqual({ privileges: {
      anon: none, authenticated: none, service_role: { ...none, SELECT: true, INSERT: true, UPDATE: true, DELETE: true },
    }, public_grants: 0, rls: true, policies: 0 });
  });
  it("denies anon/authenticated CRUD and allows service-role replacement, consume and cascade", async () => {
    const user = await fixture();
    const authenticated = client();
    expect((await authenticated.auth.signInWithPassword(user)).error).toBeNull();
    const sessionId = randomUUID();
    expect((await service.from(TABLE).insert({ user_id: user.id, session_id: sessionId })).error).toBeNull();
    for (const actor of [client(), authenticated]) {
      const results = [await actor.from(TABLE).select("*"), await actor.from(TABLE).insert({ user_id: user.id, session_id: sessionId }),
        await actor.from(TABLE).update({ session_id: randomUUID() }).eq("user_id", user.id), await actor.from(TABLE).delete().eq("user_id", user.id)];
      for (const result of results) expect(result.error?.code).toBe("42501");
    }
    const replacement = randomUUID();
    expect((await service.from(TABLE).upsert({ user_id: user.id, session_id: replacement })).error).toBeNull();
    expect((await evidence(user.id)).session_id).toBe(replacement);
    expect((await service.from(TABLE).delete().eq("user_id", user.id)).error).toBeNull();
    expect(await evidence(user.id)).toBeNull();
    expect((await service.from(TABLE).insert({ user_id: user.id, session_id: replacement })).error).toBeNull();
    expect((await service.auth.admin.deleteUser(user.id)).error).toBeNull();
    users.delete(user.id);
    expect(await evidence(user.id)).toBeNull();
  });
});

describe("A2 mailbox recovery", () => {
  it("resets an already-set password once, persists markers, removes evidence and rejects other sessions", async () => {
    const user = await fixture();
    const hash = await recoveryMail(user.email);
    const recovery = await click(hash);
    expect(recovery.response.headers.get("location")).toBe("/auth/set-password");
    const claims = (await recovery.supabase.auth.getClaims()).data!.claims;
    expect((await evidence(user.id)).session_id).toBe(claims.session_id);
    expect(claims.amr).toEqual(expect.arrayContaining([expect.objectContaining({ method: "otp" })]));
    expect((await recovery.supabase.auth.refreshSession()).error).toBeNull();
    expect((await recovery.supabase.auth.getClaims()).data?.claims.session_id).toBe(claims.session_id);
    const password = `${randomUUID()}aA1!`;
    expect(await setPassword(recovery.cookies, password)).toEqual({ redirectedTo: "/" });
    expect(await evidence(user.id)).toBeNull();
    expect((await service.from("user_password_setups").select("user_id").eq("user_id", user.id).single()).error).toBeNull();
    await deniedAction(recovery.supabase, recovery.cookies);
    expect((await client().auth.signInWithPassword({ email: user.email, password: user.password })).error).not.toBeNull();
    expect((await client().auth.signInWithPassword({ email: user.email, password })).error).toBeNull();
    expect((await click(hash)).response.headers.get("location")).toBe("/login?auth_error=recovery");
    const passwordStore = store();
    const passwordClient = sessionClient(passwordStore);
    expect((await passwordClient.auth.signInWithPassword({ email: user.email, password })).error).toBeNull();
    await deniedAction(passwordClient, passwordStore);
  }, 30_000);

  it("tells a recovery session older than 24 hours to request a new link without changing anything (A2b AC5)", async () => {
    const user = await fixture({ marker: false });
    const recovery = await click(await recoveryMail(user.email));
    const sessionId = (await recovery.supabase.auth.getClaims()).data!.claims.session_id as string;
    // "Secure password change" tính tuổi theo auth.sessions.created_at; lùi mốc này để giả lập session đã quá 24 giờ.
    expect(await waitForLocalPostgresQuery(`update auth.sessions set created_at=now() - interval '25 hours'
      where id='${sessionId}' returning id;`, "A2b aged session")).toBe(sessionId);
    expect(await setPassword(recovery.cookies, `${randomUUID()}aA1!`)).toEqual(EXPIRED);
    expect((await evidence(user.id)).session_id).toBe(sessionId);
    expect((await service.from("user_password_setups").select("user_id").eq("user_id", user.id).maybeSingle()).data).toBeNull();
    expect((await client().auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
  }, 30_000);

  it("rejects superseded links and replaced recovery sessions, keeps only the last evidence write", async () => {
    const user = await fixture();
    const first = await recoveryMail(user.email);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const second = await recoveryMail(user.email, 2);
    expect((await click(first)).response.headers.get("location")).toBe("/login?auth_error=recovery");
    const accepted = await click(second);
    expect(accepted.response.headers.get("location")).toBe("/auth/set-password");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const newer = await click(await recoveryMail(user.email, 3));
    await deniedAction(accepted.supabase, accepted.cookies);
    expect(await getPasswordSetupEligibility(newer.supabase)).toMatchObject({ status: "eligible" });
  }, 30_000);

  it.each([true, false])("lets an account without a setup marker recover (pending=%s)", async (pending) => {
    const user = await fixture({ pending, marker: false });
    const recovery = await click(await recoveryMail(user.email));
    expect(recovery.response.headers.get("location")).toBe("/auth/set-password");
    expect((await service.auth.admin.getUserById(user.id)).data.user?.email_confirmed_at).toBeTruthy();
    const password = `${randomUUID()}aA1!`;
    expect(await setPassword(recovery.cookies, password)).toEqual({ redirectedTo: "/" });
    expect(await evidence(user.id)).toBeNull();
    expect((await client().auth.signInWithPassword({ email: user.email, password })).error).toBeNull();
  }, 30_000);

  it("accepts magiclink through recovery but denies a direct magiclink session without evidence", async () => {
    const user = await fixture();
    const directStore = store();
    const direct = sessionClient(directStore);
    expect((await direct.auth.verifyOtp({ token_hash: await magiclink(user.email), type: "magiclink" })).error).toBeNull();
    expect(await evidence(user.id)).toBeNull();
    await deniedAction(direct, directStore);
    const recovery = await click(await magiclink(user.email));
    expect(recovery.response.headers.get("location")).toBe("/auth/set-password");
    expect((await evidence(user.id)).session_id).toBe((await recovery.supabase.auth.getClaims()).data?.claims.session_id);
    expect(await setPassword(recovery.cookies, `${randomUUID()}aA1!`)).toEqual({ redirectedTo: "/" });
  });

  it("keeps the original A1 verification session rejected after first password set and recovery", async () => {
    const email = `a2-signup-${randomUUID()}@example.com`;
    const registration = new FormData();
    for (const [key, value] of Object.entries({ email, username: `a2_${randomUUID().slice(0,8)}`, full_name: "Nguyễn Văn A", phone: "0912345678", dob: "2000-01-01", gender: "male" })) registration.set(key, value);
    boundary.store = store();
    expect(await signUpUser(registration)).toEqual({ success: true, needsEmailConfirmation: true });
    const user = (await service.auth.admin.listUsers({ perPage: 1000 })).data.users.find((entry) => entry.email === email)!;
    users.add(user.id);
    const signup = await service.auth.admin.generateLink({ type: "signup", email, password: `${randomUUID()}aA1!` });
    expect(signup.error).toBeNull();
    const original = await click(signup.data.properties!.hashed_token, store(), "email");
    expect(original.response.headers.get("location")).toBe("/auth/set-password");
    expect(await setPassword(original.cookies, `${randomUUID()}aA1!`)).toEqual({ redirectedTo: "/" });
    const recovery = await click(await recoveryMail(email));
    await deniedAction(original.supabase, original.cookies);
    expect(await setPassword(recovery.cookies, `${randomUUID()}aA1!`)).toEqual({ redirectedTo: "/" });
    await deniedAction(original.supabase, original.cookies, "signed_out");
  }, 30_000);

  it("preserves S2 evidence when S1 completes an action already past eligibility; Auth revokes S2", async () => {
    const user = await fixture();
    const s1 = await click(await recoveryMail(user.email));
    const nativeFetch = globalThis.fetch;
    let release: () => void = () => {};
    let entered: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/auth/v1/user") && init?.method === "PUT") { entered(); await gate; }
      return nativeFetch(input, init);
    });
    const action = setPassword(s1.cookies, `${randomUUID()}aA1!`);
    try {
      await Promise.race([started, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("S1 did not reach updateUser")), 5000))]);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const s2 = await click(await recoveryMail(user.email, 2));
      expect(await getPasswordSetupEligibility(s2.supabase)).toMatchObject({ status: "eligible" });
      const s2Session = (await s2.supabase.auth.getSession()).data.session!;
      const before = await evidence(user.id);
      release();
      expect(await action).toEqual({ redirectedTo: "/" });
      expect(await evidence(user.id)).toEqual(before);
      await deniedAction(s1.supabase, s1.cookies);
      expect(s2Session.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
      const s2AttemptStart = fetchSpy.mock.calls.length;
      expect(await setPassword(s2.cookies, `${randomUUID()}aA1!`)).toEqual(NOT_ALLOWED);
      const s2Requests = fetchSpy.mock.calls.slice(s2AttemptStart);
      expect(s2Requests.filter(([input, init]) => String(input).endsWith("/auth/v1/user") && init?.method === "GET")
        .map(([, init]) => new Headers(init?.headers).get("Authorization"))).toEqual([`Bearer ${s2Session.access_token}`]);
      expect(s2Requests.filter(([input, init]) => String(input).endsWith("/auth/v1/user") && init?.method === "PUT")).toHaveLength(0);
      expect(await evidence(user.id)).toEqual(before);
      // getUser có thể xóa cookie khi session bị thu hồi; dùng refresh token đã giữ để vẫn kiểm tra Auth thật.
      expect((await s2.supabase.auth.refreshSession(s2Session)).error).not.toBeNull();
    } finally { release(); await action; fetchSpy.mockRestore(); }
  }, 30_000);

  it("lets a locally simulated Google-only identity add a password without creating an email identity", async () => {
    const user = await fixture({ marker: false });
    await waitForLocalPostgresQuery(`update auth.identities set provider='google', provider_id='${user.id}' where user_id='${user.id}';
      update auth.users set encrypted_password='', raw_app_meta_data=raw_app_meta_data || '{"provider":"google","providers":["google"]}'::jsonb where id='${user.id}' returning id;`, "Google-only fixture");
    const recovery = await click(await recoveryMail(user.email));
    expect(recovery.response.headers.get("location")).toBe("/auth/set-password");
    const password = `${randomUUID()}aA1!`;
    expect(await setPassword(recovery.cookies, password)).toEqual({ redirectedTo: "/" });
    expect((await client().auth.signInWithPassword({ email: user.email, password })).error).toBeNull();
    const current = (await service.auth.admin.getUserById(user.id)).data.user!;
    expect(current.identities!.map((identity) => identity.provider)).toEqual(["google"]);
    expect(current.app_metadata.providers).toEqual(["google"]);
  }, 30_000);

  it("returns identical results for unknown, existing, rate-limited, pending and malformed emails", async () => {
    const unknown = `a2-unknown-${randomUUID()}@example.com`;
    const existing = await fixture();
    const pending = await fixture({ pending: true, marker: false });
    boundary.store = store();
    for (const email of [unknown, existing.email, pending.email, "nope"]) expect(await requestPasswordRecovery(email)).toEqual(NEUTRAL);
    // Fixture chỉ thuộc user của test: mốc tương lai giữ rate-limit suốt test, không phụ thuộc cửa sổ local 1s.
    expect(await waitForLocalPostgresQuery(`update auth.users set recovery_sent_at=now() + interval '5 minutes'
      where id='${existing.id}' returning id;`, "A2 rate-limited fixture")).toBe(existing.id);
    const nativeFetch = globalThis.fetch;
    const recoveryResponses: { status: number; code?: string }[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const response = await nativeFetch(input, init);
      if (String(input).endsWith("/auth/v1/recover")) {
        const body = await response.clone().json() as { code?: string };
        recoveryResponses.push({ status: response.status, code: body.code });
      }
      return response;
    });
    try {
      expect(await requestPasswordRecovery(existing.email)).toEqual(NEUTRAL);
      expect(recoveryResponses).toEqual([{ status: 429, code: "over_email_send_rate_limit" }]);
    } finally { fetchSpy.mockRestore(); }
    expect(await messages(unknown)).toEqual([]);
    expect(await messages(existing.email)).toHaveLength(1);
    expect(await messages(pending.email)).toHaveLength(1);
    expect((await service.auth.admin.listUsers({ perPage: 1000 })).data.users.some((user) => user.email === unknown)).toBe(false);
  });
});

describe("A2b /profile password change on local GoTrue", () => {
  it("changes the password with current_password sent and maps wrong or same passwords (AC3 local; AC6 with both toggles off not run)", async () => {
    const user = await fixture();
    const cookies = store();
    expect((await sessionClient(cookies).auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
    boundary.store = cookies;
    const password = `${randomUUID()}aA1!`;
    expect(await updateUserPassword({ currentPassword: `${randomUUID()}aA1!`, newPassword: password, confirmPassword: password }))
      .toEqual({ error: "Mật khẩu hiện tại không chính xác!" });
    expect(await updateUserPassword({ currentPassword: user.password, newPassword: user.password, confirmPassword: user.password }))
      .toEqual({ error: "Mật khẩu mới phải khác mật khẩu cũ." });
    expect(await updateUserPassword({ currentPassword: user.password, newPassword: password, confirmPassword: password }))
      .toEqual({ success: true });
    expect((await client().auth.signInWithPassword({ email: user.email, password })).error).toBeNull();
  }, 30_000);
});
