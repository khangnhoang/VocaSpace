import { expect, test, type Page, type Route } from "@playwright/test";
import {
  cleanupDashboardReturnFreshnessFixture,
  getActiveFixtureFlashcardCount,
  prepareDashboardReturnFreshnessFixture,
} from "../../scripts/e2e/dashboard-return-freshness-fixture.mjs";
import { exerciseAuthoringFixture } from "../../scripts/e2e/exercise-authoring-fixture.mjs";
import { getCourseOverviewPath, getTopicBuilderPath } from "../../lib/course-authoring/routes";
import { loginAsTeacher } from "../support/auth";
import { watchBrowserConsole } from "../support/console";
import { expectTopicBuilder } from "../support/structure-ui";

// Test plan:
// - Mục tiêu: ACTION-QUEUE-001 / TFEAT4 AC12 trên production build: đổi tab nhanh trong lúc một server action còn
//   chờ không làm tab treo hay mất lần lưu; deep link dashboard giữ tab và lời nhắc tới khi lưu xong; sau khi lưu,
//   `Quay lại tổng quan` thật sự chuyển sang Overview. Ba tab vừa màn điện thoại từ 360px; ở 320px tab đang mở
//   vẫn nằm trong vùng nhìn thấy.
// - Loại test: smoke E2E, chạy trên CI (không skip). Server action được giữ lại bằng `page.route` trên request có
//   header `next-action` để mô phỏng mạng chậm; request vẫn tới server thật.
// - Đối tượng: TopicBuilderTabs (ghi `?tab=` sau khi action xong), FlashcardWorkbench (createCard), DashboardReturnFeedback.
// - Bảo mật/phân quyền: service-role chỉ dựng/đọc fixture trong Node; trình duyệt dùng tài khoản giáo viên seed.
// - Invariant cần giữ: thẻ được lưu đúng một lần, tab cuối cùng hiển thị nội dung đã tải, URL khớp tab đang mở.

test.afterEach(async () => {
  await cleanupDashboardReturnFreshnessFixture();
});

async function holdServerActions(page: Page, delayMs: number) {
  const handler = async (route: Route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await route.fallback();
  };
  await page.route("**/teacher/courses/**", handler);
  return () => page.unroute("**/teacher/courses/**", handler);
}

async function addFlashcard(page: Page, word: string, translation: string) {
  await page.getByRole("button", { name: "Thêm thẻ" }).first().click();
  await page.getByRole("textbox", { name: "Từ vựng" }).fill(word);
  await page.getByRole("textbox", { name: "Nghĩa" }).fill(translation);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
}

test("all three tabs fit a phone and the open tab stays in view on the narrowest screen", async ({ page }) => {
  const fixture = await prepareDashboardReturnFreshnessFixture();
  const courseId = fixture.E2E_COURSE_ID ?? exerciseAuthoringFixture.courseId;
  const topicId = fixture.E2E_TOPIC_ID ?? exerciseAuthoringFixture.topicId;
  const tabs = page.getByRole("tablist", { name: "Nội dung bài học" }).getByRole("tab");
  const rightEdges = () => tabs.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().right));

  await loginAsTeacher(page, fixture);
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto(getTopicBuilderPath(courseId, topicId, "flashcards"));
  await expectTopicBuilder(page);
  for (const edge of await rightEdges()) expect(edge).toBeLessThanOrEqual(360);

  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole("tab", { name: /^Bài tập/ }).click();
  await expect(page.getByRole("tab", { name: /^Bài tập/ })).toHaveAttribute("data-state", "active");
  await expect
    .poll(async () => page.getByRole("tab", { name: /^Bài tập/ }).evaluate((item) => item.getBoundingClientRect().right))
    .toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("fast tab switches while a save is in flight never strand a tab or drop the save", async ({ page }) => {
  const consoleGuard = watchBrowserConsole(page);
  const fixture = await prepareDashboardReturnFreshnessFixture();
  const courseId = fixture.E2E_COURSE_ID ?? exerciseAuthoringFixture.courseId;
  const topicId = fixture.E2E_TOPIC_ID ?? exerciseAuthoringFixture.topicId;

  await loginAsTeacher(page, fixture);
  await page.goto(getTopicBuilderPath(courseId, topicId, "flashcards"));
  await expectTopicBuilder(page);
  await expect(page.getByText("Chưa có thẻ từ vựng nào")).toBeVisible();

  const release = await holdServerActions(page, 1_500);
  await addFlashcard(page, fixture.E2E_FLASHCARD_WORD, fixture.E2E_FLASHCARD_TRANSLATION);
  // Đổi tab liên tiếp trong lúc createCard còn chờ.
  for (const name of [/^Bài tập/, /^Memory check/]) {
    await page.getByRole("tab", { name }).click();
  }
  await expect(page.getByRole("tab", { name: /^Memory check/ })).toHaveAttribute("data-state", "active");
  await expect(page.getByText("Bài học chưa có memory check")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/tab=memory-check/, { timeout: 15_000 });
  await release();

  await expect.poll(() => getActiveFixtureFlashcardCount(), { timeout: 15_000 }).toBe(1);
  for (const [name, loaded] of [
    [/^Memory check/, "Bài học chưa có memory check"],
    [/^Bài tập/, "Chưa có bài tập nào"],
  ] as const) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByText(loaded)).toBeVisible({ timeout: 15_000 });
  }
  await page.getByRole("tab", { name: /^Từ vựng/ }).click();
  await expect(page.getByRole("button", { name: new RegExp(fixture.E2E_FLASHCARD_WORD) })).toBeVisible();
  await consoleGuard.expectNoErrors();
});

test("a dashboard deep link keeps its tab and guidance until the save, then returns to Overview", async ({ page }) => {
  const consoleGuard = watchBrowserConsole(page);
  const fixture = await prepareDashboardReturnFreshnessFixture();
  const courseId = fixture.E2E_COURSE_ID ?? exerciseAuthoringFixture.courseId;
  const topicId = fixture.E2E_TOPIC_ID ?? exerciseAuthoringFixture.topicId;
  const deepLink =
    getTopicBuilderPath(courseId, topicId) +
    `?from=dashboard&issue=topic_has_no_learning_content&targetType=topic&target=${topicId}&tab=exercises`;

  await loginAsTeacher(page, fixture);
  await page.goto(deepLink);
  await expectTopicBuilder(page);
  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Bài tập/ })).toHaveAttribute("data-state", "active");

  await page.getByRole("tab", { name: /^Từ vựng/ }).click();
  await expect(page).toHaveURL(/from=dashboard/);
  await expect(page).toHaveURL(/tab=flashcards/);
  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();

  const release = await holdServerActions(page, 800);
  await addFlashcard(page, fixture.E2E_FLASHCARD_WORD, fixture.E2E_FLASHCARD_TRANSLATION);
  await expect(page.getByRole("status").filter({ hasText: /n.*i dung h.*c t.*p/i })).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/from=dashboard/, { timeout: 15_000 });
  await expect(page).toHaveURL(/tab=flashcards/);
  await release();
  expect(await getActiveFixtureFlashcardCount()).toBe(1);

  await page.getByRole("link", { name: /Quay l.*i t.*ng quan/i }).click();
  await expect(page).toHaveURL(new RegExp(`${getCourseOverviewPath(courseId)}$`), { timeout: 15_000 });
  await consoleGuard.expectNoErrors();
});
