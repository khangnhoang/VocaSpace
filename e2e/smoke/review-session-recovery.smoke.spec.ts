import { expect, test } from "@playwright/test";
import { prepareReviewSessionFixture } from "../../scripts/e2e/review-session-fixture.mjs";
import { loginAsStudent } from "../support/auth";
import { watchBrowserConsole } from "../support/console";

// Test plan:
// - Mục tiêu: D6 phục hồi sau lỗi transport, không chuyển thẻ chưa lưu; thao tác touch thật trên màn hình hẹp.
// - Loại: browser với Next/action/Supabase thật; chỉ abort một request trước dispatch để tạo lỗi client.
// - Thành công: thử lại tải/lưu ghi đúng một lần, đóng/mở/reload giữ persistence; touch không cần hover.
// - Thất bại: tải mất mạng giữ error/retry; lưu mất mạng hai lần (lần đầu và lần thử lại) xếp thẻ lại cuối hàng đợi kèm lời báo, due count không đổi (LF8); sau khi tải lại, thẻ đã lưu không quay lại còn thẻ bị xếp lại và chưa lưu hiện lại.
// - Phân quyền: student canonical trên runtime E2E 45441; không mock thành công hay thay dữ liệu hosted.
// - Invariant: thẻ chưa lưu quay lại hàng đợi (không mất), nút dùng được sau lỗi, chờ dòng "Đang lưu…" biến mất trước khi đọc DB hoặc tải lại, layout không tràn ngang.
// - Zoom native đã thử bằng probe riêng nhưng chưa xác minh được; Owner kiểm tra 200% sau.
// - Verify: xem State LF8 trong progress.md (lệnh và kết quả chạy thật).
// - Giới hạn: abort transport không chứng minh DB failure; chất lượng motion và UI/UX do Owner nghiệm thu.
const credentials = { E2E_STUDENT_EMAIL: "student@gmail.com", E2E_STUDENT_PASSWORD: "123123" };
const firstId = "b2500000-0000-4000-8000-000000000001";
const secondId = "b2500000-0000-4000-8000-000000000002";

test("load/save transport failures retry, and an unsaved rating puts its card back", async ({ page }) => {
  const fixture = await prepareReviewSessionFixture(2);
  try {
    await loginAsStudent(page, credentials);
    await page.goto("/learn");
    let abortRemaining = 1;
    let aborted = 0;
    await page.route("**/learn", async (route) => {
      if (abortRemaining > 0 && route.request().headers()["next-action"]) {
        abortRemaining--; aborted++;
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
    // LF8: thẻ kế tiếp hiện ngay; lưu lỗi hai lần (lần đầu và lần thử lại sau khoảng 1 giây) thì thẻ được xếp lại kèm lời báo.
    abortRemaining = 2;
    await dialog.getByRole("button", { name: "Dễ", exact: true }).click();
    await expect(dialog.getByText("Đã xử lý 1/2 thẻ trong lượt")).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("Chưa lưu được đánh giá thẻ");
    await expect(dialog.getByRole("alert")).toContainText("Thẻ được xếp lại để bạn chấm lại.");
    expect(aborted).toBe(3); expect(await fixture.dueCount()).toBe(2);
    await expect(dialog.getByText("Đã xử lý 0/2 thẻ trong lượt")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Hiện đáp án" })).toBeEnabled();
    await page.unroute("**/learn");
    await dialog.getByRole("button", { name: "Hiện đáp án" }).click();
    await dialog.getByRole("button", { name: "Dễ", exact: true }).click();
    await expect(dialog.getByText("Đã xử lý 1/2 thẻ trong lượt")).toBeVisible();
    await expect(dialog.getByRole("status").filter({ hasText: "Đang lưu…" })).toHaveCount(0);
    await fixture.assertSaved(secondId);
    expect(await fixture.dueCount()).toBe(1);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Ôn ngay", exact: true }).click();
    await expect(dialog.getByText("Đã xử lý 0/1 thẻ trong lượt")).toBeVisible();
    // Thẻ đã lưu ("progress") không quay lại; thẻ bị xếp lại và chưa lưu ("deterministic") hiện lại.
    await expect(dialog.getByText("progress", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("deterministic", { exact: true })).toBeVisible();
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
