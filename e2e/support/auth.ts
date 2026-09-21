import { expect, type Page } from "@playwright/test";

type TeacherLoginFixture = {
  E2E_TEACHER_EMAIL: string;
  E2E_TEACHER_PASSWORD: string;
};

type StudentLoginFixture = {
  E2E_STUDENT_EMAIL: string;
  E2E_STUDENT_PASSWORD: string;
};

async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function loginAsTeacher(page: Page, fixture: TeacherLoginFixture) {
  await loginWithCredentials(page, fixture.E2E_TEACHER_EMAIL, fixture.E2E_TEACHER_PASSWORD);
}

export async function loginAsStudent(page: Page, fixture: StudentLoginFixture) {
  await loginWithCredentials(page, fixture.E2E_STUDENT_EMAIL, fixture.E2E_STUDENT_PASSWORD);
}
