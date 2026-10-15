import { expect, test, type Locator, type Page } from "@playwright/test";
import { prepareReviewSessionFixture } from "../../scripts/e2e/review-session-fixture.mjs";
import { loginAsStudent } from "../support/auth";
import { watchBrowserConsole } from "../support/console";

// Test plan:
// - Mục tiêu: review thật lưu FSRS, hoàn tất từng lượt, tải lượt tiếp và giữ persistence khi mở lại.
// - Loại: browser local với action/DB thật; B2 fixture kiểm tra eligibility và cardinality trước QA.
// - Case: 0/2/51 due, hết thẻ chỉ quay lại, còn thẻ mới ôn lượt tiếp, long content, 320/375/768/1280, keyboard/focus, reduced motion.
// - Invariant: 50 thẻ đầu hoàn tất vẫn còn lượt kế; query và FSRS giữ nguyên.
// - LF6 (AC5/AC6): bốn nút rating mang màu Attention (Lại/Khó) hoặc Recall (Ổn/Dễ); lật thẻ 400 ms và vào thẻ 300 ms khi bình thường, không lật không animation khi reduced motion (đo computed style, hai chế độ tách riêng).
// - LF8: đánh giá lưu nền nên smoke chờ dòng "Đang lưu…" của hộp thoại biến mất trước khi đọc DB.
// - Giới hạn: pending/failure/stale response nằm ở component; zoom CSS không thay thế browser zoom.
// - Verify: xem State D6 trong progress.md.
const credentials = { E2E_STUDENT_EMAIL: "student@gmail.com", E2E_STUDENT_PASSWORD: "123123" };
const firstId = "b2500000-0000-4000-8000-000000000001";
// LF8: đánh giá lưu nền; chờ dòng "Đang lưu…" biến mất (hàng đợi lưu đã cạn) trước khi đọc DB hoặc tải lại.
const savesDrained = (dialog: Locator) => expect(dialog.getByRole("status").filter({ hasText: "Đang lưu…" })).toHaveCount(0);
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
      await savesDrained(dialog);
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
      await expect(dialog.getByRole("heading", { name: "Chúc mừng! Bạn đã ôn hết thẻ đến hạn." })).toBeFocused();
      await expect(page.getByRole("button", { name: "Ôn ngay", exact: true })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: /Ôn lượt tiếp|Tải lại lượt ôn|Về dashboard/ })).toHaveCount(0);
      await dialog.getByRole("button", { name: "Quay lại" }).press("Enter");
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
    await savesDrained(dialog);
    expect(await fixture.dueCount()).toBe(1);
    await dialog.getByRole("button", { name: "Ôn lượt tiếp theo" }).click();
    await expect(dialog.getByText("Đã xử lý 0/1 thẻ trong lượt")).toBeVisible();
    await dialog.getByRole("button", { name: "Hiện đáp án" }).click();
    await dialog.getByRole("button", { name: "Dễ", exact: true }).click();
    await expect(dialog.getByText("Đã xử lý 1/1 thẻ trong lượt")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Chúc mừng! Bạn đã ôn hết thẻ đến hạn." })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Ôn lượt tiếp|Tải lại lượt ôn/ })).toHaveCount(0);
    await savesDrained(dialog);
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

// LF6 AC6: Owner Q3, lật thẻ 400 ms và vào thẻ 300 ms; reduced motion bỏ cả hai.
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`review card flip and entry timing with ${reducedMotion} motion, rating colours by family`, async ({ page }) => {
    const fixture = await prepareReviewSessionFixture(2, true);
    try {
      await page.emulateMedia({ reducedMotion });
      await loginAsStudent(page, credentials);
      const dialog = await open(page);
      await dialog.getByRole("button", { name: "Hiện đáp án" }).click();
      const timing = await dialog.locator("[data-revealed]").evaluate((card) => {
        const flip = getComputedStyle(card);
        const plane = getComputedStyle(card.parentElement as HTMLElement);
        return {
          transitionDuration: flip.transitionDuration,
          transform: flip.transform,
          animationName: plane.animationName,
          animationDuration: plane.animationDuration,
        };
      });
      if (reducedMotion === "reduce") {
        expect(timing.transitionDuration).toBe("0s");
        expect(timing.animationName).toBe("none");
        expect(timing.transform).toBe("none");
      } else {
        expect(timing.transitionDuration).toBe("0.4s");
        expect(timing.animationName).not.toBe("none");
        expect(timing.animationDuration).toBe("0.3s");
      }
      // Attention (Lại, Khó) and Recall (Ổn, Dễ) read from the same definition as the workspace card.
      const textColour = (name: string) => dialog.getByRole("button", { name, exact: true }).evaluate((el) => getComputedStyle(el).color);
      const [again, hard, good, easy] = await Promise.all(["Lại", "Khó", "Ổn", "Dễ"].map(textColour));
      expect(again).toBe(hard);
      expect(good).toBe(easy);
      expect(again).not.toBe(good);
    } finally { await fixture.restore(); }
  });
}
