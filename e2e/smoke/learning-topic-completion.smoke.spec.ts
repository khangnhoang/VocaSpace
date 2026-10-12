import { expect, test, type Page } from "@playwright/test";
import {
  MATRIX_COURSE_SLUG,
  MATRIX_TOPICS,
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/lf5/plan.md, docs/programs/student-user-flow-route/implementation-plans/lf6/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật màn hình hoàn thành chủ đề, bước vào chủ đề ở bước đầu tiên còn phải làm và xem lại memory check (LF5 AC1-AC9).
// - Loại test: smoke E2E trên Supabase local cô lập (cổng 45441) với fixture tổng hợp tạo một lần trong beforeAll; mỗi test xóa tiến độ của học viên seed rồi chạy ở 375px và 1280px.
// - Case thành công: học trọn chủ đề full-flow (thẻ, memory check, bài tập) -> không toast, màn hình hoàn thành hiện với chuỗi chuyển động (`data-motion="sequence"`);
//   xem lại Memory check chỉ đọc (có giải thích) rồi về màn hình hoàn thành không phát lại chuỗi; tải lại mở thẳng màn hình đã ổn định (`settled`);
//   chấm một thẻ Lại sau khi hoàn thành -> tải lại thì hành động chính của màn hình là nút hai dòng "Có 1 thẻ đến hạn" / "Ôn ngay";
//   hành động "Chủ đề tiếp theo" phụ là nút viền toàn chiều rộng (từ 44px) xếp dưới nút chính, giống nhau ở con trỏ chính xác và cảm ứng (mỗi hành động một hàng).
// - LF6 (AC1/AC3/AC4): "Xem lại" là một nút cùng một dòng giải thích; bấm thì focus nút đầu tiên của thanh tiến trình và bật rồi tắt vòng nổi bật (không có dưới reduced motion); các bước của thanh là nút (Enter và Space mở bước, focus về khung bước), Từ vựng mở màn hình kết thúc không dựng hàng đợi; mục tiêu bấm của thanh >= 24 px, >= 44 px dưới ngữ cảnh cảm ứng thật ở 375 và 320 px, không chồng nhau, thanh vẫn một dòng và vòng focus không bị cắt.
// - Case reduced motion: cùng luồng nhưng với `prefers-reduced-motion: reduce` thì màn hình hoàn thành hiện ngay ở trạng thái `settled`.
// - Case không có bài tập: chủ đề thẻ + memory check không bài tập, qua memory check thì tự chuyển sang màn hình hoàn thành, không có nút "Mở bài tập" hay "Hoàn thành memory check".
// - Case chưa hoàn thành: chủ đề mở ở bước đầu tiên còn phải làm (Từ vựng, rồi Memory check khi thẻ đã xong, rồi Bài tập khi memory check đã qua).
// - Bảo mật/phân quyền: fixture và kiểm tra chỉ trên runtime E2E cô lập; học viên seed là người duy nhất được ghi danh.
// - Ổn định/resilience: không tràn ngang ở 375px và 1280px trên các màn bị đụng tới.
// - Invariant cần giữ: xem lại không ghi gì; tiến độ khóa học/chương lấy từ cùng nguồn với danh sách chương.
// - Chưa kiểm chứng: cảm nhận chuyển động và nhịp 1200 ms của lần tự chuyển do Owner đánh giá trên UI chạy thật.
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
/** LF6 AC1: the stage plane is the workspace `main`, made focusable with tabindex -1 (the layout has other `main`s). */
const stagePlane = (page: Page) => page.locator("main[tabindex='-1']");
/** LF6 AC1: a thread step other than the current one is a button inside the list. */
const threadStep = (page: Page, name: RegExp) => stepThread(page).getByRole("button", { name });

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

type AutoAdvanceSample = {
  time: number;
  radios: number;
  resultButtons: number;
  graded: boolean;
  completed: boolean;
  section: boolean;
};

async function startAutoAdvanceRecorder(page: Page) {
  await page.evaluate(() => {
    const samples: AutoAdvanceSample[] = [];
    (window as unknown as { __autoAdvance: AutoAdvanceSample[] }).__autoAdvance = samples;
    const begin = performance.now();
    const tick = () => {
      const resultButtons = Array.from(document.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Xem kết quả chủ đề",
      );
      samples.push({
        time: performance.now(),
        radios: document.querySelectorAll("[role='radio']").length,
        resultButtons: resultButtons.length,
        // The answer was graded correct: the polite live region carries the "Chính xác" feedback.
        graded: Array.from(document.querySelectorAll("[aria-live='polite']")).some((region) =>
          region.textContent?.includes("Chính xác"),
        ),
        // The header's "Đã hoàn thành" badge: the moment the topic shows as completed.
        completed: Array.from(document.querySelectorAll("span, p, div")).some(
          (element) => element.textContent?.trim() === "Đã hoàn thành",
        ),
        section: document.querySelector("section[aria-labelledby='topic-completion-title']") !== null,
      });
      if (performance.now() - begin < 12_000) requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * The last exercise answer keeps its feedback on screen with no `Xem kết quả chủ đề` button at all (the top bar's return
 * action is hidden during the wait, Owner Q16), then the completion screen opens by itself. Only the order of the
 * states is asserted: the 1200 ms delay itself is covered by the fake-timer component tests, and a frame count or an
 * elapsed-time window would depend on runner speed.
 */
async function expectAutoAdvance(page: Page) {
  const samples = await page.evaluate(
    () => (window as unknown as { __autoAdvance: AutoAdvanceSample[] }).__autoAdvance,
  );
  const openedAt = samples.findIndex((sample) => sample.section);
  expect(openedAt, "the completion screen opens").toBeGreaterThanOrEqual(0);
  // 1. The correct feedback shows before the screen opens.
  const beforeOpen = samples.slice(0, openedAt);
  expect(
    beforeOpen.some((sample) => sample.graded),
    "the graded-correct feedback shows",
  ).toBe(true);
  // 2. While that feedback is visible the topic shows as completed and there is no return action or end button.
  const waiting = beforeOpen.filter((sample) => sample.graded && sample.completed);
  expect(waiting.length, "a wait frame with the feedback and the completed topic").toBeGreaterThan(0);
  for (const sample of beforeOpen.filter((frame) => frame.graded)) {
    expect(sample.radios).toBeGreaterThan(0);
    expect(sample.resultButtons).toBe(0);
  }
  // 3. Then the completion screen (openedAt >= 0 above).
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
    // Câu cuối của memory check không bài tập tự chuyển sau 1200 ms, nên không chờ phản hồi của nó.
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

/**
 * Học trọn chủ đề full-flow đến hết câu cuối. Câu cuối không có nút kết thúc: phản hồi hiện trong lúc chờ rồi
 * màn hình hoàn thành tự mở sau AUTO_ADVANCE_MS. Bộ lấy mẫu chuyển động chạy từ trước câu cuối để không lỡ chuỗi.
 */
async function finishFullFlow(page: Page) {
  await page.goto(topicPath("full"));
  await rateCards(page, FULL_WORDS);
  await expect(page.getByRole("heading", { name: 'Nghĩa của "deadline" là gì?' })).toBeVisible();
  await answerMemory(page, FULL_MEMORY);
  for (const [index, option] of FULL_EXERCISES.entries()) {
    const last = index === FULL_EXERCISES.length - 1;
    await page.getByRole("radio", { name: option }).click();
    if (last) {
      await startMotionSampler(page);
      await startAutoAdvanceRecorder(page);
    }
    await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
    if (last) {
      // Không chờ từng điều kiện bằng nhiều lệnh riêng: cửa sổ phản hồi ngắn, nên bộ ghi theo khung hình trong trang
      // lấy mẫu và phần kiểm tra chạy sau khi màn hình hoàn thành đã mở. Chỉ kiểm thứ tự trạng thái, không kiểm thời gian
      // (nhịp 1200 ms đã có test component với fake timers); 10 s chỉ để bắt trường hợp không bao giờ tự chuyển.
      await expect(page.getByRole("heading", { name: completionTitle("full") })).toBeVisible({ timeout: 10_000 });
      await expectAutoAdvance(page);
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
    // LF6 AC4: one Xem lại button and one explanation line replace the three per-stage buttons.
    await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeEnabled();
    await expect(page.getByText("Chọn một bước ở thanh tiến trình để xem lại.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Xem lại .+/ })).toHaveCount(0);
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
      `/learn/${MATRIX_COURSE_SLUG}/${MATRIX_TOPICS.vocabulary.slug}`,
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

    // LF6 AC4: Xem lại draws attention to the thread: focus on its first enabled button and a ring that shows, then goes.
    await page.getByRole("button", { name: "Xem lại", exact: true }).click();
    await expect(stepThread(page).getByRole("button").first()).toBeFocused();
    const ring = page.locator("[data-thread-highlight]");
    await expect(ring).toHaveCSS("opacity", "1", { timeout: 600 });
    await expect(ring).toHaveCSS("opacity", "0", { timeout: 2500 });
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
    // Owner Q14 (checked on the phone widths and at 320 px): the stage thread on one line, the Xem lại grid as wide as the
    // primary with 44px buttons, and the footer destinations with the capability-based treatment.
    const expectMobileLayout = async (view: Page, footer: "plain" | "outlined") => {
      const geometry = await view.evaluate(() => {
        const thread = document.querySelector("ol[aria-label='Các bước của bài học']") as HTMLElement;
        const items = Array.from(thread.children).map((item) => item.getBoundingClientRect());
        const primary = Array.from(document.querySelectorAll("button")).find((button) =>
          button.getAttribute("aria-label")?.startsWith("Có "),
        ) as HTMLElement;
        const review = Array.from(document.querySelectorAll("button")).find(
          (button) => button.textContent?.trim() === "Xem lại",
        ) as HTMLElement;
        const p = primary.getBoundingClientRect();
        const g = review.getBoundingClientRect();
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
          primaryLeft: p.left,
          primaryRight: p.right,
          reviewLeft: g.left,
          reviewRight: g.right,
          reviewHeight: g.height,
          threadButtons,
          viewportWidth: window.innerWidth,
          footerActions,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(new Set(geometry.threadCentres).size).toBe(1);
      expect(geometry.threadRight).toBeLessThanOrEqual(geometry.threadBoxRight + 0.5);
      // LF6 AC4: the single Xem lại button is as wide as the primary and a 44px target.
      expect(Math.abs(geometry.reviewLeft - geometry.primaryLeft)).toBeLessThan(1);
      expect(Math.abs(geometry.reviewRight - geometry.primaryRight)).toBeLessThan(1);
      expect(geometry.reviewHeight).toBeGreaterThanOrEqual(44);
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

    // LF6 AC4: under reduced motion Xem lại still moves focus to the thread but shows no ring.
    await page.getByRole("button", { name: "Xem lại", exact: true }).click();
    await expect(stepThread(page).getByRole("button").first()).toBeFocused();
    const ring = page.locator("[data-thread-highlight]");
    await expect(ring).toHaveCSS("opacity", "0");
    await page.waitForTimeout(400);
    await expect(ring).toHaveCSS("opacity", "0");
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
