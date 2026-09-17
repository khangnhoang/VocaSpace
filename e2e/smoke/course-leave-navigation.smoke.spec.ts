import { expect, test } from "@playwright/test";
import { prepareCourseLeaveNavigationFixture } from "../../scripts/e2e/course-leave-navigation-fixture.mjs";
import { loginAsStudent } from "../support/auth";
import { getCourseOverviewPath } from "../../lib/course-authoring/routes";

// Test plan:
// - Mục tiêu: chứng minh student collaborator rời khóa học rồi được đưa về public catalog.
// - Loại test: bounded Playwright smoke trên isolated local Supabase.
// - Case thành công: membership editor không có trách nhiệm bài học, leave transaction thành công, URL cuối là /courses.
// - Bảo mật/phân quyền: student phải có membership course-scoped để mở leave surface; destination lấy từ global role trusted.
// - Ổn định/resilience: xác nhận bằng app dialog, không dùng window.confirm và không dựa vào route teacher sau khi membership bị xóa.
// - Invariant cần giữ: global student không bị điều hướng vào teacher course list rỗng sau khi rời collaborator course.

test("takes a student collaborator to the public catalog after leaving a course", async ({ page }) => {
  const fixture = await prepareCourseLeaveNavigationFixture();
  const courseId = fixture.E2E_COURSE_ID;

  await loginAsStudent(page, fixture);
  await page.goto(getCourseOverviewPath(courseId));
  await expect(page.getByRole("button", { name: "Rời khóa học" })).toBeVisible();

  await page.getByRole("button", { name: "Rời khóa học" }).click();
  const leaveDialog = page.getByRole("dialog").last();
  await expect(leaveDialog).toContainText("Sau khi rời khóa học, bạn sẽ mất các quyền cộng tác hiện tại.");
  await leaveDialog.getByRole("button", { name: "Xác nhận rời khóa học" }).click();
  await expect(page).toHaveURL(/\/courses\/?$/, { timeout: 15_000 });
});
