// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth: mocks.signInWithOAuth } }),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

// Test plan:
// - Mục tiêu: nút Google chỉ chuyển người dùng sang Google khi provider đang bật (G3), còn lại giữ họ ở trang.
// - Loại test: component interaction trong jsdom (RTL); fetch tới /auth/v1/settings và Supabase browser client được mock.
// - Đối tượng: GoogleSignInButton.
// - Case thành công: `external.google: true` → signInWithOAuth gọi đúng một lần với provider google và
//   redirectTo = origin + /auth/callback; nút bị khóa khi đang chờ, bấm lần hai không gọi thêm.
// - Case thất bại: `external.google: false`, thiếu trường, HTTP không OK, fetch lỗi, JSON hỏng → toast "chưa khả dụng",
//   không gọi signInWithOAuth, nút bật lại; signInWithOAuth trả lỗi hoặc throw → toast "không thành công", nút bật lại.
// - Bảo mật/phân quyền: chỉ gửi anon key tới /auth/v1/settings; không đọc điểm đến nào từ URL.
// - Ổn định/resilience: mọi lỗi của bước đọc settings đều coi như chưa khả dụng.
// - Invariant cần giữ: không có redirect khi provider tắt (SDK sẽ trả `error: null` dù provider tắt).
// - Kết quả verify gần nhất: passed (13 test) bằng `npx vitest run __tests__/components/google-sign-in-button.test.tsx`.

const SETTINGS_URL = "http://supabase.test/auth/v1/settings";
const UNAVAILABLE = "Đăng nhập Google hiện chưa khả dụng";
const FAILED = "Đăng nhập Google không thành công";

const fetchMock = vi.fn();

function settingsResponse(body: unknown, init: { ok?: boolean } = {}) {
  return { ok: init.ok ?? true, json: async () => body };
}

function clickGoogle() {
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập bằng Google" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubGlobal("fetch", fetchMock);
  mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GoogleSignInButton", () => {
  it.each([
    ["the provider is off", () => fetchMock.mockResolvedValue(settingsResponse({ external: { google: false } }))],
    ["the google field is missing", () => fetchMock.mockResolvedValue(settingsResponse({ external: {} }))],
    ["the external field is missing", () => fetchMock.mockResolvedValue(settingsResponse({}))],
    ["google is not exactly true", () => fetchMock.mockResolvedValue(settingsResponse({ external: { google: "true" } }))],
    ["the settings body is null", () => fetchMock.mockResolvedValue(settingsResponse(null))],
    ["the request returns a non-OK status", () => fetchMock.mockResolvedValue(settingsResponse({ external: { google: true } }, { ok: false }))],
    ["the request throws", () => fetchMock.mockRejectedValue(new Error("network"))],
    ["the body is invalid JSON", () => fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("bad json"); } })],
  ])("shows the unavailable toast, makes no OAuth call and re-enables the button when %s", async (_label, arrange) => {
    arrange();
    render(<GoogleSignInButton />);

    clickGoogle();

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(UNAVAILABLE));
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Đăng nhập bằng Google" }) as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("reads the settings with the anon key before redirecting", async () => {
    fetchMock.mockResolvedValue(settingsResponse({ external: { google: false } }));
    render(<GoogleSignInButton />);

    clickGoogle();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SETTINGS_URL);
    expect(init.headers).toEqual({ apikey: "anon-key" });
  });

  it("starts Google sign-in once with the callback URL and stays disabled while the browser leaves", async () => {
    fetchMock.mockResolvedValue(settingsResponse({ external: { google: true } }));
    render(<GoogleSignInButton />);
    const button = screen.getByRole("button", { name: "Đăng nhập bằng Google" }) as HTMLButtonElement;

    clickGoogle();

    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    await waitFor(() => expect(button.disabled).toBe(true));

    clickGoogle();
    await Promise.resolve();

    expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("disables the button while the settings check is still running", async () => {
    let resolveSettings: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => { resolveSettings = resolve; }));
    render(<GoogleSignInButton />);

    clickGoogle();
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Đăng nhập bằng Google" }) as HTMLButtonElement).disabled).toBe(true),
    );
    clickGoogle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveSettings(settingsResponse({ external: { google: false } }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["returns an error", () => mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: { message: "boom" } })],
    ["throws", () => mocks.signInWithOAuth.mockRejectedValue(new Error("boom"))],
  ])("shows the failure toast and re-enables the button when signInWithOAuth %s", async (_label, arrange) => {
    fetchMock.mockResolvedValue(settingsResponse({ external: { google: true } }));
    arrange();
    render(<GoogleSignInButton />);

    clickGoogle();

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(FAILED));
    expect(mocks.toastError).not.toHaveBeenCalledWith(UNAVAILABLE);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Đăng nhập bằng Google" }) as HTMLButtonElement).disabled).toBe(false),
    );
  });
});
