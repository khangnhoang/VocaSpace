// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@/__tests__/support/intl";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import HomeFooter from "@/app/(client)/_components/home/HomeFooter";
import Header from "@/components/ui/header";
import MobileAccountSheet from "@/components/ui/mobile-account-sheet";

// Test plan:
// - Mục tiêu: English localization U1 AC2 - đường đã chuyển đổi (header, menu mobile, not-found, footer trang chủ) hiện tiếng
//   Anh khi ngôn ngữ của request là `en`, gồm cả tên truy cập (aria-label) và title not-found.
// - Loại test: render jsdom qua provider next-intl dùng chung (client) và cấu hình request bản test (server component);
//   Supabase được mock như test Header hiện có. Tiếng Việt đã được các test hiện có kiểm đúng nguyên văn.
// - Case: khách và người đăng nhập là admin kiêm thành viên khóa học (desktop và mobile); người chỉ có lời mời thấy nhãn lời mời;
//   footer có nhãn mạng xã hội chèn tên mạng. Trang not-found tiếng Anh có test riêng (cần mock Header).

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/utils/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/app/actions/auth", () => ({ signOutUser: vi.fn() }));
vi.mock("@/app/actions/locale", () => ({ setLocale: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

type Account = { role: string; membership: boolean; invitation: boolean } | null;

function table(result: unknown) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    limit: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function mockAccount(account: Account) {
  mocks.createClient.mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: account ? { id: "user-1", email: "user@example.com" } : null } }) },
    from: (name: string) => {
      if (name === "profiles") return table({ data: { full_name: null, avatar_url: null, role: account?.role } });
      if (name === "course_collaborators") return table({ data: account?.membership ? [{ id: "m-1" }] : [] });
      if (name === "course_collaborator_invitations") return table({ count: account?.invitation ? 1 : 0 });
      throw new Error(`Unexpected table ${name}`);
    },
  });
}

async function renderHeaderInEnglish(account: Account) {
  mockAccount(account);
  render(await Header(), { locale: "en" });
}

beforeEach(() => {
  setServerTestLocale("en");
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  setServerTestLocale("vi");
  vi.clearAllMocks();
});

describe("site header in English", () => {
  it("names the main navigation and guest actions in English", async () => {
    await renderHeaderInEnglish(null);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Home", "Courses", "Learn"]);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/register");
  });

  it("labels the signed-in account menu in English", async () => {
    await renderHeaderInEnglish({ role: "admin", membership: true, invitation: false });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Open account menu" }), { button: 0, ctrlKey: false });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("VocaSpace learner")).toBeTruthy();
    for (const label of ["Learning space", "Profile", "Administration", "My courses", "Sign out"]) {
      expect(within(menu).getByText(label)).toBeTruthy();
    }
  });

  it("passes the translated invitation label to the mobile menu", async () => {
    await renderHeaderInEnglish({ role: "student", membership: false, invitation: true });

    fireEvent.click(screen.getByRole("button", { name: "Open account navigation" }));
    const sheet = await screen.findByRole("dialog", { name: "Account navigation" });
    expect(within(sheet).getByRole("link", { name: "Collaboration invitations" }).getAttribute("href")).toBe("/teacher/courses");
  });
});

describe("mobile account menu in English", () => {
  it("shows a guest the English identity, navigation and actions", async () => {
    render(<MobileAccountSheet isAuthenticated={false} />, { locale: "en" });
    fireEvent.click(screen.getByRole("button", { name: "Open account navigation" }));

    const sheet = await screen.findByRole("dialog", { name: "Account navigation" });
    expect(within(sheet).getByText("Account options and learning navigation.")).toBeTruthy();
    expect(within(sheet).getByText("VocaSpace guest")).toBeTruthy();
    expect(within(sheet).getByText("Not signed in")).toBeTruthy();
    const nav = within(sheet).getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Home", "Courses"]);
    expect(within(sheet).getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Sign up" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Close account navigation" })).toBeTruthy();
  });

  it("shows a signed-in learner the English destinations and encouragement", async () => {
    render(
      <MobileAccountSheet isAuthenticated fullName="Lan" email="lan@example.com" isAdmin courseWorkspaceLabel="My courses" />,
      { locale: "en" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Open account navigation" }));

    const sheet = await screen.findByRole("dialog", { name: "Account navigation" });
    for (const name of ["Learning space", "Profile", "Administration", "My courses"]) {
      expect(within(sheet).getByRole("link", { name })).toBeTruthy();
    }
    expect(within(sheet).getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(within(sheet).getByText("Learn every day")).toBeTruthy();
    expect(within(sheet).getByText("Get a little closer to your goal.")).toBeTruthy();
  });
});

describe("homepage footer in English", () => {
  it("shows the English tagline, columns, legal links and copyright", () => {
    render(<HomeFooter socialLinks={[{ network: "youtube", href: "https://www.youtube.com/@vocaspace" }]} />, { locale: "en" });

    expect(
      screen.getByText("A vocabulary platform with flashcards and personal review schedules, for English learners and teachers."),
    ).toBeTruthy();
    expect(screen.getByRole("list", { name: "VocaSpace on social media" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "VocaSpace on YouTube (opens in a new tab)" })).toBeTruthy();
    const explore = screen.getByRole("navigation", { name: "Explore" });
    expect(within(explore).getAllByRole("link").map((link) => link.textContent)).toEqual(["Courses", "Learn", "For teachers"]);
    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(within(legal).getAllByRole("link").map((link) => link.textContent)).toEqual(["Privacy policy", "Terms of use"]);
    expect(screen.getByText("© 2026 VocaSpace. All rights reserved.")).toBeTruthy();
  });
});
