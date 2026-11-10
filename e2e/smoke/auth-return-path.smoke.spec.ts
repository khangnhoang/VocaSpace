import { expect, test, type Page } from "@playwright/test";

// Test plan:
// - Mục tiêu: U3 AC7 qua proxy + Server Action + trang /login thật — khách bị proxy chặn ở /profile quay lại đúng trang
//   sau khi đăng nhập; xem các trang công khai có link tới /learn (prefetch ở bản production) không ghi trang đích.
// - Loại: browser smoke với tài khoản seed; chạy trên bản build production (E2E_WEB_SERVER=start) mới có prefetch.
// - Case: (1) /profile → /login → đăng nhập → /profile; (2) context mới xem /login và /courses rồi đăng nhập → /;
//   (3) /profile → /login, xem /courses, đăng nhập → vẫn /profile (prefetch không thay trang đích đã lưu).
// - Giới hạn: đăng nhập Google không chạy được ở local (provider tắt); phần đó do test route và kiểm tra production.

const STUDENT = { email: "student@gmail.com", password: "123123" };

async function signInOnLoginPage(page: Page) {
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await page.getByLabel("Email").fill(STUDENT.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(STUDENT.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function browsePublicPagesThatLinkToLearn(page: Page) {
  await page.goto("/courses");
  await page.waitForLoadState("networkidle");
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
}

test("returns a visitor stopped at /profile to /profile after signing in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?reason=signin_required$/);

  await signInOnLoginPage(page);

  await expect(page).toHaveURL(/\/profile$/);
});

test("sends an ordinary sign-in to the home page even after viewing pages that link to /learn", async ({ page }) => {
  await browsePublicPagesThatLinkToLearn(page);

  await signInOnLoginPage(page);

  await expect(page).toHaveURL(/\/$/);
});

test("keeps the stored /profile destination while the visitor browses public pages first", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?reason=signin_required$/);
  await browsePublicPagesThatLinkToLearn(page);

  await signInOnLoginPage(page);

  await expect(page).toHaveURL(/\/profile$/);
});
