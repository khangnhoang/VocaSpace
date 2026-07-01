import { expect, test, type Page } from "@playwright/test";
import {
  assertCourseStructureOrderPersisted,
  assertCourseStructureSmokePersisted,
  courseStructureFixture,
  findCourseStructureTopicByTitle,
  prepareCourseStructureFixture,
} from "../../scripts/e2e/course-structure-fixture.mjs";
import { loginAsTeacher } from "../support/auth";
import {
  createStructureTopic,
  fillActiveDialogTextbox,
  submitActiveDialog,
} from "../support/structure-ui";

// Test plan:
// - Proves an authorized teacher can manage course structure through the browser UI.
// - Covers login UI, structure route, chapter create/order, topic create/order/edit/hide, chapter hide, and topic builder guard.
// - Asserts hidden chapter does not cascade removed_at to active descendant topics.
// - Uses an idempotent teacher/course fixture against isolated local Supabase.
// - Keeps the service-role key in Node-only fixture code, never in browser code.

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function articleByTitle(page: Page, title: string) {
  return page.locator("article").filter({ hasText: title });
}

function chapterMoveButton(
  page: Page,
  title: string,
  direction: "lên" | "xuống",
) {
  return articleByTitle(page, title).getByRole("button", {
    name: `Di chuyển chương "${title}" ${direction}`,
  });
}

function topicMoveButton(
  page: Page,
  title: string,
  direction: "lên" | "xuống",
) {
  return articleByTitle(page, title).getByRole("button", {
    name: `Di chuyển bài học "${title}" ${direction}`,
  });
}

async function expectVisibleArticleOrder(
  page: Page,
  titles: string[],
) {
  await expect
    .poll(async () => {
      const articleTexts = await page
        .locator("article")
        .evaluateAll((articles) =>
          articles.map((article) => article.textContent ?? ""),
        );

      return articleTexts
        .map((text) => titles.find((title) => text.includes(title)))
        .filter((title): title is string => Boolean(title));
    })
    .toEqual(titles);
}

async function createChapter(page: Page, title: string) {
  await page.getByRole("button", { name: /Th.*m Ch/i }).click();
  await fillActiveDialogTextbox(page, title);
  await submitActiveDialog(page, /T.*o ch/i);
  await expect(articleByTitle(page, title)).toBeVisible();
}

async function openTopicSheet(page: Page, chapterTitle: string) {
  await articleByTitle(page, chapterTitle)
    .getByRole("button", { name: /Qu.*n l.*b.*i h/i })
    .click();
  await expect(page.getByRole("heading", { name: /Qu.*n l.*b.*i h/i })).toBeVisible();
}

