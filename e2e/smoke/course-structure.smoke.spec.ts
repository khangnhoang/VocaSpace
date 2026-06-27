import { expect, test } from "@playwright/test";
import {
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
// - Covers login UI, structure route, chapter create, topic create/edit/hide, chapter hide, and topic builder guard.
// - Asserts hidden chapter does not cascade removed_at to active descendant topics.
// - Uses an idempotent teacher/course fixture against isolated local Supabase.
// - Keeps the service-role key in Node-only fixture code, never in browser code.

test("teacher manages structure metadata and hidden-parent topic guard", async ({
  page,
}) => {
  const fixture = await prepareCourseStructureFixture();
  const courseId = fixture.E2E_COURSE_ID ?? courseStructureFixture.courseId;
  const chapterTitle = fixture.E2E_STRUCTURE_CHAPTER_TITLE;
  const hiddenTopicTitle = fixture.E2E_STRUCTURE_TOPIC_HIDDEN_TITLE;
  const activeTopicTitle = fixture.E2E_STRUCTURE_TOPIC_ACTIVE_TITLE;
  const updatedTopicTitle = fixture.E2E_STRUCTURE_TOPIC_UPDATED_TITLE;

  await loginAsTeacher(page, fixture);

  await page.goto(`/courses/${courseId}/structure`);
  await page.getByRole("button", { name: /Th.*m Ch/i }).click();
  await fillActiveDialogTextbox(page, chapterTitle);
  await submitActiveDialog(page, /T.*o ch/i);
  await expect(page.getByText(chapterTitle)).toBeVisible();

  const chapterRow = page.locator("article").filter({ hasText: chapterTitle });
  await chapterRow.getByRole("button").first().click();

  await createStructureTopic(page, hiddenTopicTitle);
  await createStructureTopic(page, activeTopicTitle);

  const hiddenTopicCard = page.locator("article").filter({ hasText: hiddenTopicTitle });
  await hiddenTopicCard.getByRole("button").nth(1).click();
  await fillActiveDialogTextbox(page, updatedTopicTitle);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /Ch.*duy/i }).click();
  await submitActiveDialog(page, /L.*u thay/i);
  await expect(page.getByText(updatedTopicTitle)).toBeVisible();
  await expect(page.getByText(/Ch.*duy/i)).toBeVisible();

  const activeTopic = await findCourseStructureTopicByTitle(activeTopicTitle);

  const updatedTopicCard = page.locator("article").filter({ hasText: updatedTopicTitle });
  await updatedTopicCard.getByRole("button").nth(3).click();
  await submitActiveDialog(page, /n b.*i h/i);
  await expect(page.locator("article").filter({ hasText: updatedTopicTitle })).toHaveCount(0);

  await page.getByRole("button", { name: /Quay v/i }).click();
  await chapterRow.getByRole("button").last().click();
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
