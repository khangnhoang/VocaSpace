import { expect, test, type Page } from "@playwright/test";
import {
  courseStructureFixture,
  findCourseStructureTopicByTitle,
  prepareCourseStructureFixture,
} from "../../scripts/e2e/course-structure-fixture.mjs";
import { loginAsTeacher } from "../support/auth";
import { watchBrowserConsole } from "../support/console";
import {
  createStructureTopic,
  fillActiveDialogTextbox,
  submitActiveDialog,
} from "../support/structure-ui";

// Test plan:
// - Proves dashboard issue URLs render stable browser history behavior.
// - Covers a resolved chapter issue, valid topic no-content issue, malformed nested target, redirect to structure feedback, and Back/Forward without hydration console errors.
// - Uses the existing local teacher/course fixture and keeps the scope smaller than full PR6 browser QA.

test("dashboard issue links survive stale target redirects without hydration errors", async ({
  page,
}) => {
  const consoleGuard = watchBrowserConsole(page);

  const fixture = await prepareCourseStructureFixture();
  const courseId = fixture.E2E_COURSE_ID ?? courseStructureFixture.courseId;
  const chapterTitle = fixture.E2E_STRUCTURE_CHAPTER_TITLE;
  const topicTitle = fixture.E2E_STRUCTURE_TOPIC_ACTIVE_TITLE;

  await loginAsTeacher(page, fixture);

  await page.goto(`/courses/${courseId}/structure`);
  await page.getByRole("button", { name: /Th.*m Ch/i }).click();
  await fillActiveDialogTextbox(page, chapterTitle);
  await submitActiveDialog(page, /T.*o ch/i);
  await expect(page.getByText(chapterTitle)).toBeVisible();

  await page.goto(`/courses/${courseId}`);
  await page.getByRole("link", { name: "Thêm bài học", exact: true }).click();
  await expect(page).toHaveURL(/\/structure\?/);
  await expect(page.getByText("Chương chưa có bài học")).toBeVisible();

  const chapterRow = page.locator("article").filter({ hasText: chapterTitle });
  await chapterRow
    .getByRole("button", { name: /Qu.*n l.*b.*i h/i })
    .click();
  await createStructureTopic(page, topicTitle);
  await page.getByRole("button", { name: /Quay v.* khung ch/i }).click();
  await expect(page.getByText("Chương chưa có bài học")).toHaveCount(0);
  await expect(page).not.toHaveURL(/from=dashboard/);
  await expect(
    page
      .getByText("Tổng số bài học")
      .locator("..")
      .getByRole("heading", { name: "1" }),
  ).toBeVisible();

  const topic = await findCourseStructureTopicByTitle(topicTitle);
  const validIssueUrl =
    `/courses/${courseId}/topics/${topic.id}` +
    `?from=dashboard&issue=topic_has_no_learning_content` +
    `&targetType=topic&target=${topic.id}&tab=exercises`;
  const malformedTargetUrl =
    `/courses/${courseId}/topics/${topic.id}` +
    `?from=dashboard&issue=question_missing_content` +
    `&targetType=question&target=not-a-uuid&tab=exercises`;

  await page.goto(validIssueUrl);
  await expect(
    page.getByRole("status").filter({
      hasText: "Bài học chưa có nội dung học tập",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở thẻ từ vựng" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Mở bài tập TOEIC" }),
  ).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Bài tập TOEIC/i })).toHaveAttribute(
    "data-state",
    "active",
  );

  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();
  await page.getByRole("button", { name: "Thoát chế độ sửa" }).click();
  await expect(page).not.toHaveURL(/from=dashboard/);
  await expect(page).not.toHaveURL(/issue=topic_has_no_learning_content/);
  await expect(
    page.getByText("Tab trong đường dẫn không còn hợp lệ"),
  ).toHaveCount(0);
  await expect(
    page.locator('[role="tab"][data-state="active"]').filter({ hasText: "TOEIC" }),
  ).toBeVisible();

  await page.goto(validIssueUrl);
  await page.getByRole("tab", { name: /T.*v.*ng/i }).click();
  await expect(page).toHaveURL(/from=dashboard/);
  await expect(page).toHaveURL(/issue=topic_has_no_learning_content/);
  await expect(page).toHaveURL(/tab=flashcards/);
  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();
  await expect(page.getByRole("tab", { name: /T.*v.*ng/i })).toHaveAttribute(
    "data-state",
    "active",
  );

  await page.getByRole("tab", { name: /B.*i t.*p TOEIC/i }).click();
  await expect(page).toHaveURL(/from=dashboard/);
  await expect(page).toHaveURL(/issue=topic_has_no_learning_content/);
  await expect(page).toHaveURL(/tab=exercises/);
  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();

  await page.getByRole("tab", { name: /C.*i.*t b.*i h.*c/i }).click();
  await expect(page).not.toHaveURL(/from=dashboard/);
  await expect(page).not.toHaveURL(/issue=topic_has_no_learning_content/);
  await expect(page.getByText("Tab trong đường dẫn không còn hợp lệ")).toHaveCount(
    0,
  );
  await expect(page.getByRole("tab", { name: /C.*i.*t b.*i h.*c/i })).toHaveAttribute(
    "data-state",
    "active",
  );

  await page.goto(malformedTargetUrl);
  await expect(page).toHaveURL(new RegExp(`/courses/${courseId}/structure`));
  await expect(
    page.getByText(
      "Nội dung bạn muốn mở không còn khả dụng. Bạn đã được đưa về cấu trúc khóa học.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(page.getByText("Nội dung không còn khả dụng")).toHaveCount(0);
  await expect(page).not.toHaveURL(/issue_unavailable=1/);

  await navigateHistory(page, "back");
  await navigateHistory(page, "forward");

  await consoleGuard.expectNoErrors();
});

async function navigateHistory(page: Page, direction: "back" | "forward") {
  try {
    if (direction === "back") {
      await page.goBack({ waitUntil: "domcontentloaded" });
    } else {
      await page.goForward({ waitUntil: "domcontentloaded" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("net::ERR_ABORTED")) throw error;
  }

  await page.waitForLoadState("networkidle").catch(() => undefined);
}
