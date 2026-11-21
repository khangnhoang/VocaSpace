import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "@/app/actions/locale";

// Test plan:
// - Mục tiêu: English localization U1 AC3/G4 - action đổi ngôn ngữ chỉ ghi cookie `NEXT_LOCALE` với `vi` hoặc `en`, và chỉ khi
//   cờ giao diện tiếng Anh bật.
// - Loại test: Server Action với `next/headers` mock (cookie store ghi lại lời gọi `set`).
// - Case thành công: `vi`, `en` ghi cookie một năm, Path=/, SameSite=Lax, HttpOnly; `Secure` theo giao thức thật của request.
// - Case thất bại: giá trị lạ (`fr`, `EN`, chuỗi rỗng, null, object, mảng) và cờ tắt trả `{ ok: false }` và không ghi cookie.

const mocks = vi.hoisted(() => ({ set: vi.fn(), headers: new Headers() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mocks.set })),
  headers: vi.fn(async () => mocks.headers),
}));

beforeEach(() => {
  vi.stubEnv("ENGLISH_UI_ENABLED", "1");
  mocks.headers = new Headers();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("setLocale", () => {
  it.each(["vi", "en"] as const)("stores %s in the locale cookie for a year", async (locale) => {
    await expect(setLocale(locale)).resolves.toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith("NEXT_LOCALE", locale, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 60 * 60 * 24 * 365,
    });
  });

  it("marks the cookie Secure behind an HTTPS proxy", async () => {
    mocks.headers = new Headers({ "x-forwarded-proto": "https" });
    await setLocale("en");
    expect(mocks.set).toHaveBeenCalledWith("NEXT_LOCALE", "en", expect.objectContaining({ secure: true }));
  });

  it.each(["fr", "EN", "", null, undefined, { locale: "en" }, ["en"]])("rejects %j without writing a cookie", async (value) => {
    await expect(setLocale(value)).resolves.toEqual({ ok: false });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("writes nothing while the English interface flag is off", async () => {
    vi.stubEnv("ENGLISH_UI_ENABLED", undefined);
    await expect(setLocale("en")).resolves.toEqual({ ok: false });
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
