import { expect, test, type Page, type Request } from "@playwright/test";

// Test plan:
// - Mục tiêu: bảo vệ direct/refresh/sidebar/previous-next/back-forward và inaccessible states của C2 workspace.
// - Loại test: smoke E2E trên isolated local Supabase được runner reset/seed.
// - Đối tượng: authenticated nested workspace route, canonical navigation và route-local feedback.
// - Case thành công: exact URL/topic/content, history restore, parent action và mobile layout.
// - Case thất bại: guest, wrong-course, draft, removed, nonexistent, invalid topic và unenrolled.
// - Bảo mật/phân quyền: unavailable/unenrolled không render protected syllabus/card content.
// - Ổn định/resilience: assert pathname thay timing, collect post-login Server Action requests và kiểm tra no overflow 375px.
// - Invariant cần giữ: mỗi topic change là canonical RSC navigation; không legacy client content/history action waterfall.
// - Hồi quy dashboard: bố cục desktop/mobile đúng trước khi bundle JavaScript được tải, không đổi cột sau hydration.
// - D8-LUI: danh sách chương mở theo yêu cầu (Sheet) thay cho sidebar luôn hiện; helper mở và đóng nó để kiểm tra topic hiện tại.
// - Kết quả verify gần nhất: xem báo cáo checkpoint D8-LUI CP2 (chạy qua `npm run test:e2e`).

test("guest is sent to login before protected workspace content", async ({
  page,
}) => {
  await page.goto(
    "/learn/b2-qa-in-progress/b2-qa-progress-topic-2",
  );

  await expectPathname(page, "/login");
  await expect(page.getByText("progress", { exact: true })).toHaveCount(0);
});

test("student navigation keeps URL, topic state, and browser history aligned", async ({
  page,
}) => {
  await loginAsSeededStudent(page);
  const actionRequests: Request[] = [];
  page.on("request", (request) => {
    if (request.headers()["next-action"]) actionRequests.push(request);
  });

  await page.setViewportSize({ width: 375, height: 812 });
  const topicTwoPath =
    "/learn/b2-qa-in-progress/b2-qa-progress-topic-2";
  const topicThreePath =
    "/learn/b2-qa-in-progress/b2-qa-progress-topic-3";

  await page.goto(topicTwoPath);
  await expectWorkspaceTopic(page, {
    path: topicTwoPath,
    title: "Topic 2 - Bước tiếp theo",
    cardWord: "progress",
  });
  const parentLink = page.getByRole("link", {
    name: "Về tổng quan khóa học B2 QA - Lộ trình đang học",
  });
  await expect(parentLink).toHaveAttribute("href", "/learn/b2-qa-in-progress");
  await parentLink.focus();
  await expect(parentLink).toBeFocused();
  await expectNoHorizontalOverflow(page);

  // The course outline opens on demand instead of sitting beside the task.
  await page.getByRole("button", { name: "Mở danh sách chương và bài học" }).click();
  await page
    .getByRole("button", { name: "Chặng 3 - Tiếp tục sau chapter trống" })
    .click();
  await page.getByRole("link", { name: "Topic 3 - Sau khoảng trống" }).click();
  await expectWorkspaceTopic(page, {
    path: topicThreePath,
    title: "Topic 3 - Sau khoảng trống",
    cardWord: "future",
  });
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expectWorkspaceTopic(page, {
    path: topicThreePath,
    title: "Topic 3 - Sau khoảng trống",
    cardWord: "future",
  });

  await page.goBack();
  await expectWorkspaceTopic(page, {
    path: topicTwoPath,
    title: "Topic 2 - Bước tiếp theo",
    cardWord: "progress",
  });

  await page.goForward();
  await expectWorkspaceTopic(page, {
    path: topicThreePath,
    title: "Topic 3 - Sau khoảng trống",
    cardWord: "future",
  });

  await page.getByRole("link", { name: "Bài trước" }).click();
  await expectWorkspaceTopic(page, {
    path: topicTwoPath,
    title: "Topic 2 - Bước tiếp theo",
    cardWord: "progress",
  });

  expect(actionRequests).toHaveLength(0);
});

