import { expect, test } from "@playwright/test";
import { assertSmokeExercisePersisted, fixture } from "../scripts/e2e/exercise-smoke-fixture.mjs";

// Test plan:
// - Mục tiêu: chứng minh giáo viên được phân quyền có thể tạo exercise thật qua UI.
// - Loại test: smoke E2E Playwright + local Supabase.
// - Đối tượng: login UI, topic exercise tab, Server Action createExercise, RPC create_exercise_with_content.
// - Case thành công:
//   - Teacher đăng nhập, mở topic builder, tạo Part 7 hợp lệ, thấy title mới trong UI và DB có record.
// - Case thất bại:
//   - Không cover trong smoke đầu tiên; failure môi trường phải fail command.
// - Bảo mật/phân quyền:
//   - Dùng teacher fixture owner collaborator; không mock auth/RLS/RPC.
// - Ổn định/resilience:
//   - Fixture idempotent do runner chuẩn bị; exercise title unique theo run.
// - Invariant cần giữ:
//   - Exercise được tạo qua browser và persisted dưới đúng course/topic với group/question/options hợp lệ.
// - Kết quả verify gần nhất: passed bằng `npm run test:e2e:smoke:exercise`.
// - Ghi chú: Smoke cố ý không cover Part 5 vì bug hiện hữu đã được tracker ghi nhận.

test("teacher creates and persists a TOEIC Part 7 exercise through the browser UI", async ({
  page,
}) => {
  const title = requiredEnv("E2E_EXERCISE_TITLE");
  const courseId = process.env.E2E_COURSE_ID ?? fixture.courseId;
  const topicId = process.env.E2E_TOPIC_ID ?? fixture.topicId;

  await page.goto("/login");
  await page.getByLabel("Email").fill(requiredEnv("E2E_TEACHER_EMAIL"));
  await page.getByLabel("Password").fill(requiredEnv("E2E_TEACHER_PASSWORD"));
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

  const persisted = await assertSmokeExercisePersisted(title);
  expect(persisted.exerciseId).toEqual(expect.any(String));
});

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
