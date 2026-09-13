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
// - Kết quả verify gần nhất: 3/3 scenarios passed trên isolated seeded CP4 runner.

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
  await expect(
    page.getByRole("link", { name: expected.title }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(expected.cardWord, { exact: true })).toBeVisible();
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
