import { expect, test } from "@playwright/test";
import {
  cleanupDashboardReturnFreshnessFixture,
  getActiveFixtureFlashcardCount,
  prepareDashboardReturnFreshnessFixture,
} from "../../scripts/e2e/dashboard-return-freshness-fixture.mjs";
import { exerciseAuthoringFixture } from "../../scripts/e2e/exercise-authoring-fixture.mjs";
import { loginAsTeacher } from "../support/auth";
import { watchBrowserConsole } from "../support/console";

// Test plan:
// - Mục tiêu: kiểm tra giáo viên quay lại overview bằng nút PR6 và thấy readiness mới từ database.
// - Loại test: smoke E2E.
// - Đối tượng: dashboard issue, topic flashcard authoring, local return feedback và overview server page.
// - Case thành công: topic thiếu nội dung hiện lỗi, tạo flashcard thành công, bấm Quay lại tổng quan, lỗi cũ biến mất.
// - Bảo mật/phân quyền: service-role chỉ dựng/đọc fixture trong Node; browser dùng tài khoản giáo viên.
// - Ổn định/resilience: reload overview sau khi quay lại không làm lỗi cũ xuất hiện lại.
// - Invariant cần giữ: issue biến mất nhờ active flashcard trong database, không nhờ client tự ẩn issue.

test.afterEach(async () => {
  await cleanupDashboardReturnFreshnessFixture();
});

test("teacher returns to overview and sees the resolved topic content issue disappear", async ({
  page,
}) => {
  const consoleGuard = watchBrowserConsole(page);

  const fixture = await prepareDashboardReturnFreshnessFixture();
  const courseId = fixture.E2E_COURSE_ID ?? exerciseAuthoringFixture.courseId;
  const topicTitle = fixture.E2E_TOPIC_TITLE;
  const word = fixture.E2E_FLASHCARD_WORD;
  const translation = fixture.E2E_FLASHCARD_TRANSLATION;

  expect(await getActiveFixtureFlashcardCount()).toBe(0);

  await loginAsTeacher(page, fixture);

  await page.goto(`/courses/${courseId}`);
  const topicContentIssue = page
    .locator("li")
    .filter({ hasText: topicTitle })
    .filter({ hasText: "flashcard" });
  await expect(topicContentIssue).toBeVisible();

  const issueAction = topicContentIssue.getByRole("link", {
    name: /Th.*m n.*i dung/i,
  });
  await expect(issueAction).toHaveAttribute("href", /\/topics\//);
  await issueAction.click();
  await page.waitForURL(/\/topics\//, { timeout: 15_000 });

  await expect(page.getByRole("heading", { name: "Topic Builder" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /ch.*a c.* n.*i dung h.*c t.*p/i })).toBeVisible();
  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thoát chế độ sửa" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /B.*i t.*p TOEIC/i })).toHaveAttribute(
    "data-state",
    "active",
  );

  await page.getByRole("tab", { name: /T.*v.*ng/i }).click();
  await expect(page).toHaveURL(/from=dashboard/);
  await expect(page).toHaveURL(/tab=flashcards/);
  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();
  await page.getByRole("button", { name: /Th.*m th.*m.*i/i }).click();

  const flashcardDialog = page.getByRole("dialog").last();
  await flashcardDialog.getByRole("textbox").nth(0).fill(word);
  await flashcardDialog.getByRole("textbox").nth(3).fill(translation);
  await flashcardDialog.getByRole("button", { name: /X.*c nh.*n l.*u/i }).click();

  await expect(page.getByRole("status").filter({ hasText: /n.*i dung h.*c t.*p/i })).toBeVisible();
  await expect(page).not.toHaveURL(/from=dashboard/);
  expect(await getActiveFixtureFlashcardCount()).toBe(1);

  await page.getByRole("link", { name: /Quay l.*i t.*ng quan/i }).click();
  await expect(page).toHaveURL(new RegExp(`/courses/${courseId}$`));
  await expect(topicContentIssue).toHaveCount(0);

  await page.reload();
  await expect(
    page.locator("li").filter({ hasText: topicTitle }).filter({ hasText: "flashcard" }),
  ).toHaveCount(0);
  expect(await getActiveFixtureFlashcardCount()).toBe(1);
  await consoleGuard.expectNoErrors();
});
