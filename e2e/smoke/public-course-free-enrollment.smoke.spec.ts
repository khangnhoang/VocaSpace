import { expect, test, type Page } from "@playwright/test";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";
import { ensureWorkerAccount } from "../../scripts/e2e/support/worker-accounts.mjs";
import { assertIsolatedRuntime, getWorkerScope } from "../../scripts/e2e/support/worker-scope.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/lf3/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật rằng đăng ký khóa miễn phí ở lại trang chi tiết và chỉ mở chủ đề đầu khi bấm "Bắt đầu học" (LF3 AC7).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441) với khóa miễn phí có sẵn trong seed; học viên là tài khoản riêng của worker; chủ đề seed chỉ được đọc (không spec nào còn đưa nó về draft). beforeEach xóa tiến độ của học viên ở chủ đề đó, afterEach gỡ ghi danh vừa tạo.
// - Case thành công: đăng ký xong thì modal đóng, URL không đổi, nút chính đổi thành "Bắt đầu học"; bấm mới vào chủ đề đầu tiên.
// - Case thất bại: không có (đường lỗi điều hướng đã có component test).
// - Bảo mật/phân quyền: chỉ ghi ghi danh của học viên worker-scoped trên runtime E2E cô lập, dọn lại sau test.
// - Ổn định/resilience: không tràn ngang ở 375px và 1280px.
// - Invariant cần giữ: không có điều hướng tự động sau đăng ký; học viên đã ghi danh từ trước thấy "Tiếp tục: <tên chủ đề>" (FEAT3 AC6a).
// - Kết quả verify gần nhất: xem báo cáo checkpoint LF3 CP4 (chạy `npm run test:e2e -- e2e/smoke/public-course-free-enrollment.smoke.spec.ts`).

const COURSE_SLUG = "local-toeic-test-course";
const FIRST_TOPIC_SLUG = "local-test-topic";

// Worker-scoped: học viên riêng của worker (parallelIndex), nên ghi danh/tiến độ của spec này không đụng học viên seed
// mà `learning-workspace` và `enrolled-course-overview` đọc. Khóa học và chủ đề seed chỉ được đọc, không bị ghi.
const currentStudent = () => getWorkerScope(test.info().parallelIndex).student;

async function removeStudentEnrollment() {
  assertIsolatedRuntime(process.env);
  const admin = createSupabaseAdmin(process.env);
  const course = await admin.from("courses").select("id").eq("slug", COURSE_SLUG).single();
  if (course.error) throw new Error(course.error.message);
  const removed = await admin
    .from("enrollments")
    .delete()
    .eq("course_id", course.data.id)
    .eq("user_id", currentStudent().id);
  if (removed.error) throw new Error(removed.error.message);
}

// Chủ đề seed không có thẻ hay bài tập, nên mở nó (test "Bắt đầu học") là đồng bộ thành hoàn thành;
// xóa tiến độ để mỗi test bắt đầu như học viên chưa học chủ đề nào.
async function forgetFirstTopicProgress() {
  assertIsolatedRuntime(process.env);
  const admin = createSupabaseAdmin(process.env);
  const course = await admin.from("courses").select("id").eq("slug", COURSE_SLUG).single();
  if (course.error) throw new Error(course.error.message);
  const topic = await admin
    .from("topics")
    .select("id")
    .eq("course_id", course.data.id)
    .eq("slug", FIRST_TOPIC_SLUG)
    .single();
  if (topic.error) throw new Error(topic.error.message);
  const removed = await admin
    .from("user_topic_progress")
    .delete()
    .eq("topic_id", topic.data.id)
    .eq("user_id", currentStudent().id);
  if (removed.error) throw new Error(removed.error.message);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
}

test.beforeEach(async ({ page }) => {
  assertIsolatedRuntime(process.env);
  await ensureWorkerAccount(createSupabaseAdmin(process.env), currentStudent(), "student");
  await removeStudentEnrollment();
  await forgetFirstTopicProgress();
  await page.goto("/login");
  await page.getByLabel("Email").fill(currentStudent().email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(currentStudent().password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test.afterEach(async () => {
  await removeStudentEnrollment();
});

for (const width of [375, 1280]) {
  test(`free enrollment stays on the course page and offers Bắt đầu học at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const coursePath = `/courses/${COURSE_SLUG}`;
    await page.goto(coursePath);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Đăng ký miễn phí" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Đăng ký khóa học miễn phí" });
    await dialog.getByRole("button", { name: "Đăng ký miễn phí" }).click();

    // Ở lại trang: modal đóng, URL không đổi, nút chính là "Bắt đầu học".
    await expect(dialog).toBeHidden();
    const start = page.getByRole("button", { name: "Bắt đầu học" });
    await expect(start).toBeVisible();
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toBe(coursePath);
    await expectNoHorizontalOverflow(page);

    // Chỉ bấm mới mở chủ đề đầu tiên.
    await start.click();
    await expect(page).toHaveURL(new RegExp(`/learn/${COURSE_SLUG}/${FIRST_TOPIC_SLUG}$`));
  });
}

test("a learner who is already enrolled sees Tiếp tục with the next topic", async ({ page }) => {
  assertIsolatedRuntime(process.env);
  const admin = createSupabaseAdmin(process.env);
  const course = await admin.from("courses").select("id").eq("slug", COURSE_SLUG).single();
  if (course.error) throw new Error(course.error.message);
  const enrolled = await admin
    .from("enrollments")
    .insert({ course_id: course.data.id, user_id: currentStudent().id });
  if (enrolled.error) throw new Error(enrolled.error.message);

  await page.goto(`/courses/${COURSE_SLUG}`);
  // FEAT3 AC6a: thẻ đang học đặt tên chủ đề kế vào nút chính.
  await expect(page.getByRole("button", { name: "Tiếp tục: Local Test Topic" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bắt đầu học" })).toHaveCount(0);
});
