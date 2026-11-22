import { expect, test } from "@playwright/test";
import {
  assertExerciseAuthoringSmokePersisted,
  prepareExerciseAuthoringFixture,
} from "../../scripts/e2e/exercise-authoring-fixture.mjs";
import { getWorkerScope } from "../../scripts/e2e/support/worker-scope.mjs";
import { getTopicBuilderPath } from "../../lib/course-authoring/routes";
import { loginAsTeacher } from "../support/auth";
import { expectTopicBuilder } from "../support/structure-ui";

// Test plan:
// - Mục tiêu: teacher là co_owner và tác giả topic draft tạo bài tập TOEIC Part 7 qua browser.
// - Loại test: smoke E2E trên isolated local Supabase.
// - Đối tượng: login, tab Bài tập, composer inline (chọn Part bằng thẻ), createExercise và persistence qua RPC.
// - Bảo mật/phân quyền: service-role chỉ dùng trong Node để dựng/đọc fixture.
// - Invariant: bài tập, nhóm, câu hỏi và đáp án đúng được lưu vào đúng topic/course.
// - Ghi chú: không bao gồm Part 5; vấn đề đó được theo dõi riêng.
// - Kết quả verify: scenario passed trong lượt focused bốn spec E2E-001 bằng `npm run test:e2e`.

test("teacher creates and persists a TOEIC Part 7 exercise through the browser UI", async ({
  page,
}) => {
  // Worker-scoped: giáo viên, khóa học và topic riêng của worker này (parallelIndex).
  const scope = getWorkerScope(test.info().parallelIndex);
  const fixture = await prepareExerciseAuthoringFixture(scope);
  const title = fixture.E2E_EXERCISE_TITLE;
  const courseId = fixture.E2E_COURSE_ID;
  const topicId = fixture.E2E_TOPIC_ID;

  await loginAsTeacher(page, fixture);

  await page.goto(getTopicBuilderPath(courseId, topicId, "exercises"));
  await expectTopicBuilder(page);
  await expect(page.getByRole("tab", { name: /^Bài tập/ })).toHaveAttribute("data-state", "active");

  await page.getByRole("button", { name: "Thêm bài tập" }).first().click();
  await page.getByText("Part 7 · Reading Comprehension (Reading)").click();
  await page.getByLabel(/^Tên bài tập/).fill(title);
  await page.getByLabel("Đoạn văn").fill("A short reading passage for the exercise authoring smoke test.");
  await page.getByLabel("Câu 1", { exact: true }).fill("Which option is correct?");
  await page.getByRole("textbox", { name: "Đáp án A của câu 1 nhóm 1", exact: true }).fill("Correct option");
  await page.getByRole("textbox", { name: "Đáp án B của câu 1 nhóm 1", exact: true }).fill("Distractor option");

  await page.getByRole("button", { name: "Lưu bài tập" }).click();

  await expect(page.getByRole("button", { name: new RegExp(`^${title}`) })).toBeVisible();

  const persisted = await assertExerciseAuthoringSmokePersisted(scope, title);
  expect(persisted.exerciseId).toEqual(expect.any(String));
});
