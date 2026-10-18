import { expect, test } from "@playwright/test";
import {
  MATRIX_COURSE_SLUG,
  MATRIX_TOPICS,
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";
import { getTopicBuilderPath } from "../../lib/course-authoring/routes";
import { loginAsStudent, loginAsTeacher } from "../support/auth";

// spec: docs/programs/student-user-flow-route/implementation-plans/tfeat1/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật rằng sửa một thẻ trong bài học ĐÃ XUẤT BẢN được lưu tại chỗ,
//   bài học vẫn là "Đã xuất bản" và học viên thấy chữ mới ngay (TFEAT1 AC1, AC4).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441); fixture matrix tạo trong beforeAll, dọn trong afterAll.
// - Đối tượng: tab Flashcards của Topic Builder, updateCard Server Action, d1_update_card, trang học của học viên.
// - Case thành công: giáo viên sửa từ của thẻ đầu, không có hộp thoại xác nhận nào, huy hiệu vẫn "Đã xuất bản",
//   status trong DB vẫn published, học viên (context riêng) thấy từ mới trên trang học.
// - Bảo mật/phân quyền: service role chỉ đọc status trong Node; trình duyệt dùng tài khoản teacher và student seed.
// - Invariant cần giữ: không có native dialog (window.confirm) và bài học không bị đưa về draft.
// - Chưa kiểm chứng: cảnh báo xóa/đổi đáp án (đã có component test), cảm nhận UX do Owner kiểm tra bằng tay.
// - Kết quả verify gần nhất: passed (1/1) ngày 2026-10-18 (chạy `npm run test:e2e -- e2e/smoke/published-topic-live-edit.smoke.spec.ts`).

const TEACHER = { E2E_TEACHER_EMAIL: "teacher@gmail.com", E2E_TEACHER_PASSWORD: "123123" };
const STUDENT = { E2E_STUDENT_EMAIL: "student@gmail.com", E2E_STUDENT_PASSWORD: "123123" };
const OLD_WORD = "schedule";
const NEW_WORD = "timetable";

test.beforeAll(async () => {
  test.setTimeout(240_000);
  await seedLearningWorkspaceMatrix();
});

test.afterAll(async () => {
  await cleanupLearningWorkspaceMatrix();
});

async function readTopic() {
  const admin = createSupabaseAdmin(process.env);
  const topic = await admin
    .from("topics")
    .select("id, course_id, status")
    .eq("slug", MATRIX_TOPICS.full.slug)
    .single();
  if (topic.error) throw new Error(topic.error.message);
  return topic.data;
}

test("teacher edits a card of a published topic in place and the learner sees it at once", async ({
  page,
  browser,
}) => {
  const topic = await readTopic();
  expect(topic.status).toBe("published");

  // Một hộp thoại native (window.confirm) nghĩa là luồng cũ "chuyển về draft" còn sót lại.
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await loginAsTeacher(page, TEACHER);
  await page.goto(getTopicBuilderPath(topic.course_id, topic.id, "flashcards"));
  await expect(page.getByRole("heading", { name: "Topic Builder" })).toBeVisible();
  await expect(page.getByText("Đã xuất bản").first()).toBeVisible();

  const card = page.locator(".group").filter({ hasText: OLD_WORD }).first();
  await expect(card).toBeVisible();
  await card.hover();
  await card.getByRole("button", { name: "Sửa thẻ từ vựng" }).click();

  const dialog = page.getByRole("dialog", { name: "Sửa thẻ từ vựng" });
  await dialog.getByRole("textbox").first().fill(NEW_WORD);
  await dialog.getByRole("button", { name: "Xác nhận lưu" }).click();

  await expect(page.getByText("Cập nhật từ vựng thành công!")).toBeVisible();
  await expect(page.getByText(NEW_WORD, { exact: false }).first()).toBeVisible();
  expect(nativeDialogs).toEqual([]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Topic Builder" })).toBeVisible();
  await expect(page.getByText("Đã xuất bản").first()).toBeVisible();
  expect((await readTopic()).status).toBe("published");

  const learnerContext = await browser.newContext();
  try {
    const learner = await learnerContext.newPage();
    await loginAsStudent(learner, STUDENT);
    await learner.goto(`/learn/${MATRIX_COURSE_SLUG}/${MATRIX_TOPICS.full.slug}`);
    await expect(learner.getByText(NEW_WORD, { exact: true })).toBeVisible();
    await expect(learner.getByText(OLD_WORD, { exact: true })).toHaveCount(0);
  } finally {
    await learnerContext.close();
  }
});
