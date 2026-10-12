import { expect, test, type Page } from "@playwright/test";
import {
  MATRIX_COURSE_SLUG,
  MATRIX_TOPICS,
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/lf5/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật màn hình hoàn thành chủ đề, bước vào chủ đề ở bước đầu tiên còn phải làm và xem lại memory check (LF5 AC1-AC9).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441) với fixture tổng hợp tạo một lần trong beforeAll; mỗi test xóa tiến độ của học viên seed rồi chạy ở 375px và 1280px.
// - Case thành công: học trọn chủ đề full-flow (thẻ, memory check, bài tập) -> không toast, màn hình hoàn thành hiện với chuỗi chuyển động (`data-motion="sequence"`);
//   xem lại Memory check chỉ đọc (có giải thích) rồi về màn hình hoàn thành không phát lại chuỗi; tải lại mở thẳng màn hình đã ổn định (`settled`);
//   chấm một thẻ Lại sau khi hoàn thành -> tải lại thì hành động chính của màn hình là "Ôn ngay 1 thẻ".
// - Case reduced motion: cùng luồng nhưng với `prefers-reduced-motion: reduce` thì màn hình hoàn thành hiện ngay ở trạng thái `settled`.
// - Case không có bài tập: chủ đề thẻ + memory check không bài tập, qua memory check thì tự chuyển sang màn hình hoàn thành, không có nút "Mở bài tập" hay "Hoàn thành memory check".
// - Case chưa hoàn thành: chủ đề mở ở bước đầu tiên còn phải làm (Từ vựng, rồi Memory check khi thẻ đã xong, rồi Bài tập khi memory check đã qua).
// - Bảo mật/phân quyền: fixture và kiểm tra chỉ trên runtime E2E cô lập; học viên seed là người duy nhất được ghi danh.
// - Ổn định/resilience: không tràn ngang ở 375px và 1280px trên các màn bị đụng tới.
// - Invariant cần giữ: xem lại không ghi gì; tiến độ khóa học/chương lấy từ cùng nguồn với danh sách chương.
// - Chưa kiểm chứng: cảm nhận chuyển động và nhịp 900 ms của lần tự chuyển do Owner đánh giá trên UI chạy thật.
// - Kết quả verify gần nhất: xem báo cáo checkpoint LF5 CP4 (chạy `npm run test:e2e -- e2e/smoke/learning-topic-completion.smoke.spec.ts`).

test.describe.configure({ mode: "serial" });

const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const WIDTHS = [375, 1280];

test.beforeAll(async () => {
  test.setTimeout(240_000);
  await seedLearningWorkspaceMatrix();
});

test.afterAll(async () => {
  await cleanupLearningWorkspaceMatrix();
});

