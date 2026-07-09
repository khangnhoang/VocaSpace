import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/utils/supabase/middleware";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockedCreateServerClient = vi.mocked(createServerClient);

// Test plan:
// - Mục tiêu: kiểm tra proxy/session guard cho namespace teacher sau hard cut sang /teacher/courses.
// - Loại test: unit route/session middleware.
// - Đối tượng: updateSession trong utils/supabase/middleware.ts.
// - Case thành công:
//   - Người chưa đăng nhập vào /teacher, /teacher/courses, /teacher/courses/new, /teacher/courses/[id] bị redirect về /login.
//   - Route giống tên teacher hoặc old /courses không thuộc segment /teacher không bị guard nhầm.
// - Case thất bại:
//   - Không áp dụng trực tiếp; lỗi Supabase không được mô phỏng ở lớp này.
// - Bảo mật/phân quyền:
//   - Middleware chỉ là lớp điều hướng phiên; Server Actions/RLS vẫn là lớp bảo vệ dữ liệu thật.
// - Ổn định/resilience:
//   - Không mở lại legacy redirect từ old teacher /courses/*.
// - Invariant cần giữ:
//   - Chỉ /teacher và /teacher/... là teacher namespace được middleware guard.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/proxy.test.ts __tests__/utils/supabase-middleware.test.ts`.
// - Ghi chú: Không kiểm tra RLS ở lớp middleware.

function mockUser(user: { id: string } | null) {
  mockedCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
  } as never);
}

function requestFor(pathname: string) {
  return new NextRequest(`https://vocaspace.test${pathname}`);
}

function redirectLocation(response: Response) {
  return response.headers.get("location");
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("updateSession teacher route guard", () => {
  it.each([
    "/teacher",
    "/teacher/courses",
    "/teacher/courses/new",
    "/teacher/courses/some-course-id",
  ])("redirects unauthenticated teacher namespace request %s to login", async (pathname) => {
    mockUser(null);

    const response = await updateSession(requestFor(pathname));

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe("https://vocaspace.test/login");
  });

  it.each(["/teacherish", "/courses/some-course-id"])(
    "does not treat non-teacher path %s as the teacher namespace",
    async (pathname) => {
      mockUser(null);

      const response = await updateSession(requestFor(pathname));

      expect(response.status).toBe(200);
      expect(redirectLocation(response)).toBeNull();
    },
  );
});
