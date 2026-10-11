import { expect, test, type Page } from "@playwright/test";
import {
  FULL_FLOW_ADDED_CARD,
  MATRIX_COURSE_SLUG,
  MATRIX_TOPICS,
  addFullFlowCard,
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { CARDS_REQUIRED_ERROR } from "../../lib/memory-check";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/lf3/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật cổng "đã xem hết thẻ" của memory check (LF3 AC4-AC6) và dòng các bước (AC8).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441) với fixture tổng hợp tạo trong beforeAll và dọn trong afterAll.
// - Case thành công: học hết thẻ -> memory check mở; giảng viên thêm thẻ -> trả lời bị từ chối, về Từ vựng, tải lại có thẻ mới;
//   chấm thẻ mới -> trả lời lần đầu rồi đổi đáp án đều được ghi; dòng các bước ghi "đã xong" ngay cả khi là bước hiện tại.
// - Case thất bại: câu trả lời bị từ chối không để lại dòng user_question_answers nào.
// - Bảo mật/phân quyền: kết quả kiểm tra bằng service role chỉ trên runtime E2E cô lập; học viên seed là người duy nhất được ghi danh.
// - Ổn định/resilience: không tràn ngang ở 375px và 1280px trên các màn bị đụng tới.
// - Invariant cần giữ: server là nguồn cuối của cổng; UI chỉ phục hồi (về Từ vựng, tải lại dữ liệu), không tự mở khóa.
// - Kết quả verify gần nhất: xem báo cáo checkpoint LF3 CP4 (chạy `npm run test:e2e -- e2e/smoke/learning-memory-cards-gate.smoke.spec.ts`).

// Hai test dùng chung một lần seed và test sau đọc trạng thái do test trước để lại.
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  await seedLearningWorkspaceMatrix();
});

test.afterAll(async () => {
  await cleanupLearningWorkspaceMatrix();
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("student@gmail.com");
  await page.getByLabel("Password").fill("123123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
});

const topicPath = `/learn/${MATRIX_COURSE_SLUG}/${MATRIX_TOPICS.full.slug}`;
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const FIRST_QUESTION = 'Nghĩa của "deadline" là gì?';

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
}

/** Rate cards Ổn until the memory check is on screen; returns the card words shown on the way. */
async function rateCardsUntilMemoryCheck(page: Page) {
  const firstQuestion = page.getByRole("heading", { name: FIRST_QUESTION });
  const shown: string[] = [];
  for (let guard = 0; guard < 12; guard += 1) {
    if (await firstQuestion.isVisible()) return shown;
    for (const word of ["schedule", "deadline", "approve", "available", FULL_FLOW_ADDED_CARD.word]) {
      if (await page.getByText(word, { exact: true }).isVisible()) shown.push(word);
    }
    await page.getByRole("button", { name: "Hiện đáp án" }).click();
    await page.getByRole("button", { name: "Ổn" }).click();
    await expect(
      firstQuestion.or(page.getByRole("button", { name: "Hiện đáp án" })),
    ).toBeVisible();
  }
  await expect(firstQuestion).toBeVisible();
  return shown;
}

async function answeredOptionFor(questionContent: string) {
  const admin = createSupabaseAdmin(process.env);
  const question = await admin
    .from("questions")
    .select("id")
    .eq("content", questionContent)
    .limit(1)
    .single();
  if (question.error) throw new Error(question.error.message);
  const answers = await admin
    .from("user_question_answers")
    .select("selected_option_id")
    .eq("user_id", STUDENT_ID)
    .eq("question_id", question.data.id);
  if (answers.error) throw new Error(answers.error.message);
  return answers.data;
}

test("a card added after the page loaded sends the learner back to the flashcards, and answers work once it is rated", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(topicPath);
  const thread = page.getByRole("list", { name: "Các bước của bài học" });
  await expect(thread).toContainText("Memory check (đang khóa)");

  // Học hết thẻ: memory check mở và được vào ngay.
  await rateCardsUntilMemoryCheck(page);
  await expect(thread).toContainText("Memory check (đang học)");

  // Giảng viên thêm thẻ khi học viên đang ở memory check.
  await addFullFlowCard();

  // Server từ chối: không có câu trả lời nào được ghi, người học về Từ vựng và dữ liệu được tải lại.
  await page.getByRole("radio", { name: /hạn chót/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText(CARDS_REQUIRED_ERROR)).toBeVisible();
  await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
  await expect(thread).toContainText("Memory check (đang khóa)");
  expect(await answeredOptionFor(FIRST_QUESTION)).toHaveLength(0);
  await expectNoHorizontalOverflow(page);
  // Cùng trạng thái khóa ở màn hẹp: dòng các bước vẫn đọc được và không tràn ngang.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(thread).toContainText("Memory check (đang khóa)");
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Có shortcut tới memory check? Không: còn thẻ chưa xem.
  await expect(page.getByRole("button", { name: "Tới Memory check" })).toHaveCount(0);

  // Chấm lại hàng đợi (có thẻ mới) rồi trả lời: lần đầu sai (ghi mới), sau đó đúng (đổi đáp án).
  const shownCards = await rateCardsUntilMemoryCheck(page);
  expect(shownCards).toContain(FULL_FLOW_ADDED_CARD.word);
  await page.getByRole("radio", { name: /lịch trình/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("radio", { name: /bạn chọn chưa đúng/ })).toBeVisible();
  const firstAttempt = await answeredOptionFor(FIRST_QUESTION);
  expect(firstAttempt).toHaveLength(1);
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await page.getByRole("radio", { name: /approved/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("radio", { name: /có sẵn, rảnh/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  // Câu đầu quay lại cuối hàng: đổi sang đáp án đúng.
  await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
  await page.getByRole("radio", { name: /hạn chót/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("button", { name: "Mở bài tập" })).toBeVisible();
  const changed = await answeredOptionFor(FIRST_QUESTION);
  expect(changed).toHaveLength(1);
  expect(changed[0].selected_option_id).not.toBe(firstAttempt[0].selected_option_id);
});

test("the stage thread shows a finished step as done while it is the current step, at 375px and 1280px", async ({
  page,
}) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(topicPath);
    const thread = page.getByRole("list", { name: "Các bước của bài học" });
    // Test trước đã học hết thẻ và qua memory check; trang mở ở bước Từ vựng: bước đó vừa đang học vừa đã xong.
    await expect(thread).toContainText("Từ vựng (đã xong, đang học)");
    await expect(thread).toContainText("Memory check (đã xong)");
    await expectNoHorizontalOverflow(page);
  }
});
