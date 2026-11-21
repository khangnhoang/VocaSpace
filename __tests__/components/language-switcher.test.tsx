// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@/__tests__/support/intl";
import Header from "@/components/ui/header";
import LanguageSwitcher from "@/components/ui/language-switcher";
import MobileAccountSheet from "@/components/ui/mobile-account-sheet";

// Test plan:
// - Mục tiêu: English localization U1 AC1/AC3, quyết định 7 - bộ chọn VI/EN ở header desktop và menu tài khoản mobile, chỉ khi
//   cờ giao diện tiếng Anh bật.
// - Loại test: component interaction (jsdom) qua provider next-intl dùng chung; action `setLocale` và router được mock vì
//   hành vi ghi cookie đã có test action riêng, còn làm mới trang thật được kiểm ở bản build.
// - Case thành công: nhóm có nhãn theo ngôn ngữ đang dùng, mục hiện tại được đánh dấu; chọn ngôn ngữ khác gọi action với đúng giá
//   trị rồi mới làm mới route; trong lúc chờ các nút bị khóa.
// - Case thất bại: chọn lại ngôn ngữ hiện tại không gọi action; action từ chối hoặc request hỏng thì không làm mới và trang giữ
//   nguyên.
// - Theo cờ: cờ tắt thì Header và menu mobile không có bộ chọn; cờ bật thì có ở cả hai.

const mocks = vi.hoisted(() => ({
  setLocale: vi.fn(),
  refresh: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/app/actions/locale", () => ({ setLocale: mocks.setLocale }));
vi.mock("@/app/actions/auth", () => ({ signOutUser: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  mocks.createClient.mockResolvedValue({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("LanguageSwitcher", () => {
  it.each([
    ["vi", "Ngôn ngữ", "VI (Tiếng Việt)"],
    ["en", "Language", "EN (English)"],
  ] as const)("labels the group in %s and marks the current language", (locale, label, current) => {
    render(<LanguageSwitcher />, { locale });
    const group = screen.getByRole("group", { name: label });
    expect(within(group).getByRole("button", { name: current }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getAllByRole("button", { pressed: false })).toHaveLength(1);
  });

  it("stores the chosen language, then refreshes the current route", async () => {
    let finish: (value: { ok: boolean }) => void = () => {};
    mocks.setLocale.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<LanguageSwitcher />, { locale: "vi" });

    fireEvent.click(screen.getByRole("button", { name: "EN (English)" }));
    expect(mocks.setLocale).toHaveBeenCalledExactlyOnceWith("en");
    await waitFor(() => expect((screen.getByRole("button", { name: "VI (Tiếng Việt)" }) as HTMLButtonElement).disabled).toBe(true));
    expect(mocks.refresh).not.toHaveBeenCalled();

    await act(async () => finish({ ok: true }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("button", { name: "EN (English)" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("does nothing when the current language is chosen again", () => {
    render(<LanguageSwitcher />, { locale: "en" });
    fireEvent.click(screen.getByRole("button", { name: "EN (English)" }));
    expect(mocks.setLocale).not.toHaveBeenCalled();
  });

  it("keeps the page as it is when the action refuses the change", async () => {
    mocks.setLocale.mockResolvedValue({ ok: false });
    render(<LanguageSwitcher />, { locale: "vi" });
    fireEvent.click(screen.getByRole("button", { name: "EN (English)" }));
    await waitFor(() => expect(mocks.setLocale).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByRole("button", { name: "EN (English)" }) as HTMLButtonElement).disabled).toBe(false));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("keeps the page as it is when the request fails", async () => {
    mocks.setLocale.mockRejectedValue(new Error("network"));
    render(<LanguageSwitcher />, { locale: "vi" });
    fireEvent.click(screen.getByRole("button", { name: "EN (English)" }));
    await waitFor(() => expect(mocks.setLocale).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByRole("button", { name: "EN (English)" }) as HTMLButtonElement).disabled).toBe(false));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "VI (Tiếng Việt)" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("language switcher placement", () => {
  async function renderHeader() {
    render(await Header());
  }

  it("is absent from the header and the mobile menu while the flag is off", async () => {
    await renderHeader();
    expect(screen.queryByRole("group", { name: "Ngôn ngữ" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng tài khoản" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("group", { name: "Ngôn ngữ" })).toBeNull();
  });

  it("appears in the desktop header and the mobile menu while the flag is on", async () => {
    vi.stubEnv("ENGLISH_UI_ENABLED", "1");
    await renderHeader();
    expect(screen.getByRole("group", { name: "Ngôn ngữ" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng tài khoản" }));
    const sheet = await screen.findByRole("dialog");
    const group = within(sheet).getByRole("group", { name: "Ngôn ngữ" });
    expect(within(group).getByText("Ngôn ngữ").classList.contains("sr-only")).toBe(false);
  });

  it("shows the switcher in the mobile menu only when Header asks for it", () => {
    render(<MobileAccountSheet isAuthenticated={false} showLanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng tài khoản" }));
    expect(within(screen.getByRole("dialog")).getByRole("group", { name: "Ngôn ngữ" })).toBeTruthy();
  });
});
