import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { setPasswordAfterConfirmation } from "@/app/actions/auth";
import { createUserByAdmin } from "@/app/actions/user";
import { GET as confirm } from "@/app/auth/confirm/route";

// Test plan:
// - Mục tiêu: bảo vệ AUTH-004 (A5 CP4) — admin tạo user không đặt mật khẩu nào, người dùng tự đặt qua mail chuẩn.
// - Loại test: integration — Server Action + Auth admin API + hook "Before User Created" + Mailpit + Route Handler local thật.
// - Đối tượng: createUserByAdmin, mail recovery, GET /auth/confirm, setPasswordAfterConfirmation.
// - Case thành công: admin tạo user → tài khoản có marker d7_server_created, profile đúng role/username/full_name/phone, không
//   mật khẩu nào đăng nhập được (kể cả "123456"), mail "Đặt lại mật khẩu VocaSpace" tới hộp thư; bấm link → /auth/set-password,
//   đặt mật khẩu → có row user_password_setups và đăng nhập được bằng mật khẩu mới.
// - Case thất bại: học viên thường gọi action bị từ chối và không tạo user nào; email trùng trả lỗi và không gửi thêm mail.
// - Bảo mật/phân quyền: chỉ admin đang hoạt động tạo được; không ai, kể cả admin, đăng nhập được bằng mật khẩu mặc định.
// - Ổn định/resilience: mỗi test dùng email/username ngẫu nhiên; user tạo ra được xóa ở afterAll.
// - Invariant cần giữ: tài khoản do admin tạo chưa có mật khẩu cho đến khi chủ email đặt qua link recovery.
// - Kết quả verify gần nhất: xem milestone A5 CP4 trong progress.md (`ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- a5-admin-create-user`).
// - Ghi chú: local GoTrue không áp hook cho admin.createUser (tái hiện ở CP4), nên marker được kiểm bằng app_metadata chứ không bằng việc hook từ chối khi thiếu marker; lỗi gửi mail do rate limit được kiểm ở test action.

type CookieRecord = { name: string; value: string; options?: Record<string, unknown> };
type CookieStore = { getAll: () => CookieRecord[]; set: (name: string, value: string, options?: Record<string, unknown>) => void };

// Chỉ thay adapter cookies/session của Next.js: hàng đợi `clients` là phiên admin cho requireAdmin, còn lại dùng cookie store.
const boundary = vi.hoisted(() => ({ clients: [] as unknown[], store: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => boundary.store }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); } }));
vi.mock("@/utils/supabase/server", async () => {
  const { createServerClient: createSsr } = await import("@supabase/ssr");
  return {
    createClient: async () => {
      const queued = boundary.clients.shift();
      if (queued) return queued;
      const cookies = boundary.store as CookieStore;
      return createSsr(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
          getAll: cookies.getAll,
          setAll: (changes) => { for (const { name, value, options } of changes) cookies.set(name, value, options); },
        },
      });
    },
  };
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAILPIT = process.env.A1_MAILPIT_URL ?? "http://127.0.0.1:45324";
const ORIGIN = "http://127.0.0.1:3000";
const createdUserIds = new Set<string>();

