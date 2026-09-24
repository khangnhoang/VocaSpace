import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { getCourseOverviewPath, getCourseStructurePath } from "@/lib/course-authoring/routes";
import { createD2PreviewBrowserFixture } from "../support/d2-preview-fixture";
import { loginAsStudent, loginAsTeacher } from "../support/auth";

// spec: ../specs/d2-public-preview.plan.md
// seed: e2e/d2/public-course-preview.spec.ts (fixture được tạo trong test.beforeAll)
// Test plan:
// - Mục tiêu: kiểm tra luồng public Preview, dữ liệu học không đổi, suspension do moderation và phục hồi qua tăng mẫu số.
// - Loại test: Playwright trên app và Supabase local cô lập; fixture dùng dữ liệu thật, không mock request.
// - Thành công: guest/enrolled actor dùng card, quiz, media; warning khớp audit; tạo draft hợp lệ tự mở lại Preview.
// - Thất bại/cancel: Preview bị chặn khi A=20/M=5/cap=4; Escape đóng hộp thoại ẩn bài mà không đổi topic hoặc marker.
// - Kích thước/bàn phím: kiểm tra tràn ngang ở 320/375/tablet/desktop, focus tiêu đề dialog và chọn đáp án bằng Space.
// - Kết quả verify gần nhất: passed (1 scenario) bằng `npm.cmd run test:e2e -- e2e/d2/public-course-preview.spec.ts`; runtime Supabase là cô lập.

const APP_URL = process.env.E2E_BASE_URL ??
  `http://${process.env.E2E_HOST ?? "127.0.0.1"}:${process.env.E2E_PORT ?? "3100"}`;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_EMAIL = "admin@gmail.com";
const TEACHER_EMAIL = "teacher@gmail.com";
const STUDENT_EMAIL = "student@gmail.com";
const SEEDED_PASSWORD = "123123";

let fixture: Awaited<ReturnType<typeof createD2PreviewBrowserFixture>>;

test.beforeAll(async () => {
  fixture = await createD2PreviewBrowserFixture();
});

test.afterAll(async () => {
  await fixture?.cleanup();
});

