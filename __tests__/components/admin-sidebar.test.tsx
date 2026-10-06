// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import AdminSidebar from "@/components/ui/admin-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

// Test plan:
// - Mục tiêu: A5 AC9 — header sidebar admin hiện logo VocaSpace thay cho icon Codepen và chữ.
// - Loại test: component render trong jsdom (RTL), không mock dữ liệu.
// - Đối tượng: AdminSidebar (components/ui/admin-sidebar.tsx).
// - Case thành công: có ảnh alt="VocaSpace" trỏ tới logo gradient trong public/brand; menu quản trị vẫn đủ 5 mục.
// - Case thất bại: không áp dụng.
// - Bảo mật/phân quyền: không áp dụng (phân quyền admin nằm ở layout/Server Action).
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: logo là ảnh từ public/brand, không còn tiêu đề chữ thay logo.
// - Kết quả verify gần nhất: xem milestone A5 CP1 trong progress.md (`npx vitest run __tests__/components/admin-sidebar.test.tsx`).
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

  it("keeps the five admin menu links", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <AdminSidebar />
        </SidebarProvider>
      </TooltipProvider>,
    );

    for (const name of ["Dashboard", "Quản lý User", "Quản lý Khóa học", "Thống kê & Doanh thu", "Cài đặt hệ thống"]) {
      expect(screen.getByRole("link", { name })).toBeTruthy();
    }
  });
});
