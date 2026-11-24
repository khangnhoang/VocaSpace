// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@/__tests__/support/intl";
import Header from "@/components/ui/header";
import { PATHNAME_HEADER } from "@/lib/i18n/locked-areas";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), requestHeaders: new Map<string, string>() }));

vi.mock("@/utils/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/app/actions/auth", () => ({ signOutUser: vi.fn() }));
vi.mock("@/app/actions/locale", () => ({ setLocale: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));
// Chỉ thay nguồn dữ liệu request (header đường dẫn do proxy ghi); logic khóa trong request-locale.ts chạy thật.
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => mocks.requestHeaders.get(name) ?? null }),
  cookies: async () => ({ get: () => undefined }),
}));

// Test plan:
// - Mục tiêu: U9 AC2/AC5 - bộ chọn ngôn ngữ vắng trên not-found của khu bị khóa (desktop và menu mobile), có mặt ở nơi khác.
// - Loại test: component test với Header async thật (Supabase mock như english-shell.test.tsx), request giả chỉ ở nguồn header.
// - Case: khóa hoạt động (cờ tiếng Anh bật, bước B tắt) trên /teacher/missing và /admin/missing: không có bộ chọn;
//   trên URL học viên, /teachers và /administrator: có; bước B bật: có; Header không opt-in luôn có khi cờ bật.

async function renderNotFoundHeader(path: string) {
  mocks.requestHeaders.set(PATHNAME_HEADER, path);
  render(await Header({ hideSwitcherInLockedAreas: true }));
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  mocks.createClient.mockResolvedValue({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } });
  vi.stubEnv("ENGLISH_UI_ENABLED", "1");
  vi.stubEnv("ENGLISH_UI_STEP_B_ENABLED", undefined);
});

afterEach(() => {
  cleanup();
  mocks.requestHeaders.clear();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("language switcher on the not-found header", () => {
  it.each(["/teacher/missing", "/admin/missing"])("is absent on %s, desktop and mobile menu", async (path) => {
    await renderNotFoundHeader(path);
    expect(screen.queryByRole("group", { name: "Ngôn ngữ" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng tài khoản" }));
    expect(within(await screen.findByRole("dialog")).queryByRole("group", { name: "Ngôn ngữ" })).toBeNull();
  });

  it.each(["/does-not-exist", "/teachers", "/administrator"])("is shown on %s", async (path) => {
    await renderNotFoundHeader(path);
    expect(screen.getByRole("group", { name: "Ngôn ngữ" })).toBeTruthy();
  });

  it("is shown on a teacher URL once step B is on", async () => {
    vi.stubEnv("ENGLISH_UI_STEP_B_ENABLED", "1");
    await renderNotFoundHeader("/teacher/missing");
    expect(screen.getByRole("group", { name: "Ngôn ngữ" })).toBeTruthy();
  });

  it("stays on a header that does not opt in, even on a locked path", async () => {
    mocks.requestHeaders.set(PATHNAME_HEADER, "/teacher/missing");
    render(await Header());
    expect(screen.getByRole("group", { name: "Ngôn ngữ" })).toBeTruthy();
  });
});
