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

// spec: docs/programs/student-user-flow-route/implementation-plans/lf3/plan.md, docs/programs/student-user-flow-route/implementation-plans/lf4/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật cổng "đã xem hết thẻ" của memory check (LF3 AC4-AC6) và dòng các bước (AC8).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441) với fixture tổng hợp tạo trong beforeAll và dọn trong afterAll.
// - Case thành công: học hết thẻ -> memory check mở; giảng viên thêm thẻ -> trả lời bị từ chối, về Từ vựng, tải lại có thẻ mới;
//   chấm thẻ mới -> trả lời lần đầu rồi đổi đáp án đều được ghi; dòng các bước ghi "đã xong" ngay cả khi là bước hiện tại.
// - Case phục hồi có đáp án đã lưu: học viên đã có đáp án memory check được lưu, giảng viên thêm thẻ, lần ĐỔI đáp án bị từ chối và
//   đáp án đã lưu giữ nguyên; sau khi học thẻ mới, gửi lại thì đáp án được đổi.
// - Case thất bại: câu trả lời bị từ chối không để lại dòng user_question_answers nào (lần đầu) hoặc không đổi dòng đã lưu (lần đổi).
// - Bảo mật/phân quyền: kết quả kiểm tra bằng service role chỉ trên runtime E2E cô lập; học viên seed là người duy nhất được ghi danh.
// - Ổn định/resilience: không tràn ngang ở 375px và 1280px trên các màn bị đụng tới.
// - Invariant cần giữ: server là nguồn cuối của cổng; UI chỉ phục hồi (về Từ vựng, tải lại dữ liệu), không tự mở khóa.
// - LF4 (AC3/AC4/AC5/AC6) ở 375px và 1280px: (a) chấm một phần thẻ rồi tải lại thì chỉ xếp thẻ chưa xem và có toast số thẻ chưa học;
//   (b) mọi thẻ đã xem, có một thẻ chấm Lại, tải lại thì màn hình kết thúc mời ôn thẻ đến hạn đó, "Ôn ngay" chỉ xếp thẻ đó còn "Ôn lại từ vựng" xếp mọi thẻ;
//   (c) giảng viên thêm thẻ, tải lại thì chỉ thẻ mới được xếp. Nửa ngày giờ FSRS của AC5 kiểm ở tầng action, không kiểm ở trình duyệt.
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
  expect(shownCards).toEqual([FULL_FLOW_ADDED_CARD.word]);
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

