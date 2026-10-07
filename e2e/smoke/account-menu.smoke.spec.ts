import { expect, test } from "@playwright/test";
import { loginAsStudent, loginAsTeacher } from "../support/auth";

// Test plan:
// - Mục tiêu: menu tài khoản thật hiển thị ngay lần mở đầu và sau client navigation.
// - Loại: browser local với tài khoản seed; không mock dropdown hoặc quyền từ Header.
// - Case: học viên, teacher, admin; đóng bằng Escape, mở lại, mobile và khách.
// - Giới hạn: membership/invitation variants được kiểm tra ở component; không kiểm tra production.
// - Verify: xem State D6 trong progress.md.
for (const role of ["student", "teacher", "admin"] as const) {
  test(`${role} account menu opens on first click and after navigation`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    if (role === "teacher") {
      await loginAsTeacher(page, { E2E_TEACHER_EMAIL: "teacher@gmail.com", E2E_TEACHER_PASSWORD: "123123" });
    } else {
      await loginAsStudent(page, { E2E_STUDENT_EMAIL: `${role}@gmail.com`, E2E_STUDENT_PASSWORD: "123123" });
    }
    const trigger = page.getByRole("button", { name: "Mở menu tài khoản", exact: true });
    const menu = page.getByRole("menu");
    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Không gian học tập" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Hồ sơ cá nhân" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Quản trị hệ thống" })).toHaveCount(role === "admin" ? 1 : 0);
    await expect(menu.getByRole("menuitem", { name: "Khóa học của tôi" })).toHaveCount(role === "student" ? 0 : 1);
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    await expect(menu.getByRole("menuitem", { name: "Hồ sơ cá nhân" })).toBeVisible();
    await menu.getByRole("menuitem", { name: "Hồ sơ cá nhân" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await trigger.click();
    await expect(menu.getByRole("menuitem", { name: "Không gian học tập" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 375, height: 800 });
    await page.getByRole("button", { name: "Mở điều hướng tài khoản" }).click();
    const sheet = page.getByRole("dialog", { name: "Điều hướng tài khoản" });
    await expect(sheet.getByRole("link", { name: "Không gian học tập" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Hồ sơ cá nhân" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible();
  });
}

test("guest account navigation retains login and registration", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng ký ngay", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole("button", { name: "Mở điều hướng tài khoản" }).click();
  const sheet = page.getByRole("dialog", { name: "Điều hướng tài khoản" });
  await expect(sheet.getByRole("link", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Đăng ký ngay", exact: true })).toBeVisible();
});
