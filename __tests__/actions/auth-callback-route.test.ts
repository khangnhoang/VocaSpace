import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: callback Google chỉ đổi code lấy session bằng exchangeCodeForSession và chỉ chuyển tới hai path cố định.
// - Loại test: Route Handler unit test với Supabase boundary mock.
// - Đối tượng: GET /auth/callback.
// - Case thành công: code hợp lệ, exchange ok → 303 `/` và exchange được gọi đúng một lần với code đó.
// - Case thất bại: thiếu code, `error`/`error_description` từ nhà cung cấp (có hoặc không có code), exchange lỗi hoặc
//   throw (code giả, thiếu PKCE verifier) → /login?auth_error=oauth; các case không có code hợp lệ không gọi Supabase.
// - Bảo mật/phân quyền: G1 — `next`/`redirect_to` từ query bị bỏ qua cả khi thành công lẫn thất bại, không có open redirect.
// - Ổn định/resilience: lỗi bất ngờ khi tạo client hoặc đổi code vẫn ra đường thất bại cố định.
// - Invariant cần giữ: Location luôn là path nội bộ tương đối (giữ host gốc và cookie session vừa đặt).
// - Kết quả verify gần nhất: passed (13 test) bằng `npx vitest run __tests__/actions/auth-callback-route.test.ts`.

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
