import { expect, test } from "@playwright/test";
import {
  assertExerciseAuthoringSmokePersisted,
  exerciseAuthoringFixture,
  prepareExerciseAuthoringFixture,
} from "../../scripts/e2e/exercise-authoring-fixture.mjs";

// Test plan:
// - Proves an authorized teacher can create a real TOEIC Part 7 exercise through the browser UI.
// - Covers login UI, topic exercise tab, Server Action createExercise, and RPC persistence.
// - Uses an idempotent teacher/course/topic fixture against isolated local Supabase.
// - Keeps the service-role key in Node-only fixture code, never in browser code.
// - Does not cover Part 5; that known issue is tracked separately.

test("teacher creates and persists a TOEIC Part 7 exercise through the browser UI", async ({
  page,
}) => {
  const fixture = await prepareExerciseAuthoringFixture();
  const title = fixture.E2E_EXERCISE_TITLE;
  const teacherEmail = fixture.E2E_TEACHER_EMAIL;
  const teacherPassword = fixture.E2E_TEACHER_PASSWORD;
  const courseId = fixture.E2E_COURSE_ID ?? exerciseAuthoringFixture.courseId;
  const topicId = fixture.E2E_TOPIC_ID ?? exerciseAuthoringFixture.topicId;

  await page.goto("/login");
  await page.getByLabel("Email").fill(teacherEmail);
  await page.getByLabel("Password").fill(teacherPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);

  await page.goto(`/courses/${courseId}/topics/${topicId}?tab=exercises`);
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
