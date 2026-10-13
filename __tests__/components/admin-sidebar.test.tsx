// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
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
//   (AD1 AC5: Dashboard, Quản lý User); Dashboard chỉ active ở /admin, Quản lý User active ở /admin/user-management và đường dẫn con.
// - Case thất bại: các mục không có route (Khóa học, Thống kê & Doanh thu, Cài đặt hệ thống) không còn trong menu.
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

  it("lists exactly the two admin links that have a page", () => {
    renderSidebar();

    const links = screen
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links).toEqual([
      ["Dashboard", "/admin"],
      ["Quản lý User", "/admin/user-management"],
    ]);
    for (const name of ["Quản lý Khóa học", "Thống kê & Doanh thu", "Cài đặt hệ thống"]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
  });

  it.each([
    ["/admin", "Dashboard"],
    ["/admin/user-management", "Quản lý User"],
    ["/admin/user-management/some-sub-path", "Quản lý User"],
  ])("marks only the matching link active on %s", (pathname, activeName) => {
    navigation.pathname = pathname;
    renderSidebar();

    const active = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("data-active") === "true")
      .map((link) => link.textContent);
    expect(active).toEqual([activeName]);
  });
});
