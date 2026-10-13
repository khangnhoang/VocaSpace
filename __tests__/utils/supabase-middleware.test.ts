import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/utils/supabase/middleware";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockedCreateServerClient = vi.mocked(createServerClient);

// Test plan:
// - Mục tiêu: kiểm tra proxy/session guard cho namespace teacher sau hard cut sang /teacher/courses và cho /profile (A5 AUTH-017),
//   cùng lý do `reason=signin_required` trên redirect về /login (F1 AUTH-003).
// - Loại test: unit route/session middleware.
// - Đối tượng: updateSession trong utils/supabase/middleware.ts.
// - Case thành công:
//   - Người chưa đăng nhập vào /teacher, /teacher/courses, /teacher/courses/new, /teacher/courses/[id] bị redirect về /login.
//   - Route giống tên teacher hoặc old /courses không thuộc segment /teacher không bị guard nhầm.
//   - Người chưa đăng nhập vào /profile hoặc /profile/... bị redirect về /login chỉ kèm `reason=signin_required` (query và hash khác bị bỏ); người đã đăng nhập vẫn vào được.
//   - Người chưa đăng nhập vào /admin, /admin/user-management và các route AD1 gỡ (/admin/courses, /admin/stats, /admin/settings) bị redirect về đúng
//     `/login?reason=signin_required`, bỏ query/hash, thay `reason` giả bằng đúng một `reason` (AD1 AC1).
//   - Redirect teacher giữ query khác và có đúng một `reason`, kể cả khi request mang sẵn `reason` giả.
// - Case thất bại:
//   - Không áp dụng trực tiếp; lỗi Supabase không được mô phỏng ở lớp này.
// - Bảo mật/phân quyền:
//   - Middleware chỉ là lớp điều hướng phiên; Server Actions/RLS vẫn là lớp bảo vệ dữ liệu thật.
// - Ổn định/resilience:
//   - Không mở lại legacy redirect từ old teacher /courses/*.
// - Invariant cần giữ:
//   - Chỉ /teacher, /teacher/..., /profile, /profile/..., /admin và /admin/... được middleware guard; /profileish, /adminish, /administrator thì không.
//   - Với /admin, proxy không truy vấn profiles (AD1 G3); kiểm tra vai trò nằm ở server render (xem admin-access.test.ts).
//   - Redirect không bao giờ mang next/redirect_to từ /profile hoặc /admin; `reason` chỉ là literal cố định.
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
    expect(redirectLocation(response)).toBe("https://vocaspace.test/login?reason=signin_required");
  });

  it.each([
    ["/teacher?x=1", "https://vocaspace.test/login?x=1&reason=signin_required"],
    ["/teacher/courses?a=1&b=two", "https://vocaspace.test/login?a=1&b=two&reason=signin_required"],
    ["/teacher?reason=other&x=1", "https://vocaspace.test/login?reason=signin_required&x=1"],
    ["/teacher?reason=a&reason=b", "https://vocaspace.test/login?reason=signin_required"],
    ["/teacher?reason=signin_required", "https://vocaspace.test/login?reason=signin_required"],
  ])("keeps other query parameters and sets exactly one reason on the %s redirect", async (path, expected) => {
    mockUser(null);

    const response = await updateSession(requestFor(path));

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe(expected);
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
      expect(redirectLocation(response)).toBe("https://vocaspace.test/login?reason=signin_required");
    },
  );

  it("drops next and redirect_to query parameters on the signed-out profile redirect", async () => {
    mockUser(null);

    const response = await updateSession(
      requestFor("/profile/orders?next=https://evil.example&redirect_to=//evil.example"),
    );

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe("https://vocaspace.test/login?reason=signin_required");
  });

  it("clears query and hash on the signed-out profile redirect before adding the reason, replacing a forged reason", async () => {
    mockUser(null);

    const response = await updateSession(requestFor("/profile?next=x&reason=<b>boom</b>#h"));

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe("https://vocaspace.test/login?reason=signin_required");
  });

  it.each(["/profile", "/profile/orders", "/teacher"])(
    "lets a signed-in user through to %s",
    async (pathname) => {
      mockUser({ id: "user-1" });

      const response = await updateSession(requestFor(pathname));

      expect(response.status).toBe(200);
      expect(redirectLocation(response)).toBeNull();
    },
  );

  it.each(["/login", "/register"])("still sends a signed-in user from %s to the home page", async (pathname) => {
    mockUser({ id: "user-1" });

    const response = await updateSession(requestFor(pathname));

    expect(response.status).toBe(307);
    expect(new URL(redirectLocation(response)!).pathname).toBe("/");
  });

  it("does not treat /profileish as the profile namespace", async () => {
    mockUser(null);

    const response = await updateSession(requestFor("/profileish"));

    expect(response.status).toBe(200);
    expect(redirectLocation(response)).toBeNull();
  });
});

describe("updateSession admin route guard", () => {
  it.each(["/admin", "/admin/user-management", "/admin/courses", "/admin/stats", "/admin/settings"])(
    "redirects unauthenticated admin request %s to login with only the sign-in reason",
    async (pathname) => {
      mockUser(null);

      const response = await updateSession(requestFor(pathname));

      expect(response.status).toBe(307);
      expect(redirectLocation(response)).toBe("https://vocaspace.test/login?reason=signin_required");
    },
  );

  it("drops query and hash on the signed-out admin redirect and replaces a forged reason", async () => {
    mockUser(null);

    const response = await updateSession(
      requestFor("/admin/x?next=https://evil.example&redirect_to=//evil.example&reason=<b>boom</b>#h"),
    );

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe("https://vocaspace.test/login?reason=signin_required");
  });

  it.each(["/adminish", "/administrator", "/admin-panel"])(
    "does not treat %s as the admin namespace",
    async (pathname) => {
      mockUser(null);

      const response = await updateSession(requestFor(pathname));

      expect(response.status).toBe(200);
      expect(redirectLocation(response)).toBeNull();
    },
  );

  it.each(["/admin", "/admin/user-management"])(
    "lets a signed-in user through the proxy to %s without any profile query",
    async (pathname) => {
      const from = vi.fn();
      mockedCreateServerClient.mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
        from,
      } as never);

      const response = await updateSession(requestFor(pathname));

      expect(response.status).toBe(200);
      expect(redirectLocation(response)).toBeNull();
      expect(from).not.toHaveBeenCalled();
    },
  );
});
