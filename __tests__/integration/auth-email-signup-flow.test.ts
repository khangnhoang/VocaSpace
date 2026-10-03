import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  resendSignupConfirmation,
  setPasswordAfterConfirmation,
  signUpUser,
} from "@/app/actions/auth";
import { GET as confirmEmail } from "@/app/auth/confirm/route";

type CookieRecord = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

type TestCookieStore = {
  getAll: () => CookieRecord[];
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
};

const nextHeadersMock = vi.hoisted(() => ({
  currentCookieStore: {
    getAll: () => [],
    set: () => {},
  } as TestCookieStore,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => nextHeadersMock.currentCookieStore,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

// Test plan:
// - Mục tiêu: chứng minh luồng đăng ký A1 trên Supabase local thật — user do server tạo, chưa xác minh, không có session,
//   mail xác minh tới hộp thư local, và chỉ chủ hộp thư đặt được mật khẩu đúng một lần.
// - Loại test: integration/Server Action + Route Handler/Supabase Auth local + Mailpit (xác minh email và hook bật).
// - Đối tượng: signUpUser, resendSignupConfirmation, GET /auth/confirm, setPasswordAfterConfirmation.
// - Case thành công: đăng ký → user chưa xác minh có marker, không session, có mail; link mới nhất → /auth/set-password;
//   đặt mật khẩu C → cờ d7_password_set, đăng nhập bằng C được.
// - Case thất bại: username trùng (email mới/đang chờ/đã xác minh) → cùng lỗi, không tạo user; replay session `otp` cũ
//   hoặc session đăng nhập bằng mật khẩu → không đặt lại được; đăng nhập bằng mật khẩu kẻ tấn công đặt → không session.
// - Bảo mật/phân quyền: C3 — kẻ tấn công qua public API hoặc qua app không giữ được mật khẩu trên email nạn nhân (G8);
//   G5 — email mới/đang chờ/đã xác minh và resend cho mọi email trả cùng kết quả.
// - Ổn định/resilience: mỗi test dùng email/username ngẫu nhiên; user tạo ra được xóa ở afterAll.
// - Invariant cần giữ: không đường đăng ký nào trả session hoặc để client chọn mật khẩu trước khi xác minh email.
// - Kết quả verify gần nhất: passed (8 test) bằng `ALLOW_DB_INTEGRATION_TESTS=true npx vitest run --config vitest.integration.config.ts __tests__/integration/auth-email-signup-flow.test.ts`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAILPIT_URL = process.env.A1_MAILPIT_URL ?? "http://127.0.0.1:45324";
const APP_ORIGIN = "http://127.0.0.1:3000";

const NEUTRAL_SIGNUP_RESULT = { success: true, needsEmailConfirmation: true };
const USERNAME_TAKEN = { error: "Username đã được dùng, hãy thử username khác." };
const SET_PASSWORD_NOT_ALLOWED = {
  error: "Phiên xác minh không còn hợp lệ để đặt mật khẩu. Vui lòng đăng nhập lại.",
};

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const testRunId = randomUUID().slice(0, 8);

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true khi dang dung test/dev DB.",
    );
  }

  for (const value of [SUPABASE_URL, MAILPIT_URL]) {
    const url = new URL(value);
    const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (url.protocol !== "http:" || !isLocalHost) {
      throw new Error(`Chan test DB integration vi URL khong phai local: ${value}`);
    }
  }
}

function createCookieStore(initial: CookieRecord[] = []): TestCookieStore {
  const cookies = new Map(initial.map((cookie) => [cookie.name, { ...cookie }]));
  return {
    getAll: () => Array.from(cookies.values()),
    set: (name, value, options) => {
      cookies.set(name, { name, value, options });
    },
  };
}

function activateCookieStore(store: TestCookieStore) {
  nextHeadersMock.currentCookieStore = store;
  return store;
}

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function uniqueIdentity(label: string) {
  const suffix = randomUUID().slice(0, 8);
  return {
    email: `a1-flow-${testRunId}-${label}-${suffix}@example.com`,
    username: `a1_${label}_${suffix}`,
  };
}

function registrationForm(email: string, username: string) {
  const formData = new FormData();
  const values = {
    username,
    email,
    full_name: "Nguyễn Văn A",
    phone: "0912345678",
    dob: "2000-01-01T00:00:00.000Z",
    gender: "nam",
  };
  for (const [key, value] of Object.entries(values)) formData.append(key, value);
  return formData;
}

async function signUpThroughApp(email: string, username: string) {
  const store = activateCookieStore(createCookieStore());
  const result = await signUpUser(registrationForm(email, username));
  return { result, cookies: store.getAll() };
}

async function findUserByEmail(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Khong doc duoc danh sach user: ${error.message}`);
  return data.users.find((user) => user.email === email) ?? null;
}

async function countUsersWithEmail(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Khong doc duoc danh sach user: ${error.message}`);
  return data.users.filter((user) => user.email === email).length;
}

