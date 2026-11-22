import { expect, test } from "@playwright/test";
import {
  cleanupLearningWorkspaceMatrix,
  matrixFor,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { getWorkerScope, assertIsolatedRuntime } from "../../scripts/e2e/support/worker-scope.mjs";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";
import { getTopicBuilderPath } from "../../lib/course-authoring/routes";
import { loginAsStudent, loginAsTeacher } from "../support/auth";
import { expectTopicBuilder } from "../support/structure-ui";

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

const OLD_WORD = "schedule";
const NEW_WORD = "timetable";

// Worker-scoped: ma trận, học viên và giáo viên riêng của worker này (parallelIndex); gán trong beforeAll.
let scope: ReturnType<typeof getWorkerScope>;
let matrix: ReturnType<typeof matrixFor>;

test.beforeAll(async () => {
  scope = getWorkerScope(test.info().parallelIndex);
  matrix = matrixFor(scope);
  test.setTimeout(240_000);
  await seedLearningWorkspaceMatrix(process.env, { scope });
});

test.afterAll(async () => {
  await cleanupLearningWorkspaceMatrix(process.env, { scope });
});

async function readTopic() {
  assertIsolatedRuntime(process.env);
  const admin = createSupabaseAdmin(process.env);
  const topic = await admin
    .from("topics")
    .select("id, course_id, status")
    .eq("slug", matrix.topics.full.slug)
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

  await loginAsTeacher(page, { E2E_TEACHER_EMAIL: matrix.teacher.email, E2E_TEACHER_PASSWORD: matrix.teacher.password });
  await page.goto(getTopicBuilderPath(topic.course_id, topic.id, "flashcards"));
  await expectTopicBuilder(page);
  await expect(page.getByText("Đã xuất bản").first()).toBeVisible();

  // TFEAT4: sửa thẻ inline trong editor bên phải, không còn dialog sửa.
  await page.getByRole("button", { name: new RegExp(OLD_WORD) }).first().click();
  await page.getByRole("textbox", { name: "Từ vựng" }).fill(NEW_WORD);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();

  await expect(page.getByText("Cập nhật từ vựng thành công!")).toBeVisible();
  await expect(page.getByText(NEW_WORD, { exact: false }).first()).toBeVisible();
  expect(nativeDialogs).toEqual([]);

  await page.reload();
  await expectTopicBuilder(page);
  await expect(page.getByText("Đã xuất bản").first()).toBeVisible();
  expect((await readTopic()).status).toBe("published");

  const learnerContext = await browser.newContext();
  try {
    const learner = await learnerContext.newPage();
    await loginAsStudent(learner, { E2E_STUDENT_EMAIL: matrix.student.email, E2E_STUDENT_PASSWORD: matrix.student.password });
    await learner.goto(`/learn/${matrix.courseSlug}/${matrix.topics.full.slug}`);
    await expect(learner.getByText(NEW_WORD, { exact: true })).toBeVisible();
    await expect(learner.getByText(OLD_WORD, { exact: true })).toHaveCount(0);
  } finally {
    await learnerContext.close();
  }
});
