import { NextRequest, NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";
import { PATHNAME_HEADER } from "@/lib/i18n/locked-areas";
import { updateSession } from "@/utils/supabase/middleware";

vi.mock("@/utils/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

const mockedUpdateSession = vi.mocked(updateSession);

// Test plan:
// - Mục tiêu: U9 H5 - URL đuôi ảnh dưới /teacher và /admin vẫn đi qua proxy chỉ để nhận header đường dẫn, còn auth giữ như cũ.
// - Loại test: unit proxy wiring (matcher và nhánh đuôi ảnh), updateSession được mock như proxy.test.ts.
// - Case: matcher khớp URL ảnh dưới hai khu vực bị khóa nhưng không khớp ảnh ở nơi khác hay tên giống (/teachers, /administrator);
//   proxy() trả response có header đường dẫn đúng (thay giá trị giả) mà không gọi updateSession, nên không redirect hay refresh phiên;
//   URL không phải ảnh dưới khu bị khóa vẫn đi qua updateSession.

afterEach(() => {
  vi.clearAllMocks();
});

describe("proxy matcher for image-extension paths in locked areas", () => {
  it.each<[string, boolean]>([
    ["/teacher/missing.png", true],
    ["/admin/missing.png", true],
    ["/teacher/a/b/missing.webp", true],
    ["/admin/x.svg", true],
    ["/courses/missing.png", false],
    ["/teachers/missing.png", false],
    ["/administrator/missing.png", false],
    ["/images/cover.png", false],
    ["/teacher/courses", true],
  ])("matches %s: %s", (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });
});

describe("proxy on image-extension paths in locked areas", () => {
  it.each(["/teacher/missing.png", "/admin/missing.jpeg"])(
    "sets the path header without calling updateSession for %s",
    async (pathname) => {
      const response = await proxy(
        new NextRequest(`https://vocaspace.test${pathname}`, { headers: { [PATHNAME_HEADER]: "/courses" } }),
      );

      expect(mockedUpdateSession).not.toHaveBeenCalled();
      expect(response.headers.get(`x-middleware-request-${PATHNAME_HEADER}`)).toBe(pathname);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );

  it("still delegates a locked non-image path to updateSession", async () => {
    const expected = NextResponse.next();
    mockedUpdateSession.mockResolvedValue(expected);
    const request = new NextRequest("https://vocaspace.test/teacher/courses");

    expect(await proxy(request)).toBe(expected);
    expect(mockedUpdateSession).toHaveBeenCalledWith(request);
  });
});