type MailpitMessage = { ID: string; Created: string };

async function listMails(email: string) {
  const response = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  if (!response.ok) throw new Error(`Mailpit search failed: ${response.status}`);
  const body = (await response.json()) as { messages: MailpitMessage[] };
  return [...body.messages].sort((a, b) => Date.parse(a.Created) - Date.parse(b.Created));
}

async function waitForMails(email: string, count: number) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const messages = await listMails(email);
    if (messages.length >= count) return messages;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Khong thay ${count} mail cho ${email} trong Mailpit`);
}

async function tokenHashFrom(message: MailpitMessage) {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
  if (!response.ok) throw new Error(`Mailpit message read failed: ${response.status}`);
  const body = (await response.json()) as { HTML: string; Text: string };
  const content = `${body.HTML}\n${body.Text}`;
  expect(content).toContain("/auth/confirm?token_hash=");
  const match = content.match(/token_hash=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("Mail khong co token_hash");
  return match[1];
}

// Đợi qua max_frequency của Auth local (1s) giữa hai lần gửi mail cho cùng một email.
async function waitForMailWindow() {
  await new Promise((resolve) => setTimeout(resolve, 1_200));
}

async function clickConfirmLink(tokenHash: string, store = createCookieStore()) {
  activateCookieStore(store);
  const response = await confirmEmail(
    new NextRequest(`${APP_ORIGIN}/auth/confirm?token_hash=${tokenHash}&type=email`),
  );
  return { location: response.headers.get("location"), store };
}

async function setPassword(store: TestCookieStore, password: string) {
  activateCookieStore(store);
  const formData = new FormData();
  formData.append("password", password);
  formData.append("confirmPassword", password);
  try {
    return await setPasswordAfterConfirmation(formData);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT:")) {
      return { redirectedTo: error.message.slice("NEXT_REDIRECT:".length) };
    }
    throw error;
  }
}

async function canSignIn(email: string, password: string) {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  return !error && Boolean(data.session);
}

async function passwordSessionStore(email: string, password: string) {
  const store = createCookieStore();
  const serverClient = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
      },
    },
  });
  const { error } = await serverClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Khong dang nhap duoc: ${error.message}`);
  return store;
}

