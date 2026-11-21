// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MobileAccountSheet from "@/components/ui/mobile-account-sheet";

const mocks = vi.hoisted(() => ({ signOutUser: vi.fn() }));

vi.mock("@/app/actions/auth", () => ({ signOutUser: mocks.signOutUser }));

// Test plan:
// - Mục tiêu: sheet tài khoản trên mobile có cùng đích đến với menu desktop cho khách, học viên, thành viên khóa học và admin (F1 AC1–AC3).
// - Loại test: component interaction (RTL, jsdom).
// - Đối tượng: MobileAccountSheet.
// - Case thành công: mọi người thấy "Trang chủ" (/) và "Khóa học" (/courses) phía trên mục tài khoản (U1 AC11);
//   khách thấy "Đăng nhập" (/login) và "Đăng ký ngay" (/register); người đã đăng nhập thấy "Không gian học tập", "Hồ sơ cá nhân",
//   link khóa học theo nhãn do Header truyền (href từ getTeacherCourseListPath), "Quản trị hệ thống" chỉ khi isAdmin, và "Đăng xuất" gọi signOutUser;
//   bấm link đóng sheet.
// - Case thất bại: không có "Cài đặt"; khách không thấy link học viên/admin/khóa học dù prop được truyền; người dùng thường không thấy link admin/khóa học.
// - Bảo mật/phân quyền: link admin và khóa học chỉ phụ thuộc prop từ server wiring (Header), sheet không tự truy vấn profile.
// - Ổn định/resilience: không áp dụng (không có async trong sheet).
// - Invariant cần giữ: Escape/phím đóng và trả focus về nút mở do Radix Dialog; được kiểm tra bằng browser QA ở CP2, không lặp lại ở đây.
// - Kết quả verify gần nhất: xem milestone F1 CP2 trong progress.md (`npx vitest run __tests__/components/mobile-account-sheet.test.tsx`).

// jsdom chưa cài đặt điều hướng thật khi bấm link; chặn mặc định sau khi React đã xử lý click để tránh nhiễu log.
const preventNavigation = (event: Event) => {
  if ((event.target as Element).closest("a")) event.preventDefault();
};

beforeEach(() => {
  document.addEventListener("click", preventNavigation);
  // jsdom không có matchMedia; sheet dùng nó để tự đóng khi lên desktop.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  mocks.signOutUser.mockReset();
});

afterEach(() => {
  document.removeEventListener("click", preventNavigation);
  cleanup();
});

function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng tài khoản" }));
  return screen.findByRole("dialog", { name: "Điều hướng tài khoản" });
}

// Điều hướng chính nằm trong nav riêng, giống nhau cho mọi người; các test tài khoản chỉ so phần còn lại.
function links(dialog: HTMLElement) {
  return within(dialog)
    .queryAllByRole("link")
    .filter((link) => !link.closest('nav[aria-label="Điều hướng chính"]'))
    .map((link) => [link.textContent?.trim(), link.getAttribute("href")]);
}

describe("MobileAccountSheet", () => {
  it.each([false, true])(
    "lists Trang chủ and Khóa học above the account items (signed in: %s)",
    async (isAuthenticated) => {
      render(<MobileAccountSheet isAuthenticated={isAuthenticated} />);

      const dialog = await openSheet();
      const nav = within(dialog).getByRole("navigation", { name: "Điều hướng chính" });

      expect(
        within(nav)
          .getAllByRole("link")
          .map((link) => [link.textContent?.trim(), link.getAttribute("href")]),
      ).toEqual([
        ["Trang chủ", "/"],
        ["Khóa học", "/courses"],
      ]);
      const firstAccountLink = within(dialog).getAllByRole("link").find((link) => !nav.contains(link));
      expect(nav.compareDocumentPosition(firstAccountLink!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );

  it("offers a signed-out visitor the login and register links and closes after following one", async () => {
    render(<MobileAccountSheet isAuthenticated={false} isAdmin courseWorkspaceLabel="Khóa học của tôi" />);

    const dialog = await openSheet();

    expect(links(dialog)).toEqual([
      ["Đăng nhập", "/login"],
      ["Đăng ký ngay", "/register"],
    ]);
    expect(within(dialog).queryByRole("button", { name: /Đăng xuất/ })).toBeNull();

    fireEvent.click(within(dialog).getByRole("link", { name: "Đăng ký ngay" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers a signed-in student the learner destinations, sign out and no dead settings row", async () => {
    render(<MobileAccountSheet isAuthenticated email="student@example.com" fullName="Học viên" />);

    const dialog = await openSheet();

    expect(links(dialog)).toEqual([
      ["Không gian học tập", "/learn"],
      ["Hồ sơ cá nhân", "/profile"],
    ]);
    expect(within(dialog).queryByText("Cài đặt")).toBeNull();
    expect(within(dialog).queryByText("Quản trị hệ thống")).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(mocks.signOutUser).toHaveBeenCalledTimes(1));
  });

  it.each(["Khóa học của tôi", "Lời mời cộng tác"])(
    "shows the course workspace link labelled %s from the server wiring",
    async (label) => {
      render(<MobileAccountSheet isAuthenticated courseWorkspaceLabel={label} />);

      const dialog = await openSheet();

      expect(links(dialog)).toContainEqual([label, "/teacher/courses"]);
    },
  );

  it("shows the admin link only when flagged, between the profile and course links like the desktop menu", async () => {
    render(<MobileAccountSheet isAuthenticated isAdmin courseWorkspaceLabel="Khóa học của tôi" />);

    const dialog = await openSheet();

    expect(links(dialog)).toEqual([
      ["Không gian học tập", "/learn"],
      ["Hồ sơ cá nhân", "/profile"],
      ["Quản trị hệ thống", "/admin"],
      ["Khóa học của tôi", "/teacher/courses"],
    ]);
  });

  it("closes the sheet after following a signed-in link", async () => {
    render(<MobileAccountSheet isAuthenticated />);

    const dialog = await openSheet();
    fireEvent.click(within(dialog).getByRole("link", { name: "Hồ sơ cá nhân" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
