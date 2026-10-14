import { expect, test, type Page } from "@playwright/test";
import {
  prepareRevocableAdmin,
  removeRevocableAdmin,
  revokeAdminRole,
} from "../../scripts/e2e/admin-gate-fixture.mjs";
import { loginAsStudent, loginAsTeacher } from "../support/auth";

// Test plan:
// - Mục tiêu: AD1 — chỉ admin đang hoạt động render được trang /admin; khách bị đưa về đăng nhập; người khác nhận trang 404.
// - Loại test: smoke E2E trên runtime Supabase cô lập (API 45441) với tài khoản seed student/teacher/admin và một admin tạo riêng cho case thu quyền.
// - Case thành công: admin mở /admin từ menu tài khoản, thấy đúng 3 link sidebar (Dashboard, Quản lý User, Quản lý khóa học), điều hướng client
//   sang "Quản lý User" rồi "Quản lý khóa học"; /admin/courses trả 200 kèm khung admin (AD3 AC1).
// - Case thất bại:
//   - Khách vào /admin/user-management và /admin/courses bị chuyển về /login?reason=signin_required (redirect thắng 404).
//   - Student và teacher vào /admin, /admin/user-management và /admin/courses nhận trang not-found, không có sidebar/nội dung admin.
//   - Admin vào /admin/stats, /admin/settings (route chưa có) nhận trang not-found.
// - Bảo mật/phân quyền: admin bị thu quyền khi đang ở /admin rồi bấm "Quản lý User" hoặc "Quản lý khóa học", và khi đang ở /admin/user-management rồi bấm "Dashboard" (điều hướng client, không reload) vẫn nhận 404 vì mỗi page tự kiểm tra (AC3).
// - Ghi chú giới hạn:
//   - Spec chạy trên `next dev`; status 404 của document trên build production được kiểm bằng script riêng
//     (scripts/e2e/admin-gate-status-check.mjs).
//   - Admin bị gỡ (removed_at) được kiểm ở unit test của requireAdminPage; seed không có admin bị gỡ.
// - Verify: xem State AD1 trong docs/programs/admin-console/progress.md.

const NOT_FOUND_HEADING = "Không tìm thấy trang";

async function expectNotFoundWithoutAdminShell(page: Page) {
  await expect(page.getByRole("heading", { name: NOT_FOUND_HEADING })).toBeVisible();
  await expect(page.getByText("Menu Quản Trị")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Quản lý User" })).toHaveCount(0);
  await expect(page.getByText("Tổng quan Quản trị")).toHaveCount(0);
}

async function loginAsAdmin(page: Page) {
  await loginAsStudent(page, { E2E_STUDENT_EMAIL: "admin@gmail.com", E2E_STUDENT_PASSWORD: "123123" });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("guest is sent to sign in from the admin pages, including the course screen", async ({ page }) => {
  for (const path of ["/admin/user-management", "/admin/courses"]) {
    await page.goto(`${path}?next=https://evil.example`);
    await expect(page).toHaveURL(/\/login\?reason=signin_required$/);
  }
});

for (const role of ["student", "teacher"] as const) {
  test(`${role} gets the not-found page on admin pages without any admin content`, async ({ page }) => {
    if (role === "teacher") {
      await loginAsTeacher(page, { E2E_TEACHER_EMAIL: "teacher@gmail.com", E2E_TEACHER_PASSWORD: "123123" });
    } else {
      await loginAsStudent(page, { E2E_STUDENT_EMAIL: "student@gmail.com", E2E_STUDENT_PASSWORD: "123123" });
    }

    for (const path of ["/admin", "/admin/user-management", "/admin/courses"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expectNotFoundWithoutAdminShell(page);
    }
  });
}

test("admin opens the dashboard from the account menu and reaches user management by client navigation", async ({
  page,
}) => {
  await loginAsAdmin(page);

  await page.getByRole("button", { name: "Mở menu tài khoản", exact: true }).click();
  await page.getByRole("menuitem", { name: "Quản trị hệ thống" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Tổng quan Quản trị")).toBeVisible();

  const sidebarLinks = page.locator('[data-slot="sidebar-content"]').getByRole("link");
  await expect(sidebarLinks).toHaveText(["Dashboard", "Quản lý User", "Quản lý khóa học"]);
  await expect(sidebarLinks.nth(0)).toHaveAttribute("data-active", "true");
  await expect(sidebarLinks.nth(1)).toHaveAttribute("data-active", "false");
  await expect(sidebarLinks.nth(2)).toHaveAttribute("data-active", "false");

  await sidebarLinks.nth(1).click();
  await expect(page).toHaveURL(/\/admin\/user-management$/);
  await expect(page.getByText("Thông tin người dùng")).toBeVisible();
  await expect(page.getByText("student@gmail.com")).toBeVisible();
  await expect(sidebarLinks.nth(0)).toHaveAttribute("data-active", "false");
  await expect(sidebarLinks.nth(1)).toHaveAttribute("data-active", "true");

  await sidebarLinks.nth(2).click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await expect(page.getByRole("heading", { name: "Quản lý khóa học", level: 1 })).toBeVisible();
  await expect(sidebarLinks.nth(1)).toHaveAttribute("data-active", "false");
  await expect(sidebarLinks.nth(2)).toHaveAttribute("data-active", "true");
});

test("admin gets the course screen with the admin shell on a direct visit", async ({ page }) => {
  await loginAsAdmin(page);

  const response = await page.goto("/admin/courses");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Quản lý khóa học", level: 1 })).toBeVisible();
  await expect(page.getByText("Menu Quản Trị")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Lọc khóa học theo trạng thái" })).toBeVisible();
});

test("admin gets the not-found page on the stats and settings routes", async ({ page }) => {
  await loginAsAdmin(page);

  for (const path of ["/admin/stats", "/admin/settings"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expectNotFoundWithoutAdminShell(page);
  }
});

// Mỗi hướng điều hướng client kiểm tra page đích tự gọi requireAdminPage(): layout admin đang mount nên không được tin (AC3).
const REVOCATION_CASES = [
  { from: "/admin", visible: "Tổng quan Quản trị", link: "Quản lý User" },
  { from: "/admin", visible: "Tổng quan Quản trị", link: "Quản lý khóa học" },
  { from: "/admin/user-management", visible: "Thông tin người dùng", link: "Dashboard" },
] as const;

for (const { from, visible, link } of REVOCATION_CASES) {
  test(`admin who loses the role on ${from} gets the not-found page on the ${link} client navigation without a reload`, async ({
    page,
  }) => {
    let failed = false;
    try {
      const credentials = await prepareRevocableAdmin();
      await loginAsStudent(page, credentials);
      await page.goto(from);
      await expect(page.getByText(visible)).toBeVisible();

      await revokeAdminRole();

      // Không page.goto/reload: layout admin vẫn đang mount, nên chỉ kiểm tra theo từng page mới chặn được (AC3).
      await page.locator('[data-slot="sidebar-content"]').getByRole("link", { name: link }).click();
      await expectNotFoundWithoutAdminShell(page);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      // Dọn luôn chạy, kể cả khi chuẩn bị dở dang; lỗi dọn làm test fail nhưng không che lỗi gốc của test.
      try {
        await removeRevocableAdmin();
      } catch (cleanupError) {
        if (!failed) throw cleanupError;
        console.error(cleanupError);
      }
    }
  });
}
