import { expect, test, type Page } from "@playwright/test";
import {
  cleanupDashboardReturnFreshnessFixture,
  prepareDashboardReturnFreshnessFixture,
} from "../../scripts/e2e/dashboard-return-freshness-fixture.mjs";
import { exerciseAuthoringFixture } from "../../scripts/e2e/exercise-authoring-fixture.mjs";
import { getTopicBuilderPath } from "../../lib/course-authoring/routes";
import { loginAsTeacher } from "../support/auth";
import { expectTopicBuilder } from "../support/structure-ui";

// Test plan:
// - Mục tiêu: mở side sheet nhóm tác giả không làm nội dung trang co lại hay nhảy ngang khi trang có thanh cuộn.
// - Loại test: smoke E2E trên trình duyệt thật. Playwright mặc định ẩn thanh cuộn nên lỗi này không lộ ra;
//   file này bật lại thanh cuộn và dùng cửa sổ thấp để trang chắc chắn phải cuộn.
// - Đối tượng: khóa cuộn của Radix (`body[data-scroll-locked]`) cùng `scrollbar-gutter: stable` trong globals.css.
// - Invariant cần giữ: khung header giữ nguyên vị trí và kích thước trước, trong và sau khi mở sheet.

test.use({
  viewport: { width: 1280, height: 360 },
  launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] },
});

test.afterEach(async () => {
  await cleanupDashboardReturnFreshnessFixture();
});

function headerBox(page: Page) {
  return page.locator("header[aria-labelledby=topic-workflow-title]").boundingBox();
}

test("opening the author group sheet does not shift the page", async ({ page }) => {
  const fixture = await prepareDashboardReturnFreshnessFixture();
  const courseId = fixture.E2E_COURSE_ID ?? exerciseAuthoringFixture.courseId;
  const topicId = fixture.E2E_TOPIC_ID ?? exerciseAuthoringFixture.topicId;

  await loginAsTeacher(page, fixture);
  await page.goto(getTopicBuilderPath(courseId, topicId, "flashcards"));
  await expectTopicBuilder(page);
  await expect(page.getByText("Chưa có thẻ từ vựng nào")).toBeVisible();

  // Điều kiện để test có ý nghĩa: trang đang có thanh cuộn thật chiếm chỗ.
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight > innerHeight && document.documentElement.clientWidth < innerWidth),
  ).toBe(true);
  const before = await headerBox(page);

  await page.getByRole("button", { name: /^Nhóm tác giả/ }).click();
  await expect(page.getByRole("dialog", { name: "Nhóm tác giả và ghi chú" })).toBeVisible();
  expect(await headerBox(page)).toEqual(before);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await headerBox(page)).toEqual(before);
});
