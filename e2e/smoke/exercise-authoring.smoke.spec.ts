import { expect, test } from "@playwright/test";
import {
  assertExerciseAuthoringSmokePersisted,
  exerciseAuthoringFixture,
  prepareExerciseAuthoringFixture,
} from "../../scripts/e2e/exercise-authoring-fixture.mjs";
import { getTopicBuilderPath } from "../../lib/course-authoring/routes";
import { loginAsTeacher } from "../support/auth";

// Test plan:
// - Mục tiêu: teacher là co_owner và tác giả topic draft tạo bài tập TOEIC Part 7 qua browser.
// - Loại test: smoke E2E trên isolated local Supabase.
// - Đối tượng: login, tab bài tập, createExercise và persistence qua RPC.
// - Bảo mật/phân quyền: service-role chỉ dùng trong Node để dựng/đọc fixture.
// - Invariant: bài tập, nhóm, câu hỏi và đáp án đúng được lưu vào đúng topic/course.
// - Ghi chú: không bao gồm Part 5; vấn đề đó được theo dõi riêng.
// - Kết quả verify: scenario passed trong lượt focused bốn spec E2E-001 bằng `npm run test:e2e`.

test("teacher creates and persists a TOEIC Part 7 exercise through the browser UI", async ({
  page,
}) => {
  const fixture = await prepareExerciseAuthoringFixture();
  const title = fixture.E2E_EXERCISE_TITLE;
  const courseId = fixture.E2E_COURSE_ID ?? exerciseAuthoringFixture.courseId;
  const topicId = fixture.E2E_TOPIC_ID ?? exerciseAuthoringFixture.topicId;

  await loginAsTeacher(page, fixture);

  await page.goto(getTopicBuilderPath(courseId, topicId, "exercises"));
  await expect(page.getByRole("heading", { name: "Topic Builder" })).toBeVisible();
  await page.getByRole("tab", { name: /TOEIC/ }).click();

  await page.getByRole("button", { name: "Add TOEIC exercise" }).click();
  await page.getByLabel("Exercise title").fill(title);
  await page
    .getByLabel("Passage text group 1")
    .fill("A short reading passage for the exercise authoring smoke test.");
  await page
    .getByLabel("Question content group 1 question 1")
    .fill("Which option is correct?");
  await page.getByLabel("Answer A").fill("Correct option");
  await page.getByLabel("Answer B").fill("Distractor option");

  await page.getByLabel("Save exercise").click();

  await expect(page.getByText(title)).toBeVisible();

  const persisted = await assertExerciseAuthoringSmokePersisted(title);
  expect(persisted.exerciseId).toEqual(expect.any(String));
});
