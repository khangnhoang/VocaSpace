import { expect, test } from "@playwright/test";
import { prepareReviewSessionFixture } from "../../scripts/e2e/review-session-fixture.mjs";
import { loginAsStudent } from "../support/auth";
import { watchBrowserConsole } from "../support/console";

// Test plan:
// - Mục tiêu: D6 phục hồi sau lỗi transport, không chuyển thẻ chưa lưu; thao tác touch thật trên màn hình hẹp.
// - Loại: browser với Next/action/Supabase thật; chỉ abort một request trước dispatch để tạo lỗi client.
// - Thành công: thử lại tải/lưu ghi đúng một lần, đóng/mở/reload giữ persistence; touch không cần hover.
// - Thất bại: tải/lưu mất mạng giữ error/retry và due count không đổi.
// - Phân quyền: student canonical trên runtime E2E 45441; không mock thành công hay thay dữ liệu hosted.
// - Invariant: thẻ chưa lưu ở nguyên vị trí, nút dùng được sau lỗi, layout không tràn ngang.
// - Zoom native đã thử bằng probe riêng nhưng chưa xác minh được; Owner kiểm tra 200% sau.
// - Verify: load/save recovery và touch passed (2026-10-08); lệnh và giới hạn ghi trong progress.md.
// - Giới hạn: abort transport không chứng minh DB failure; chất lượng motion và UI/UX do Owner nghiệm thu.
const credentials = { E2E_STUDENT_EMAIL: "student@gmail.com", E2E_STUDENT_PASSWORD: "123123" };
const firstId = "b2500000-0000-4000-8000-000000000001";

test("load/save transport failures retry without advancing an unsaved card", async ({ page }) => {
  const fixture = await prepareReviewSessionFixture(2);
  try {
    await loginAsStudent(page, credentials);
    await page.goto("/learn");
    let abortNext = true;
    let aborted = 0;
    await page.route("**/learn", async (route) => {
      if (abortNext && route.request().headers()["next-action"]) {
        abortNext = false; aborted++;
        await route.abort("failed");
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Ôn ngay", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Ôn tập tập trung" });
    await expect(dialog.getByRole("heading", { name: "Chưa thể mở lượt ôn" })).toBeFocused();
    expect(aborted).toBe(1); expect(await fixture.dueCount()).toBe(2);
    await dialog.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(dialog.getByText("Đã xử lý 0/2 thẻ trong lượt")).toBeVisible();
    await dialog.getByRole("button", { name: "Hiện đáp án" }).click();
    abortNext = true;
    await dialog.getByRole("button", { name: "Dễ", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Chưa lưu được đánh giá.");
    expect(aborted).toBe(2); expect(await fixture.dueCount()).toBe(2);
    await expect(dialog.getByText("Đã xử lý 0/2 thẻ trong lượt")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Dễ", exact: true })).toBeEnabled();
    await page.unroute("**/learn");
    await dialog.getByRole("button", { name: "Dễ", exact: true }).click();
    await expect(dialog.getByText("Đã xử lý 1/2 thẻ trong lượt")).toBeVisible();
    await fixture.assertSaved(firstId);
    expect(await fixture.dueCount()).toBe(1);
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByRole("button", { name: "Ôn ngay", exact: true }).click();
    await expect(dialog.getByText("Đã xử lý 0/1 thẻ trong lượt")).toBeVisible();
    await expect(dialog.getByText("deterministic", { exact: true })).toHaveCount(0);
  } finally { await fixture.restore(); }
});

test("fresh 320px touch context reveals, rates and closes without hover", async ({ browser, baseURL }) => {
  const fixture = await prepareReviewSessionFixture(2, true);
  const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const consoleGuard = watchBrowserConsole(page);
  try {
    await loginAsStudent(page, credentials);
    await page.goto("/learn");
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Ôn ngay", exact: true }).tap();
    const dialog = page.getByRole("dialog", { name: "Ôn tập tập trung" });
    await dialog.getByRole("button", { name: "Hiện đáp án" }).tap();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.getByRole("button", { name: "Dễ", exact: true }).tap();
    await expect(dialog.getByText("Đã xử lý 1/2 thẻ trong lượt")).toBeVisible();
    await fixture.assertSaved(firstId);
    await dialog.getByRole("button", { name: "Đóng giao diện ôn tập" }).tap();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Ôn ngay", exact: true })).toBeFocused();
    await consoleGuard.expectNoErrors();
  } finally { await context.close(); await fixture.restore(); }
});
