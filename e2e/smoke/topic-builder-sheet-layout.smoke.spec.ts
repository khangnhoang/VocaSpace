import { expect, test, type Page } from "@playwright/test";
import {
  cleanupDashboardReturnFreshnessFixture,
  prepareDashboardReturnFreshnessFixture,
} from "../../scripts/e2e/dashboard-return-freshness-fixture.mjs";
import { exerciseAuthoringFixture } from "../../scripts/e2e/exercise-authoring-fixture.mjs";
import { portfolioFixture, preparePortfolioFixture } from "../../scripts/e2e/teacher-course-portfolio-fixture.mjs";
import { getTopicBuilderPath } from "../../lib/course-authoring/routes";
import { loginAsTeacher } from "../support/auth";
import { expectTopicBuilder } from "../support/structure-ui";

// Test plan:
// - Mục tiêu: mở side sheet nhóm tác giả, và hộp thoại ở trang danh sách khóa học, không làm nội dung trang co giãn
//   hay nhảy ngang khi trang có thanh cuộn.
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

test("opening a dialog on the course portfolio does not shift the page", async ({ page }) => {
  await preparePortfolioFixture();
  await loginAsTeacher(page, { E2E_TEACHER_EMAIL: portfolioFixture.teacherEmail, E2E_TEACHER_PASSWORD: portfolioFixture.teacherPassword });
  await page.goto("/teacher/courses");
  // Không định vị theo role: hộp thoại mở thì phần còn lại của trang bị ẩn khỏi cây trợ năng.
  const header = page.locator("header", { has: page.locator("h1", { hasText: "Khóa học của tôi" }) });
  await expect(header).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight > innerHeight && document.documentElement.clientWidth < innerWidth),
  ).toBe(true);
  // Cuộn tới nút trước khi đo, để lần bấm không làm trang cuộn và lẫn vào phép so sánh.
  const trash = page.getByRole("button", { name: "Đưa vào thùng rác", exact: true });
  await trash.scrollIntoViewIfNeeded();
  const before = await header.boundingBox();

  await trash.click();
  await expect(page.getByRole("dialog", { name: "Đưa khóa học vào thùng rác?" })).toBeVisible();
  expect(await header.boundingBox()).toEqual(before);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await header.boundingBox()).toEqual(before);
});
