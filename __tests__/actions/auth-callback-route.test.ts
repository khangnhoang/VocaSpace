import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: callback Google chỉ đổi code lấy session bằng exchangeCodeForSession; thất bại về path cố định, thành công về `/`
//   hoặc trang đích nội bộ mà proxy đã ghi vào cookie (U3 AC7), rồi xoá cookie đó và ghi cách đăng nhập `google` (U3 AC6).
// - Loại test: Route Handler unit test với Supabase boundary mock.
// - Đối tượng: GET /auth/callback.
// - Case thành công: code hợp lệ, exchange ok → 303 `/` và exchange được gọi đúng một lần với code đó.
// - Case thất bại: thiếu code, `error`/`error_description` từ nhà cung cấp (có hoặc không có code), exchange lỗi hoặc
//   throw (code giả, thiếu PKCE verifier) → /login?auth_error=oauth; các case không có code hợp lệ không gọi Supabase.
// - Bảo mật/phân quyền: G1 — `next`/`redirect_to` từ query bị bỏ qua cả khi thành công lẫn thất bại, không có open redirect;
//   cookie trang đích sai allowlist về `/`; thất bại không đụng cookie nào.
// - Ổn định/resilience: lỗi bất ngờ khi tạo client hoặc đổi code vẫn ra đường thất bại cố định.
// - Invariant cần giữ: Location luôn là path nội bộ tương đối (giữ host gốc và cookie session vừa đặt).

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const ORIGIN = "http://127.0.0.1:3000";
const FAILURE = "/login?auth_error=oauth";

function mockExchange(error: unknown = null) {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: {}, error });
  mockedCreateClient.mockResolvedValue({ auth: { exchangeCodeForSession } } as never);
  return exchangeCodeForSession;
}

function callback(query: string) {
  return GET(new NextRequest(`${ORIGIN}/auth/callback?${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  it("exchanges a valid code once and redirects to the home page", async () => {
    const exchangeCodeForSession = mockExchange();

    const response = await callback("code=good-code");

    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("good-code");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });

  it.each([
    ["no code", ""],
    ["an empty code", "code="],
    ["a whitespace-only code", "code=%20%20"],
    ["a provider error without a code", "error=access_denied"],
    ["a provider error with a code", "error=access_denied&code=good-code"],
    ["only an error_description with a code", "error_description=User%20cancelled&code=good-code"],
  ])("redirects to the oauth failure without calling Supabase for %s", async (_label, query) => {
    const exchangeCodeForSession = mockExchange();

    const response = await callback(query);

    expect(mockedCreateClient).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(FAILURE);
  });

  it.each([
    ["a bogus or reused code", { code: "validation_failed", status: 400 }],
    ["a missing PKCE verifier", { code: "bad_code_verifier", status: 400 }],
  ])("redirects to the oauth failure when the exchange fails for %s", async (_label, error) => {
    mockExchange(error);

    const response = await callback("code=bogus");

    expect(response.headers.get("location")).toBe(FAILURE);
  });

  it("redirects to the oauth failure when the exchange throws", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { exchangeCodeForSession: vi.fn().mockRejectedValue(new Error("network")) },
    } as never);

    const response = await callback("code=good-code");

    expect(response.headers.get("location")).toBe(FAILURE);
  });

  it("redirects to the oauth failure when creating the client fails", async () => {
    mockedCreateClient.mockRejectedValue(new Error("cookies unavailable"));

    const response = await callback("code=good-code");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(FAILURE);
  });

  it("ignores next and redirect_to on success", async () => {
    mockExchange();

    const response = await callback(
      "code=good-code&next=https://evil.example&redirect_to=//evil.example",
    );

    expect(response.headers.get("location")).toBe("/");
  });

  it("ignores next and redirect_to on a failing exchange", async () => {
    mockExchange({ code: "validation_failed", status: 400 });

    const response = await callback(
      "code=bogus&next=https://evil.example&redirect_to=//evil.example",
    );

    expect(response.headers.get("location")).toBe(FAILURE);
  });

  it("ignores next and redirect_to when the provider reports an error", async () => {
    const response = await callback("error=access_denied&next=https://evil.example");

    expect(response.headers.get("location")).toBe(FAILURE);
  });
});

describe("GET /auth/callback return path and last method (U3)", () => {
  function callbackWithCookie(query: string, cookie: string, origin = ORIGIN) {
    return GET(new NextRequest(`${origin}/auth/callback?${query}`, { headers: { cookie } }));
  }

  function setCookies(response: Response) {
    return (response.headers.get("set-cookie") ?? "").split(/,(?=\s*\w+=)/).map((cookie) => cookie.trim());
  }

  it("redirects to a valid stored return path, deletes it and records google", async () => {
    mockExchange();

    const response = await callbackWithCookie("code=good-code", "vs_return_to=%2Fprofile%2Forders");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/profile/orders");
    const cookies = setCookies(response);
    const cleared = cookies.find((cookie) => cookie.startsWith("vs_return_to="));
    expect(cleared).toMatch(/^vs_return_to=;/);
    expect(cleared).toMatch(/Max-Age=0/);
    const method = cookies.find((cookie) => cookie.startsWith("vs_last_sign_in="));
    expect(method).toMatch(/^vs_last_sign_in=google;/);
    expect(method).toMatch(/HttpOnly/i);
    expect(method).toMatch(/SameSite=lax/i);
    expect(method).toMatch(/Max-Age=15552000/);
    expect(method).not.toMatch(/Secure/i);
  });

  it("marks the cookies Secure when the callback arrives over HTTPS", async () => {
    mockExchange();

    const response = await callbackWithCookie("code=good-code", "vs_return_to=%2Fadmin", "https://vocaspace.test");

    expect(response.headers.get("location")).toBe("/admin");
    for (const cookie of setCookies(response)) expect(cookie).toMatch(/Secure/i);
  });

  it.each([
    ["an external URL", "vs_return_to=https%3A%2F%2Fevil.example"],
    ["a protocol-relative URL", "vs_return_to=%2F%2Fevil.example"],
    ["a non-allowlisted page", "vs_return_to=%2Flearn%2Fx"],
    ["an empty value", "vs_return_to="],
  ])("falls back to the home page for %s and still clears the cookie", async (_label, cookie) => {
    mockExchange();

    const response = await callbackWithCookie("code=good-code", cookie);

    expect(response.headers.get("location")).toBe("/");
    expect(setCookies(response).find((value) => value.startsWith("vs_return_to="))).toMatch(/Max-Age=0/);
  });

  it("ignores next and redirect_to even when a valid return path is stored", async () => {
    mockExchange();

    const response = await callbackWithCookie(
      "code=good-code&next=https://evil.example&redirect_to=//evil.example",
      "vs_return_to=%2Fteacher",
    );

    expect(response.headers.get("location")).toBe("/teacher");
  });

  it("leaves both cookies untouched when the exchange fails", async () => {
    mockExchange({ code: "validation_failed", status: 400 });

    const response = await callbackWithCookie("code=bogus", "vs_return_to=%2Fprofile");

    expect(response.headers.get("location")).toBe(FAILURE);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
