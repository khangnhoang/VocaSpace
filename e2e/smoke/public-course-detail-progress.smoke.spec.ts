import { expect, test, type Page } from "@playwright/test";
import {
  MATRIX_COURSE_SLUG,
  MATRIX_TOPICS,
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/lf3/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật đề cương ở trang chi tiết khóa học của học viên đã ghi danh (LF3 AC10, Q7):
//   mọi chủ đề là liên kết /learn (kể cả chủ đề Preview), trạng thái Đã hoàn thành / Học tiếp / Sắp tới, nút chính "Tiếp tục: <tên chủ đề>" (FEAT3 AC6a).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441) với fixture ma trận D8 tạo trong beforeAll, dọn trong afterAll.
// - Case thành công: chưa có tiến độ thì chủ đề đầu là Học tiếp; hoàn thành thật một chủ đề trong workspace rồi quay lại trang chi tiết
//   thì chủ đề đó là Đã hoàn thành (tải mới, không phải bản cũ); "Tiếp tục: <tên chủ đề>" mở đúng chủ đề Học tiếp.
// - Case thất bại / ranh giới: khách chưa đăng nhập vẫn thấy đề cương cũ (liên kết xem thử, khóa), không có liên kết /learn.
// - Bảo mật/phân quyền: ghi chỉ bằng service role trong runtime E2E cô lập để dọn tiến độ của học viên seed.
// - Ổn định/resilience: không tràn ngang ở 375px và 1280px.
// - Invariant cần giữ: trạng thái trên trang chi tiết lấy từ cùng projection với tổng quan `/learn/<course>`.
// - Kết quả verify gần nhất: xem báo cáo checkpoint LF3 CP7 (chạy `npm run test:e2e -- e2e/smoke/public-course-detail-progress.smoke.spec.ts`).

test.describe.configure({ mode: "serial" });

const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const coursePath = `/courses/${MATRIX_COURSE_SLUG}`;
const firstTopic = MATRIX_TOPICS.full;
const memoryTopic = MATRIX_TOPICS.memory;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  await seedLearningWorkspaceMatrix();
});

test.afterAll(async () => {
  await cleanupLearningWorkspaceMatrix();
});

async function resetStudentProgress() {
  const admin = createSupabaseAdmin(process.env);
  const course = await admin.from("courses").select("id").eq("slug", MATRIX_COURSE_SLUG).single();
  if (course.error) throw new Error(course.error.message);
  const topics = await admin.from("topics").select("id").eq("course_id", course.data.id);
  if (topics.error) throw new Error(topics.error.message);
  const topicIds = topics.data.map((topic) => topic.id);
  const questions = await admin.from("questions").select("id").eq("course_id", course.data.id);
  if (questions.error) throw new Error(questions.error.message);

  const answers = await admin
    .from("user_question_answers")
    .delete()
    .eq("user_id", STUDENT_ID)
    .in("question_id", questions.data.map((question) => question.id));
  if (answers.error) throw new Error(answers.error.message);
  const progress = await admin
    .from("user_topic_progress")
    .delete()
    .eq("user_id", STUDENT_ID)
    .in("topic_id", topicIds);
  if (progress.error) throw new Error(progress.error.message);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
}

// Chỉ tìm trong đề cương: thẻ đang học (FEAT3 AC6) cũng có liên kết tới các chủ đề vừa học.
const topicLink = (page: Page, title: string) =>
  page
    .getByRole("region", { name: "Đề cương khóa học" })
    .getByRole("link", { name: new RegExp(`^${title}`) });

test("a visitor still sees the preview syllabus without learning links", async ({ page }) => {
  await page.goto(coursePath);

  await expect(topicLink(page, firstTopic.title)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Xem thử bài học" })).toHaveCount(1);
  await expect(page.getByText("Nội dung dành cho học viên").first()).toBeVisible();
  await expect(page.locator(`a[href^="/learn/${MATRIX_COURSE_SLUG}/"]`)).toHaveCount(0);
});

for (const width of [375, 1280]) {
  test(`an enrolled learner sees topic states, completes a topic and sees it done on return at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await resetStudentProgress();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await page.getByLabel("Email").fill("student@gmail.com");
    await page.getByLabel("Password").fill("123123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);

    // Chưa có tiến độ: chủ đề đầu (cũng là chủ đề Preview) là liên kết /learn với trạng thái Học tiếp.
    await page.goto(coursePath);
    const first = topicLink(page, firstTopic.title);
    await expect(first).toHaveAttribute("href", `/learn/${MATRIX_COURSE_SLUG}/${firstTopic.slug}`);
    await expect(first).toContainText("Học tiếp");
    const memory = topicLink(page, memoryTopic.title);
    await expect(memory).toHaveAttribute("href", `/learn/${MATRIX_COURSE_SLUG}/${memoryTopic.slug}`);
    await expect(memory).toContainText("Sắp tới");
    await expect(page.getByText("Học tiếp", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Đã hoàn thành", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Xem thử bài học" })).toHaveCount(0);
    await expect(page.getByText("Nội dung dành cho học viên")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // Hoàn thành thật chủ đề memory check: memory check rồi bài tập duy nhất của chủ đề.
    await memory.click();
    await expect(page).toHaveURL(new RegExp(`/learn/${MATRIX_COURSE_SLUG}/${memoryTopic.slug}$`));
    await page.getByRole("radio", { name: /đáng tin cậy/ }).click();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await expect(page.getByRole("radio", { name: /bạn chọn đúng/ })).toBeVisible();
    await page.getByRole("button", { name: "Câu tiếp theo" }).click();
    await page.getByRole("radio", { name: /enhance/ }).click();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    // LF9: khi server xác nhận đạt, workspace tự mở bài tập; không còn nút trung gian.
    await expect(page.getByText("Part 5 sau memory check")).toBeVisible();
    await page.getByRole("radio", { name: /^(?:[A-C]\.?\s*)?return$/ }).click();
    await page.getByRole("button", { name: "Xác nhận đáp án" }).click();

    const admin = createSupabaseAdmin(process.env);
    await expect
      .poll(async () => {
        const rows = await admin
          .from("user_topic_progress")
          .select("is_topic_completed, topics!inner(slug)")
          .eq("user_id", STUDENT_ID)
          .eq("topics.slug", memoryTopic.slug);
        if (rows.error) throw new Error(rows.error.message);
        return rows.data.some((row) => row.is_topic_completed === true);
      })
      .toBe(true);

    // Quay lại trang chi tiết: chủ đề vừa học đã hoàn thành, chủ đề đầu vẫn là Học tiếp.
    await page.goto(coursePath);
    await expect(topicLink(page, memoryTopic.title)).toContainText("Đã hoàn thành");
    await expect(topicLink(page, firstTopic.title)).toContainText("Học tiếp");
    await expect(page.getByText("Đã hoàn thành", { exact: true })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);

    // FEAT3 AC6a: nút chính của thẻ đang học "Tiếp tục: <tên chủ đề>" mở đúng chủ đề Học tiếp.
    await page.getByRole("button", { name: `Tiếp tục: ${firstTopic.title}` }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${MATRIX_COURSE_SLUG}/${firstTopic.slug}$`));
    // Chờ trang học tải xong để afterAll không dọn fixture giữa lúc trang đang đồng bộ tiến độ.
    await expect(page.getByRole("list", { name: "Các bước của bài học" })).toBeVisible();
  });
}
