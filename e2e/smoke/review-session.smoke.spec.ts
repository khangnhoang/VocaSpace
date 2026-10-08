import { expect, test, type Page } from "@playwright/test";
import { prepareReviewSessionFixture } from "../../scripts/e2e/review-session-fixture.mjs";
import { loginAsStudent } from "../support/auth";
import { watchBrowserConsole } from "../support/console";

// Test plan:
// - Mục tiêu: review thật lưu FSRS, hoàn tất từng lượt, tải lượt tiếp và giữ persistence khi mở lại.
// - Loại: browser local với action/DB thật; B2 fixture kiểm tra eligibility và cardinality trước QA.
// - Case: 0/2/51 due, long content, 320/375/768/1280, keyboard/focus, reduced motion.
// - Invariant: 50 thẻ đầu hoàn tất vẫn còn lượt kế; query và FSRS giữ nguyên.
// - Giới hạn: pending/failure/stale response nằm ở component; zoom CSS không thay thế browser zoom.
// - Verify: xem State D6 trong progress.md.
const credentials = { E2E_STUDENT_EMAIL: "student@gmail.com", E2E_STUDENT_PASSWORD: "123123" };
const firstId = "b2500000-0000-4000-8000-000000000001";
async function open(page: Page) {
  await page.goto("/learn");
  const trigger = page.getByRole("button", { name: "Ôn ngay", exact: true });
  await trigger.focus();
  await trigger.press("Enter");
  return page.getByRole("dialog", { name: "Ôn tập tập trung" });
}

for (const width of [320, 375, 768, 1280]) {
  test(`review saves and returns focus after refresh at ${width}px`, async ({ page }) => {
    const fixture = await prepareReviewSessionFixture(2, true);
    const consoleGuard = watchBrowserConsole(page);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await loginAsStudent(page, credentials);
      let dialog = await open(page);
      const reveal = dialog.getByRole("button", { name: "Hiện đáp án" });
      await expect(reveal).toBeFocused();
      await expect(dialog.getByText("Đã xử lý 0/2 thẻ trong lượt")).toBeVisible();
      await reveal.press("Enter");
      await expect(dialog.getByText("có tính xác định", { exact: true })).toBeVisible();
      for (const name of ["Lại", "Khó", "Ổn", "Dễ"]) {
        const button = dialog.getByRole("button", { name, exact: true });
        const size = await button.boundingBox();
        expect(size?.width).toBeGreaterThanOrEqual(44);
        expect(size?.height).toBeGreaterThanOrEqual(44);
      }
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await dialog.getByRole("button", { name: "Ổn", exact: true }).press("Enter");
      await expect(dialog.getByText("Đã xử lý 1/2 thẻ trong lượt")).toBeVisible();
      await fixture.assertSaved(firstId);
      await expect(reveal).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Ôn ngay", exact: true })).toBeFocused();
      dialog = await open(page);
      await expect(dialog.getByText("Đã xử lý 0/1 thẻ trong lượt")).toBeVisible();
      await expect(dialog.getByText("deterministic", { exact: true })).toHaveCount(0);
      await dialog.getByRole("button", { name: "Hiện đáp án" }).press("Enter");
      await dialog.getByRole("button", { name: "Dễ", exact: true }).press("Enter");
      await expect(dialog.getByRole("heading", { name: "Đã hoàn tất lượt này" })).toBeFocused();
      await expect(page.getByRole("button", { name: "Ôn ngay", exact: true })).toHaveCount(0);
      await dialog.getByRole("button", { name: "Ôn lượt tiếp" }).press("Enter");
      await expect(dialog.getByRole("heading", { name: "Lượt tải này chưa có thẻ có thể ôn" })).toBeVisible();
      await dialog.getByRole("button", { name: "Về dashboard" }).press("Enter");
      await expect(dialog).not.toBeVisible();
      await expect(page.locator("#review-summary-title")).toBeFocused();
      expect(await fixture.dueCount()).toBe(0);
      await consoleGuard.expectNoErrors();
    } finally { await fixture.restore(); }
  });
}

test("a 51-card workload completes only the 50-card batch and fetches the remaining card", async ({ page }) => {
  // 51 ghi thật liên tiếp kiểm tra ranh giới batch, cần ngân sách riêng cho hành trình dài.
  test.slow();
  const fixture = await prepareReviewSessionFixture(51);
  try {
    await loginAsStudent(page, credentials);
    const dialog = await open(page);
    await expect(dialog.getByText("Đã xử lý 0/50 thẻ trong lượt")).toBeVisible();
    for (let done = 0; done < 50; done++) {
      await dialog.getByRole("button", { name: "Hiện đáp án" }).click();
      await dialog.getByRole("button", { name: "Dễ", exact: true }).click();
      await expect(dialog.getByText(`Đã xử lý ${done + 1}/50 thẻ trong lượt`)).toBeVisible();
    }
    await expect(dialog.getByRole("heading", { name: "Đã hoàn tất lượt này" })).toBeVisible();
    expect(await fixture.dueCount()).toBe(1);
    await dialog.getByRole("button", { name: "Ôn lượt tiếp" }).click();
    await expect(dialog.getByText("Đã xử lý 0/1 thẻ trong lượt")).toBeVisible();
    await dialog.getByRole("button", { name: "Hiện đáp án" }).click();
    await dialog.getByRole("button", { name: "Dễ", exact: true }).click();
    await expect(dialog.getByText("Đã xử lý 1/1 thẻ trong lượt")).toBeVisible();
    expect(await fixture.dueCount()).toBe(0);
  } finally { await fixture.restore(); }
});

test("zero-due dashboard does not invent a review entry", async ({ page }) => {
  const fixture = await prepareReviewSessionFixture(0);
  try {
    await loginAsStudent(page, credentials);
    await page.goto("/learn");
    await expect(page.getByRole("button", { name: "Ôn ngay", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Hôm nay chưa có thẻ cần ôn" })).toBeVisible();
  } finally { await fixture.restore(); }
});