test("teacher manages structure metadata and hidden-parent topic guard", async ({
  page,
}) => {
  const fixture = await prepareCourseStructureFixture();
  const courseId = fixture.E2E_COURSE_ID ?? courseStructureFixture.courseId;
  const chapterTitle = fixture.E2E_STRUCTURE_CHAPTER_TITLE;
  const secondChapterTitle = fixture.E2E_STRUCTURE_CHAPTER_SECOND_TITLE;
  const thirdChapterTitle = fixture.E2E_STRUCTURE_CHAPTER_THIRD_TITLE;
  const hiddenTopicTitle = fixture.E2E_STRUCTURE_TOPIC_HIDDEN_TITLE;
  const activeTopicTitle = fixture.E2E_STRUCTURE_TOPIC_ACTIVE_TITLE;
  const orderTopicTitle = fixture.E2E_STRUCTURE_TOPIC_ORDER_TITLE;
  const updatedTopicTitle = fixture.E2E_STRUCTURE_TOPIC_UPDATED_TITLE;

  await loginAsTeacher(page, fixture);

  await page.goto(`/courses/${courseId}/structure`);
  await createChapter(page, chapterTitle);
  await createChapter(page, secondChapterTitle);
  await createChapter(page, thirdChapterTitle);
  await expectVisibleArticleOrder(page, [
    chapterTitle,
    secondChapterTitle,
    thirdChapterTitle,
  ]);

  await expect(chapterMoveButton(page, chapterTitle, "lên")).toBeDisabled();
  await expect(chapterMoveButton(page, thirdChapterTitle, "xuống")).toBeDisabled();

  const thirdChapterUp = chapterMoveButton(page, thirdChapterTitle, "lên");
  await thirdChapterUp.focus();
  await expect(thirdChapterUp).toBeFocused();
  await page.keyboard.press("Enter");
  await expectVisibleArticleOrder(page, [
    chapterTitle,
    thirdChapterTitle,
    secondChapterTitle,
  ]);

  await page.reload();
  await expectVisibleArticleOrder(page, [
    chapterTitle,
    thirdChapterTitle,
    secondChapterTitle,
  ]);

  const thirdChapterDown = chapterMoveButton(page, thirdChapterTitle, "xuống");
  await thirdChapterDown.focus();
  await expect(thirdChapterDown).toBeFocused();
  await page.keyboard.press("Space");
  await expectVisibleArticleOrder(page, [
    chapterTitle,
    secondChapterTitle,
    thirdChapterTitle,
  ]);

  await page.reload();
  await expectVisibleArticleOrder(page, [
    chapterTitle,
    secondChapterTitle,
    thirdChapterTitle,
  ]);

  const chapterRow = page.locator("article").filter({ hasText: chapterTitle });
  await openTopicSheet(page, chapterTitle);

  await createStructureTopic(page, hiddenTopicTitle);
  await createStructureTopic(page, activeTopicTitle);
  await createStructureTopic(page, orderTopicTitle);
  await expectVisibleArticleOrder(page, [
    hiddenTopicTitle,
    activeTopicTitle,
    orderTopicTitle,
  ]);

  await expect(topicMoveButton(page, hiddenTopicTitle, "lên")).toBeDisabled();
  await expect(topicMoveButton(page, orderTopicTitle, "xuống")).toBeDisabled();

  await topicMoveButton(page, orderTopicTitle, "lên").click();
  await expectVisibleArticleOrder(page, [
    hiddenTopicTitle,
    orderTopicTitle,
    activeTopicTitle,
  ]);

  await page.getByRole("button", { name: /Quay v/i }).click();
  await openTopicSheet(page, chapterTitle);
  await expectVisibleArticleOrder(page, [
    hiddenTopicTitle,
    orderTopicTitle,
    activeTopicTitle,
  ]);

  const orderTopicDown = topicMoveButton(page, orderTopicTitle, "xuống");
  await orderTopicDown.focus();
  await expect(orderTopicDown).toBeFocused();
  await page.keyboard.press("Space");
  await expectVisibleArticleOrder(page, [
    hiddenTopicTitle,
    activeTopicTitle,
    orderTopicTitle,
  ]);

  await page.getByRole("button", { name: /Quay v/i }).click();
  await openTopicSheet(page, chapterTitle);
  await expectVisibleArticleOrder(page, [
    hiddenTopicTitle,
    activeTopicTitle,
    orderTopicTitle,
  ]);

  await assertCourseStructureOrderPersisted({
    chapterTitles: [chapterTitle, secondChapterTitle, thirdChapterTitle],
    topicChapterTitle: chapterTitle,
    topicTitles: [hiddenTopicTitle, activeTopicTitle, orderTopicTitle],
  });

  const hiddenTopicCard = page.locator("article").filter({ hasText: hiddenTopicTitle });
  await hiddenTopicCard
    .getByRole("button", {
      name: new RegExp(`^Sửa bài học ${escapeRegExp(hiddenTopicTitle)}$`),
    })
    .click();
  await fillActiveDialogTextbox(page, updatedTopicTitle);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /Ch.*duy/i }).click();
  await submitActiveDialog(page, /L.*u thay/i);
  await expect(articleByTitle(page, updatedTopicTitle)).toBeVisible();
  await expect(page.getByText(/Ch.*duy/i)).toBeVisible();

  const activeTopic = await findCourseStructureTopicByTitle(activeTopicTitle);

  const updatedTopicCard = page.locator("article").filter({ hasText: updatedTopicTitle });
  await updatedTopicCard
    .getByRole("button", {
      name: new RegExp(`^Ẩn bài học ${escapeRegExp(updatedTopicTitle)}$`),
    })
    .click();
  await submitActiveDialog(page, /n b.*i h/i);
  await expect(page.locator("article").filter({ hasText: updatedTopicTitle })).toHaveCount(0);

  await page.getByRole("button", { name: /Quay v/i }).click();
  await chapterRow
    .getByRole("button", {
      name: new RegExp(`^Ẩn chương ${escapeRegExp(chapterTitle)}$`),
    })
    .click();
  await submitActiveDialog(page, /n ch/i);
  await expect(page.locator("article").filter({ hasText: chapterTitle })).toHaveCount(0);

  await page.goto(`/courses/${courseId}/topics/${activeTopic.id}`);
  await expect(page).toHaveURL(new RegExp(`/courses/${courseId}/structure\\?topic_unavailable=1$`));

  const persisted = await assertCourseStructureSmokePersisted({
    chapterTitle,
    hiddenTopicTitle: updatedTopicTitle,
    activeTopicTitle,
  });
  expect(persisted.hiddenTopicId).toEqual(expect.any(String));
  expect(persisted.activeTopicId).toEqual(activeTopic.id);
});
