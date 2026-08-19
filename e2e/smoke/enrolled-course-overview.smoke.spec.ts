import { expect, test, type Page } from "@playwright/test";

// Test plan:
// - Mục tiêu: bảo vệ dashboard entry cùng C1 overview/access states bằng dữ liệu seed deterministic và exact route.
// - Loại test: smoke E2E trên isolated local Supabase đã reset và seed bởi runner.
// - Ổn định: đăng nhập qua UI, dùng role/href ổn định và kiểm tra pathname thay vì timing redirect.
// - Invariant: dashboard giữ fast-path topic CTA; unenrolled không lộ protected content; nested workspace do C2 smoke sở hữu.
// - Kết quả verify gần nhất: 3/3 scenario passed bằng focused post-QA Playwright command.

test("guest is sent to login without rendering the course overview", async ({
  page,
}) => {
  await page.goto("/learn/b2-qa-in-progress");

  await expectPathname(page, "/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "B2 QA - Lộ trình đang học" }),
  ).toHaveCount(0);
});

test("student sees in-progress, completed, no-content, and nested route states", async ({
  page,
}) => {
  await loginAsSeededStudent(page);
  await page.setViewportSize({ width: 375, height: 812 });

  const inProgressPath = "/learn/b2-qa-in-progress";
  const nextTopicPath =
    "/learn/b2-qa-in-progress/b2-qa-progress-topic-2";

  await page.goto("/learn");
  const inProgressCard = page.locator("article").filter({
    has: page.getByRole("heading", {
      level: 3,
      name: "B2 QA - Lộ trình đang học",
    }),
  });
  await expect(
    inProgressCard.getByRole("link", { name: "Tiếp tục học" }),
  ).toHaveAttribute("href", nextTopicPath);
  const overviewLink = inProgressCard.getByRole("link", {
    name: "Xem tổng quan",
  });
  await expect(overviewLink).toHaveAttribute("href", inProgressPath);
  await expectNoHorizontalOverflow(page);

  await overviewLink.click();
  await expectPathname(page, inProgressPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "B2 QA - Lộ trình đang học" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", {
      name: "Tiến độ khóa học B2 QA - Lộ trình đang học",
    }),
  ).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByText("2/4 chủ đề đã hoàn thành")).toBeVisible();

  const continueLink = page.getByRole("link", { name: "Tiếp tục học" });
  await expect(continueLink).toHaveAttribute("href", nextTopicPath);
  await expectNoHorizontalOverflow(page);

  await continueLink.click();
  await expectPathname(page, nextTopicPath);

  const completedPath = "/learn/b2-qa-completed";
  await page.goto(completedPath);
  await expectPathname(page, completedPath);
  await expect(
    page.getByRole("progressbar", {
      name: "Tiến độ khóa học B2 QA - Lộ trình đã hoàn thành",
    }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByText("3/3 chủ đề đã hoàn thành")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Xem lại bài học cuối" }),
  ).toHaveAttribute(
    "href",
    "/learn/b2-qa-completed/b2-qa-completed-final-topic",
  );

  const noContentPath = "/learn/b2-qa-no-content";
  await page.goto(noContentPath);
  await expectPathname(page, noContentPath);
  await expect(
    page.getByRole("heading", {
      name: "Khóa học chưa có nội dung để bắt đầu",
    }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator('a[href^="/learn/b2-qa-no-content/"]')).toHaveCount(
    0,
  );
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/learn");
  await expect(
    inProgressCard.getByRole("link", { name: "Tiếp tục học" }),
  ).toBeVisible();
  await expect(
    inProgressCard.getByRole("link", { name: "Xem tổng quan" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(inProgressPath);
  await expect(
    page.getByRole("heading", { name: "Các chủ đề trong khóa học" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Tiếp tục học" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("student sees an access state without protected content and safe not-found routes", async ({
  page,
}) => {
  await loginAsSeededStudent(page);

  const unenrolledPath = "/learn/local-toeic-test-course";
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
  await expect(
    page.getByRole("link", { name: "Về không gian học tập" }),
  ).toHaveAttribute("href", "/learn");
  await expect(page.getByText("Local Test Topic")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  for (const notFoundPath of [
    "/learn/UPPERCASE",
    "/learn/course-slug-that-does-not-exist",
  ]) {
    await page.goto(notFoundPath);
    await expectPathname(page, notFoundPath);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("404");
    await expect(
      page.getByText("Tài khoản này chưa đăng ký khóa học"),
    ).toHaveCount(0);
    await expect(page.getByText("Chưa thể tải tổng quan khóa học")).toHaveCount(
      0,
    );
  }
});

async function loginAsSeededStudent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("student@gmail.com");
  await page.getByLabel("Password").fill("123123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectPathname(page: Page, expectedPath: string) {
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(expectedPath);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
