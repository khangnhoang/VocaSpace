import { expect, test } from "@playwright/test";
import {
  findCreatedTopicByTitle,
  prepareTopicCreateNavigationFixture,
  topicCreateNavigationFixture,
} from "../../scripts/e2e/topic-create-navigation-fixture.mjs";
import { loginAsTeacher } from "../support/auth";
import {
  getCourseStructurePath,
  getTopicBuilderPath,
} from "../../lib/course-authoring/routes";

// Test plan:
// - Mục tiêu: chứng minh create topic mở đúng Builder target từ authoritative returned id.
// - Loại test: bounded Playwright smoke trên isolated local Supabase.
// - Cardinality: chapter có 0, 1 và nhiều draft topic hiện hữu.
// - Case thành công: sau create, URL là Builder path của đúng topic vừa persist.
// - Bảo mật/phân quyền: browser đăng nhập bằng owner membership; fixture service-role chỉ chuẩn bị dữ liệu.
// - Ổn định/resilience: không chọn target từ danh sách draft hoặc thứ tự refresh.
// - Invariant cần giữ: create result id là target duy nhất của navigation.

test("creates a topic into the exact Builder target with zero, one, or multiple existing drafts", async ({
  browser,
}) => {
  const fixture = await prepareTopicCreateNavigationFixture();
  const courseId = fixture.E2E_COURSE_ID ?? topicCreateNavigationFixture.courseId;
  const baseURL =
    process.env.E2E_BASE_URL ??
    `http://${process.env.E2E_HOST ?? "127.0.0.1"}:${process.env.E2E_PORT ?? "3100"}`;

  for (const chapter of fixture.chapters) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      await loginAsTeacher(page, fixture);
      await page.goto(getCourseStructurePath(courseId));

      const chapterArticle = page.locator("article").filter({ hasText: chapter.title });
      await expect(chapterArticle).toBeVisible();
      await chapterArticle.getByRole("button", { name: "Quản lý bài học" }).click();
      await expect(page.getByRole("heading", { name: "Quản lý bài học" })).toBeVisible();

      await page.getByRole("button", { name: "Thêm bài học" }).click();
      const dialog = page.getByRole("dialog").last();
      await dialog.getByRole("textbox").fill(chapter.createTitle);
      await dialog.getByRole("button", { name: "Tạo và tiếp tục" }).click();

      await expect(page).toHaveURL(
        new RegExp(`/teacher/courses/${courseId}/topics/[0-9a-f-]{36}$`),
        { timeout: 15_000 },
      );
      const createdTopic = await findCreatedTopicByTitle(chapter.createTitle);
      expect(createdTopic.chapter_id).toBe(chapter.id);
      expect(createdTopic.status).toBe("draft");
      await expect(page).toHaveURL(getTopicBuilderPath(courseId, createdTopic.id), {
        timeout: 15_000,
      });
      await expect(page.getByRole("heading", { name: "Topic Builder" })).toBeVisible();
    } finally {
      await context.close();
    }
  }
});
