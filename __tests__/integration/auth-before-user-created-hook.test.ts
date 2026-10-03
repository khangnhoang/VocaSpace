import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: chứng minh hook "Before User Created" chỉ cho tạo user qua Google hoặc qua server (marker).
// - Loại test: integration/Supabase Auth local thật + gọi hàm hook trực tiếp qua Postgres local.
// - Đối tượng: public.d7_before_user_created, public signUp/signInWithOtp, admin.createUser.
// - Case thành công: payload provider google → {}; email có marker → {}; admin createUser có marker tạo được user.
// - Case thất bại: email không marker và phone → lỗi 403; anon signUp/signInWithOtp cho email mới → lỗi, không có user.
// - Bảo mật/phân quyền: anon key không tạo được user email (không ai đặt sẵn mật khẩu cho email người khác).
// - Ổn định/resilience: user tạo trong test được xóa ở afterAll.
// - Invariant cần giữ: mọi user email mới phải đi qua server của app (G8, H12).
// - Kết quả verify gần nhất: passed (10 test) bằng `ALLOW_DB_INTEGRATION_TESTS=true npx vitest run --config vitest.integration.config.ts __tests__/integration/auth-before-user-created-hook.test.ts`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const createdUserIds = new Set<string>();

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true khi dang dung test/dev DB.",
    );
  }

  const url = new URL(SUPABASE_URL);
  const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "http:" || !isLocalHost) {
    throw new Error(`Chan test DB integration vi Supabase URL khong phai local: ${SUPABASE_URL}`);
  }
}

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function uniqueEmail(label: string) {
  return `a1-hook-${label}-${randomUUID().slice(0, 8)}@example.com`;
}

async function callHook(appMetadata: Record<string, unknown>) {
  const event = JSON.stringify({ user: { app_metadata: appMetadata } }).replace(/'/g, "''");
  const output = await waitForLocalPostgresQuery(
    `select public.d7_before_user_created('${event}'::jsonb)::text;`,
    "hook result",
  );
  return JSON.parse(output) as Record<string, unknown>;
}

async function findUserIdByEmail(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Khong doc duoc danh sach user: ${error.message}`);
  return data.users.find((user) => user.email === email)?.id ?? null;
}

beforeAll(() => {
  assertSafeIntegrationEnv();
});

afterAll(async () => {
  for (const id of createdUserIds) {
    await supabaseAdmin.auth.admin.deleteUser(id);
  }
});

describe("public.d7_before_user_created", () => {
  it("allows a Google user without the server marker", async () => {
    await expect(callHook({ provider: "google" })).resolves.toEqual({});
  });

  it("allows an email user carrying the server marker", async () => {
    await expect(callHook({ provider: "email", d7_server_created: true })).resolves.toEqual({});
  });

  it("rejects an email user without the server marker with 403", async () => {
    await expect(callHook({ provider: "email" })).resolves.toEqual({
      error: { http_code: 403, message: "Signups must go through VocaSpace" },
    });
  });

  it("rejects an email user whose marker is not the boolean true", async () => {
    const result = await callHook({ provider: "email", d7_server_created: "true" });
    expect(result).toHaveProperty("error.http_code", 403);
  });

  it("rejects a phone user", async () => {
    const result = await callHook({ provider: "phone" });
    expect(result).toHaveProperty("error.http_code", 403);
  });

  it("is executable only by supabase_auth_admin among the API roles", async () => {
    const output = await waitForLocalPostgresQuery(
      `select string_agg(r || '=' || has_function_privilege(r, 'public.d7_before_user_created(jsonb)', 'execute'), ',' order by r)
       from unnest(array['anon', 'authenticated', 'supabase_auth_admin']) as r;`,
      "hook grants",
    );
    expect(output).toBe("anon=false,authenticated=false,supabase_auth_admin=true");
  });
});

describe("Auth API with the hook enabled", () => {
  it("rejects anon signUp for a new email and creates no user", async () => {
    const email = uniqueEmail("signup");
    const { data, error } = await anonClient().auth.signUp({ email, password: "Attacker-123!" });

    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
    expect(await findUserIdByEmail(email)).toBeNull();
  });

  it("rejects anon signInWithOtp for a new email and creates no user", async () => {
    const email = uniqueEmail("otp");
    const { error } = await anonClient().auth.signInWithOtp({ email });

    expect(error).not.toBeNull();
    expect(await findUserIdByEmail(email)).toBeNull();
  });

  it("lets the server create an unconfirmed email user with the marker", async () => {
    const email = uniqueEmail("admin");
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: `${randomUUID()}aA1!`,
      email_confirm: false,
      app_metadata: { d7_server_created: true },
    });

    expect(error).toBeNull();
    expect(data.user?.email_confirmed_at ?? null).toBeNull();
    if (data.user) createdUserIds.add(data.user.id);
  });

  it("reports sign-ups as enabled through the settings endpoint the app reads", async () => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: "no-store",
    });
    const settings = (await response.json()) as { disable_signup?: unknown };

    expect(response.ok).toBe(true);
    expect(settings.disable_signup).toBe(false);
  });
});
