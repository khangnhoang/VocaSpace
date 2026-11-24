import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PATHNAME_HEADER } from "@/lib/i18n/locked-areas";
import { updateSession } from "@/utils/supabase/middleware";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockedCreateServerClient = vi.mocked(createServerClient);

// Test plan:
// - Mục tiêu: U9 AC7 và G4 - updateSession ghi đè header đường dẫn upstream trên cả hai response nó dựng.
// - Loại test: unit trên updateSession với Supabase giả.
// - Case: response thường mang đường dẫn proxy thấy; giá trị client giả bị thay (cả khi giả khóa trên path học viên lẫn giả path
//   học viên trên path khóa); response dựng lại trong setAll vẫn mang header, vẫn chuyển cookie phiên đã refresh lên upstream
//   và trả Set-Cookie cho client, và không có Set-Cookie NEXT_LOCALE.
// - Hành vi redirect/auth giữ nguyên: được kiểm ở supabase-middleware.test.ts.

// Next ghi header request upstream thành `x-middleware-request-<tên>` trên response của proxy.
const upstream = (response: Response, name: string) => response.headers.get(`x-middleware-request-${name}`);

function mockSupabase(options: { user: { id: string } | null; refresh?: { name: string; value: string }[] }) {
  mockedCreateServerClient.mockImplementation(((_url: string, _key: string, config: { cookies: { setAll: (c: unknown[]) => void } }) => ({
    auth: {
      getUser: vi.fn(async () => {
        if (options.refresh) {
          config.cookies.setAll(options.refresh.map((cookie) => ({ ...cookie, options: { path: "/", httpOnly: true } })));
        }
        return { data: { user: options.user } };
      }),
    },
  })) as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("updateSession path header", () => {
  it.each(["/teacher/courses", "/admin", "/courses", "/api/question-group-media/upload"])(
    "passes the request path %s upstream",
    async (pathname) => {
      mockSupabase({ user: { id: "u" } });

      const response = await updateSession(new NextRequest(`https://vocaspace.test${pathname}?x=1`));

      expect(upstream(response, PATHNAME_HEADER)).toBe(pathname);
    },
  );

  it("replaces a forged locked path on a student request", async () => {
    mockSupabase({ user: null });

    const response = await updateSession(
      new NextRequest("https://vocaspace.test/courses", { headers: { [PATHNAME_HEADER]: "/teacher/courses" } }),
    );

    expect(upstream(response, PATHNAME_HEADER)).toBe("/courses");
  });

  it("replaces a forged student path on a locked request", async () => {
    mockSupabase({ user: { id: "u" } });

    const response = await updateSession(
      new NextRequest("https://vocaspace.test/admin", { headers: { [PATHNAME_HEADER]: "/courses" } }),
    );

    expect(upstream(response, PATHNAME_HEADER)).toBe("/admin");
  });

  it("keeps the path header, forwards refreshed session cookies upstream and to the client when setAll rebuilds the response", async () => {
    mockSupabase({
      user: { id: "u" },
      refresh: [
        { name: "sb-access-token", value: "fresh-access" },
        { name: "sb-refresh-token", value: "fresh-refresh" },
      ],
    });

    const response = await updateSession(
      new NextRequest("https://vocaspace.test/teacher/courses", {
        headers: { [PATHNAME_HEADER]: "/courses", cookie: "sb-access-token=stale; NEXT_LOCALE=en" },
      }),
    );

    expect(upstream(response, PATHNAME_HEADER)).toBe("/teacher/courses");
    const upstreamCookie = upstream(response, "cookie") ?? "";
    expect(upstreamCookie).toContain("sb-access-token=fresh-access");
    expect(upstreamCookie).toContain("sb-refresh-token=fresh-refresh");
    expect(upstreamCookie).not.toContain("stale");
    expect(upstreamCookie).toContain("NEXT_LOCALE=en");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-access-token=fresh-access");
    expect(setCookie).toContain("sb-refresh-token=fresh-refresh");
    expect(setCookie).not.toContain("NEXT_LOCALE");
  });

  it("replaces a forged header on the rebuilt response too", async () => {
    mockSupabase({ user: { id: "u" }, refresh: [{ name: "sb-access-token", value: "fresh" }] });

    const response = await updateSession(
      new NextRequest("https://vocaspace.test/courses", { headers: { [PATHNAME_HEADER]: "/admin" } }),
    );

    expect(upstream(response, PATHNAME_HEADER)).toBe("/courses");
  });
});
