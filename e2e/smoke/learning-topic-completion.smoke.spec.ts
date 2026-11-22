import { expect, test, type Page } from "@playwright/test";
import {
  MATRIX_TOPICS,
  cleanupLearningWorkspaceMatrix,
  matrixFor,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { getWorkerScope, assertIsolatedRuntime } from "../../scripts/e2e/support/worker-scope.mjs";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/lf9/plan.md, docs/programs/student-user-flow-route/implementation-plans/lf6/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật màn hình hoàn thành chủ đề, bước vào chủ đề ở bước đầu tiên còn phải làm và xem lại memory check (LF5 AC1-AC9).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441) với fixture tổng hợp tạo một lần trong beforeAll; mỗi test xóa tiến độ của học viên seed rồi chạy ở 375px và 1280px.
// - Case thành công: học trọn chủ đề full-flow (thẻ, memory check, bài tập) -> không toast, màn hình hoàn thành hiện với chuỗi chuyển động (`data-motion="sequence"`);
//   xem lại Memory check chỉ đọc (có giải thích) rồi về màn hình hoàn thành không phát lại chuỗi; tải lại mở thẳng màn hình đã ổn định (`settled`);
//   chấm một thẻ Lại sau khi hoàn thành -> tải lại thì hành động chính của màn hình là nút hai dòng "Có 1 thẻ đến hạn" / "Ôn ngay";
//   hành động "Chủ đề tiếp theo" phụ là nút viền toàn chiều rộng (từ 44px) xếp dưới nút chính, giống nhau ở con trỏ chính xác và cảm ứng (mỗi hành động một hàng).
// - LF6 (AC1/AC3/AC4, Owner QA 2026-10-13): không còn nút "Xem lại", dòng giải thích hay vòng nổi bật; một dòng gợi ý nhỏ nằm dưới thanh tiến trình, trong khung nhìn, không làm tràn ngang và thanh vẫn một dòng; các bước của thanh là nút có con trỏ tay và nền hover đổi màu (đo bằng computed style), Enter và Space mở bước, focus về khung bước, Từ vựng mở màn hình kết thúc không dựng hàng đợi; mục tiêu bấm của thanh >= 24 px, >= 44 px dưới ngữ cảnh cảm ứng thật ở 375 và 320 px, không chồng nhau và vòng focus không bị cắt.
// - Case reduced motion: cùng luồng nhưng với `prefers-reduced-motion: reduce` thì màn hình hoàn thành hiện ngay ở trạng thái `settled`.
// - Case không có bài tập: chủ đề thẻ + memory check không bài tập, qua memory check thì tự chuyển sang màn hình hoàn thành, không có nút "Mở bài tập" hay "Hoàn thành memory check".
// - Case chưa hoàn thành: chủ đề mở ở bước đầu tiên còn phải làm (Từ vựng, rồi Memory check khi thẻ đã xong, rồi Bài tập khi memory check đã qua).
// - Bảo mật/phân quyền: fixture và kiểm tra chỉ trên runtime E2E cô lập; học viên seed là người duy nhất được ghi danh.
// - Ổn định/resilience: không tràn ngang ở 375px và 1280px trên các màn bị đụng tới.
// - Invariant cần giữ: xem lại không ghi gì; tiến độ khóa học/chương lấy từ cùng nguồn với danh sách chương.
// - LF9 r7: câu bài tập cuối giữ phản hồi và không tự chuyển; nút "Hoàn thành" mở màn hình hoàn thành.
// - Chưa kiểm chứng: cảm nhận chuyển động do Owner đánh giá trên UI chạy thật.
// - Kết quả verify gần nhất: xem báo cáo checkpoint LF5 CP4 (chạy `npm run test:e2e -- e2e/smoke/learning-topic-completion.smoke.spec.ts`).

test.describe.configure({ mode: "serial" });

