import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/confirm/route";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Test plan:
// - Mục tiêu: chỉ gửi cookie recovery khi bằng chứng của session mới đã lưu thành công.
// - Loại test: Route Handler unit, adapter @supabase/ssr thật; HTTP Auth và Data API được mock.
// - Đối tượng: GET /auth/confirm?type=recovery, recordPasswordRecovery.
// - Case thành công: claims mới ghi user_id/session_id trước response 303 có cookie; bỏ query redirect.
// - Case thất bại: token sai, claims thiếu/lỗi, upsert lỗi/ném → path recovery cố định, không Set-Cookie.
// - Bảo mật/phân quyền: scope local, bearer của session mới; giữ nguyên cookie cũ kể cả cookie chia chunk.
// - Ổn định/resilience: signOut thành công/lỗi/ném không làm lọt cookie; email/signup không ghi bằng chứng.
// - Invariant cần giữ: response lỗi không phát bất kỳ cookie Auth mới hay cookie xóa phiên cũ.
// - Kết quả verify gần nhất: passed (29 test) bằng `npx vitest run __tests__/actions/auth-recovery-route.test.ts`.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const cookieName = "sb-127-auth-token";
let accessToken: string;
let upsert: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn<(input: string, init: RequestInit) => Promise<Response>>>;
let logout: ReturnType<typeof vi.fn<(input: string, init: RequestInit) => Promise<Response>>>;

function jwt(claims: Record<string, unknown>) {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method: "otp" }], ...claims })).toString("base64url"),
    Buffer.from("test-signature").toString("base64url"),
  ].join(".");
}

function session(token: string) {
  return { access_token: token, refresh_token: "new-refresh-token", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, aud: "authenticated", app_metadata: {}, user_metadata: {} },
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function request(query = "token_hash=new-hash&type=recovery", existing = false) {
  const old = `base64-${Buffer.from(JSON.stringify(session(jwt({ session_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" })))).toString("base64url")}`;
  const headers = existing ? { cookie: `${cookieName}.0=${old.slice(0, 200)}; ${cookieName}.1=${old.slice(200)}` } : undefined;
  return new NextRequest(`http://127.0.0.1:3000/auth/confirm?${query}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:45321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  accessToken = jwt({ session_id: sessionId });
  upsert = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ upsert })) } as never);
  logout = vi.fn().mockResolvedValue(json({}));
  fetchMock = vi.fn(async (input: string, init: RequestInit) => {
    const url = String(input);
    if (url.includes("/verify")) return json(session(accessToken));
    if (url.includes("/user")) return json(session(accessToken).user);
    if (url.includes("/logout")) return logout(input, init);
    throw new Error(`Unexpected Auth request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("recovery cookie commit", () => {
  it("records verified claims and commits cookies", async () => {
    const response = await GET(request("token_hash=new-hash&type=recovery&next=https://evil.example&redirect_to=//evil.example", true));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/auth/set-password");
    expect(upsert).toHaveBeenCalledWith({ user_id: userId, session_id: sessionId }, { onConflict: "user_id" });
    const headers = response.headers.getSetCookie();
    expect(headers.some((header) => header.startsWith(`${cookieName}=base64-`))).toBe(true);
    expect(logout).not.toHaveBeenCalled();
  });

  for (const existing of [false, true]) {
    for (const failure of ["claims", "missing_session_id", "write", "write_throw"]) {
      for (const signOut of ["ok", "error", "throw"]) {
        it(`discards all cookie writes with existing=${existing}, failure=${failure}, signOut=${signOut}`, async () => {
          if (failure === "missing_session_id") accessToken = jwt({});
          if (failure === "write") upsert.mockResolvedValue({ error: { code: "08006" } });
          if (failure === "write_throw") upsert.mockRejectedValue(new Error("transport"));
          if (failure === "claims") fetchMock.mockImplementation(async (input: string, init: RequestInit) => {
            if (String(input).includes("/verify")) return json(session(accessToken));
            if (String(input).includes("/logout")) return logout(input, init);
            return json({ msg: "bad jwt", code: "bad_jwt" }, 403);
          });
          if (signOut === "error") logout.mockResolvedValue(json({ msg: "failure", code: "unexpected_failure" }, 500));
          if (signOut === "throw") logout.mockImplementation(() => { throw new Error("transport"); });
          const incoming = request(undefined, existing);
          const originalCookies = incoming.cookies.getAll();
          const response = await GET(incoming);
          expect(response.headers.get("location")).toBe("/login?auth_error=recovery");
          expect(response.headers.getSetCookie()).toEqual([]);
          expect(incoming.cookies.getAll()).toEqual(originalCookies);
          expect(logout).toHaveBeenCalledTimes(1);
          const [url, init] = logout.mock.calls[0];
          expect(url).toContain("scope=local");
          expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${accessToken}`);
        });
      }
    }
  }
  it("rejects an expired token without evidence or new cookies", async () => {
    fetchMock.mockResolvedValue(json({ code: "otp_expired", msg: "expired" }, 403));
    const response = await GET(request());
    expect(response.headers.get("location")).toBe("/login?auth_error=recovery");
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();
  });
  it.each(["type=recovery", "token_hash=&type=recovery"])("rejects incomplete %s before Auth", async (query) => {
    const response = await GET(request(query));
    expect(response.headers.get("location")).toBe("/login?auth_error=recovery");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
