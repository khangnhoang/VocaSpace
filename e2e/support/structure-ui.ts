import { expect, type Page } from "@playwright/test";

export async function createStructureTopic(page: Page, title: string) {
  await page.getByRole("button", { name: /Th.*m b.*i h/i }).click();
  await fillActiveDialogTextbox(page, title);
  await submitActiveDialog(page, /T.*o b.*i h/i);
  await expect(page.locator("article").filter({ hasText: title })).toBeVisible();
}

export async function submitActiveDialog(page: Page, name: RegExp) {
  await page.getByRole("dialog").last().getByRole("button", { name }).click();
}

export async function fillActiveDialogTextbox(page: Page, value: string) {
  await page.getByRole("dialog").last().getByRole("textbox").last().fill(value);
}
