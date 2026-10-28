import { expect, test, type Page } from "@playwright/test";
import {
  courseStructureFixture,
  findCourseStructureTopicByTitle,
  prepareCourseStructureFixture,
} from "../../scripts/e2e/course-structure-fixture.mjs";
import { loginAsTeacher } from "../support/auth";
import { watchBrowserConsole } from "../support/console";
import {
  createStructureTopic,
  fillActiveDialogTextbox,
  submitActiveDialog,
} from "../support/structure-ui";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
  getTopicBuilderPath,
} from "../../lib/course-authoring/routes";

// Test plan:
// - Mục tiêu: query, tab và chế độ sửa từ dashboard đồng bộ với UI khi đổi tab liên tiếp.
// - Case: chapter đã sửa, topic thiếu nội dung, Settings save/refresh, target hỏng và Back/Forward.
// - Dùng fixture teacher/course local thật; giữ assertion về URL/UI và console hydration.
// - Verify: xem State D6 trong progress.md; không dùng networkidle; chỉ giữ ERR_ABORTED đã biết của redirect.
// - TFEAT4: chạy lại trên CI vì topic builder chỉ ghi `?tab=` khi không còn server action chờ (ACTION-QUEUE-001).


test("dashboard issue links survive stale target redirects without hydration errors", async ({
  page,
}) => {
  const consoleGuard = watchBrowserConsole(page);

  const fixture = await prepareCourseStructureFixture();
  const courseId = fixture.E2E_COURSE_ID ?? courseStructureFixture.courseId;
  const chapterTitle = fixture.E2E_STRUCTURE_CHAPTER_TITLE;
  const topicTitle = fixture.E2E_STRUCTURE_TOPIC_ACTIVE_TITLE;

  await loginAsTeacher(page, fixture);

  await page.goto(getCourseStructurePath(courseId));
  await page.getByRole("button", { name: /Th.*m Ch/i }).click();
  await fillActiveDialogTextbox(page, chapterTitle);
  await submitActiveDialog(page, /T.*o ch/i);
  await expect(page.getByRole("heading", { level: 2, name: chapterTitle })).toBeVisible();

  await page.goto(getCourseOverviewPath(courseId));
  await page.getByRole("link", { name: "Thêm bài học", exact: true }).click();
  await expect(page).toHaveURL(/\/structure\?/);
  await expect(page.getByText("Chương chưa có bài học")).toBeVisible({ timeout: 30_000 });

  // Deep link chọn sẵn chương được đánh dấu trong workbench.
  await expect(page.getByRole("heading", { level: 2, name: chapterTitle })).toBeVisible();
  await createStructureTopic(page, chapterTitle, topicTitle);
  await expect(page.getByText("Chương chưa có bài học")).toHaveCount(0);
  await expect(page).not.toHaveURL(/from=dashboard/);
  await expect(page.getByText(/1 chương · 1 bài học/)).toBeVisible();

  const topic = await findCourseStructureTopicByTitle(topicTitle);
  const validIssueUrl =
    getTopicBuilderPath(courseId, topic.id) +
    `?from=dashboard&issue=topic_has_no_learning_content` +
    `&targetType=topic&target=${topic.id}&tab=exercises`;
  const malformedTargetUrl =
    getTopicBuilderPath(courseId, topic.id) +
    `?from=dashboard&issue=question_missing_content` +
    `&targetType=question&target=not-a-uuid&tab=exercises`;

  await page.goto(validIssueUrl);
  await expect(
    page.getByRole("status").filter({
      hasText: "Bài học chưa có nội dung học tập",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở thẻ từ vựng" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Mở bài tập TOEIC" }),
  ).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /^Bài tập/ })).toHaveAttribute(
    "data-state",
    "active",
  );

  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();
  await page.getByRole("button", { name: "Thoát chế độ sửa" }).click();
  await expect(page).not.toHaveURL(/from=dashboard/);
  await expect(page).not.toHaveURL(/issue=topic_has_no_learning_content/);
  await expect(
    page.getByText("Tab trong đường dẫn không còn hợp lệ"),
  ).toHaveCount(0);
  await expect(
    page.locator('[role="tab"][data-state="active"]').filter({ hasText: "Bài tập" }),
  ).toBeVisible();

  await page.goto(validIssueUrl);
  await page.getByRole("tab", { name: /^Từ vựng/ }).click();
  await expect(page).toHaveURL(/from=dashboard/);
  await expect(page).toHaveURL(/issue=topic_has_no_learning_content/);
  await expect(page).toHaveURL(/tab=flashcards/);
  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Từ vựng/ })).toHaveAttribute(
    "data-state",
    "active",
  );

  await page.getByRole("tab", { name: /^Bài tập/ }).click();
  await expect(page).toHaveURL(/from=dashboard/);
  await expect(page).toHaveURL(/issue=topic_has_no_learning_content/);
  await expect(page).toHaveURL(/tab=exercises/);
  await expect(page.getByText("Đang sửa vấn đề từ dashboard")).toBeVisible();

  await page.getByRole("tab", { name: /^Cài đặt/ }).click();
  await expect(page).not.toHaveURL(/from=dashboard/);
  await expect(page).not.toHaveURL(/issue=topic_has_no_learning_content/);
  await expect(page.getByText("Tab trong đường dẫn không còn hợp lệ")).toHaveCount(
    0,
  );
  await expect(page.getByRole("tab", { name: /^Cài đặt/ })).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(page).toHaveURL(/tab=settings/);
  const settingsUrl = page.url();

  // Request refresh phải dùng query hiện tại của router, không khôi phục deep link đã thoát.
  const refreshRequest = page.waitForRequest((request) =>
    request.method() === "GET" && request.headers()["rsc"] === "1" &&
    new URL(request.url()).pathname === new URL(settingsUrl).pathname,
  );
  await page.getByLabel("Tên bài học").fill(`${topicTitle} (đã đổi tên)`);
  await page.getByRole("button", { name: "Lưu cài đặt", exact: true }).click();
  const refreshUrl = new URL((await refreshRequest).url());
  expect(refreshUrl.searchParams.get("tab")).toBe("settings");
  expect(refreshUrl.searchParams.has("from")).toBe(false);
  expect(refreshUrl.searchParams.has("issue")).toBe(false);
  await expect(page).toHaveURL(settingsUrl);

  await page.goto(malformedTargetUrl);
  await expect(page).toHaveURL(new RegExp(getCourseStructurePath(courseId)));
  await expect(
    page.getByText(
      "Nội dung bạn muốn mở không còn khả dụng. Bạn đã được đưa về cấu trúc khóa học.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(page.getByText("Nội dung không còn khả dụng")).toHaveCount(0);
  await expect(page).not.toHaveURL(/issue_unavailable=1/);
  const structureUrl = page.url();

  await navigateHistory(page, "back");
  await expect(page).toHaveURL(settingsUrl);
  await expect(page.getByRole("tab", { name: /^Cài đặt/ })).toHaveAttribute("data-state", "active");
  await navigateHistory(page, "forward");
  await expect(page).toHaveURL(structureUrl);
  await expect(page.getByRole("button", { name: "Thêm chương", exact: true })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 2, name: chapterTitle })).toBeVisible();

  await consoleGuard.expectNoErrors();
});

async function navigateHistory(page: Page, direction: "back" | "forward") {
  try {
    if (direction === "back") {
      await page.goBack({ waitUntil: "domcontentloaded" });
    } else {
      await page.goForward({ waitUntil: "domcontentloaded" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("net::ERR_ABORTED")) throw error;
  }

}
