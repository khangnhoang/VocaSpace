import { expect, test, type Page } from "@playwright/test";
import {
  FULL_FLOW_ADDED_CARD,
  addFullFlowCard,
  cleanupLearningWorkspaceMatrix,
  matrixFor,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { getWorkerScope, assertIsolatedRuntime } from "../../scripts/e2e/support/worker-scope.mjs";
import viLearn from "../../messages/vi/learn.json";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/lf9/plan.md, docs/programs/student-user-flow-route/implementation-plans/lf4/plan.md, docs/programs/student-user-flow-route/implementation-plans/lf6/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật cổng Ổn/Dễ lần đầu và giữ mở qua các lần ôn (LF9) và dòng các bước (AC8).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441) với fixture tổng hợp tạo trong beforeAll và dọn trong afterAll.
// - Case thành công: học hết thẻ -> memory check mở; giảng viên thêm thẻ -> trả lời bị từ chối, về Từ vựng, tải lại có thẻ mới;
//   chấm thẻ mới -> trả lời lần đầu rồi đổi đáp án đều được ghi; dòng các bước ghi "đã xong" ngay cả khi là bước hiện tại (LF5: vào lại chủ đề thì mở thẳng bước đầu tiên còn phải làm, tức Bài tập, rồi quay lại các bước đã xong).
// - Case phục hồi có đáp án đã lưu: học viên đã có đáp án memory check được lưu, giảng viên thêm thẻ, lần ĐỔI đáp án bị từ chối và
//   đáp án đã lưu giữ nguyên; sau khi học thẻ mới, gửi lại thì đáp án được đổi.
// - Case thất bại: câu trả lời bị từ chối không để lại dòng user_question_answers nào (lần đầu) hoặc không đổi dòng đã lưu (lần đổi).
// - Bảo mật/phân quyền: kết quả kiểm tra bằng service role chỉ trên runtime E2E cô lập; học viên seed là người duy nhất được ghi danh.
// - Ổn định/resilience: không tràn ngang ở 375px và 1280px trên các màn bị đụng tới.
// - Invariant cần giữ: server là nguồn cuối của cổng; UI chỉ phục hồi (về Từ vựng, tải lại dữ liệu), không tự mở khóa.
// - LF9 ở 375px và 1280px: học dở rồi tải lại chỉ xếp phần chưa đạt; Lại không mở cổng lần đầu, Ổn mở, ôn lại cả bộ tự về Memory check; thẻ mới được xếp riêng.
// - LF6 (AC2/AC3): bước khóa của thanh tiến trình là nút; bấm Memory check khi còn thẻ chưa đạt cổng hiện lý do ngay dưới thanh, bấm Bài tập hiện lý do memory check, cả hai không đổi bước; dưới ngữ cảnh cảm ứng thật ở 375 và 320 px mọi bước kể cả bước khóa cao >= 44 px, thanh vẫn một dòng và các vùng bấm không chồng nhau.
// - LF8: đánh giá lưu nền nên trước mỗi lần tải lại ở case LF4 (a) và (b) smoke chờ DB đủ số thẻ đã chấm (không còn dòng trạng thái "Đang lưu…").
// - Kết quả verify gần nhất: xem State LF9 trong progress.md (chạy `npm run test:e2e -- e2e/smoke/learning-memory-cards-gate.smoke.spec.ts`).