test("guest and enrolled Preview recovers automatically after denominator growth", async ({ page }) => {
  const coursePath = `/courses/${fixture.courseSlug}`;
  const previewPath = `${coursePath}/preview/${fixture.topicSlugs[0]}`;

  // 1. Mở đề cương công khai ở màn hình hẹp và xác nhận topic có marker là lối vào Preview.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(coursePath);
  await expect(page.getByRole("heading", { name: fixture.courseTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Đề cương khóa học" })).toBeVisible();
  await expect(page.locator(`a[href="${previewPath}"]`)).toBeVisible();
  await expectNoHorizontalOverflow(page, 320);

  // 2. Dùng hàng đợi card, tải media riêng tư và trả lời quiz bằng bàn phím.
  await page.locator(`a[href="${previewPath}"]`).click();
  await expect(page).toHaveURL(`${APP_URL}${previewPath}`);
  await expect(page.getByText("Tiến độ trong lượt xem thử này không được lưu.")).toBeVisible();
  await expect(page.getByText("orbit", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
  await page.getByRole("button", { name: "Lại" }).click();
  await expect(page.getByText("harbor", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
  await page.getByRole("button", { name: "Dễ" }).click();
  await expect(page.getByText("orbit", { exact: true })).toBeVisible();

  const mediaResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/public-course-preview/media/${fixture.groupId}/image`),
  );
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
  await page.getByRole("button", { name: "Dễ" }).click();
  const mediaResponse = await mediaResponsePromise;
  expect(mediaResponse.status()).toBe(200);
  const initialImage = page.getByRole("img", { name: "Hình ảnh ngữ liệu" });
  await expect(initialImage).toBeVisible();
  await expect.poll(() => initialImage.evaluate((image) =>
    (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
  )).toBe(true);
  const answer = page.getByRole("button", { name: "A. Đáp án đúng" });
  await answer.focus();
  await expect(answer).toBeFocused();
  await page.keyboard.press("Space");
  await expect(answer).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();
  await expect(page.getByText("D2 explanation for the correct preview answer.")).toBeVisible();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.getByText("Bạn đã xem hết nội dung mẫu.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tiếp tục học" })).toHaveCount(0);

  for (const width of [375, 768, 1280]) {
    await expectNoHorizontalOverflow(page, width);
  }

  // 3. Kiểm tra actor đã enroll chỉ thấy CTA sau khi hết lượt và không tạo learner rows.
  const learnerBaseline = await readLearnerRows();
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAsStudent(page, {
    E2E_STUDENT_EMAIL: STUDENT_EMAIL,
    E2E_STUDENT_PASSWORD: SEEDED_PASSWORD,
  });
  await page.goto(previewPath);
  await expect(page.getByRole("button", { name: "Tiếp tục học" })).toHaveCount(0);
  for (let cardIndex = 0; cardIndex < fixture.cardIds.length; cardIndex += 1) {
    await page.getByRole("button", { name: "Hiện đáp án" }).click();
    await page.getByRole("button", { name: "Dễ" }).click();
  }
  await page.getByRole("button", { name: "A. Đáp án đúng" }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.getByRole("button", { name: "Tiếp tục học" })).toBeVisible();
  await expectNoHorizontalOverflow(page, 375);
  expect(await readLearnerRows()).toEqual(learnerBaseline);

  // 4. Mở và hủy hộp thoại ẩn topic đã đánh dấu; bàn phím không được làm thay đổi dữ liệu.
  await page.getByRole("button", { name: "Mở điều hướng tài khoản" }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.setViewportSize({ width: 320, height: 820 });
  await loginAsTeacher(page, {
    E2E_TEACHER_EMAIL: TEACHER_EMAIL,
    E2E_TEACHER_PASSWORD: SEEDED_PASSWORD,
  });
  await page.goto(getCourseStructurePath(fixture.courseId));
  await expectNoHorizontalOverflow(page, 320);
  await page.getByRole("button", { name: "Quản lý bài học" }).first().click();
  await expect(page.getByRole("heading", { name: "Quản lý bài học" })).toBeVisible();
  await expectNoHorizontalOverflow(page, 320);
  const firstTopic = page.locator("article").filter({ hasText: fixture.topicTitles[0] });
  await firstTopic.getByRole("button", { name: new RegExp(`Ẩn bài học ${escapeRegExp(fixture.topicTitles[0])}`) }).click();
  const deleteDialog = page.getByRole("dialog").last();
  const deleteHeading = deleteDialog.getByRole("heading", { name: "Ẩn bài học?" });
  await expect(deleteHeading).toBeFocused();
  await expectNoHorizontalOverflow(page, 320);
  await page.keyboard.press("Escape");
  await expect(deleteHeading).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quản lý bài học" })).toBeVisible();
  const unchangedTopic = await fixture.supabase.from("topics")
    .select("status, removed_at, is_preview")
    .eq("id", fixture.topicIds[0])
    .single();
  expect(unchangedTopic.error).toBeNull();
  expect(unchangedTopic.data).toMatchObject({ status: "published", removed_at: null, is_preview: true });

  // 5. Moderation làm A=20/M=5/cap=4; public chỉ nhận trạng thái chung, teacher thấy đúng audit.
  const moderator = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const moderatorSignIn = await moderator.auth.signInWithPassword({ email: ADMIN_EMAIL, password: SEEDED_PASSWORD });
  expect(moderatorSignIn.error).toBeNull();
  const moderationReason = "D2 browser acceptance verified takedown";
  const moderation = await moderator.rpc("moderate_platform_content", {
    p_target_type: "topic",
    p_target_id: fixture.topicIds[5],
    p_action: "takedown",
    p_reason: moderationReason,
  });
  expect(moderation.error).toBeNull();
  expect(moderation.data?.audit_id).toEqual(expect.any(String));
  fixture.rememberModerationAuditId(String(moderation.data.audit_id));
  await moderator.auth.signOut();

  await page.goto(coursePath);
  await expect(page.getByText("Tính năng xem trước nội dung của khóa học này đang tạm thời không khả dụng.")).toBeVisible();
  await expect(page.locator(`a[href="${previewPath}"]`)).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toMatch(/quota|moderation|audit|acceptance verified/i);
  await page.goto(previewPath);
  await expect(page.getByRole("heading", { name: "Nội dung xem thử hiện không khả dụng" })).toBeVisible();
  await expect(page.getByText("orbit", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 320);

  await page.goto(getCourseOverviewPath(fixture.courseId));
  const suspensionNotice = page.getByRole("status")
    .filter({ hasText: "Xem trước bài học đang tạm thời bị vô hiệu hóa" });
  await expect(suspensionNotice).toContainText("Đang chọn 5/4 bài học xem thử.");
  await expect(suspensionNotice).toContainText(moderationReason);
  await expect(suspensionNotice.getByRole("link", { name: "Điều chỉnh bài học xem thử" }))
    .toHaveAttribute("href", getCourseStructurePath(fixture.courseId));
  for (const width of [320, 375, 768, 1280]) {
    await expectNoHorizontalOverflow(page, width);
  }

  // 6. Tạo một draft không gắn marker để tăng A lên 21, giữ M=5 và tự xóa causal pointer.
  await page.getByRole("link", { name: "Điều chỉnh bài học xem thử" }).click();
  await expectNoHorizontalOverflow(page, 1280);
  await page.getByRole("button", { name: "Quản lý bài học" }).first().click();
  const recoveredTopicTitle = `D2 recovery draft ${fixture.suffix}`;
  await createD2RecoveryDraft(page, recoveredTopicTitle, fixture.courseId);
  await page.goto(getCourseOverviewPath(fixture.courseId));
  await expect(page.getByText("Xem trước bài học đang tạm thời bị vô hiệu hóa")).toHaveCount(0);

  const activeTopics = await fixture.supabase.from("topics")
    .select("id, title, status, is_preview")
    .eq("course_id", fixture.courseId)
    .is("removed_at", null);
  expect(activeTopics.error).toBeNull();
  expect(activeTopics.data).toHaveLength(21);
  expect(activeTopics.data?.filter((topic) => topic.is_preview)).toHaveLength(5);
  const restoredTarget = await fixture.supabase.from("topics")
    .select("status, removed_at, is_preview")
    .eq("id", fixture.topicIds[5])
    .single();
  expect(restoredTarget.error).toBeNull();
  expect(restoredTarget.data).toMatchObject({ removed_at: expect.any(String), is_preview: false });
  const recoveredDraft = activeTopics.data?.find((topic) => topic.title === recoveredTopicTitle);
  expect(recoveredDraft).toMatchObject({ status: "draft", is_preview: false });
  const causePointer = await fixture.supabase.from("course_preview_moderation_causes")
    .select("course_id")
    .eq("course_id", fixture.courseId);
  expect(causePointer.error).toBeNull();
  expect(causePointer.data).toEqual([]);

  // 7. Màn hình công khai mở lại mà không có thao tác kích hoạt riêng.
  await page.goto(coursePath);
  await expect(page.locator(`a[href="${previewPath}"]`)).toBeVisible();
  await expectNoHorizontalOverflow(page, 320);
  for (const width of [375, 768, 1280]) {
    await expectNoHorizontalOverflow(page, width);
  }
  await page.goto(previewPath);
  await expect(page.getByText("Tiến độ trong lượt xem thử này không được lưu.")).toBeVisible();
  const resumedMediaResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/public-course-preview/media/${fixture.groupId}/image`),
  );
  for (let cardIndex = 0; cardIndex < fixture.cardIds.length; cardIndex += 1) {
    await page.getByRole("button", { name: "Hiện đáp án" }).click();
    await page.getByRole("button", { name: "Dễ" }).click();
  }
  await expect(page.getByRole("img", { name: "Hình ảnh ngữ liệu" })).toBeVisible();
  const resumedMediaResponse = await resumedMediaResponsePromise;
  expect(resumedMediaResponse.status()).toBe(200);
  const resumedImage = page.getByRole("img", { name: "Hình ảnh ngữ liệu" });
  await expect.poll(() => resumedImage.evaluate((image) =>
    (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
  )).toBe(true);
  await expect(page.getByRole("button", { name: "A. Đáp án đúng" })).toBeVisible();
  await page.getByRole("button", { name: "A. Đáp án đúng" }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();
});

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth, `document overflow at ${width}px`).toBeLessThanOrEqual(width);
}

async function createD2RecoveryDraft(
  page: import("@playwright/test").Page,
  title: string,
  courseId: string,
) {
  await page.getByRole("button", { name: "Thêm bài học" }).click();
  const dialog = page.getByRole("dialog").last();
  await dialog.getByRole("textbox").last().fill(title);
  await dialog.getByRole("button", { name: "Tạo và tiếp tục" }).click();
  await page.waitForURL((url) =>
    url.pathname.startsWith(`/teacher/courses/${courseId}/topics/`),
    { timeout: 15_000 },
  );
  await expect(page.getByRole("link", { name: "Quay về structure workspace" })).toBeVisible();
}

async function readLearnerRows() {
  const [cards, answers, progress] = await Promise.all([
    fixture.supabase.from("user_flashcards").select("id")
      .eq("user_id", fixture.studentId).in("card_id", fixture.cardIds),
    fixture.supabase.from("user_question_answers").select("id")
      .eq("user_id", fixture.studentId).eq("question_id", fixture.questionId),
    fixture.supabase.from("user_topic_progress").select("id")
      .eq("user_id", fixture.studentId).eq("topic_id", fixture.topicIds[0]),
  ]);
  for (const result of [cards, answers, progress]) expect(result.error).toBeNull();
  return {
    cards: cards.data,
    answers: answers.data,
    progress: progress.data,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
