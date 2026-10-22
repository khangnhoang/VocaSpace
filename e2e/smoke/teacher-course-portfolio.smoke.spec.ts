import { expect, test } from "@playwright/test";
import { portfolioFixture, preparePortfolioFixture } from "../../scripts/e2e/teacher-course-portfolio-fixture.mjs";
import { loginAsTeacher } from "../support/auth";
import { watchBrowserConsole } from "../support/console";

// Test plan:
// - Mục tiêu: chứng minh portfolio tải qua server thật, điều hướng attention và refresh sau sửa.
// - Loại test: Chromium smoke, database E2E cô lập; không ghi database dev gốc.
// - Đối tượng: /teacher/courses, CP1 read, updateCourse, CourseForm, Course Overview.
// - Case thành công: correction hiện đúng course, mở đúng route, lưu tên và thấy dữ liệu mới không reload.
// - Case thất bại: console/pageerror làm test thất bại; fixture từ chối API ngoài 45441.
// - Bảo mật/phân quyền: teacher owner được sửa; ma trận quyền do CP1 integration và component test sở hữu.
// - Ổn định/resilience: reload cuối xác nhận dữ liệu đã lưu; 375px không overflow.
// - Invariant: không dùng mock action/RPC; kết quả UI sau mutation phải khớp database.
// - Kết quả verify gần nhất: passed bằng `npm run test:e2e -- e2e/smoke/teacher-course-portfolio.smoke.spec.ts` (1/1, API 45441).

test("teacher resumes correction and sees an authoritative portfolio refresh after editing", async ({ page }) => {
  test.setTimeout(180_000);
  const { supabase } = await preparePortfolioFixture();
  await loginAsTeacher(page, { E2E_TEACHER_EMAIL: portfolioFixture.teacherEmail, E2E_TEACHER_PASSWORD: portfolioFixture.teacherPassword });
  await page.goto("/teacher/courses");
  const consoleGuard = watchBrowserConsole(page, { failOn: [/.*/] });
  await expect(page.getByRole("heading", { name: "Khóa học của tôi" })).toBeVisible();
  const correction = page.getByRole("link", { name: `Sửa: ${portfolioFixture.title}`, exact: true });
  await expect(correction).toBeVisible();
  await correction.click();
  await expect(page).toHaveURL(new RegExp(`/teacher/courses/${portfolioFixture.courseId}$`), { timeout: 30_000 });
  await page.goto("/teacher/courses");
  await page.getByRole("button", { name: "Cài đặt thông tin", exact: true }).click();
  const newTitle = `${portfolioFixture.title} đã sửa`;
  await page.getByLabel("Tên khóa học").fill(newTitle);
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("heading", { level: 2, name: newTitle, exact: true })).toBeVisible();
  const persisted = await supabase.from("courses").select("title").eq("id", portfolioFixture.courseId).single();
  expect(persisted.error).toBeNull();
  expect(persisted.data?.title).toBe(newTitle);
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: newTitle, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await consoleGuard.expectNoErrors();
});
