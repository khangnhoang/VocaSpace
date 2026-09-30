import { expect, type Page } from "@playwright/test";

export function chapterNavigator(page: Page) {
  return page.getByRole("navigation", { name: "Chương" });
}

export function chapterRow(page: Page, title: string) {
  return chapterNavigator(page).getByRole("listitem").filter({ hasText: title });
}

export function workbenchTopicList(page: Page, chapterTitle: string) {
  return page.getByRole("list", { name: `Bài học trong ${chapterTitle}` });
}

export async function selectStructureChapter(page: Page, title: string) {
  // Dòng chương còn có nút di chuyển (chỉ icon); nút chọn là nút chứa tên chương.
  await chapterRow(page, title).getByRole("button").filter({ hasText: title }).click();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
}

// Tạo bài học sẽ mở trình soạn bài học; quay lại để tiếp tục ở đúng chương đang chọn.
export async function createStructureTopic(page: Page, chapterTitle: string, title: string) {
  await page.getByRole("button", { name: "Thêm bài học" }).click();
  await fillActiveDialogTextbox(page, title);
  await submitActiveDialog(page, /Tạo và tiếp tục/);
  await page.waitForURL((url) => /\/topics\/[0-9a-f-]{36}$/.test(url.pathname), {
    timeout: 15_000,
  });
  await page.goBack();
  await expect(workbenchTopicList(page, chapterTitle).getByText(title, { exact: true })).toBeVisible();
}

export async function submitActiveDialog(page: Page, name: RegExp) {
  await page.getByRole("dialog").last().getByRole("button", { name }).click();
}

export async function fillActiveDialogTextbox(page: Page, value: string) {
  await page.getByRole("dialog").last().getByRole("textbox").last().fill(value);
}