// Hai test dùng chung một lần seed và test sau đọc trạng thái do test trước để lại.
test.describe.configure({ mode: "serial" });

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

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(matrix.student.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(matrix.student.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

const topicPath = () => `/learn/${matrix.courseSlug}/${matrix.topics.full.slug}`;
const NEW_CARDS_TOAST = "Bài học vừa có thêm 1 thẻ mới. Học xong rồi làm lại memory check nhé.";
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

/** Number of the topic's cards that have a stored rating for the seeded learner. */
async function ratedCardCount() {
  assertIsolatedRuntime(process.env);
  const admin = createSupabaseAdmin(process.env);
  const topic = await admin.from("topics").select("id").eq("slug", matrix.topics.full.slug).limit(1).single();
  if (topic.error) throw new Error(topic.error.message);
  const cards = await admin.from("cards").select("id").eq("topic_id", topic.data.id);
  if (cards.error) throw new Error(cards.error.message);
  const rows = await admin
    .from("user_flashcards")
    .select("card_id, last_rating")
    .eq("user_id", matrix.student.id)
    .in("card_id", cards.data.map((card) => card.id));
  if (rows.error) throw new Error(rows.error.message);
  return rows.data.filter((row) => row.last_rating !== null).length;
}

async function answeredOptionFor(questionContent: string) {
  assertIsolatedRuntime(process.env);
  const admin = createSupabaseAdmin(process.env);
  // Nội dung câu hỏi lặp lại ở khóa học matrix của mọi worker, nên chỉ tìm trong khóa học của worker này.
  const course = await admin.from("courses").select("id").eq("slug", matrix.courseSlug).single();
  if (course.error) throw new Error(course.error.message);
  const question = await admin
    .from("questions")
    .select("id")
    .eq("course_id", course.data.id)
    .eq("content", questionContent)
    .limit(1)
    .single();
  if (question.error) throw new Error(question.error.message);
  const answers = await admin
    .from("user_question_answers")
    .select("selected_option_id")
    .eq("user_id", matrix.student.id)
    .eq("question_id", question.data.id);
  if (answers.error) throw new Error(answers.error.message);
  return answers.data;
}

test("a card added after the page loaded sends the learner back to the flashcards, and answers work once it is rated", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(topicPath());
  const thread = page.getByRole("list", { name: "Các bước của bài học" });
  await expect(thread).toContainText("Memory check (đang khóa)");

  // LF6 AC2: a locked step is a button that explains the lock under the thread and never opens the stage.
  const lockLine = thread.locator("xpath=../following-sibling::div[@aria-live='polite']");
  await expect(lockLine).toHaveText("");
  await thread.getByRole("button", { name: /^Memory check\s*\(đang khóa\)/ }).click();
  await expect(lockLine).toHaveText("Học các thẻ còn thiếu ở mức Ổn hoặc Dễ để mở Memory check.");
  await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
  await thread.getByRole("button", { name: /^Bài tập\s*\(đang khóa\)/ }).click();
  await expect(lockLine).toHaveText("Trả lời đúng hết memory check để mở khóa phần bài tập.");
  await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
  await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toHaveCount(0);

  // LF6 AC3: on touch-primary input every step, locked ones included, keeps a 44 px target on one line at 375 and 320 px.
  const touchContext = await browser.newContext({
    storageState: await page.context().storageState(),
    viewport: { width: 375, height: 812 },
    hasTouch: true,
  });
  try {
    const touchPage = await touchContext.newPage();
    await touchPage.goto(topicPath());
    for (const width of [375, 320]) {
      await touchPage.setViewportSize({ width, height: 812 });
      await expect(touchPage.getByRole("list", { name: "Các bước của bài học" })).toContainText("Memory check (đang khóa)");
      const geometry = await touchPage.evaluate(() => {
        const list = document.querySelector("ol[aria-label='Các bước của bài học']") as HTMLElement;
        // One line: the vertical centres agree (a 24 px step target may be 2 px taller than the 20 px circle on the narrowest width).
        const items = Array.from(list.children).map((item) => {
          const rect = item.getBoundingClientRect();
          return Math.round((rect.top + rect.bottom) / 2);
        });
        // The 44 px hit area is read by hit-testing 21.5 px above and below each button's centre.
        const buttons = Array.from(list.querySelectorAll("button")).map((button) => {
          const rect = button.getBoundingClientRect();
          const cx = (rect.left + rect.right) / 2;
          const cy = (rect.top + rect.bottom) / 2;
          const hit44 = [cy - 21.5, cy + 21.5].every((y) => {
            const hit = document.elementFromPoint(cx, y);
            return hit !== null && button.contains(hit);
          });
          return { left: rect.left, right: rect.right, hit44, locked: button.hasAttribute("data-step-locked") };
        });
        return {
          coarse: !matchMedia("(hover: hover) and (pointer: fine)").matches,
          items,
          buttons,
          viewportWidth: window.innerWidth,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(geometry.coarse).toBe(true);
      expect(new Set(geometry.items).size).toBe(1);
      expect(geometry.buttons.some((button) => button.locked)).toBe(true);
      expect(geometry.overflow).toBe(false);
      for (const button of geometry.buttons) {
        expect(button.hit44).toBe(true);
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(geometry.viewportWidth);
      }
      const byLeft = [...geometry.buttons].sort((a, b) => a.left - b.left);
      for (let i = 1; i < byLeft.length; i += 1) expect(byLeft[i].left).toBeGreaterThanOrEqual(byLeft[i - 1].right - 0.5);
    }
  } finally {
    await touchContext.close();
  }

  // Học hết thẻ: memory check mở và được vào ngay.
  await rateCardsUntilMemoryCheck(page);
  await expect(thread).toContainText("Memory check (đang học)");

  // Giảng viên thêm thẻ khi học viên đang ở memory check.
  await addFullFlowCard(process.env, { scope });

  // Server từ chối: không có câu trả lời nào được ghi, người học về Từ vựng và dữ liệu được tải lại.
  await page.getByRole("radio", { name: /hạn chót/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  // Đúng một toast thông tin với số thẻ mới; không có toast lỗi và không có toast "Bạn còn N thẻ chưa học".
  await expect(page.getByText(NEW_CARDS_TOAST)).toBeVisible();
  await expect(page.getByText(viLearn.actions.progress.cardsRequired)).toHaveCount(0);
  await expect(page.getByText(/Bạn còn \d+ thẻ chưa học/)).toHaveCount(0);
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
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();

  await page.getByRole("radio", { name: /approved/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page.getByRole("radio", { name: /có sẵn, rảnh/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();

  // Câu đầu quay lại cuối hàng: đổi sang đáp án đúng.
  await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
  await page.getByRole("radio", { name: /hạn chót/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("button", { name: "Mở bài tập" })).toHaveCount(0);
  await expect(thread).toContainText("Bài tập (đang học)");
  const changed = await answeredOptionFor(FIRST_QUESTION);
  expect(changed).toHaveLength(1);
  expect(changed[0].selected_option_id).not.toBe(firstAttempt[0].selected_option_id);
});

test("the stage thread shows a finished step as done while it is the current step, at 375px and 1280px", async ({
  page,
}) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(topicPath());
    const thread = page.getByRole("list", { name: "Các bước của bài học" });
    // Test trước đã học hết thẻ và qua memory check, còn bài tập chưa làm: LF5 mở thẳng bước Bài tập.
    await expect(thread).toContainText("Bài tập (đang học)");
    await expect(thread).toContainText("Memory check (đã xong)");
    await expectNoHorizontalOverflow(page);
    // Quay lại một bước đã xong thì bước đó vừa đang học vừa đã xong.
    await page.getByRole("button", { name: "Về Memory check" }).click();
    await expect(thread).toContainText("Memory check (đã xong, đang học)");
    await page.getByRole("button", { name: "Về Từ vựng" }).click();
    await expect(thread).toContainText("Từ vựng (đã xong, đang học)");
    await expectNoHorizontalOverflow(page);
  }
});

test("a changed answer is refused while a new card is unseen and the stored answer stays; it succeeds after the card is rated", async ({
  page,
}) => {
  // Test này tự seed lại để bắt đầu từ trạng thái sạch (không còn thẻ mới, đáp án, tiến độ của hai test trước).
  test.setTimeout(300_000);
  await seedLearningWorkspaceMatrix(process.env, { scope });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(topicPath());
  const thread = page.getByRole("list", { name: "Các bước của bài học" });
  await rateCardsUntilMemoryCheck(page);

  // Có đáp án đã lưu: câu đầu trả lời sai (ghi lại), hai câu sau đúng; câu đầu quay lại cuối hàng.
  await page.getByRole("radio", { name: /lịch trình/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("radio", { name: /bạn chọn chưa đúng/ })).toBeVisible();
  const stored = await answeredOptionFor(FIRST_QUESTION);
  expect(stored).toHaveLength(1);
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page.getByRole("radio", { name: /approved/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page.getByRole("radio", { name: /có sẵn, rảnh/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();

  // Giảng viên thêm thẻ; lần đổi đáp án của câu đầu bị từ chối và đáp án đã lưu không đổi.
  await addFullFlowCard(process.env, { scope });
  await page.getByRole("radio", { name: /hạn chót/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText(NEW_CARDS_TOAST)).toBeVisible();
  await expect(thread).toContainText("Memory check (đang khóa)");
  const afterRefusal = await answeredOptionFor(FIRST_QUESTION);
  expect(afterRefusal).toHaveLength(1);
  expect(afterRefusal[0].selected_option_id).toBe(stored[0].selected_option_id);

  // Phục hồi: học thẻ mới rồi gửi lại thì đáp án được đổi sang đáp án đúng.
  const shownCards = await rateCardsUntilMemoryCheck(page);
  expect(shownCards).toEqual([FULL_FLOW_ADDED_CARD.word]);
  await page.getByRole("radio", { name: /hạn chót/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("button", { name: "Mở bài tập" })).toHaveCount(0);
  await expect(thread).toContainText("Bài tập (đang học)");
  // LF9: câu đúng cuối tự chuyển sang bài tập; dấu đã xong giữ nguyên.
  await expect(thread).toContainText("Memory check (đã xong)");
  const changed = await answeredOptionFor(FIRST_QUESTION);
  expect(changed).toHaveLength(1);
  expect(changed[0].selected_option_id).not.toBe(stored[0].selected_option_id);
});

// LF4: mỗi bề rộng tự seed lại để bắt đầu từ trạng thái sạch (học viên chưa xem thẻ nào).
for (const width of [375, 1280]) {
  test(`unseen and uncleared cards resume, full review advances automatically and a new card is queued alone, at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await seedLearningWorkspaceMatrix(process.env, { scope });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(topicPath());

    const counter = (left: number, total: number) => page.getByText(`${left} / ${total}`, { exact: true });
    const finishedHeading = page.getByRole("heading", { name: "Bạn đã ôn xong từ vựng" });
    const rate = async (word: string, rating: string, nextVisible: ReturnType<Page["getByText"]>) => {
      await expect(page.getByText(word, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Hiện đáp án" }).click();
      await page.getByRole("button", { name: rating, exact: true }).click();
      // LF8: thẻ kế tiếp hiện ngay; việc ghi dòng chấm chạy nền (xem savesDrained).
      await expect(nextVisible).toBeVisible();
    };
    const unseenToast = (count: number) => page.getByText(`Bạn còn ${count} thẻ chưa học trong bài học này`);
    // LF8: đánh giá lưu nền và không có dòng trạng thái; trước khi tải lại phải chờ DB đủ số thẻ đã chấm (hàng đợi lưu đã cạn).
    const savesDrained = (ratedCards: number) => expect.poll(ratedCardCount).toBe(ratedCards);

    // Lần đầu mọi thẻ đều chưa xem: đủ 4 thẻ và không có toast chưa học.
    await expect(counter(4, 4)).toBeVisible();
    await expect(unseenToast(4)).toHaveCount(0);

    // (a) Chấm hai thẻ đầu Dễ rồi tải lại: chỉ còn hai thẻ chưa xem và có toast.
    await rate("schedule", "Dễ", page.getByText("deadline", { exact: true }));
    await rate("deadline", "Dễ", page.getByText("approve", { exact: true }));
    await savesDrained(2);
    await page.reload();
    await expect(counter(2, 2)).toBeVisible();
    await expect(page.getByText("approve", { exact: true })).toBeVisible();
    await expect(unseenToast(2)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Chấm Lại chưa mở cổng; tải lại vẫn xếp đúng thẻ chưa đạt, dù đã xem hết.
    await rate("approve", "Lại", page.getByText("available", { exact: true }));
    await rate("available", "Dễ", page.getByText("approve", { exact: true }));
    await savesDrained(4);
    await page.reload();
    await expect(counter(1, 1)).toBeVisible();
    await expect(page.getByText("approve", { exact: true })).toBeVisible();
    const thread = page.getByRole("list", { name: "Các bước của bài học" });
    await expect(thread).toContainText("Memory check (đang khóa)");
    await rate("approve", "Ổn", page.getByRole("heading", { name: FIRST_QUESTION }));
    await expect(finishedHeading).toHaveCount(0);

    // Ôn lại cả bộ: Lại không khóa lại cổng đã đạt; hết bộ tự về Memory check còn thiếu.
    await page.getByRole("button", { name: "Về Từ vựng" }).click();
    await page.getByRole("button", { name: "Ôn lại từ vựng" }).click();
    await expect(counter(4, 4)).toBeVisible();
    await rate("schedule", "Lại", page.getByText("deadline", { exact: true }));
    await expect(thread).not.toContainText("Memory check (đang khóa)");
    await rate("deadline", "Ổn", page.getByText("approve", { exact: true }));
    await rate("approve", "Ổn", page.getByText("available", { exact: true }));
    await rate("available", "Ổn", page.getByText("schedule", { exact: true }));
    await rate("schedule", "Ổn", page.getByRole("heading", { name: FIRST_QUESTION }));
    await expect(finishedHeading).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // (c) Giảng viên thêm thẻ: tải lại thì chỉ thẻ mới được xếp, kèm toast.
    await addFullFlowCard(process.env, { scope });
    await page.reload();
    await expect(counter(1, 1)).toBeVisible();
    await expect(page.getByText(FULL_FLOW_ADDED_CARD.word, { exact: true })).toBeVisible();
    await expect(unseenToast(1)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