const WIDTHS = [375, 1280];

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
  await resetLearner();
  await page.goto("/login");
  await page.getByLabel("Email").fill(matrix.student.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(matrix.student.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

const topicPath = (key: keyof typeof MATRIX_TOPICS) =>
  `/learn/${matrix.courseSlug}/${matrix.topics[key].slug}`;
const completionTitle = (key: keyof typeof MATRIX_TOPICS) =>
  `Đã hoàn thành chủ đề “${matrix.topics[key].title}”`;

/** Xóa mọi dấu vết học của học viên seed trong khóa fixture, để mỗi test bắt đầu từ chủ đề chưa học. */
async function resetLearner() {
  assertIsolatedRuntime(process.env);
  const admin = createSupabaseAdmin(process.env);
  const course = await admin.from("courses").select("id").eq("slug", matrix.courseSlug).single();
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
    .eq("user_id", matrix.student.id)
    .in("question_id", questions.data.map((question) => question.id));
  if (answers.error) throw new Error(answers.error.message);
  const flashcards = await admin
    .from("user_flashcards")
    .delete()
    .eq("user_id", matrix.student.id)
    .in("card_id", cards.data.map((card) => card.id));
  if (flashcards.error) throw new Error(flashcards.error.message);
  const progress = await admin
    .from("user_topic_progress")
    .delete()
    .eq("user_id", matrix.student.id)
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
/** LF6 AC1: the stage plane is the workspace `main`, made focusable with tabindex -1 (the layout has other `main`s). */
const stagePlane = (page: Page) => page.locator("main[tabindex='-1']");
/** LF6 AC1: a thread step other than the current one is a button inside the list. */
const threadStep = (page: Page, name: RegExp) => stepThread(page).getByRole("button", { name });
/** LF6 AC4 (Owner QA): the single hint line under the thread, on every stage with more than one step. */
const THREAD_HINT =
  "Bạn có thể di chuyển nhanh giữa các nội dung bằng cách nhấn vào nội dung tương ứng trên thanh tiến trình.";

/** LF6 AC3 (Owner QA): the removed "Xem lại" button, its line and the highlight ring must not come back. */
async function expectNoReviewButtonOrRing(page: Page) {
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toHaveCount(0);
  await expect(page.getByText("Chọn một bước ở thanh tiến trình để xem lại.")).toHaveCount(0);
  await expect(page.locator("[data-thread-highlight]")).toHaveCount(0);
}

/** LF6 AC3 (Owner QA): every step button has a pointer cursor and a hover background clearly different from the page. */
async function expectStepAffordance(page: Page) {
  const buttons = stepThread(page).getByRole("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let index = 0; index < count; index += 1) {
    await expect(buttons.nth(index)).toHaveCSS("cursor", "pointer");
  }
  const first = buttons.first();
  await page.mouse.move(0, 0);
  await expect(first).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await first.hover();
  // The hover background must settle (polled across the 220 ms colour transition) on a colour that is neither transparent
  // nor the page's own background, so the step stands out. Colours are compared as computed, whatever their syntax.
  const pageBackground = await first.evaluate((element) => {
    for (let node = element.parentElement; node; node = node.parentElement) {
      const value = getComputedStyle(node).backgroundColor;
      if (value !== "rgba(0, 0, 0, 0)") return value;
    }
    return "rgba(0, 0, 0, 0)";
  });
  await expect
    .poll(() => first.evaluate((element) => getComputedStyle(element).backgroundColor), { timeout: 2000 })
    .not.toMatch(/^rgba\(0, 0, 0, 0\)$/);
  await expect
    .poll(() => first.evaluate((element) => getComputedStyle(element).backgroundColor), { timeout: 2000 })
    .not.toBe(pageBackground);
  await page.mouse.move(0, 0);
}

interface MotionSample {
  time: number;
  /** Course progress fill as a fraction of its track. */
  courseFill: number;
  /** Opacity of the "Tiếp theo" hint. */
  hintOpacity: number;
  /** Whether the gained-segment highlight element exists on the course bar. */
  gainPresent: boolean;
  /** Width of the highlight as a fraction of the track, and its opacity. */
  gainWidth: number;
  gainOpacity: number;
  /** Computed timing of the course fill, the highlight and the hint (CSS time lists such as "1s, 0.3s"). */
  fillTiming: { duration: string; delay: string };
  gainTiming: { duration: string; delay: string } | null;
  hintAnimationDelay: string;
}

/** Converts a computed CSS time list ("1s, 0.3s", "250ms") to milliseconds. */
const cssTimesMs = (list: string) =>
  list.split(",").map((part) => {
    const value = part.trim();
    return value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;
  });

/** Records the course bar and the next hint on every frame once the completion screen exists. */
async function startMotionSampler(page: Page) {
  await page.evaluate(() => {
    const samples: MotionSample[] = [];
    (window as unknown as { __motion: MotionSample[] }).__motion = samples;
    const begin = performance.now();
    const tick = () => {
      const section = document.querySelector("section[aria-labelledby='topic-completion-title']");
      const fill = section?.querySelector("[role='progressbar'] > div") as HTMLElement | null;
      const hint = section?.querySelector("[data-completion-hint]") as HTMLElement | null;
      if (fill?.parentElement && hint) {
        const gain = fill.parentElement.querySelector("[data-completion-gain]") as HTMLElement | null;
        samples.push({
          time: performance.now(),
          courseFill: fill.getBoundingClientRect().width / fill.parentElement.getBoundingClientRect().width,
          hintOpacity: Number(getComputedStyle(hint).opacity),
          gainPresent: gain !== null,
          gainWidth: gain ? gain.getBoundingClientRect().width / fill.parentElement.getBoundingClientRect().width : 0,
          gainOpacity: gain ? Number(getComputedStyle(gain).opacity) : 0,
          fillTiming: {
            duration: getComputedStyle(fill).transitionDuration,
            delay: getComputedStyle(fill).transitionDelay,
          },
          gainTiming: gain
            ? { duration: getComputedStyle(gain).transitionDuration, delay: getComputedStyle(gain).transitionDelay }
            : null,
          hintAnimationDelay: getComputedStyle(hint).animationDelay,
        });
      }
      if (performance.now() - begin < 12_000) requestAnimationFrame(tick);
    };
    tick();
  });
}

async function readMotionSamples(page: Page) {
  return page.evaluate(() => (window as unknown as { __motion: MotionSample[] }).__motion);
}

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
    // Câu đúng cuối của mọi memory check chuyển ngay khi server xác nhận, nên không chờ phản hồi của nó.
    if (!afterwards) continue;
    await expect(page.getByRole("radio", { name: /bạn chọn đúng/ })).toBeVisible();
    await page.getByRole("button", { name: afterwards }).click();
  }
}

const FULL_WORDS = ["schedule", "deadline", "approve", "available"];
const FULL_MEMORY: Array<[RegExp, string]> = [
  [/hạn chót/, "Câu tiếp theo"],
  [/approved/, "Câu tiếp theo"],
  [/có sẵn, rảnh/, ""],
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

/**
 * Học trọn chủ đề full-flow đến hết câu cuối. Câu cuối giữ phản hồi và không tự chuyển (LF9 r7); nút "Hoàn thành"
 * mở màn hình hoàn thành. Bộ lấy mẫu chuyển động chạy từ trước lần bấm đó để không lỡ chuỗi.
 */
async function finishFullFlow(page: Page) {
  await page.goto(topicPath("full"));
  await rateCards(page, FULL_WORDS);
  await expect(page.getByRole("heading", { name: 'Nghĩa của "deadline" là gì?' })).toBeVisible();
  await answerMemory(page, FULL_MEMORY);
  await expect(page.getByRole("radio", { name: FULL_EXERCISES[0] })).toBeVisible();
  await expect(stagePlane(page)).toBeFocused();
  await expect(page.getByRole("button", { name: "Mở bài tập" })).toHaveCount(0);
  for (const [index, option] of FULL_EXERCISES.entries()) {
    const last = index === FULL_EXERCISES.length - 1;
    await page.getByRole("radio", { name: option }).click();
    await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
    if (last) {
      const finish = page.getByRole("button", { name: "Hoàn thành", exact: true });
      await expect(finish).toBeVisible();
      await expect(page.getByRole("radio", { name: /bạn chọn đúng/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Câu tiếp theo" })).toHaveCount(0);
      await expect(completionSection(page)).toHaveCount(0);
      await startMotionSampler(page);
      await finish.click();
      await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    } else {
      const forward = page.getByRole("button", { name: "Câu tiếp theo" });
      await expect(forward).toBeVisible();
      await expect(completionSection(page)).toHaveCount(0);
      await forward.click();
    }
  }
}

for (const width of WIDTHS) {
  test(`finishing the full-flow topic opens the completion screen with its sequence, and the review and reload settle it, at ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 900 });
    await finishFullFlow(page);

    // The completion screen opens by itself once the last answer's feedback delay ends.
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "sequence");
    // Result text and the primary action are usable at once; only the progress and the hint are sequenced.
    await expect(page.getByRole("link", { name: "Chủ đề tiếp theo" })).toBeVisible();
    // LF6 AC4 (Owner QA): no review button or line, no ring; one hint under the thread instead.
    await expectNoReviewButtonOrRing(page);
    await expect(page.getByRole("button", { name: /^Xem lại .+/ })).toHaveCount(0);
    await expect(page.getByText(THREAD_HINT)).toBeVisible();
    await expect(page.getByText(/^Tiếp theo: /)).toBeVisible();
    await page.waitForTimeout(2200);
    // AC8 (Owner Q7). Timing is verified from the computed CSS, not from frame cadence, so a slow runner cannot flip it:
    // the course fill has a fixed 1.2 s transition with no delay, the highlight grows with it and fades right after, and
    // the hint starts only once the fill is over. Samples only prove the start and end values and the highlight.
    const samples = await readMotionSamples(page);
    expect(samples.length).toBeGreaterThan(0);
    const first = samples[0];
    const last = samples[samples.length - 1];
    expect(first.courseFill).toBeLessThan(0.05);
    expect(first.hintOpacity).toBeLessThan(0.2);
    expect(last.courseFill).toBeGreaterThan(0.12);
    expect(last.courseFill).toBeLessThan(0.16);
    expect(last.hintOpacity).toBe(1);
    expect(cssTimesMs(first.fillTiming.duration)).toEqual([1200]);
    expect(cssTimesMs(first.fillTiming.delay)).toEqual([0]);
    expect(first.gainTiming).not.toBeNull();
    expect(cssTimesMs(first.gainTiming!.duration)).toEqual([1200, 300]);
    expect(cssTimesMs(first.gainTiming!.delay)).toEqual([0, 1200]);
    expect(cssTimesMs(first.hintAnimationDelay)[0]).toBeGreaterThanOrEqual(1250);
    // The highlight is shown when the sequence starts and transparent once it has settled.
    expect(first.gainPresent).toBe(true);
    expect(first.gainOpacity).toBeGreaterThan(0.9);
    expect(last.gainOpacity).toBeLessThan(0.05);
    // Loose sanity check, no frame count or time window: at least one sample mid-run, with the bar between its old and
    // new value and the highlight both visibly wide and opaque.
    expect(
      samples.some(
        (sample) =>
          sample.courseFill > 0.005 &&
          sample.courseFill < 0.135 &&
          sample.gainWidth > 0.01 &&
          sample.gainOpacity > 0.9,
      ),
    ).toBe(true);
    await expect(page.getByRole("progressbar")).toHaveCount(2);
    await expect(page.getByRole("progressbar", { name: "Tiến độ khóa học" })).toHaveAttribute("aria-valuenow", "1");
    // Thẻ vừa chấm Ổn chưa đến hạn nên hành động chính là chủ đề kế, không phải ôn thẻ.
    await expect(page.getByRole("button", { name: /^Ôn ngay/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Chủ đề tiếp theo" })).toHaveAttribute(
      "href",
      `/learn/${matrix.courseSlug}/${matrix.topics.vocabulary.slug}`,
    );
    // Q8: a one-line action with no second line; the next topic is named in the hint instead.
    await expect(page.getByRole("link", { name: "Chủ đề tiếp theo" })).toHaveText("Chủ đề tiếp theo");
    await expect(page.getByText(/^Tiếp theo: Chủ đề /)).toBeVisible();
    // Both progress tracks share one height.
    const heights = await page
      .getByRole("progressbar")
      .evaluateAll((bars) => bars.map((bar) => Math.round(bar.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
    await expectNoHorizontalOverflow(page);

    // Xem lại memory check ngay trong phiên: chỉ đọc, có giải thích; quay về không phát lại chuỗi.
    await threadStep(page, /^Memory check/).click();
    await expect(page.getByRole("heading", { level: 2, name: "Xem lại Memory check" })).toBeVisible();
    // LF6 AC1: after a jump the stage plane has focus.
    await expect(stagePlane(page)).toBeFocused();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
    await expect(page.getByText("deadline nghĩa là hạn chót.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kiểm tra đáp án" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Xem kết quả chủ đề" }).click();
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "settled");

    // Tải lại: mở thẳng màn hình hoàn thành đã ổn định; bản xem lại vẫn có giải thích.
    await page.reload();
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "settled");
    await expect(page.locator("[data-completion-gain]")).toHaveCount(0);
    await threadStep(page, /^Memory check/).click();
    await expect(page.getByText("deadline nghĩa là hạn chót.")).toBeVisible();
    await page.getByRole("button", { name: "Xem kết quả chủ đề" }).click();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "settled");

    // LF6 AC3 (Owner QA): the steps read as clickable, and the hint stays under the thread on the settled completion screen.
    await expect(page.getByText(THREAD_HINT)).toBeVisible();
    await expectStepAffordance(page);
    await expect(completionSection(page)).toHaveAttribute("data-motion", "settled");

    // Enter and Space activate a thread step (native buttons); Từ vựng opens the finished screen and starts no queue.
    await stepThread(page).getByRole("button").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Bạn đã ôn xong từ vựng" })).toBeVisible();
    await expect(stagePlane(page)).toBeFocused();
    await expect(page.getByText(/^\d+ \/ \d+$/)).toHaveCount(0);
    await threadStep(page, /^Bài tập/).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio", { name: FULL_EXERCISES[0] })).toBeVisible();
    await expect(stagePlane(page)).toBeFocused();
    await threadStep(page, /^Từ vựng/).click();

    // Chấm một thẻ Lại sau khi hoàn thành: tải lại thì màn hình mời ôn thẻ đến hạn trước.
    await page.getByRole("button", { name: "Ôn lại từ vựng" }).click();
    await expect(page.getByText("schedule", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hiện đáp án" }).click();
    await page.getByRole("button", { name: "Lại", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    // Q10: the primary action is two lines; its accessible name keeps both.
    const dueNow = page.getByRole("button", { name: "Có 1 thẻ đến hạn, Ôn ngay" });
    await expect(dueNow).toBeVisible();
    await expect(dueNow.locator("[data-due-line]")).toHaveText(["Có 1 thẻ đến hạn", "Ôn ngay"]);
    await expectNoHorizontalOverflow(page);
    // Q13: one action per row in every input mode. On a mouse/trackpad (the default context, which reports a fine
    // pointer) the next-topic action is already the full-width outlined 44px+ button under the full-width primary.
    expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(true);
    const subordinate = page.getByRole("link", { name: "Chủ đề tiếp theo" });
    const measure = (link: typeof subordinate) =>
      link.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const parent = element.parentElement!.getBoundingClientRect();
        return {
          borderColor: style.borderTopColor,
          background: style.backgroundColor,
          height: box.height,
          widthRatio: box.width / parent.width,
        };
      });
    // Geometry of the due-first actions: the primary, the next-topic action and the two text lines of the primary.
    const layout = (view: Page) =>
      view.evaluate(() => {
        const primary = Array.from(document.querySelectorAll("button")).find((button) =>
          button.getAttribute("aria-label")?.startsWith("Có "),
        ) as HTMLElement;
        const link = Array.from(document.querySelectorAll("a")).find(
          (anchor) => anchor.textContent === "Chủ đề tiếp theo",
        ) as HTMLElement;
        const row = primary.parentElement!.getBoundingClientRect();
        const p = primary.getBoundingClientRect();
        const l = link.getBoundingClientRect();
        const lines = Array.from(primary.querySelectorAll("[data-due-line]")).map((line) => line.getBoundingClientRect().left);
        return {
          primaryWidthRatio: p.width / row.width,
          linkWidthRatio: l.width / row.width,
          stacked: l.top >= p.bottom,
          linesLeft: lines,
          lineInset: lines[0] - p.left,
          docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
    const expectStacked = async (view: Page, link: typeof subordinate) => {
      const stackedLayout = await layout(view);
      expect(stackedLayout.stacked).toBe(true);
      expect(stackedLayout.primaryWidthRatio).toBeGreaterThan(0.95);
      expect(stackedLayout.linkWidthRatio).toBeGreaterThan(0.95);
      expect(stackedLayout.docOverflow).toBe(false);
      // The two lines of the primary start at the same x, inset from the button edge.
      expect(Math.abs(stackedLayout.linesLeft[0] - stackedLayout.linesLeft[1])).toBeLessThan(1);
      expect(stackedLayout.lineInset).toBeGreaterThan(8);
      const outline = await measure(link);
      expect(outline.borderColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(outline.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(outline.height).toBeGreaterThanOrEqual(44);
      expect(outline.widthRatio).toBeGreaterThan(0.95);
    };
    await expectStacked(page, subordinate);
    // Owner Q14 (checked on the phone widths and at 320 px): the stage thread on one line, the hint under it inside the
    // viewport, and the footer destinations with the capability-based treatment.
    const expectMobileLayout = async (view: Page, footer: "plain" | "outlined") => {
      const geometry = await view.evaluate(() => {
        const thread = document.querySelector("ol[aria-label='Các bước của bài học']") as HTMLElement;
        const items = Array.from(thread.children).map((item) => item.getBoundingClientRect());
        const hint = document.querySelector("[data-thread-hint]") as HTMLElement;
        const hintRect = hint.getBoundingClientRect();
        const threadRect = thread.getBoundingClientRect();
        // The hit area is read by hit-testing 21.5 px above and below the centre (a 44 px target) and 10 px (a 24 px one).
        const threadButtons = Array.from(thread.querySelectorAll("button")).map((button) => {
          const rect = button.getBoundingClientRect();
          const cx = (rect.left + rect.right) / 2;
          const cy = (rect.top + rect.bottom) / 2;
          const hits = (offset: number) =>
            [cy - offset, cy + offset].every((y) => {
              const hit = document.elementFromPoint(cx, y);
              return hit !== null && button.contains(hit);
            });
          return {
            left: rect.left,
            right: rect.right,
            height: rect.height,
            hit44: hits(21.5),
            hit24: hits(10),
          };
        });
        const footerActions = Array.from(
          document.querySelectorAll("nav[aria-label='Điều hướng bài học'] a, nav[aria-label='Điều hướng bài học'] button"),
        ).map((element) => {
          const style = getComputedStyle(element);
          return {
            borderColor: style.borderTopColor,
            background: style.backgroundColor,
            height: element.getBoundingClientRect().height,
          };
        });
        return {
          // One line: the vertical centres agree (a 24 px step target may be 2 px taller than the 20 px circle on the narrowest width).
          threadCentres: items.map((rect) => Math.round((rect.top + rect.bottom) / 2)),
          threadRight: Math.max(...items.map((rect) => rect.right)),
          threadBoxRight: thread.getBoundingClientRect().right,
          hint: {
            left: hintRect.left,
            right: hintRect.right,
            top: hintRect.top,
            threadBottom: threadRect.bottom,
            text: hint.textContent,
          },
          threadButtons,
          viewportWidth: window.innerWidth,
          footerActions,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(new Set(geometry.threadCentres).size).toBe(1);
      expect(geometry.threadRight).toBeLessThanOrEqual(geometry.threadBoxRight + 0.5);
      // LF6 AC4 (Owner QA): the hint wraps by itself under the thread and stays inside the viewport.
      expect(geometry.hint.text).toBe(THREAD_HINT);
      expect(geometry.hint.top).toBeGreaterThanOrEqual(geometry.hint.threadBottom - 0.5);
      expect(geometry.hint.left).toBeGreaterThanOrEqual(0);
      expect(geometry.hint.right).toBeLessThanOrEqual(geometry.viewportWidth);
      // LF6 AC3: every thread step is at least 24x24; on touch-primary input at least 44 high; hit areas never overlap and
      // stay inside the viewport.
      expect(geometry.threadButtons.length).toBeGreaterThanOrEqual(2);
      for (const button of geometry.threadButtons) {
        expect(button.right - button.left).toBeGreaterThanOrEqual(24);
        expect(button.height).toBeGreaterThanOrEqual(24);
        expect(button.hit24).toBe(true);
        expect(button.hit44).toBe(footer === "outlined");
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(geometry.viewportWidth);
      }
      const byLeft = [...geometry.threadButtons].sort((a, b) => a.left - b.left);
      for (let i = 1; i < byLeft.length; i += 1) expect(byLeft[i].left).toBeGreaterThanOrEqual(byLeft[i - 1].right - 0.5);
      expect(geometry.overflow).toBe(false);
      expect(geometry.footerActions.length).toBeGreaterThan(0);
      for (const action of geometry.footerActions) {
        if (footer === "outlined") {
          expect(action.borderColor).not.toBe("rgba(0, 0, 0, 0)");
          expect(action.background).not.toBe("rgba(0, 0, 0, 0)");
          expect(action.height).toBeGreaterThanOrEqual(44);
        } else {
          // A fine pointer keeps the quiet footer treatment.
          expect(action.borderColor).toBe("rgba(0, 0, 0, 0)");
          expect(action.background).toBe("rgba(0, 0, 0, 0)");
        }
      }
    };
    await expectMobileLayout(page, "plain");
    await page.setViewportSize({ width: 320, height: 700 });
    await page.waitForTimeout(300);
    await expectMobileLayout(page, "plain");
    await page.setViewportSize({ width, height: 900 });
    // Keyboard focus on the next-topic action shows a real ring: the :focus-visible state with a Route Blue ring of non-zero
    // spread, polled across the 120 ms colour/shadow transition.
    // LF6 AC3: a thread step shows the same kind of ring, and the ring is not clipped by an ancestor or the viewport.
    const firstStep = stepThread(page).getByRole("button").first();
    await firstStep.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(firstStep).toBeFocused();
    await expect
      .poll(() => firstStep.evaluate((element) => getComputedStyle(element).boxShadow), { timeout: 2000 })
      .toMatch(/rgb\(37, 99, 235\) 0px 0px 0px [1-9]\d*px/);
    const ringClipped = await firstStep.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const ring = { left: box.left - 2, right: box.right + 2, top: box.top - 2, bottom: box.bottom + 2 };
      let clipped = ring.left < 0 || ring.right > window.innerWidth;
      for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX === "visible" && style.overflowY === "visible") continue;
        const parent = node.getBoundingClientRect();
        if (ring.left < parent.left || ring.right > parent.right || ring.top < parent.top || ring.bottom > parent.bottom) {
          clipped = true;
        }
      }
      return clipped;
    });
    expect(ringClipped).toBe(false);
    await subordinate.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(subordinate).toBeFocused();
    expect(await subordinate.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    await expect
      .poll(() => subordinate.evaluate((element) => getComputedStyle(element).boxShadow), { timeout: 2000 })
      .toMatch(/rgb\(37, 99, 235\) 0px 0px 0px [1-9]\d*px/);
    // Q13 on touch-primary input (a second context sharing the signed-in session): the same stacked composition.
    const touchContext = await browser.newContext({
      storageState: await page.context().storageState(),
      viewport: { width, height: 900 },
      hasTouch: true,
    });
    try {
      const touchPage = await touchContext.newPage();
      await touchPage.goto(page.url());
      await expect(touchPage.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
      expect(await touchPage.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(false);
      // Q13 on touch: the same stacked composition, so the two contexts cannot diverge.
      await expectStacked(touchPage, touchPage.getByRole("link", { name: "Chủ đề tiếp theo" }));
      await expectMobileLayout(touchPage, "outlined");
      // LF6 AC3: the thread also stays on one line at 320 px under the real touch-primary context.
      await touchPage.setViewportSize({ width: 320, height: 700 });
      await touchPage.waitForTimeout(300);
      await expectMobileLayout(touchPage, "outlined");
    } finally {
      await touchContext.close();
    }
    await dueNow.click();
    await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
    await expect(page.getByText("schedule", { exact: true })).toBeVisible();
    await rateCards(page, ["schedule"]);
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    await expect(completionSection(page)).toHaveAttribute("data-motion", "settled");
  });

  test(`reduced motion shows the completion screen settled at once, at ${width}px`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    await finishFullFlow(page);

    // The completion screen opens by itself once the last answer's feedback delay ends.
    await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible();
    expect(await completionSection(page).getAttribute("data-motion")).toBe("settled");
    // The final values are there from the first frame: no bar growth and no hint fade.
    await page.waitForTimeout(300);
    const samples = await readMotionSamples(page);
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample.courseFill).toBeGreaterThan(0.12);
      expect(sample.courseFill).toBeLessThan(0.16);
      expect(sample.hintOpacity).toBe(1);
      expect(sample.gainPresent).toBe(false);
    }
    await expect(page.locator("[data-completion-gain]")).toHaveCount(0);
    await expect(page.getByRole("progressbar", { name: "Tiến độ khóa học" })).toHaveAttribute("aria-valuenow", "1");
    await expectNoHorizontalOverflow(page);

    // LF6 AC3/AC4 (Owner QA): under reduced motion the hint still shows, nothing was added that moves, and no ring exists.
    await expect(page.getByText(THREAD_HINT)).toBeVisible();
    await expectNoReviewButtonOrRing(page);
    await expectStepAffordance(page);
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
      [/hóa đơn/, "Câu tiếp theo"],
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
      `/learn/${matrix.courseSlug}`,
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
    // Bài tập chỉ hiện khi server đã ghi nhận câu đúng cuối; tải lại sớm hơn thì memory check có thể chưa được lưu.
    await expect(page.getByRole("radio", { name: FULL_EXERCISES[0] })).toBeVisible();
    await page.reload();
    await expect(stepThread(page)).toContainText("Bài tập (đang học)");
    await expect(stepThread(page)).toContainText("Memory check (đã xong)");
    await expect(page.getByRole("button", { name: "Xác nhận đáp án" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
