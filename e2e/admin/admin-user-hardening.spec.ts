import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminGateFixture, isolatedAdmin, prepareRevocableAdmin, removeRevocableAdmin } from "../../scripts/e2e/admin-gate-fixture.mjs";
import { loginAsStudent } from "../support/auth";
import { watchBrowserConsole } from "../support/console";

// Test plan:
// - Mục tiêu: AD7 self-edit thật qua browser/action/DB, vẫn sửa role người khác và từ chối phiên vừa bị thu quyền.
// - Loại test: E2E trên runtime cô lập 45441, form/RHF và Server Action thật, không mock request.
// - Case thành công: self-edit tại 1280/375/320px giữ role admin, lưu tên/username/phone; target khác đổi role được.
// - Case thất bại: admin có form mở rồi bị removed không lưu được, giữ input; request trang admin mới nhận 404.
// - Bảo mật/phân quyền: chỉ fixture revocable admin và một target tạo riêng, không sửa admin seed.
// - Ổn định/resilience: readback DB xác nhận persisted state; cleanup ở afterAll, không mở production/root.
// - Invariant cần giữ: UI disabled không làm mất giá trị role, server vẫn chặn sau khi thu quyền.
// - Kết quả verify gần nhất: passed (5 test), npx playwright test --config playwright.config.ts e2e/admin/admin-user-hardening.spec.ts
//   trên runtime đã reset; gateway cô lập đã restart sau lỗi upstream 502 của runner.

const service = () => isolatedAdmin(process.env);
let targetId: string;

test.beforeAll(async () => {
  const created = await service().auth.admin.createUser({
    email: `ad7-browser-${randomUUID()}@example.com`, email_confirm: true,
    app_metadata: { d7_server_created: true }, user_metadata: { full_name: "AD7 Browser Target", username: `ad7_${randomUUID()}` },
  });
  expect(created.error).toBeNull();
  targetId = created.data.user!.id;
});

test.beforeEach(async ({ page }) => {
  const credentials = await prepareRevocableAdmin(process.env);
  await loginAsStudent(page, credentials);
  await page.goto("/admin/user-management");
  await expect(page.getByRole("heading", { name: "Quản lý người dùng" })).toBeVisible();
});

test.afterAll(async () => {
  if (targetId) expect((await service().auth.admin.deleteUser(targetId)).error).toBeNull();
  await removeRevocableAdmin(process.env);
});

for (const width of [1280, 375, 320]) {
  test(`self-edit preserves admin role and saves personal fields at ${width}px`, async ({ page }) => {
    const consoleGuard = watchBrowserConsole(page);
    await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
    await page.getByRole("button", { name: `Chỉnh sửa ${adminGateFixture.fullName}` }).click();
    const role = page.getByRole("combobox", { name: "Vai trò", exact: true });
    await expect(role).toBeDisabled();
    await expect(page.getByText("Bạn không thể tự thay đổi vai trò của tài khoản đang đăng nhập.")).toBeVisible();
    await page.getByPlaceholder("VD: Nguyễn Văn A").fill(`AD7 Updated ${width}`);
    await page.getByPlaceholder("VD: nguyenvana").fill(`ad7_updated_${width}`);
    await page.getByPlaceholder("VD: 0987654321").fill("0987654321");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/ad7/self-edit-${width}.png` });
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(page.getByText("Chỉnh sửa thông tin", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Chỉnh sửa AD7 Updated ${width}` })).toBeVisible();
    const profile = await service().from("profiles").select("full_name,username,phone,role").eq("id", adminGateFixture.userId).single();
    expect(profile.error).toBeNull();
    expect(profile.data).toEqual({ full_name: `AD7 Updated ${width}`, username: `ad7_updated_${width}`, phone: "0987654321", role: "admin" });
    await consoleGuard.expectNoErrors();
  });
}

test("another account retains role editing", async ({ page }) => {
  await page.getByRole("button", { name: "Chỉnh sửa AD7 Browser Target" }).click();
  const role = page.getByRole("combobox", { name: "Vai trò", exact: true });
  await expect(role).toBeEnabled();
  await role.focus();
  await page.keyboard.press("Space");
  await page.getByRole("option", { name: "Giáo viên (Teacher)" }).click();
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByText("Chỉnh sửa thông tin", { exact: true })).toHaveCount(0);
  const profile = await service().from("profiles").select("role").eq("id", targetId).single();
  expect(profile.error).toBeNull(); expect(profile.data?.role).toBe("teacher");
});

test("a removed admin cannot submit an already-open form or make a fresh admin-page request", async ({ page }) => {
  await page.getByRole("button", { name: `Chỉnh sửa ${adminGateFixture.fullName}` }).click();
  await page.getByPlaceholder("VD: Nguyễn Văn A").fill("AD7 Denied Edit");
  expect((await service().from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", adminGateFixture.userId)).error).toBeNull();
  try {
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(page.getByText("Từ chối truy cập. Bạn không có quyền hạn quản trị viên.", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("VD: Nguyễn Văn A")).toHaveValue("AD7 Denied Edit");
    const profile = await service().from("profiles").select("full_name,role").eq("id", adminGateFixture.userId).single();
    expect(profile.error).toBeNull(); expect(profile.data).toEqual({ full_name: adminGateFixture.fullName, role: "admin" });
    await page.getByRole("button", { name: "Hủy bỏ" }).click();
    // Trang có thể đã được Next prefetch trước khi thu quyền; kiểm một request server mới, không cache đã cấp quyền.
    const response = await page.goto(`/admin/courses?ad7_fresh=${randomUUID()}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  } finally {
    expect((await service().from("profiles").update({ removed_at: null }).eq("id", adminGateFixture.userId)).error).toBeNull();
  }
});