function client(key = SUPABASE_ANON_KEY) {
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const service = client(SUPABASE_SERVICE_ROLE_KEY);

function newStore(): CookieStore {
  const records = new Map<string, CookieRecord>();
  return {
    getAll: () => [...records.values()],
    set: (name, value, options) => { records.set(name, { name, value, options }); },
  };
}

async function createSessionUser(role: "admin" | "student") {
  const email = `a5-create-${role}-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `A5 ${role}` },
    app_metadata: { d7_server_created: true },
  });
  expect(error).toBeNull();
  createdUserIds.add(data.user!.id);
  if (role !== "student") expect((await service.from("profiles").update({ role }).eq("id", data.user!.id)).error).toBeNull();
  const session = client();
  expect((await session.auth.signInWithPassword({ email, password })).error).toBeNull();
  return session;
}

async function mailsTo(email: string) {
  const response = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  expect(response.ok).toBe(true);
  const result = await response.json() as { messages: { ID: string; Created: string }[] };
  return result.messages.sort((a, b) => Date.parse(a.Created) - Date.parse(b.Created));
}

async function waitForTokenHash(email: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const mails = await mailsTo(email);
    if (mails.length > 0) {
      const mail = await (await fetch(`${MAILPIT}/api/v1/message/${mails[mails.length - 1].ID}`)).json() as { HTML: string; Text: string; Subject: string };
      expect(mail.Subject).toBe("Đặt lại mật khẩu VocaSpace");
      const hash = `${mail.HTML}\n${mail.Text}`.match(/token_hash=([A-Za-z0-9_-]+)/)?.[1];
      expect(hash).toBeTruthy();
      return hash!;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Không thấy mail đặt mật khẩu local trong 15s.");
}

function newUserInput(label: string) {
  const suffix = randomUUID().slice(0, 8);
  return {
    email: `a5-created-${label}-${suffix}@example.com`,
    username: `a5c_${label}_${suffix}`,
    full_name: "Người Dùng Admin Tạo",
    phone: "0912345678",
    role: "teacher" as const,
  };
}

async function findProfile(email: string) {
  const { data, error } = await service.from("profiles").select("id, email, role, username, full_name, phone").eq("email", email).maybeSingle();
  expect(error).toBeNull();
  if (data) createdUserIds.add(data.id);
  return data;
}

beforeAll(() => {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true cho stack local.");
  }
  for (const value of [SUPABASE_URL, MAILPIT]) {
    if (!["127.0.0.1", "localhost"].includes(new URL(value).hostname)) {
      throw new Error(`Chan test DB integration vi URL khong phai local: ${value}`);
    }
  }
});

afterAll(async () => {
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
});

describe("A5 admin creates a user without a password", () => {
  it("creates a passwordless server-created user, mails the recovery link and lets the owner set a password", async () => {
    boundary.clients.push(await createSessionUser("admin"));
    const input = newUserInput("ok");

    const result = await createUserByAdmin(input);
    expect(result).toEqual({ success: true, message: "Đã tạo tài khoản và gửi email đặt mật khẩu" });

    const profile = await findProfile(input.email);
    expect(profile).toMatchObject({
      email: input.email,
      role: "teacher",
      username: input.username,
      full_name: input.full_name,
      phone: input.phone,
    });
    const { data: authUser } = await service.auth.admin.getUserById(profile!.id);
    expect(authUser.user?.app_metadata.d7_server_created).toBe(true);
    expect(authUser.user?.email_confirmed_at).toBeTruthy();

    // Không mật khẩu nào đăng nhập được, kể cả mật khẩu mặc định cũ và mật khẩu rỗng.
    for (const password of ["123456", "Abcdef1!", ""]) {
      const attempt = await client().auth.signInWithPassword({ email: input.email, password });
      expect(attempt.error).not.toBeNull();
      expect(attempt.data.session).toBeNull();
    }

    // Chủ email bấm link trong mail, đặt mật khẩu, đăng nhập bằng mật khẩu đó.
    const tokenHash = await waitForTokenHash(input.email);
    const cookies = newStore();
    boundary.store = cookies;
    const confirmed = await confirm(new NextRequest(`${ORIGIN}/auth/confirm?token_hash=${tokenHash}&type=recovery`, {
      headers: { cookie: "" },
    }));
    expect(confirmed.status).toBe(303);
    expect(confirmed.headers.get("Location")).toBe("/auth/set-password");
    for (const cookie of confirmed.cookies.getAll()) cookies.set(cookie.name, cookie.value);

    const chosenPassword = `${randomUUID()}aA1!`;
    const form = new FormData();
    form.set("password", chosenPassword);
    form.set("confirmPassword", chosenPassword);
    await expect(setPasswordAfterConfirmation(form)).rejects.toThrow("NEXT_REDIRECT:/");

    const setup = await service.from("user_password_setups").select("user_id").eq("user_id", profile!.id).maybeSingle();
    expect(setup.data?.user_id).toBe(profile!.id);
    const signedIn = await client().auth.signInWithPassword({ email: input.email, password: chosenPassword });
    expect(signedIn.error).toBeNull();
    expect((await client().auth.signInWithPassword({ email: input.email, password: "123456" })).error).not.toBeNull();
  });

  it("refuses an ordinary learner and creates no user or mail", async () => {
    boundary.clients.push(await createSessionUser("student"));
    const input = newUserInput("denied");

    const result = await createUserByAdmin(input);

    expect(result).toEqual({ error: "Từ chối truy cập. Bạn không có quyền hạn quản trị viên." });
    expect(await findProfile(input.email)).toBeNull();
    expect(await mailsTo(input.email)).toHaveLength(0);
  });

  it("returns the create error for a duplicate email and sends no second mail", async () => {
    boundary.clients.push(await createSessionUser("admin"));
    const input = newUserInput("dup");
    expect((await createUserByAdmin(input)).success).toBe(true);
    await findProfile(input.email);
    await waitForTokenHash(input.email);
    const before = (await mailsTo(input.email)).length;

    boundary.clients.push(await createSessionUser("admin"));
    const duplicate = await createUserByAdmin({ ...input, username: `${input.username}x` });

    expect(duplicate.error).toBeTruthy();
    expect(duplicate.success).toBeUndefined();
    expect((await mailsTo(input.email)).length).toBe(before);
  });
});