test("a changed answer is refused while a new card is unseen and the stored answer stays; it succeeds after the card is rated", async ({
  page,
}) => {
  // Test này tự seed lại để bắt đầu từ trạng thái sạch (không còn thẻ mới, đáp án, tiến độ của hai test trước).
  test.setTimeout(300_000);
  await seedLearningWorkspaceMatrix();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(topicPath);
  const thread = page.getByRole("list", { name: "Các bước của bài học" });
  await rateCardsUntilMemoryCheck(page);

  // Có đáp án đã lưu: câu đầu trả lời sai (ghi lại), hai câu sau đúng; câu đầu quay lại cuối hàng.
  await page.getByRole("radio", { name: /lịch trình/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("radio", { name: /bạn chọn chưa đúng/ })).toBeVisible();
  const stored = await answeredOptionFor(FIRST_QUESTION);
  expect(stored).toHaveLength(1);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("radio", { name: /approved/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("radio", { name: /có sẵn, rảnh/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();

  // Giảng viên thêm thẻ; lần đổi đáp án của câu đầu bị từ chối và đáp án đã lưu không đổi.
  await addFullFlowCard();
  await page.getByRole("radio", { name: /hạn chót/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText(CARDS_REQUIRED_ERROR)).toBeVisible();
  await expect(thread).toContainText("Memory check (đang khóa)");
  const afterRefusal = await answeredOptionFor(FIRST_QUESTION);
  expect(afterRefusal).toHaveLength(1);
  expect(afterRefusal[0].selected_option_id).toBe(stored[0].selected_option_id);

  // Phục hồi: học thẻ mới rồi gửi lại thì đáp án được đổi sang đáp án đúng.
  const shownCards = await rateCardsUntilMemoryCheck(page);
  expect(shownCards).toEqual([FULL_FLOW_ADDED_CARD.word]);
  await page.getByRole("radio", { name: /hạn chót/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("button", { name: "Mở bài tập" })).toBeVisible();
  // AC8: bước memory check đã xong ngay khi câu cuối được chấp nhận, trước khi bấm "Mở bài tập".
  await expect(thread).toContainText("Memory check (đã xong, đang học)");
  const changed = await answeredOptionFor(FIRST_QUESTION);
  expect(changed).toHaveLength(1);
  expect(changed[0].selected_option_id).not.toBe(stored[0].selected_option_id);
});

// LF4: mỗi bề rộng tự seed lại để bắt đầu từ trạng thái sạch (học viên chưa xem thẻ nào).
for (const width of [375, 1280]) {
  test(`only unseen cards are queued, due cards are offered after the last card and a new card is queued alone, at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await seedLearningWorkspaceMatrix();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(topicPath);

    const counter = (left: number, total: number) => page.getByText(`${left} / ${total}`, { exact: true });
    const finishedHeading = page.getByRole("heading", { name: "Bạn đã ôn xong từ vựng" });
    const rate = async (word: string, rating: string, nextVisible: ReturnType<Page["getByText"]>) => {
      await expect(page.getByText(word, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Hiện đáp án" }).click();
      await page.getByRole("button", { name: rating, exact: true }).click();
      // Thẻ kế tiếp chỉ hiện sau khi server đã ghi dòng chấm.
      await expect(nextVisible).toBeVisible();
    };
    const unseenToast = (count: number) => page.getByText(`Bạn còn ${count} thẻ chưa học trong bài học này`);

    // Lần đầu mọi thẻ đều chưa xem: đủ 4 thẻ và không có toast chưa học.
    await expect(counter(4, 4)).toBeVisible();
    await expect(unseenToast(4)).toHaveCount(0);

    // (a) Chấm hai thẻ đầu Dễ rồi tải lại: chỉ còn hai thẻ chưa xem và có toast.
    await rate("schedule", "Dễ", page.getByText("deadline", { exact: true }));
    await rate("deadline", "Dễ", page.getByText("approve", { exact: true }));
    await page.reload();
    await expect(counter(2, 2)).toBeVisible();
    await expect(page.getByText("approve", { exact: true })).toBeVisible();
    await expect(unseenToast(2)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // (b) Thẻ "approve" chấm Lại, thẻ "available" chấm Dễ; mọi thẻ đã xem nên tải lại thì vào màn hình kết thúc.
    await rate("approve", "Lại", page.getByText("available", { exact: true }));
    await rate("available", "Dễ", page.getByText("approve", { exact: true }));
    await page.reload();
    await expect(finishedHeading).toBeVisible();
    await expect(page.getByText("Bạn có 1 thẻ đến hạn thuộc bài học này")).toBeVisible();
    await expect(unseenToast(1)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Ôn ngay 1 thẻ" }).click();
    await expect(counter(1, 1)).toBeVisible();
    await expect(page.getByText("approve", { exact: true })).toBeVisible();

    await page.reload();
    await expect(finishedHeading).toBeVisible();
    await page.getByRole("button", { name: "Ôn lại từ vựng" }).click();
    await expect(counter(4, 4)).toBeVisible();
    await expect(page.getByText("schedule", { exact: true })).toBeVisible();

    // (c) Giảng viên thêm thẻ: tải lại thì chỉ thẻ mới được xếp, kèm toast.
    await addFullFlowCard();
    await page.reload();
    await expect(counter(1, 1)).toBeVisible();
    await expect(page.getByText(FULL_FLOW_ADDED_CARD.word, { exact: true })).toBeVisible();
    await expect(unseenToast(1)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
