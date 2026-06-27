import { expect, type Page } from "@playwright/test";

type TeacherLoginFixture = {
  E2E_TEACHER_EMAIL: string;
  E2E_TEACHER_PASSWORD: string;
};

export async function loginAsTeacher(page: Page, fixture: TeacherLoginFixture) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(fixture.E2E_TEACHER_EMAIL);
  await page.getByLabel("Password").fill(fixture.E2E_TEACHER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}
