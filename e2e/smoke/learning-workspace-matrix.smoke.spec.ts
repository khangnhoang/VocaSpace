import { expect, test, type Page } from "@playwright/test";
import {
  MATRIX_COURSE_SLUG,
  MATRIX_TOPICS,
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "../../scripts/e2e/learning-workspace-matrix-fixture.mjs";

// spec: docs/programs/student-user-flow-route/implementation-plans/d8-learning-ui/plan.md
// Test plan:
// - Mục tiêu: kiểm chứng trên trình duyệt thật layout learning workspace D8-LUI (candidate) cho thẻ, Part 1-7, memory check và media lỗi.
// - Loại test: smoke E2E trên Supabase local cô lập; fixture tổng hợp tạo trong beforeAll và dọn trong afterAll.
// - Case thành công: thẻ lật và chuyển sang thẻ kế; Part 1 ảnh không bị cắt và phóng to được; sai thì giải thích tại chỗ, đúng thì chờ "Câu tiếp theo" (AC7 candidate); audio giữ node cùng nhóm; memory check mở khóa bài tập.
// - Case thất bại: ảnh không tải được hiện thông báo cục bộ và vẫn làm được câu hỏi; nhóm thiếu audio hiện thông báo thay vì ô trống.
// - Bảo mật/phân quyền: fixture chỉ ghi vào runtime E2E cô lập (cổng 45441); học viên seed là người duy nhất được ghi danh.
// - Ổn định/resilience: không tràn ngang ở 320/375/768/1024/1366/1440px; reduced motion bỏ bản sao đang gấp của thẻ cũ.
// - Invariant cần giữ: kết quả chấm không tự chuyển câu; câu cùng nhóm không tạo lại player.
// - Chưa kiểm chứng: cảm nhận chuyển động, thời gian và mật độ đọc do Owner đánh giá trên UI chạy thật.
// - Kết quả verify gần nhất: xem báo cáo checkpoint D8-LUI CP2/CP4 (chạy `npm run test:e2e -- e2e/smoke/learning-workspace-matrix.smoke.spec.ts`).

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
  await page.getByLabel("Password").fill("123123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
});

const topicPath = (key: keyof typeof MATRIX_TOPICS) =>
  `/learn/${MATRIX_COURSE_SLUG}/${MATRIX_TOPICS[key].slug}`;

// Saved correct answers survive a reload, so a question may offer "Câu tiếp theo" instead of "Câu sau".
const nextQuestion = (page: Page) =>
  page.getByRole("button", { name: /^(Câu sau|Câu tiếp theo)$/ }).click();

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
}

test("vocabulary card turns in place and continues to the next front", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(topicPath("vocabulary"));
  await expect(page.getByRole("heading", { level: 1, name: MATRIX_TOPICS.vocabulary.title })).toBeVisible();
  await expect(page.getByText("reliable", { exact: true })).toBeVisible();

  const reveal = page.getByRole("button", { name: "Hiện đáp án" });
  const before = await reveal.boundingBox();
  await reveal.click();
  await expect(page.getByText("đáng tin cậy", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lại" })).toBeFocused();

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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(topicPath("vocabulary"));
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
  await page.getByRole("button", { name: "Ổn" }).click();
  await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
  await expect(page.getByText("incomprehensibilities", { exact: true })).toBeVisible();
});

test("card box keeps one height for long and short cards", async ({ page }) => {
  for (const [width, height] of [[320, 700], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(topicPath("vocabulary"));
    const box = page.locator("[data-flashcard-box]");
    const longFront = await box.boundingBox();
    await page.getByRole("button", { name: "Hiện đáp án" }).click();
    const longBack = await box.boundingBox();
    const rating = await page.getByRole("button", { name: "Lại" }).boundingBox();
    await page.getByRole("button", { name: "Ổn" }).click();
    await expect(page.getByRole("button", { name: "Hiện đáp án" })).toBeVisible();
    const next = await box.boundingBox();
    expect(longBack?.height).toBe(longFront?.height);
    expect(next?.height).toBe(longFront?.height);
    const revealAgain = await page.getByRole("button", { name: "Hiện đáp án" }).boundingBox();
    expect(Math.abs((revealAgain?.y ?? 0) - (rating?.y ?? 0))).toBeLessThan(2);
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
    await page.getByRole("button", { name: "Xem lại câu hỏi" }).click();
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
    await page.getByRole("button", { name: "Xem lại câu hỏi" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Câu 4:/ }).click();
    await expect(page.locator('audio[data-mark="same-player"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  }
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
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await page.getByRole("radio", { name: /enhance/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Mở bài tập" }).click();

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
