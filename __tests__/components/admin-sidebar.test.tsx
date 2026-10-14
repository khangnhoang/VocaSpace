// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSidebar from "@/components/ui/admin-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const navigation = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

// Test plan:
// - Mục tiêu: A5 AC9 — header sidebar admin hiện logo VocaSpace thay cho icon Codepen và chữ.
// - Loại test: component render trong jsdom (RTL), không mock dữ liệu.
// - Đối tượng: AdminSidebar (components/ui/admin-sidebar.tsx).
// - Case thành công: có ảnh alt="VocaSpace" trỏ tới logo gradient trong public/brand; menu quản trị chỉ còn 2 mục có route thật
//   (AD1 AC5, AD3 AC1: Dashboard, Quản lý User, Quản lý khóa học theo đúng thứ tự); Dashboard chỉ active ở /admin,
//   Quản lý User và Quản lý khóa học active ở route của mình và đường dẫn con.
// - Case thất bại: các mục chưa có route (Thống kê & Doanh thu, Cài đặt hệ thống) không có trong menu.
// - Bảo mật/phân quyền: không áp dụng (phân quyền admin nằm ở layout/Server Action).
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: logo là ảnh từ public/brand, không còn tiêu đề chữ thay logo.
// - Kết quả verify gần nhất: xem milestone AD1 CP3 trong progress.md (`npx vitest run __tests__/components/admin-sidebar.test.tsx`).
// - Ghi chú: độ tương phản logo/nền sidebar và 375 px/1280 px kiểm bằng browser QA, không nằm trong test này.

beforeAll(() => {
  // jsdom không có matchMedia; SidebarProvider cần cho hook nhận biết mobile.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
});

// Link của menu nằm trong sidebar-content; logo ở header là một link riêng về trang chủ.
function menuLinks() {
  const content = document.querySelector<HTMLElement>('[data-slot="sidebar-content"]');
  if (!content) throw new Error("sidebar-content not found");
  return within(content).getAllByRole("link");
}

function renderSidebar() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <AdminSidebar />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  navigation.pathname = "/admin";
});

describe("AdminSidebar", () => {
  it("shows the VocaSpace logo image from public/brand in the header", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <AdminSidebar />
        </SidebarProvider>
      </TooltipProvider>,
    );

    const logo = screen.getByRole("img", { name: "VocaSpace" });
    expect(logo.getAttribute("src")).toContain("vocaspace-logo.svg");
    expect(screen.queryByRole("heading", { name: "VocaSpace" })).toBeNull();
  });

  it("links the logo to the home page", () => {
    renderSidebar();

    const link = screen.getByRole("link", { name: "VocaSpace" });
    expect(link.getAttribute("href")).toBe("/");
    expect(within(link).getByRole("img", { name: "VocaSpace" }).getAttribute("src")).toContain("vocaspace-logo.svg");
    // Logo không thuộc menu quản trị và không nhận trạng thái đang chọn.
    expect(link.getAttribute("data-active")).toBeNull();
  });

  it("lists exactly the three admin links that have a page", () => {
    renderSidebar();

    const links = menuLinks().map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links).toEqual([
      ["Dashboard", "/admin"],
      ["Quản lý User", "/admin/user-management"],
      ["Quản lý khóa học", "/admin/courses"],
    ]);
    for (const name of ["Thống kê & Doanh thu", "Cài đặt hệ thống"]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
  });

  it.each([
    ["/admin", "Dashboard"],
    ["/admin/user-management", "Quản lý User"],
    ["/admin/user-management/some-sub-path", "Quản lý User"],
    ["/admin/courses", "Quản lý khóa học"],
    ["/admin/courses/some-sub-path", "Quản lý khóa học"],
  ])("marks only the matching link active on %s", (pathname, activeName) => {
    navigation.pathname = pathname;
    renderSidebar();

    const active = menuLinks()
      .filter((link) => link.getAttribute("data-active") === "true")
      .map((link) => link.textContent);
    expect(active).toEqual([activeName]);
  });
});
