import { expect, test, type Page } from "@playwright/test";
import {
  MATRIX_COURSE_SLUG,
  MATRIX_TOPICS,
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/lf8/plan.md
// Test plan:
// - Mục tiêu: LF8 AC1, AC2, AC5: chấm thẻ liên tiếp không chờ lưu vẫn ghi đúng đánh giá cuối của từng thẻ, đúng thứ tự, và chủ đề kết thúc theo quyết định của server.
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441), fixture ma trận học tập tạo trong beforeAll và dọn trong afterAll.
// - Case thành công: Lại, Dễ, Ổn bấm liên tiếp không chờ lưu; `expect.poll` trên DB thấy đúng đánh giá cuối của từng thẻ và thẻ chưa chấm chưa có dòng.
//   Chấm tiếp hai thẻ còn lại (thẻ chấm Lại được chấm lại Ổn) thì hàng đợi kết thúc, memory check mở sau khi lưu xong, DB giữ đánh giá cuối.
// - AC7 (trình duyệt thật): nhấp đúp chuột và chạm đúp trên nút chấm chỉ ghi đánh giá của thẻ đầu; thẻ kế tiếp vẫn ở mặt trước (chưa bị lật), không có đánh giá thứ hai.
// - Phân quyền: kiểm tra bằng service role chỉ trên runtime E2E cô lập; học viên seed là người duy nhất được ghi danh.
// - Invariant cần giữ: thẻ kế tiếp hiện ngay không phụ thuộc lưu; mỗi lần bấm chấm chỉ ghi một đánh giá (không mất, không đôi); server vẫn quyết định cổng memory check.
// - Giới hạn: không chứng minh thời gian phản hồi; lỗi lưu và đóng hộp thoại ôn nằm ở component test và review-session-recovery.
// - Kết quả verify gần nhất: xem State LF8 trong progress.md (chạy `npm run test:e2e -- e2e/smoke/learning-fast-rating.smoke.spec.ts`).
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
  await page.getByLabel("Mật khẩu", { exact: true }).fill("123123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

const topicPath = `/learn/${MATRIX_COURSE_SLUG}/${MATRIX_TOPICS.full.slug}`;
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const FIRST_QUESTION = 'Nghĩa của "deadline" là gì?';

/** Last rating stored for each card word of the topic; a card without a row is left out. */
async function lastRatingsByWord() {
  const admin = createSupabaseAdmin(process.env);
  const topic = await admin.from("topics").select("id").eq("slug", MATRIX_TOPICS.full.slug).limit(1).single();
  if (topic.error) throw new Error(topic.error.message);
  const cards = await admin.from("cards").select("id, front_content").eq("topic_id", topic.data.id);
  if (cards.error) throw new Error(cards.error.message);
  const rows = await admin.from("user_flashcards").select("card_id, last_rating").eq("user_id", STUDENT_ID);
  if (rows.error) throw new Error(rows.error.message);
  const byCard = new Map(rows.data.map((row) => [row.card_id, row.last_rating]));
  const result: Record<string, number> = {};
  for (const card of cards.data) {
    const rating = byCard.get(card.id);
    if (rating !== undefined && rating !== null) result[(card.front_content as { word: string }).word] = rating;
  }
  return result;
}

// Chấm không chờ lưu: chỉ chờ thẻ hiện ra (hiện ngay); việc lưu xong được chờ bằng `expect.poll` trên DB.
async function rateNow(page: Page, word: string, rating: string) {
  await expect(page.getByText(word, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
  await page.getByRole("button", { name: rating, exact: true }).click();
}

test("rating Again, Easy and Good with no wait stores each card's last rating, then the queue ends as the server decides", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(topicPath);
  await expect(page.getByText("4 / 4", { exact: true })).toBeVisible();

  await rateNow(page, "schedule", "Lại");
  await rateNow(page, "deadline", "Dễ");
  await rateNow(page, "approve", "Ổn");
  // Hàng đợi còn "available" rồi "schedule" (xếp lại sau Lại); thẻ hiện ngay, không chờ lưu.
  await expect(page.getByText("available", { exact: true })).toBeVisible();
  await expect.poll(lastRatingsByWord).toEqual({ schedule: 1, deadline: 4, approve: 3 });

  await rateNow(page, "available", "Dễ");
  await rateNow(page, "schedule", "Ổn");
  await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
  await expect.poll(lastRatingsByWord).toEqual({ schedule: 3, deadline: 4, approve: 3, available: 4 });
});

// Xoá trạng thái thẻ và tiến độ của học viên seed để chủ đề lại có 4 thẻ chưa xem, rồi lật thẻ đầu ("schedule").
async function startFreshReview(page: Page) {
  const admin = createSupabaseAdmin(process.env);
  const topic = await admin.from("topics").select("id").eq("slug", MATRIX_TOPICS.full.slug).limit(1).single();
  if (topic.error) throw new Error(topic.error.message);
  const cards = await admin.from("cards").select("id").eq("topic_id", topic.data.id);
  if (cards.error) throw new Error(cards.error.message);
  const cardIds = cards.data.map((card) => card.id);
  const flashcards = await admin.from("user_flashcards").delete().eq("user_id", STUDENT_ID).in("card_id", cardIds);
  if (flashcards.error) throw new Error(flashcards.error.message);
  const progress = await admin.from("user_topic_progress").delete().eq("user_id", STUDENT_ID).eq("topic_id", topic.data.id);
  if (progress.error) throw new Error(progress.error.message);

  await page.goto(topicPath);
  await expect(page.getByText("4 / 4", { exact: true })).toBeVisible();
  await expect(page.getByText("schedule", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
}

// Chỉ thẻ đầu có đánh giá; thẻ kế tiếp hiện mặt trước (chưa lật) và chưa có nút chấm.
async function expectOnlyFirstCardRated(page: Page) {
  await expect(page.getByText("deadline", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lại", exact: true })).toHaveCount(0);
  await expect.poll(lastRatingsByWord).toEqual({ schedule: 1 });
}

test("a fast double click on a rating saves it once and does not reveal the next card (AC7)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await startFreshReview(page);

  await page.getByRole("button", { name: "Lại", exact: true }).dblclick();
  await expectOnlyFirstCardRated(page);
});

test("a fast double tap on a rating saves it once and does not reveal the next card on touch (AC7)", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const touchContext = await browser.newContext({
    hasTouch: true,
    viewport: { width: 375, height: 800 },
    storageState: await page.context().storageState(),
  });
  try {
    const touchPage = await touchContext.newPage();
    await startFreshReview(touchPage);

    const box = await touchPage.getByRole("button", { name: "Lại", exact: true }).boundingBox();
    if (!box) throw new Error("Rating button has no bounding box");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await touchPage.touchscreen.tap(x, y);
    await touchPage.touchscreen.tap(x, y);
    await expectOnlyFirstCardRated(touchPage);
  } finally {
    await touchContext.close();
  }
});