test.beforeEach(async ({ page }) => {
  await resetLearner();
  await page.goto("/login");
  await page.getByLabel("Email").fill("student@gmail.com");
  await page.getByLabel("Password").fill("123123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
});

const topicPath = (key: keyof typeof MATRIX_TOPICS) =>
  `/learn/${MATRIX_COURSE_SLUG}/${MATRIX_TOPICS[key].slug}`;
const completionTitle = (key: keyof typeof MATRIX_TOPICS) =>
  `Đã hoàn thành chủ đề “${MATRIX_TOPICS[key].title}”`;

/** Xóa mọi dấu vết học của học viên seed trong khóa fixture, để mỗi test bắt đầu từ chủ đề chưa học. */
async function resetLearner() {
  const admin = createSupabaseAdmin(process.env);
  const course = await admin.from("courses").select("id").eq("slug", MATRIX_COURSE_SLUG).single();
  if (course.error) throw new Error(course.error.message);
  const topics = await admin.from("topics").select("id").eq("course_id", course.data.id);
  if (topics.error) throw new Error(topics.error.message);
  const topicIds = topics.data.map((topic) => topic.id);
  const questions = await admin.from("questions").select("id").eq("course_id", course.data.id);
  if (questions.error) throw new Error(questions.error.message);
  const cards = await admin.from("cards").select("id").in("topic_id", topicIds);
  if (cards.error) throw new Error(cards.error.message);

  const answers = await admin
    .from("user_question_answers")
    .delete()
    .eq("user_id", STUDENT_ID)
    .in("question_id", questions.data.map((question) => question.id));
  if (answers.error) throw new Error(answers.error.message);
  const flashcards = await admin
    .from("user_flashcards")
    .delete()
    .eq("user_id", STUDENT_ID)
    .in("card_id", cards.data.map((card) => card.id));
  if (flashcards.error) throw new Error(flashcards.error.message);
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

const completionSection = (page: Page) => page.locator("section[aria-labelledby='topic-completion-title']");
const stepThread = (page: Page) => page.getByRole("list", { name: "Các bước của bài học" });

async function rateCards(page: Page, words: string[]) {
  for (const word of words) {
    await expect(page.getByText(word, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hiện đáp án" }).click();
    await page.getByRole("button", { name: "Ổn", exact: true }).click();
  }
}

async function answerMemory(page: Page, answers: Array<[RegExp, string]>) {
  for (const [option, afterwards] of answers) {
    await page.getByRole("radio", { name: option }).click();
    await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    // Câu cuối của memory check không bài tập tự chuyển sau 900 ms, nên không chờ phản hồi của nó.
    if (!afterwards) continue;
    await expect(page.getByRole("radio", { name: /bạn chọn đúng/ })).toBeVisible();
    await page.getByRole("button", { name: afterwards }).click();
  }
}

const FULL_WORDS = ["schedule", "deadline", "approve", "available"];
const FULL_MEMORY: Array<[RegExp, string]> = [
  [/hạn chót/, "Tiếp tục"],
  [/approved/, "Tiếp tục"],
  [/có sẵn, rảnh/, "Mở bài tập"],
];
// Đáp án đúng của 6 câu bài tập của chủ đề full-flow, theo thứ tự hiện ra.
const FULL_EXERCISES: RegExp[] = [
  /reviewing a schedule/,
  /A project deadline/,
  /Change the schedule/,
  /^(?:[A-C]\.?\s*)?available$/,
  /^(?:[A-C]\.?\s*)?approved$/,
  /^(?:[A-D]\.?\s*)?deadline$/,
];

/** Học trọn chủ đề full-flow đến câu cuối; dừng trước hành động xác nhận "Xem kết quả chủ đề". */
async function finishFullFlow(page: Page) {
  await page.goto(topicPath("full"));
  await rateCards(page, FULL_WORDS);
  await expect(page.getByRole("heading", { name: 'Nghĩa của "deadline" là gì?' })).toBeVisible();
  await answerMemory(page, FULL_MEMORY);
  for (const [index, option] of FULL_EXERCISES.entries()) {
    await page.getByRole("radio", { name: option }).click();
    await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
    const last = index === FULL_EXERCISES.length - 1;
    const forward = page.getByRole("button", { name: last ? "Xem kết quả chủ đề" : "Câu tiếp theo" });
    await expect(forward).toBeVisible();
    // Chưa xác nhận thì chưa có màn hình hoàn thành, và không có toast hoàn thành bài.
    await expect(completionSection(page)).toHaveCount(0);
    if (!last) await forward.click();
  }
}

for (const width of WIDTHS) {
  test(`finishing the full-flow topic opens the completion screen with its sequence, and the review and reload settle it, at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 900 });
    await finishFullFlow(page);

    await page.getByRole("button", { name: "Xem kết quả chủ đề" }).click();
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "sequence");
    await expect(page.getByRole("progressbar")).toHaveCount(2);
    await expect(page.getByRole("progressbar", { name: "Tiến độ khóa học" })).toHaveAttribute("aria-valuenow", "1");
    // Thẻ vừa chấm Ổn chưa đến hạn nên hành động chính là chủ đề kế, không phải ôn thẻ.
    await expect(page.getByRole("button", { name: /^Ôn ngay/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Tiếp tục học/ })).toHaveAttribute(
      "href",
      `/learn/${MATRIX_COURSE_SLUG}/${MATRIX_TOPICS.vocabulary.slug}`,
    );
    await expectNoHorizontalOverflow(page);

    // Xem lại memory check ngay trong phiên: chỉ đọc, có giải thích; quay về không phát lại chuỗi.
    await page.getByRole("button", { name: "Xem lại Memory check" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Xem lại Memory check" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
    await expect(page.getByText("deadline nghĩa là hạn chót.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kiểm tra đáp án" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Về màn hình hoàn thành" }).click();
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "settled");

    // Tải lại: mở thẳng màn hình hoàn thành đã ổn định; bản xem lại vẫn có giải thích.
    await page.reload();
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "settled");
    await page.getByRole("button", { name: "Xem lại Memory check" }).click();
    await expect(page.getByText("deadline nghĩa là hạn chót.")).toBeVisible();
    await page.getByRole("button", { name: "Về màn hình hoàn thành" }).click();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "settled");

    // Chấm một thẻ Lại sau khi hoàn thành: tải lại thì màn hình mời ôn thẻ đến hạn trước.
    await page.getByRole("button", { name: "Xem lại Từ vựng" }).click();
    await expect(page.getByText("schedule", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hiện đáp án" }).click();
    await page.getByRole("button", { name: "Lại", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    const dueNow = page.getByRole("button", { name: "Ôn ngay 1 thẻ" });
    await expect(dueNow).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await dueNow.click();
    await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
    await expect(page.getByText("schedule", { exact: true })).toBeVisible();
  });

  test(`reduced motion shows the completion screen settled at once, at ${width}px`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    await finishFullFlow(page);

    await page.getByRole("button", { name: "Xem kết quả chủ đề" }).click();
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    expect(await completionSection(page).getAttribute("data-motion")).toBe("settled");
    await expect(page.getByRole("progressbar", { name: "Tiến độ khóa học" })).toHaveAttribute("aria-valuenow", "1");
    await expectNoHorizontalOverflow(page);
  });

  test(`passing a memory check with no exercises moves on to the completion screen by itself, at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(topicPath("memoryOnly"));
    await expect(stepThread(page)).toContainText("Từ vựng (đang học)");
    await rateCards(page, ["invoice", "supplier"]);
    await expect(page.getByRole("heading", { name: 'Nghĩa của "invoice" là gì?' })).toBeVisible();
    await answerMemory(page, [
      [/hóa đơn/, "Tiếp tục"],
      [/nhà cung cấp/, ""],
    ]);

    // Không có nút nào để bấm tiếp: không "Mở bài tập", không "Hoàn thành memory check".
    await expect(page.getByRole("button", { name: "Mở bài tập" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Hoàn thành memory check" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: completionTitle("memoryOnly") })).toBeVisible();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "sequence");
    // Chủ đề cuối của khóa: hành động chính dẫn về tổng quan khóa học.
    await expect(page.getByRole("link", { name: "Về tổng quan khóa học" }).first()).toHaveAttribute(
      "href",
      `/learn/${MATRIX_COURSE_SLUG}`,
    );
    await expectNoHorizontalOverflow(page);
  });

  test(`an unfinished topic opens on its first unfinished step, at ${width}px`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 900 });

    // Chưa học gì: Từ vựng.
    await page.goto(topicPath("full"));
    await expect(stepThread(page)).toContainText("Từ vựng (đang học)");
    await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();

    // Thẻ đã xong, memory check chưa qua: tải lại mở thẳng Memory check.
    await rateCards(page, FULL_WORDS);
    await expect(page.getByRole("heading", { name: 'Nghĩa của "deadline" là gì?' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: 'Nghĩa của "deadline" là gì?' })).toBeVisible();
    await expect(stepThread(page)).toContainText("Memory check (đang học)");
    await expectNoHorizontalOverflow(page);

    // Memory check đã qua, bài tập chưa làm: tải lại mở thẳng Bài tập.
    await answerMemory(page, FULL_MEMORY);
    await page.reload();
    await expect(stepThread(page)).toContainText("Bài tập (đang học)");
    await expect(stepThread(page)).toContainText("Memory check (đã xong)");
    await expect(page.getByRole("button", { name: "Xác nhận đáp án" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