test("student gets privacy-safe unavailable and unenrolled recovery states", async ({
  page,
}) => {
  await loginAsSeededStudent(page);

  for (const path of [
    "/learn/b2-qa-in-progress/b2-qa-completed-final-topic",
    "/learn/b2-qa-no-content/b2-qa-no-content-draft-topic",
    "/learn/b2-qa-no-content/b2-qa-no-content-removed-topic",
    "/learn/b2-qa-in-progress/topic-that-does-not-exist",
    "/learn/b2-qa-in-progress/UPPERCASE",
  ]) {
    await page.goto(path);
    await expectPathname(page, path);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Bài học này không khả dụng",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Về tổng quan khóa học" }),
    ).toHaveAttribute("href", /^\/learn\//);
    await expect(page.getByText("progress", { exact: true })).toHaveCount(0);
    await expect(page.getByText("deterministic", { exact: true })).toHaveCount(
      0,
    );
  }

  const unenrolledPath =
    "/learn/local-toeic-test-course/local-test-topic";
  await page.goto(unenrolledPath);
  await expectPathname(page, unenrolledPath);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tài khoản này chưa đăng ký khóa học",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Xem thông tin khóa học" }),
  ).toHaveAttribute("href", "/courses/local-toeic-test-course");
  await expect(page.getByText("Local Test Topic")).toHaveCount(0);
});

test("student dashboard keeps its responsive columns before hydration", async ({
  page,
}) => {
  await loginAsSeededStudent(page);

  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route("**/_next/**/*.js*", async (route) => {
      await scriptsReady;
      await route.continue();
    });

    try {
      await page.goto("/learn", { waitUntil: "commit" });
      const course = page.locator(
        'section[aria-labelledby="continuing-courses-title"]',
      );
      const review = page.locator(
        'section[aria-labelledby="review-summary-title"]',
      );
      const remaining = page.locator(
        'section[aria-labelledby="remaining-courses-title"]',
      );
      await expect(course).toBeVisible();
      await expect(review).toBeAttached();
      await expect(remaining).toBeAttached();
      const before = {
        scrollY: await page.evaluate(() => window.scrollY),
        course: (await course.boundingBox())!,
        review: (await review.boundingBox())!,
        remaining: (await remaining.boundingBox())!,
      };

      if (width >= 1024) {
        expect(before.review.x).toBeGreaterThan(before.course.x + before.course.width);
        expect(before.review.y).toBeCloseTo(before.course.y, 0);
        expect(before.remaining.y).toBeLessThanOrEqual(before.course.y + before.course.height + 64);
      } else {
        expect(before.review.y).toBeGreaterThanOrEqual(before.course.y + before.course.height);
        expect(before.remaining.y).toBeGreaterThan(before.review.y + before.review.height);
        expect(before.review.width).toBeCloseTo(before.course.width, 0);
      }
      await expectNoHorizontalOverflow(page);

      releaseScripts();
      await page.waitForLoadState("load");
      await page.unrouteAll({ behavior: "wait" });
      await page.getByRole("button", { name: /Tất cả ·/ }).click();
      const after = {
        scrollY: await page.evaluate(() => window.scrollY),
        course: (await course.boundingBox())!,
        review: (await review.boundingBox())!,
      };
      expect(after.course.width).toBeCloseTo(before.course.width, 0);
      expect(after.review.x).toBeCloseTo(before.review.x, 0);
      expect(after.review.y + after.scrollY).toBeCloseTo(before.review.y + before.scrollY, 0);
      await expectNoHorizontalOverflow(page);
    } finally {
      releaseScripts();
      await page.unrouteAll({ behavior: "wait" });
    }
  }
});

async function loginAsSeededStudent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("student@gmail.com");
  await page.getByLabel("Password").fill("123123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectWorkspaceTopic(
  page: Page,
  expected: { path: string; title: string; cardWord: string },
) {
  await expectPathname(page, expected.path);
  await expect(
    page.getByRole("heading", { level: 1, name: expected.title }),
  ).toBeVisible();
  await expect(page.getByText(expected.cardWord, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mở danh sách chương và bài học" }).click();
  await expect(
    page.getByRole("link", { name: expected.title }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function expectPathname(page: Page, expectedPath: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(expectedPath);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
