import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEnglishStepBEnabled, isTeacherAdminLockActive } from "@/lib/i18n/config";
import { PATHNAME_HEADER } from "@/lib/i18n/locked-areas";

const cookiesMock = vi.fn();
const headersMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
  headers: () => headersMock(),
}));

import { getRequestLocale } from "@/lib/i18n/request-locale";

// Test plan:
// - Mục tiêu: U9 AC1, AC2, AC5 ở mức unit - khóa tiếng Việt cho khu giáo viên/admin trong getRequestLocale và hai cờ.
// - Loại test: hàm với next/headers giả (chỉ giả nguồn dữ liệu request, không giả logic khóa).
// - Case: bảng cờ tiếng Anh x cờ bước B x đường dẫn x cookie/Accept-Language; cờ tiếng Anh tắt không đọc cookies()/headers() (G1);
//   thiếu header đường dẫn thì không khóa; khóa không bao giờ ghi cookie (hàm chỉ đọc).

function setRequest(options: { cookie?: string; acceptLanguage?: string; pathname?: string }) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === "NEXT_LOCALE" && options.cookie ? { value: options.cookie } : undefined),
  });
  const entries: Record<string, string> = {};
  if (options.acceptLanguage) entries["accept-language"] = options.acceptLanguage;
  if (options.pathname) entries[PATHNAME_HEADER] = options.pathname;
  headersMock.mockResolvedValue(new Headers(entries));
}

beforeEach(() => {
  cookiesMock.mockReset();
  headersMock.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe("step B flag", () => {
  it.each([
    [undefined, false],
    ["0", false],
    ["true", false],
    ["1", true],
  ] as const)("reads ENGLISH_UI_STEP_B_ENABLED=%j as %j", (value, expected) => {
    vi.stubEnv("ENGLISH_UI_STEP_B_ENABLED", value);
    expect(isEnglishStepBEnabled()).toBe(expected);
  });

  it.each([
    ["1", undefined, true],
    ["1", "1", false],
    [undefined, undefined, false],
    [undefined, "1", false],
  ] as const)("lock with English=%j and step B=%j is %j", (english, stepB, expected) => {
    vi.stubEnv("ENGLISH_UI_ENABLED", english);
    vi.stubEnv("ENGLISH_UI_STEP_B_ENABLED", stepB);
    expect(isTeacherAdminLockActive()).toBe(expected);
  });
});

describe("getRequestLocale lock", () => {
  it.each([undefined, "1"] as const)(
    "returns Vietnamese without reading request data while the English flag is off (step B=%j)",
    async (stepB) => {
      vi.stubEnv("ENGLISH_UI_ENABLED", undefined);
      vi.stubEnv("ENGLISH_UI_STEP_B_ENABLED", stepB);
      setRequest({ cookie: "en", acceptLanguage: "en-US", pathname: "/courses" });

      await expect(getRequestLocale()).resolves.toBe("vi");
      expect(cookiesMock).not.toHaveBeenCalled();
      expect(headersMock).not.toHaveBeenCalled();
    },
  );

  describe("English on, step B off (locked)", () => {
    beforeEach(() => {
      vi.stubEnv("ENGLISH_UI_ENABLED", "1");
      vi.stubEnv("ENGLISH_UI_STEP_B_ENABLED", undefined);
    });

    it.each(["/teacher", "/teacher/courses", "/admin", "/admin/user-management", "/api/question-group-media/upload"])(
      "forces Vietnamese on %s with an en cookie",
      async (pathname) => {
        setRequest({ cookie: "en", acceptLanguage: "en-US", pathname });
        await expect(getRequestLocale()).resolves.toBe("vi");
      },
    );

    it("forces Vietnamese on a locked path with an English-first Accept-Language and no cookie", async () => {
      setRequest({ acceptLanguage: "en-US,en;q=0.9", pathname: "/admin" });
      await expect(getRequestLocale()).resolves.toBe("vi");
    });

    it.each(["/", "/courses", "/learn", "/teachers", "/administrator", "/api/question-group-media/abc/image"])(
      "still follows the en cookie on %s",
      async (pathname) => {
        setRequest({ cookie: "en", pathname });
        await expect(getRequestLocale()).resolves.toBe("en");
      },
    );

    it("still follows Accept-Language on a student path without a cookie", async () => {
      setRequest({ acceptLanguage: "en-US,en;q=0.9", pathname: "/courses" });
      await expect(getRequestLocale()).resolves.toBe("en");
    });

    it("does not lock when the path header is missing", async () => {
      setRequest({ cookie: "en" });
      await expect(getRequestLocale()).resolves.toBe("en");
    });
  });

  describe("English on, step B on (unlocked)", () => {
    beforeEach(() => {
      vi.stubEnv("ENGLISH_UI_ENABLED", "1");
      vi.stubEnv("ENGLISH_UI_STEP_B_ENABLED", "1");
    });

    it.each(["/teacher/courses", "/admin", "/api/question-group-media/upload"])(
      "resolves %s like a student page with an en cookie",
      async (pathname) => {
        setRequest({ cookie: "en", pathname });
        await expect(getRequestLocale()).resolves.toBe("en");
      },
    );

    it("lets Accept-Language decide on a teacher path without a cookie", async () => {
      setRequest({ acceptLanguage: "en-US", pathname: "/teacher/courses" });
      await expect(getRequestLocale()).resolves.toBe("en");
    });

    it("still honors a vi cookie", async () => {
      setRequest({ cookie: "vi", acceptLanguage: "en-US", pathname: "/admin" });
      await expect(getRequestLocale()).resolves.toBe("vi");
    });
  });
});
