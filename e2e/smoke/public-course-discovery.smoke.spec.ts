import { expect, test, type Page } from "@playwright/test";

// Test plan:
// - Mục tiêu: bảo vệ public discovery, B3 legacy redirect và nested learner route.
// - Loại test: smoke E2E trên isolated local Supabase đã reset và seed bởi runner.
// - Ổn định: chờ course link đầu tiên hiển thị trước khi đọc số lượng Suspense grid.
// - Invariant: exact legacy page redirect canonical; nested learner URL vẫn chọn đúng topic.
// - Kết quả verify gần nhất: 2/2 scenario passed bằng focused CP2 Playwright command.

test("guest discovers canonical public detail through the legacy redirect", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);

  const highlightedLinks = page.locator(
    'a[aria-label^="Xem chi tiết khóa học "][href^="/courses/"]',
  );
  await expect(highlightedLinks.first()).toBeVisible();
  const highlightedCount = await highlightedLinks.count();
  expect(highlightedCount).toBeLessThanOrEqual(4);

  const selectedLink = highlightedLinks.first();
  const selectedTitle = (await selectedLink.getAttribute("aria-label"))?.replace(
    "Xem chi tiết khóa học ",
    "",
  );
  const canonicalPath = await selectedLink.getAttribute("href");
  expect(selectedTitle).toBeTruthy();
  expect(canonicalPath).toMatch(/^\/courses\/[a-z0-9]+(?:-[a-z0-9]+)*$/);

  await page.goto(canonicalPath!);
  await expect(page).toHaveURL(new RegExp(`${canonicalPath}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(selectedTitle!);
  await expect(
    page.getByRole("heading", { name: "Đề cương khóa học" }),
  ).toBeVisible();
  await expect(page.getByText("Xem trước tạm thời")).toBeVisible();
  await expect(page.locator(`a[href^="/learn/"][href*="/"]`)).toHaveCount(0);

  await page.goto("/courses");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Khám phá khóa học phù hợp với bạn",
    }),
  ).toBeVisible();
  await expect(page.locator(`a[href="${canonicalPath}"]`).first()).toBeVisible();

  await page.goto("/courses/course-slug-that-does-not-exist");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("404");

  const slug = canonicalPath!.slice("/courses/".length);
  const legacyPath = `/learn/${slug}`;
  await page.goto(legacyPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(selectedTitle!);
  await expectPathname(page, canonicalPath!);
  await expect(
    page.getByRole("heading", { name: "Đề cương khóa học" }),
  ).toBeVisible();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Mở điều hướng tài khoản" }).click();
  await expect(
    page.getByRole("heading", { name: "Điều hướng tài khoản" }),
  ).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
});

test("student legacy detail redirects while the nested workspace route remains exact", async ({
  page,
}) => {
  await loginAsSeededStudent(page);

  await page.goto("/learn/b2-qa-in-progress");
  await expect(
    page.getByRole("heading", { level: 1, name: "B2 QA - Lộ trình đang học" }),
  ).toBeVisible();
  await expectPathname(page, "/courses/b2-qa-in-progress");

  const nestedPath = "/learn/b2-qa-in-progress/b2-qa-progress-topic-2";
  await page.goto(nestedPath);

  const requestedTopic = page.getByRole("button", {
    name: "Topic 2 - Bước tiếp theo",
  });
  await expect(requestedTopic).toBeVisible();
  await expect(requestedTopic).toHaveClass(/bg-emerald-50/);
  await expectPathname(page, nestedPath);
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
    .poll(() => page.evaluate(() => window.location.pathname))
    .toBe(expectedPath);
}
