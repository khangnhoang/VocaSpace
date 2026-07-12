import { expect, test } from "@playwright/test";

// Test plan:
// - Mục tiêu: bảo vệ guest discovery qua homepage, catalog, canonical detail và legacy detail.
// - Loại test: smoke E2E trên isolated local Supabase đã reset và seed bởi runner.
// - Ổn định: chờ course link đầu tiên hiển thị trước khi đọc số lượng Suspense grid.
// - Invariant: canonical detail không mở workspace content và legacy detail chưa redirect.

test("guest discovers canonical and legacy public course detail", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Mở điều hướng tài khoản" }).click();
  await expect(
    page.getByRole("heading", { name: "Điều hướng tài khoản" }),
  ).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 720 });

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

  await selectedLink.click();
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
  await expect(page).toHaveURL(new RegExp(`${legacyPath}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(selectedTitle!);
  await expect(
    page.getByRole("heading", { name: "Đề cương khóa học" }),
  ).toBeVisible();
});
