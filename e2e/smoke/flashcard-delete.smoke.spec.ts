import { expect, test } from "@playwright/test";
import {
  cleanupFlashcardDeleteFixtures,
  getFlashcardRemovedAt,
  prepareFlashcardDeleteFixture,
} from "../../scripts/e2e/flashcard-delete-fixture.mjs";
import { exerciseAuthoringFixture } from "../../scripts/e2e/exercise-authoring-fixture.mjs";
import { loginAsTeacher } from "../support/auth";

// Test plan:
// - Mục tiêu: kiểm tra giáo viên có quyền xóa mềm một flashcard thật qua browser UI.
// - Loại test: smoke E2E.
// - Đối tượng: tab flashcard, deleteCard Server Action, RLS, refresh danh sách và reload trang.
// - Case thành công: card biến mất sau khi xác nhận xóa và vẫn vắng mặt sau reload.
// - Bảo mật/phân quyền: service-role chỉ tạo fixture và kiểm tra removed_at trong Node.
// - Ổn định/resilience: cleanup chạy sau test để dữ liệu tạm không sót lại khi assertion fail.
// - Invariant cần giữ: browser không dùng service-role key và dữ liệu persisted có removed_at khác NULL.

test.afterEach(async () => {
  await cleanupFlashcardDeleteFixtures();
});

test("teacher soft-deletes a flashcard and it stays absent after reload", async ({
  page,
}) => {
  const fixture = await prepareFlashcardDeleteFixture();
  const courseId = fixture.E2E_COURSE_ID ?? exerciseAuthoringFixture.courseId;
  const topicId = fixture.E2E_TOPIC_ID ?? exerciseAuthoringFixture.topicId;
  const cardId = fixture.E2E_FLASHCARD_ID;
  const word = fixture.E2E_FLASHCARD_WORD;

  await loginAsTeacher(page, fixture);

  await page.goto(`/courses/${courseId}/topics/${topicId}?tab=flashcards`);
  await expect(page.getByRole("heading", { name: "Topic Builder" })).toBeVisible();
  await expect(page.getByText(word)).toBeVisible();

  const card = page.locator(".group").filter({ hasText: word }).first();
  await card.hover();
  await card.getByRole("button", { name: "Xóa thẻ từ vựng" }).click();

  await page.getByRole("dialog").getByRole("button", { name: "Xóa vĩnh viễn" }).click();
  await expect(page.getByText("Đã xóa từ vựng thành công!")).toBeVisible();
  await expect(page.getByText("Đã xóa từ vựng thành công!")).toHaveCount(1);
  await expect(page.getByText(word)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Topic Builder" })).toBeVisible();
  await expect(page.getByText(word)).toHaveCount(0);

  const removedAt = await getFlashcardRemovedAt(cardId);
  expect(removedAt).toEqual(expect.any(String));
});
