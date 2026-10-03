import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/confirm/route";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: link xác minh trong mail chỉ tạo session qua verifyOtp và chỉ chuyển tới hai path cố định.
// - Loại test: Route Handler unit test với Supabase boundary mock.
// - Đối tượng: GET /auth/confirm.
// - Case thành công: token_hash + type hợp lệ, verifyOtp ok → /auth/set-password.
// - Case thất bại: verifyOtp lỗi, thiếu hoặc sai token_hash/type → /login?auth_error=confirm (không gọi Supabase khi input sai).
// - Bảo mật/phân quyền: G1 — `next`/`redirect_to` từ query bị bỏ qua, không có open redirect.
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: Location luôn là path nội bộ tương đối (giữ host gốc và cookie session vừa đặt).
// - Kết quả verify gần nhất: passed (8 test) bằng `npx vitest run __tests__/actions/auth-confirm-route.test.ts`.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const ORIGIN = "http://127.0.0.1:3000";

function mockVerifyOtp(error: unknown = null) {
  const verifyOtp = vi.fn().mockResolvedValue({ data: {}, error });
  mockedCreateClient.mockResolvedValue({ auth: { verifyOtp } } as never);
  return verifyOtp;
}

function confirm(query: string) {
  return GET(new NextRequest(`${ORIGIN}/auth/confirm?${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/confirm", () => {
  it("verifies the token and redirects to the set-password page", async () => {
    const verifyOtp = mockVerifyOtp();

    const response = await confirm("token_hash=hash-1&type=email");

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "email" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/auth/set-password");
  });

  it("redirects to the login error when verifyOtp fails", async () => {
    mockVerifyOtp({ code: "otp_expired", status: 403 });

    const response = await confirm("token_hash=used&type=signup");

    expect(response.headers.get("location")).toBe("/login?auth_error=confirm");
  });

  it.each([
    ["a missing token_hash", "type=email"],
    ["an empty token_hash", "token_hash=&type=email"],
    ["a missing type", "token_hash=hash-1"],
    ["an unsupported type", "token_hash=hash-1&type=recovery"],
  ])("redirects to the login error without calling Supabase for %s", async (_label, query) => {
    const verifyOtp = mockVerifyOtp();

    const response = await confirm(query);

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(mockedCreateClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("/login?auth_error=confirm");
  });

  it("ignores next and redirect_to on success", async () => {
    mockVerifyOtp();

    const response = await confirm(
      "token_hash=hash-1&type=email&next=https://evil.example&redirect_to=https://evil.example",
    );

    expect(response.headers.get("location")).toBe("/auth/set-password");
  });

  it("ignores next and redirect_to on failure", async () => {
    mockVerifyOtp({ code: "otp_expired", status: 403 });

    const response = await confirm("token_hash=hash-1&type=email&next=//evil.example");

    expect(response.headers.get("location")).toBe("/login?auth_error=confirm");
  });
});