beforeAll(async () => {
  assertSafeIntegrationEnv();
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`);
  if (!response.ok) throw new Error(`Mailpit local khong san sang: ${response.status}`);
});

afterAll(async () => {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email?.startsWith(`a1-flow-${testRunId}-`)) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }
  }
});

describe("app sign-up", () => {
  it("creates an unverified marked user without a session and sends the confirmation mail", async () => {
    const { email, username } = uniqueIdentity("new");

    const { result, cookies } = await signUpThroughApp(email, username);

    expect(result).toEqual(NEUTRAL_SIGNUP_RESULT);
    expect(cookies).toEqual([]);
    const user = await findUserByEmail(email);
    expect(user?.email_confirmed_at ?? null).toBeNull();
    expect(user?.app_metadata).toMatchObject({ d7_server_created: true });
    expect(user?.user_metadata).toMatchObject({ username });
    await tokenHashFrom((await waitForMails(email, 1))[0]);
  });

  it("returns the same result for a pending and a verified email without creating another user", async () => {
    const pending = uniqueIdentity("pending");
    await signUpThroughApp(pending.email, pending.username);
    await waitForMails(pending.email, 1);
    await waitForMailWindow();

    const repeatPending = await signUpThroughApp(pending.email, uniqueIdentity("pending2").username);
    expect(repeatPending.result).toEqual(NEUTRAL_SIGNUP_RESULT);
    expect(repeatPending.cookies).toEqual([]);
    expect(await countUsersWithEmail(pending.email)).toBe(1);
    await waitForMails(pending.email, 2);

    const verified = uniqueIdentity("verified");
    await signUpThroughApp(verified.email, verified.username);
    const verifiedUser = await findUserByEmail(verified.email);
    await supabaseAdmin.auth.admin.updateUserById(verifiedUser!.id, { email_confirm: true });

    const repeatVerified = await signUpThroughApp(verified.email, uniqueIdentity("verified2").username);
    expect(repeatVerified.result).toEqual(NEUTRAL_SIGNUP_RESULT);
    expect(repeatVerified.cookies).toEqual([]);
    expect(await countUsersWithEmail(verified.email)).toBe(1);
  });

  it("rejects a taken username the same way for a new, pending or verified email and creates no user", async () => {
    const owner = uniqueIdentity("owner");
    await signUpThroughApp(owner.email, owner.username);

    const pending = uniqueIdentity("upending");
    await signUpThroughApp(pending.email, pending.username);
    const verified = uniqueIdentity("uverified");
    await signUpThroughApp(verified.email, verified.username);
    const verifiedUser = await findUserByEmail(verified.email);
    await supabaseAdmin.auth.admin.updateUserById(verifiedUser!.id, { email_confirm: true });

    const fresh = uniqueIdentity("ufresh");
    for (const email of [fresh.email, pending.email, verified.email]) {
      const { result } = await signUpThroughApp(email, owner.username);
      expect(result).toEqual(USERNAME_TAKEN);
    }
    expect(await findUserByEmail(fresh.email)).toBeNull();
  });

  it("returns the same resend result for an unknown and a pending email", async () => {
    const pending = uniqueIdentity("resend");
    await signUpThroughApp(pending.email, pending.username);
    await waitForMails(pending.email, 1);
    await waitForMailWindow();

    const unknown = await resendSignupConfirmation(uniqueIdentity("unknown").email);
    const forPending = await resendSignupConfirmation(pending.email);

    expect(forPending).toEqual(unknown);
    await waitForMails(pending.email, 2);
  });
});

describe("pre-registration attacks (C3)", () => {
  it("leaves no usable password for an attacker who uses the public API", async () => {
    const { email, username } = uniqueIdentity("c3api");
    const attackerPassword = `Attacker-${randomUUID()}`;

    const firstAttempt = await anonClient().auth.signUp({ email, password: attackerPassword });
    expect(firstAttempt.error).not.toBeNull();
    expect(await findUserByEmail(email)).toBeNull();

    await signUpThroughApp(email, username);
    await anonClient().auth.signUp({ email, password: attackerPassword });
    expect(await canSignIn(email, attackerPassword)).toBe(false);

    await waitForMails(email, 1);
    await waitForMailWindow();
    await resendSignupConfirmation(email);
    const mails = await waitForMails(email, 2);
    const newestToken = await tokenHashFrom(mails[mails.length - 1]);

    const { location } = await clickConfirmLink(newestToken);
    expect(location).toBe("/auth/set-password");
    expect(await canSignIn(email, attackerPassword)).toBe(false);
  });

  it("gives an attacker who registers through the app no session and no known password", async () => {
    const { email, username } = uniqueIdentity("c3app");

    const first = await signUpThroughApp(email, username);
    await waitForMails(email, 1);
    await waitForMailWindow();
    const second = await signUpThroughApp(email, uniqueIdentity("c3app2").username);

    expect(first).toEqual({ result: NEUTRAL_SIGNUP_RESULT, cookies: [] });
    expect(second).toEqual({ result: NEUTRAL_SIGNUP_RESULT, cookies: [] });
    expect(await countUsersWithEmail(email)).toBe(1);

    const mails = await waitForMails(email, 2);
    const { location } = await clickConfirmLink(await tokenHashFrom(mails[mails.length - 1]));
    expect(location).toBe("/auth/set-password");
  });
});

describe("set password after confirmation (R11)", () => {
  it("lets the mailbox owner set a password once and rejects replay and password sessions", async () => {
    const { email, username } = uniqueIdentity("r11");
    const passwordC = `Victim-${randomUUID()}`;
    const passwordD = `Replay-${randomUUID()}`;
    await signUpThroughApp(email, username);
    const [mail] = await waitForMails(email, 1);

    const { location, store } = await clickConfirmLink(await tokenHashFrom(mail));
    expect(location).toBe("/auth/set-password");
    const otpSessionCookies = store.getAll().map((cookie) => ({ ...cookie }));
    expect(otpSessionCookies.length).toBeGreaterThan(0);

    await expect(setPassword(store, passwordC)).resolves.toEqual({ redirectedTo: "/" });
    const user = await findUserByEmail(email);
    expect(user?.app_metadata?.d7_password_set).toBe(true);
    expect(user?.email_confirmed_at).toBeTruthy();

    const replayStore = createCookieStore(otpSessionCookies);
    await expect(setPassword(replayStore, passwordD)).resolves.toEqual(SET_PASSWORD_NOT_ALLOWED);
    expect(await canSignIn(email, passwordC)).toBe(true);
    expect(await canSignIn(email, passwordD)).toBe(false);

    const passwordStore = await passwordSessionStore(email, passwordC);
    await expect(setPassword(passwordStore, passwordD)).resolves.toEqual(SET_PASSWORD_NOT_ALLOWED);
    expect(await canSignIn(email, passwordD)).toBe(false);
  });

  it("redirects a reused confirmation link to the login error", async () => {
    const { email, username } = uniqueIdentity("reuse");
    await signUpThroughApp(email, username);
    const tokenHash = await tokenHashFrom((await waitForMails(email, 1))[0]);

    expect((await clickConfirmLink(tokenHash)).location).toBe("/auth/set-password");
    expect((await clickConfirmLink(tokenHash)).location).toBe("/login?auth_error=confirm");
  });
});
