import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertCourseStructureOrderPersisted,
  assertCourseStructureSmokePersisted,
  courseStructureFixture,
  findCourseStructureTopicByTitle,
  prepareCourseStructureFixture,
} from "../../scripts/e2e/course-structure-fixture.mjs";
import { loginAsTeacher } from "../support/auth";
import { watchBrowserConsole } from "../support/console";
import {
  chapterNavigator,
  createStructureTopic,
  fillActiveDialogTextbox,
  selectStructureChapter,
  submitActiveDialog,
  workbenchTopicList,
} from "../support/structure-ui";
import { getCourseStructurePath } from "../../lib/course-authoring/routes";

// Test plan:
// - Proves an authorized teacher can manage course structure through the UI-4 navigator + chapter workbench.
// - Covers login UI, structure route, chapter create/order, topic create/order/inline rename/delete, and chapter delete.
// - After delete mutations, Structure stays usable (next chapter selected, no stale notice, no console errors)
//   and never re-reads the deleted topic through Topic Builder.
// - Asserts a deleted chapter does not cascade removed_at to active descendant topics.
// - Stale direct Topic Builder URLs are out of scope here (tracked as existing debt, not a UI-4 contract).
// - Uses an idempotent teacher/course fixture against isolated local Supabase.
// - Keeps the service-role key in Node-only fixture code, never in browser code.

function chapterMoveButton(page: Page, title: string, direction: "lên" | "xuống") {
  return page.getByRole("button", { name: `Di chuyển chương "${title}" ${direction}` });
}

function topicMoveButton(page: Page, title: string, direction: "lên" | "xuống") {
  return page.getByRole("button", { name: `Di chuyển bài học "${title}" ${direction}` });
}

async function expectListOrder(list: Locator, titles: string[]) {
  await expect
    .poll(async () => {
      const itemTexts = await list
        .getByRole("listitem")
        .evaluateAll((items) => items.map((item) => item.textContent ?? ""));

      return itemTexts
        .map((text) => titles.find((title) => text.includes(title)))
        .filter((title): title is string => Boolean(title));
    })
    .toEqual(titles);
}

async function createChapter(page: Page, title: string) {
  await page.getByRole("button", { name: "Thêm chương" }).click();
  await fillActiveDialogTextbox(page, title);
  await submitActiveDialog(page, /Tạo chương/);
  // Chương vừa tạo được chọn ngay để thêm bài học tiếp.
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
}

