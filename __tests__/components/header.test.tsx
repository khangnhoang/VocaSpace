// @vitest-environment jsdom

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/ui/header";
import MobileAccountSheet from "@/components/ui/mobile-account-sheet";

type Scenario = {
  user: { id: string; email: string } | null;
  role?: string;
  membership?: boolean;
  pendingInvitation?: boolean;
};

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signOutUser: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/app/actions/auth", () => ({ signOutUser: mocks.signOutUser }));

// Test plan:
// - Mục tiêu: Header (async server component) cấp cùng dữ liệu quyền cho menu desktop và sheet mobile (F1 AC1–AC3, G3).
// - Loại test: orchestration của component async thật với client Supabase mock; render jsdom để so sánh hai menu.
// - Đối tượng: Header + MobileAccountSheet.
// - Case thành công: khách, học viên, thành viên khóa học, chỉ có lời mời đang chờ, teacher và admin — menu desktop và props của sheet khớp;
//   danh sách đích đến trong sheet đã mở bằng danh sách link của menu desktop đã mở.
// - Case thất bại: không có "Cài đặt" ở cả hai menu; người dùng thường không thấy link admin/khóa học.
// - Bảo mật/phân quyền: link admin chỉ khi profiles.role = 'admin'; Header là nơi duy nhất đọc profile/membership/lời mời.
// - Invariant cần giữ: nhãn khóa học "Lời mời cộng tác" chỉ khi có lời mời mà chưa là teacher/thành viên; cả hai menu link /teacher/courses.
// - Ghi chú: Supabase được mock vì test kiểm tra wiring dữ liệu → UI, không phải RLS; hành vi truy vấn thật nằm ngoài phạm vi.
// - Kết quả verify gần nhất: xem milestone F1 CP2 trong progress.md (`npx vitest run __tests__/components/header.test.tsx`).

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

function mockSupabase({ user, role = "student", membership = false, pendingInvitation = false }: Scenario) {
  mocks.createClient.mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: (name: string) => {
      if (name === "profiles") {
        return table({ data: { full_name: "Người dùng", avatar_url: null, role } });
      }
      if (name === "course_collaborators") {
        return table({ data: membership ? [{ id: "member-1" }] : [] });
      }
      if (name === "course_collaborator_invitations") {
        return table({ count: pendingInvitation ? 1 : 0 });
      }
      throw new Error(`Unexpected table ${name}`);
    },
  });
}

function findSheet(node: ReactNode): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === MobileAccountSheet) return node as ReactElement<Record<string, unknown>>;
  const children = node.props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findSheet(child);
    if (found) return found;
  }
  return null;
}

function destinations(root: HTMLElement) {
  // Mục menu desktop là <a role="menuitem">, nên lấy theo thẻ <a> thay vì role link.
  return Array.from(root.querySelectorAll("a[href]"))
    .filter((link) => link.getAttribute("href") !== "/")
    .map((link) => [link.textContent?.trim(), link.getAttribute("href")]);
}

const preventNavigation = (event: Event) => {
  if ((event.target as Element).closest("a")) event.preventDefault();
};

beforeEach(() => {
  document.addEventListener("click", preventNavigation);
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  document.removeEventListener("click", preventNavigation);
  cleanup();
  vi.clearAllMocks();
});

const user = { id: "user-1", email: "user@example.com" };

const signedInScenarios: Array<{
  name: string;
  scenario: Scenario;
  expected: Array<[string, string]>;
  sheetProps: { isAdmin: boolean; courseWorkspaceLabel: string | null };
}> = [
  {
    name: "a student with no workspace",
    scenario: { user },
    expected: [["Không gian học tập", "/learn"], ["Hồ sơ cá nhân", "/profile"]],
    sheetProps: { isAdmin: false, courseWorkspaceLabel: null },
  },
  {
    name: "a member-only student",
    scenario: { user, membership: true },
    expected: [["Không gian học tập", "/learn"], ["Hồ sơ cá nhân", "/profile"], ["Khóa học của tôi", "/teacher/courses"]],
    sheetProps: { isAdmin: false, courseWorkspaceLabel: "Khóa học của tôi" },
  },
  {
    name: "an invitation-only student",
    scenario: { user, pendingInvitation: true },
    expected: [["Không gian học tập", "/learn"], ["Hồ sơ cá nhân", "/profile"], ["Lời mời cộng tác", "/teacher/courses"]],
    sheetProps: { isAdmin: false, courseWorkspaceLabel: "Lời mời cộng tác" },
  },
  {
    name: "a teacher",
    scenario: { user, role: "teacher" },
    expected: [["Không gian học tập", "/learn"], ["Hồ sơ cá nhân", "/profile"], ["Khóa học của tôi", "/teacher/courses"]],
    sheetProps: { isAdmin: false, courseWorkspaceLabel: "Khóa học của tôi" },
  },
  {
    name: "an admin with no workspace",
    scenario: { user, role: "admin" },
    expected: [["Không gian học tập", "/learn"], ["Hồ sơ cá nhân", "/profile"], ["Quản trị hệ thống", "/admin"]],
    sheetProps: { isAdmin: true, courseWorkspaceLabel: null },
  },
];

describe("Header account menus", () => {
  it.each(signedInScenarios)(
    "gives $name the same destinations in the desktop menu and the mobile sheet",
    async ({ scenario, expected, sheetProps }) => {
      mockSupabase(scenario);

      const element = await Header();

      expect(findSheet(element)?.props).toMatchObject({ isAuthenticated: true, ...sheetProps });

      const { container } = render(element);
      // Trigger menu desktop là nút avatar; tên truy cập của nó chính là chữ cái đầu của họ tên.
      fireEvent.keyDown(screen.getByRole("button", { name: "N" }), { key: "Enter" });
      const menu = await screen.findByRole("menu");
      expect(destinations(menu)).toEqual(expected);
      expect(within(menu).queryByText("Cài đặt")).toBeNull();
      expect(within(menu).getByRole("button", { name: /Đăng xuất/ })).toBeTruthy();

      fireEvent.click(within(container).getByRole("button", { name: "Mở điều hướng tài khoản" }));
      const dialog = await screen.findByRole("dialog", { name: "Điều hướng tài khoản" });
      expect(destinations(dialog)).toEqual(expected);
      expect(within(dialog).queryByText("Cài đặt")).toBeNull();
      expect(within(dialog).getByRole("button", { name: "Đăng xuất" })).toBeTruthy();
    },
  );

  it("gives a signed-out visitor login and register in both the desktop header and the mobile sheet", async () => {
    mockSupabase({ user: null });

    const element = await Header();

    expect(findSheet(element)?.props).toMatchObject({
      isAuthenticated: false,
      isAdmin: false,
      courseWorkspaceLabel: null,
    });

    const { container } = render(element);
    const expected = [["Đăng nhập", "/login"], ["Đăng ký ngay", "/register"]];
    expect(destinations(container)).toEqual(expected);

    fireEvent.click(within(container).getByRole("button", { name: "Mở điều hướng tài khoản" }));
    const dialog = await screen.findByRole("dialog", { name: "Điều hướng tài khoản" });
    await waitFor(() => expect(destinations(dialog)).toEqual(expected));
  });
});
