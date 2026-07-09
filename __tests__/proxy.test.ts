import { type NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";
import { updateSession } from "@/utils/supabase/middleware";

vi.mock("@/utils/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

const mockedUpdateSession = vi.mocked(updateSession);

// Test plan:
// - Mục tiêu: kiểm tra proxy.ts vẫn là entry point route/session của dự án.
// - Loại test: unit proxy wiring.
// - Đối tượng: proxy() và config.matcher trong proxy.ts.
// - Case thành công:
//   - proxy() delegate request sang updateSession.
//   - matcher vẫn bao phủ route app bình thường để /teacher/* đi qua updateSession.
// - Case thất bại:
//   - Không áp dụng; test này chỉ bảo vệ wiring, không mô phỏng Supabase.
// - Bảo mật/phân quyền:
//   - Quyết định auth nằm trong updateSession và Server Actions/RLS, proxy chỉ chuyển request vào entry point.
// - Ổn định/resilience:
//   - Không yêu cầu middleware.ts vì dự án dùng proxy.ts.
// - Invariant cần giữ:
//   - proxy.ts gọi updateSession cho request đi qua matcher.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/proxy.test.ts __tests__/utils/supabase-middleware.test.ts`.
// - Ghi chú: Không test auth ở file này; auth guard được kiểm tra trong middleware test.

afterEach(() => {
  vi.clearAllMocks();
});

describe("proxy route/session entry point", () => {
  it("delegates requests to updateSession", async () => {
    const request = new Request("https://vocaspace.test/teacher/courses") as NextRequest;
    const expectedResponse = NextResponse.next();
    mockedUpdateSession.mockResolvedValue(expectedResponse);

    const response = await proxy(request);

    expect(response).toBe(expectedResponse);
    expect(mockedUpdateSession).toHaveBeenCalledWith(request);
  });

  it("keeps the matcher configured for application routes", () => {
    expect(config.matcher).toEqual([
      "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ]);
  });
});