async function openTopicAction(page: Page, topicTitle: string, action: RegExp) {
  await page.getByRole("button", { name: `Thao tác khác cho bài học ${topicTitle}` }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

test("teacher manages structure and deletes without leaving the workspace broken", async ({
  page,
}) => {
  // Mỗi lần tạo bài học đi qua Topic Builder (dev server biên dịch lần đầu) rồi quay lại.
  test.setTimeout(180_000);
  const fixture = await prepareCourseStructureFixture();
  const courseId = fixture.E2E_COURSE_ID ?? courseStructureFixture.courseId;
  const chapterTitle = fixture.E2E_STRUCTURE_CHAPTER_TITLE;
  const secondChapterTitle = fixture.E2E_STRUCTURE_CHAPTER_SECOND_TITLE;
  const thirdChapterTitle = fixture.E2E_STRUCTURE_CHAPTER_THIRD_TITLE;
  const hiddenTopicTitle = fixture.E2E_STRUCTURE_TOPIC_HIDDEN_TITLE;
  const activeTopicTitle = fixture.E2E_STRUCTURE_TOPIC_ACTIVE_TITLE;
  const orderTopicTitle = fixture.E2E_STRUCTURE_TOPIC_ORDER_TITLE;
  const updatedTopicTitle = fixture.E2E_STRUCTURE_TOPIC_UPDATED_TITLE;

  const consoleGuard = watchBrowserConsole(page);
  await loginAsTeacher(page, fixture);

  await page.goto(getCourseStructurePath(courseId));
  await createChapter(page, chapterTitle);
  await createChapter(page, secondChapterTitle);
  await createChapter(page, thirdChapterTitle);
  await expectListOrder(chapterNavigator(page), [
    chapterTitle,
    secondChapterTitle,
    thirdChapterTitle,
  ]);

  await expect(chapterMoveButton(page, thirdChapterTitle, "xuống")).toBeDisabled();
  const thirdChapterUp = chapterMoveButton(page, thirdChapterTitle, "lên");
  await thirdChapterUp.focus();
  await expect(thirdChapterUp).toBeFocused();
  await page.keyboard.press("Enter");
  await expectListOrder(chapterNavigator(page), [
    chapterTitle,
    thirdChapterTitle,
    secondChapterTitle,
  ]);
  await expect(page.getByText("Chương 2 / 3")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: thirdChapterTitle })).toBeVisible();
  await expectListOrder(chapterNavigator(page), [
    chapterTitle,
    thirdChapterTitle,
    secondChapterTitle,
  ]);

  const thirdChapterDown = chapterMoveButton(page, thirdChapterTitle, "xuống");
  await thirdChapterDown.focus();
  await expect(thirdChapterDown).toBeFocused();
  await page.keyboard.press("Space");
  await expectListOrder(chapterNavigator(page), [
    chapterTitle,
    secondChapterTitle,
    thirdChapterTitle,
  ]);

  await page.reload();
  await expectListOrder(chapterNavigator(page), [
    chapterTitle,
    secondChapterTitle,
    thirdChapterTitle,
  ]);

  await selectStructureChapter(page, chapterTitle);
  await expect(chapterMoveButton(page, chapterTitle, "lên")).toBeDisabled();

  await createStructureTopic(page, chapterTitle, hiddenTopicTitle);
  await createStructureTopic(page, chapterTitle, activeTopicTitle);
  await createStructureTopic(page, chapterTitle, orderTopicTitle);
  const topicList = workbenchTopicList(page, chapterTitle);
  await expectListOrder(topicList, [hiddenTopicTitle, activeTopicTitle, orderTopicTitle]);

  await expect(topicMoveButton(page, hiddenTopicTitle, "lên")).toBeDisabled();
  await expect(topicMoveButton(page, orderTopicTitle, "xuống")).toBeDisabled();

  await topicMoveButton(page, orderTopicTitle, "lên").click();
  await expectListOrder(topicList, [hiddenTopicTitle, orderTopicTitle, activeTopicTitle]);

  await page.reload();
  await expectListOrder(workbenchTopicList(page, chapterTitle), [
    hiddenTopicTitle,
    orderTopicTitle,
    activeTopicTitle,
  ]);

  const orderTopicDown = topicMoveButton(page, orderTopicTitle, "xuống");
  await orderTopicDown.focus();
  await expect(orderTopicDown).toBeFocused();
  await page.keyboard.press("Space");
  await expectListOrder(topicList, [hiddenTopicTitle, activeTopicTitle, orderTopicTitle]);

  await assertCourseStructureOrderPersisted({
    chapterTitles: [chapterTitle, secondChapterTitle, thirdChapterTitle],
    topicChapterTitle: chapterTitle,
    topicTitles: [hiddenTopicTitle, activeTopicTitle, orderTopicTitle],
  });

  await openTopicAction(page, hiddenTopicTitle, /Đổi tên/);
  const renameInput = page.getByRole("textbox", { name: "Tên bài học" });
  await expect(renameInput).toBeFocused();
  await renameInput.fill(updatedTopicTitle);
  await renameInput.press("Enter");
  await expect(topicList.getByText(updatedTopicTitle, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Thao tác khác cho bài học ${updatedTopicTitle}` }),
  ).toBeFocused();

  const activeTopic = await findCourseStructureTopicByTitle(activeTopicTitle);

  await openTopicAction(page, updatedTopicTitle, /Xóa bài học/);
  await submitActiveDialog(page, /^Xóa bài học$/);
  await expect(topicList.getByText(updatedTopicTitle, { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: `Xóa chương ${chapterTitle}` }).click();
  await submitActiveDialog(page, /^Xóa chương$/);
  await expect(chapterNavigator(page).getByText(chapterTitle)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Chương đã xóa \(1\)/ })).toBeVisible();

  // Xóa xong, Structure vẫn dùng tiếp được ngay: chương kế tiếp được chọn,
  // không có thông báo liên kết cũ và không đi qua Topic Builder.
  await expectListOrder(chapterNavigator(page), [secondChapterTitle, thirdChapterTitle]);
  await expect(page.getByRole("heading", { level: 2, name: secondChapterTitle })).toBeVisible();
  await expect(page.getByText("Nội dung không còn khả dụng")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thêm chương" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Thêm bài học" })).toBeEnabled();
  await expect(page).toHaveURL(new RegExp(`/teacher/courses/${courseId}/structure`));
  await consoleGuard.expectNoErrors();

  const persisted = await assertCourseStructureSmokePersisted({
    chapterTitle,
    hiddenTopicTitle: updatedTopicTitle,
    activeTopicTitle,
  });
  expect(persisted.hiddenTopicId).toEqual(expect.any(String));
  expect(persisted.activeTopicId).toEqual(activeTopic.id);
});
