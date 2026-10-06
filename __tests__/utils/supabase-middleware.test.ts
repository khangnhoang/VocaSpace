import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/utils/supabase/middleware";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockedCreateServerClient = vi.mocked(createServerClient);

// Test plan:
// - Mục tiêu: kiểm tra proxy/session guard cho namespace teacher sau hard cut sang /teacher/courses và cho /profile (A5 AUTH-017).
// - Loại test: unit route/session middleware.
// - Đối tượng: updateSession trong utils/supabase/middleware.ts.
// - Case thành công:
//   - Người chưa đăng nhập vào /teacher, /teacher/courses, /teacher/courses/new, /teacher/courses/[id] bị redirect về /login.
//   - Route giống tên teacher hoặc old /courses không thuộc segment /teacher không bị guard nhầm.
//   - Người chưa đăng nhập vào /profile hoặc /profile/... bị redirect về /login không kèm next/redirect_to; người đã đăng nhập vẫn vào được.
// - Case thất bại:
//   - Không áp dụng trực tiếp; lỗi Supabase không được mô phỏng ở lớp này.
// - Bảo mật/phân quyền:
//   - Middleware chỉ là lớp điều hướng phiên; Server Actions/RLS vẫn là lớp bảo vệ dữ liệu thật.
// - Ổn định/resilience:
//   - Không mở lại legacy redirect từ old teacher /courses/*.
// - Invariant cần giữ:
//   - Chỉ /teacher, /teacher/..., /profile và /profile/... được middleware guard; /profileish thì không.
// - Kết quả verify gần nhất: xem milestone A5 CP1 trong progress.md (`npm run test:run -- __tests__/utils/supabase-middleware.test.ts`).
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

describe("updateSession profile route guard", () => {
  it.each(["/profile", "/profile/orders"])(
    "redirects unauthenticated profile request %s to login without a destination parameter",
    async (pathname) => {
      mockUser(null);

      const response = await updateSession(requestFor(pathname));

      expect(response.status).toBe(307);
      expect(redirectLocation(response)).toBe("https://vocaspace.test/login");
    },
  );

  it.each(["/profile", "/profile/orders", "/teacher"])(
    "lets a signed-in user through to %s",
    async (pathname) => {
      mockUser({ id: "user-1" });

      const response = await updateSession(requestFor(pathname));

      expect(response.status).toBe(200);
      expect(redirectLocation(response)).toBeNull();
    },
  );

  it("does not treat /profileish as the profile namespace", async () => {
    mockUser(null);

    const response = await updateSession(requestFor("/profileish"));

    expect(response.status).toBe(200);
    expect(redirectLocation(response)).toBeNull();
  });
});
