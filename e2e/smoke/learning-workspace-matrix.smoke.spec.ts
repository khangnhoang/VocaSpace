import { expect, test, type Page } from "@playwright/test";
import {
  MATRIX_COURSE_SLUG,
  MATRIX_TOPICS,
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";
import { createSupabaseAdmin } from "../../scripts/e2e/support/supabase-admin.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/d8-learning-ui/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật layout learning workspace D8-LUI (candidate) cho thẻ, Part 1-7, memory check và media lỗi.
// - Loại test: smoke E2E trên Supabase local cô lập; fixture tổng hợp tạo trong beforeAll và dọn trong afterAll.
// - Case thành công: thẻ lật và chuyển sang thẻ kế; Part 1 ảnh không bị cắt và phóng to được; sai thì giải thích tại chỗ, đúng thì chờ "Câu tiếp theo" (AC7 candidate); chuyển câu chỉ qua "Danh sách câu hỏi" (LF9 r7); audio giữ node cùng nhóm; memory check mở khóa bài tập.
// - Case thất bại: ảnh không tải được hiện thông báo cục bộ và vẫn làm được câu hỏi; nhóm thiếu audio hiện thông báo thay vì ô trống.
// - Bảo mật/phân quyền: fixture chỉ ghi vào runtime E2E cô lập (cổng 45441); học viên seed là người duy nhất được ghi danh.
// - Ổn định/resilience: không tràn ngang ở 320/375/768/1024/1366/1440px; reduced motion bỏ bản sao đang gấp của thẻ cũ.
// - Invariant cần giữ: kết quả chấm không tự chuyển câu; câu cùng nhóm không tạo lại player.
// - Chưa kiểm chứng: cảm nhận chuyển động, thời gian và mật độ đọc do Owner đánh giá trên UI chạy thật.
// - LF6 (AC6): lật thẻ của workspace 400 ms khi bình thường và không chuyển động khi reduced motion (computed style).
// - LF4: các test thẻ từ vựng xóa dòng chấm của học viên trước khi chạy vì hàng đợi chỉ gồm thẻ chưa xem.
// - Kết quả verify gần nhất: passed (10/10) ngày 2026-10-18 sau khi sửa case memory check theo LF9 (đạt thì tự mở bài tập) và cho helper mở danh sách câu hỏi chờ hydrate (chạy `npm run test:e2e -- e2e/smoke/learning-workspace-matrix.smoke.spec.ts`).

const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const WIDTHS = [320, 375, 768, 1024, 1366, 1440];

test.beforeAll(async () => {
  // Many synthetic rows and storage uploads are written once for the whole file.
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

const topicPath = (key: keyof typeof MATRIX_TOPICS) =>
  `/learn/${MATRIX_COURSE_SLUG}/${MATRIX_TOPICS[key].slug}`;

// LF9 r7: the question list is the only way between questions, so moving on picks the row after the current one.
const nextQuestion = async (page: Page) => {
  const rows = page.getByRole("button", { name: /^Câu \d+: / });
  // A click that lands before hydration opens nothing, so retry until the list is open.
  await expect(async () => {
    if ((await page.getByRole("dialog").count()) === 0) {
      await page.getByRole("button", { name: "Danh sách câu hỏi" }).click();
    }
    await expect(rows.first()).toBeVisible({ timeout: 1_000 });
  }).toPass();
  const current = await rows.evaluateAll((all) => all.findIndex((row) => row.getAttribute("aria-current") === "true"));
  await rows.nth(current + 1).click();
  // The closing list still repeats exercise titles, so wait until it is gone.
  await expect(rows).toHaveCount(0);
};

// LF4: workspace chỉ xếp thẻ chưa xem, nên test thẻ từ vựng xóa dòng chấm của học viên để luôn bắt đầu từ hàng đợi đầy đủ.
async function forgetVocabularyCardProgress() {
  const admin = createSupabaseAdmin(process.env);
  const topic = await admin.from("topics").select("id").eq("slug", MATRIX_TOPICS.vocabulary.slug).single();
  if (topic.error) throw new Error(topic.error.message);
  const cards = await admin.from("cards").select("id").eq("topic_id", topic.data.id);
  if (cards.error) throw new Error(cards.error.message);
  const removed = await admin
    .from("user_flashcards")
    .delete()
    .eq("user_id", STUDENT_ID)
    .in("card_id", cards.data.map((card) => card.id));
  if (removed.error) throw new Error(removed.error.message);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
}

test("vocabulary card turns in place and continues to the next front", async ({ page }) => {
  await forgetVocabularyCardProgress();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(topicPath("vocabulary"));
  await expect(page.getByRole("heading", { level: 1, name: MATRIX_TOPICS.vocabulary.title })).toBeVisible();
  await expect(page.getByText("reliable", { exact: true })).toBeVisible();

  const reveal = page.getByRole("button", { name: "Hiện đáp án" });
  const before = await reveal.boundingBox();
  await reveal.click();
  await expect(page.getByText(/^Nghĩa:\s*đáng tin cậy$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Lại" })).toBeFocused();
  // LF6 AC6 (Owner Q3): the flip lasts 400 ms.
  expect(await page.locator("[data-flashcard-box]").evaluate((box) => getComputedStyle(box).transitionDuration)).toBe("0.4s");

  await page.getByRole("button", { name: "Ổn" }).click();
  await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
  await expect(page.getByText("incomprehensibilities", { exact: true })).toBeVisible();
  const after = await page.getByRole("button", { name: "Hiện đáp án" }).boundingBox();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(160);

  // A long back keeps every rating reachable without clipping.
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
  for (const label of ["Lại", "Khó", "Ổn", "Dễ"]) {
    const box = await page.getByRole("button", { name: label }).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(40);
  }
  await expectNoHorizontalOverflow(page);
});

test("reduced motion shows the next front without turning the card", async ({ page }) => {
  await forgetVocabularyCardProgress();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(topicPath("vocabulary"));
  // LF6 AC6: reduced motion removes the flip, checked separately from the 400 ms case above.
  await expect(page.locator("[data-flashcard-box]")).toBeVisible();
  expect(
    await page.locator("[data-flashcard-box]").evaluate((box) => {
      const style = getComputedStyle(box);
      return { property: style.transitionProperty, transform: style.transform };
    }),
  ).toEqual({ property: "none", transform: "none" });
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
  await page.getByRole("button", { name: "Ổn" }).click();
  await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
  await expect(page.getByText("incomprehensibilities", { exact: true })).toBeVisible();
});

test("card box keeps one height for long and short cards", async ({ page }) => {
  await forgetVocabularyCardProgress();
  for (const [width, height] of [[320, 700], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(topicPath("vocabulary"));
    const box = page.locator("[data-flashcard-box]");
    // Layout height, not the painted box: a card that is mid-turn is perspective-projected,
    // so its bounding box changes size without the layout moving at all.
    const layoutHeight = () => box.evaluate((element) => (element as HTMLElement).offsetHeight);
    // Vị trí theo trang, không theo khung nhìn: `goto` lại cùng URL khôi phục vị trí cuộn rồi có thể bị đặt lại về đầu trang
    // giữa hai lần đo, nên `boundingBox()` lệch theo độ cuộn dù bố cục không đổi.
    const pageTop = (name: string) =>
      page.getByRole("button", { name }).evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    // Trên bản production, ngay sau `goto` khung thẻ có thể chưa hiển thị (offsetHeight 0); chỉ đo khi thẻ đã hiện.
    await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
    const longFront = await layoutHeight();
    await page.getByRole("button", { name: "Hiện đáp án" }).click();
    const longBack = await layoutHeight();
    const rating = await pageTop("Lại");
    await page.getByRole("button", { name: "Ổn" }).click();
    await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
    const next = await layoutHeight();
    expect(longBack).toBe(longFront);
    expect(next).toBe(longFront);
    const revealAgain = await pageTop("Hiện đáp án");
    expect(Math.abs(revealAgain - rating)).toBeLessThan(2);
    await expectNoHorizontalOverflow(page);
  }
});

test("Part 1 keeps the picture uncropped, explains inline and waits for Câu tiếp theo", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(topicPath("listening"));
  await expect(page.getByText("Part 1 - Mô tả tranh")).toBeVisible();

  const image = page.getByAltText("Hình ảnh của nhóm câu hỏi");
  await expect(image).toBeVisible();
  const metrics = await image.evaluate((element) => {
    const img = element as HTMLImageElement;
    return {
      naturalRatio: img.naturalWidth / img.naturalHeight,
      renderedRatio: img.clientWidth / img.clientHeight,
      fit: getComputedStyle(img).objectFit,
    };
  });
  expect(metrics.fit).toBe("contain");
  expect(Math.abs(metrics.naturalRatio - metrics.renderedRatio)).toBeLessThan(0.02);

  const enlarge = page.getByRole("button", { name: "Phóng to hình ảnh" });
  await enlarge.click();
  await expect(page.getByRole("dialog", { name: "Hình ảnh của nhóm câu hỏi" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(enlarge).toBeFocused();

  // Wrong answer: explanation stays inline, no dialog, then retry.
  await page.getByRole("radio", { name: /closing a door/ }).click();
  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
  await expect(page.getByText("Chưa chính xác")).toBeVisible();
  await expect(page.getByText(/Giải thích: đáp án A/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Thử lại" }).click();

  // Correct answer: the result stays until the learner chooses to continue.
  await page.getByRole("radio", { name: /holding a document/ }).click();
  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
  await expect(page.getByRole("radio", { name: /bạn chọn đúng/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("radio", { name: /bạn chọn đúng/ })).toBeVisible();
  await expect(page.getByText("Part 1 - Mô tả tranh")).toBeVisible();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByText("Part 2 - Hỏi đáp")).toBeVisible();
});

test("Part 3 keeps the same audio player across questions of one group", async ({ page }) => {
  await page.goto(topicPath("listening"));
  // Part 1 and Part 2 each have one question; skip with the next-question button.
  await nextQuestion(page);
  await nextQuestion(page);
  await expect(page.getByText("Part 3 - Hội thoại")).toBeVisible();

  const audio = page.getByLabel("Âm thanh của nhóm câu hỏi");
  await audio.evaluate((element) => element.setAttribute("data-mark", "same-player"));
  await nextQuestion(page);
  await expect(page.getByText(/Câu 2 về cuộc hội thoại/)).toBeVisible();
  await expect(page.locator('audio[data-mark="same-player"]')).toHaveCount(1);
});

test("question navigator jumps across parts and keeps the player inside one group", async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(topicPath("listening"));
    await expect(page.getByText("Part 1 - Mô tả tranh")).toBeVisible();

    // Wide screens open a popover and narrow ones a sheet; both are one dialog with the same list.
    await page.getByRole("button", { name: "Danh sách câu hỏi" }).click();
    const list = page.getByRole("dialog");
    await expect(list).toBeVisible();
    await expect(list.getByRole("heading", { name: "Part 3 - Hội thoại" })).toBeVisible();
    await expect(list.getByRole("button", { name: /^Câu 1:.*Đang xem/ })).toHaveAttribute("aria-current", "true");
    await list.getByRole("button", { name: /^Câu 3:/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Part 3 - Hội thoại")).toBeVisible();
    await expect(page.locator("main h2:focus")).toBeVisible();

    const audio = page.getByLabel("Âm thanh của nhóm câu hỏi");
    await audio.evaluate((element) => element.setAttribute("data-mark", "same-player"));
    await page.getByRole("button", { name: "Danh sách câu hỏi" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Câu 4:/ }).click();
    await expect(page.locator('audio[data-mark="same-player"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  }
});

test("a long Part 7 passage keeps the question reachable: pinned beside it when wide, a jump when stacked", async ({ page }) => {
  const toPart7 = async () => {
    await page.goto(topicPath("reading"));
    for (let i = 0; i < 4; i += 1) {
      await nextQuestion(page);
    }
    await expect(page.getByText("Part 7 - Đọc hiểu")).toBeVisible();
  };
  const heading = page.locator("main h2[data-question-heading]");

  await page.setViewportSize({ width: 1440, height: 900 });
  await toPart7();
  await expect(heading.locator("xpath=ancestor::*[@data-sticky][1]")).toHaveAttribute("data-sticky", "true");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(heading).toBeInViewport();
  // Pinned near the top of the viewport while the long passage scrolls past, not left behind it.
  expect((await heading.boundingBox())?.y ?? Infinity).toBeLessThan(200);

  // LF9 r7: no back or skip actions; the question list and its caption stay visible at every width.
  for (const width of [768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await toPart7();
    await expect(page.getByRole("button", { name: /^Câu (trước|sau)$/ })).toHaveCount(0);
    await expect(page.getByText("Chuyển nhanh giữa các câu")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.getByRole("button", { name: "Tới câu hỏi" }).click();
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
});

test("every content mode fits without page-wide horizontal scrolling", async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });

    await page.goto(topicPath("listening"));
    await expect(page.getByText("Part 1 - Mô tả tranh")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // Part 1 (1 question) + Part 2 (1) + Part 3 (3) precede Part 4.
    for (let i = 0; i < 5; i += 1) {
      await nextQuestion(page);
    }
    await expect(page.getByText("Part 4 - Bài nói")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(topicPath("reading"));
    await expect(page.getByText("Part 5 - Điền từ vào câu")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    for (let i = 0; i < 4; i += 1) {
      await nextQuestion(page);
    }
    await expect(page.getByText("Part 7 - Đọc hiểu")).toBeVisible();
    await expect(page.getByText(/Đoạn 14\./)).toBeAttached();
    await expectNoHorizontalOverflow(page);
  }
});

test("memory check keeps exercises locked until the server confirms the pass", async ({ page }) => {
  await page.goto(topicPath("memory"));
  const thread = page.getByRole("list", { name: "Các bước của bài học" });
  await expect(thread).toContainText("Bài tập (đang khóa)");

  await page.getByRole("radio", { name: /đáng tin cậy/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByRole("radio", { name: /bạn chọn đúng/ })).toBeVisible();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();

  await page.getByRole("radio", { name: /enhance/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  // LF9: khi server xác nhận đạt, workspace tự mở bài tập; không còn nút trung gian.

  await expect(page.getByText("Part 5 sau memory check")).toBeVisible();
  await expect(page.getByRole("button", { name: "Về Memory check" })).toBeVisible();
});

test("failed or missing media is named locally and the question stays answerable", async ({ page }) => {
  await page.goto(topicPath("faults"));
  await expect(page.getByText("Không tải được hình ảnh.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải lại hình ảnh" })).toBeVisible();
  await expect(page.getByLabel("Âm thanh của nhóm câu hỏi")).toBeVisible();
  await page.getByRole("radio", { name: /Đáp án đúng/ }).click();
  await expect(page.getByRole("button", { name: "Xác nhận đáp án" })).toBeEnabled();

  await nextQuestion(page);
  await expect(page.getByText(/đang thiếu âm thanh/)).toBeVisible();
});
