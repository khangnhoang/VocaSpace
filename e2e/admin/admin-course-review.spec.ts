import { expect, test, type Page } from "@playwright/test";
import { createAdminCourseReviewFixture } from "../support/admin-course-review-fixture";
import { loginAsStudent } from "../support/auth";

// Test plan:
// - Mục tiêu: admin duyệt, từ chối và hạ khóa học từ /admin/courses trên dữ liệu thật (AD3 AC5-AC7).
// - Loại test: Playwright trên app và Supabase local cô lập (API 45441); fixture tạo bằng service role (có guard cổng 45441), mọi thao tác UI là session admin thật.
// - Case thành công:
//   - hàng chờ duyệt cũ nhất đứng đầu; panel tóm tắt hiện dàn bài thật; "Duyệt" đưa khóa học rời tab Chờ duyệt và vào danh mục /courses.
//   - "Từ chối" kèm lý do đưa khóa học sang tab Bản nháp, hàng hiện đúng lý do.
//   - "Hạ về bản nháp" kèm lý do đưa khóa học đã xuất bản rời danh mục /courses và sang tab Bản nháp.
// - Case thất bại: lý do quá ngắn báo lỗi dưới ô nhập, giữ nguyên nội dung đã nhập và khóa học không đổi.
// - Ổn định: fixture dọn trong afterAll kể cả khi test fail; các test dùng chung một fixture nhưng mỗi test chỉ đổi khóa học của riêng nó.
// - Giới hạn: bố cục 375/1280 px và thứ tự focus kiểm thủ công (plan §4.1); gỡ khóa học (takedown) đã có integration test ở tầng RPC.
// - Verify: xem State AD3 trong docs/programs/admin-console/progress.md.

let fixture: Awaited<ReturnType<typeof createAdminCourseReviewFixture>>;

test.beforeAll(async () => {
  fixture = await createAdminCourseReviewFixture();
});

test.afterAll(async () => {
  await fixture?.cleanup();
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginAsStudent(page, { E2E_STUDENT_EMAIL: "admin@gmail.com", E2E_STUDENT_PASSWORD: "123123" });
});

// Span sr-only (position absolute) làm Playwright chèn khoảng trắng trước dấu phẩy khi tính tên truy cập, nên khớp theo regex.
const summaryButton = (page: Page, title: string) =>
  page.getByRole("button", { name: new RegExp(`^${title}\\s*, xem tóm tắt$`) });
const catalogLink = (page: Page, slug: string) => page.locator(`a[href="/courses/${slug}"]`);

test("admin approves a pending course and it enters the public catalog", async ({ page }) => {
  const { approve, reject, suffix } = fixture;

  await page.goto(`/admin/courses?q=${suffix}`);
  await expect(page.getByRole("heading", { name: /^Chờ duyệt/, level: 2 })).toBeVisible();
  // Khóa học chờ lâu hơn đứng trước.
  const rows = page.getByRole("row").filter({ has: page.getByRole("button", { name: /xem tóm tắt/ }) });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(approve.title);
  await expect(rows.nth(1)).toContainText(reject.title);

  await summaryButton(page, approve.title).click();
  const panel = page.getByRole("dialog", { name: approve.title });
  await expect(panel.getByText("Chương 1: Chương approve")).toBeVisible();
  await expect(panel.getByText("Bài học approve")).toBeVisible();
  await expect(panel.getByText("1 / 1 bài học đã xuất bản")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await page.goto("/courses");
  await expect(catalogLink(page, approve.slug)).toHaveCount(0);

  await page.goto(`/admin/courses?q=${suffix}`);
  await page.getByRole("button", { name: `Duyệt khóa học ${approve.title}` }).click();
  const dialog = page.getByRole("dialog", { name: "Duyệt khóa học này?" });
  await expect(dialog).toContainText(approve.title);
  await dialog.getByRole("button", { name: "Duyệt khóa học" }).click();

  await expect(page.getByText("Đã duyệt khóa học.")).toBeVisible();
  await expect(summaryButton(page, approve.title)).toHaveCount(0);
  await expect(summaryButton(page, reject.title)).toBeVisible();

  await page.goto("/courses");
  await expect(catalogLink(page, approve.slug).first()).toBeVisible();
});

test("admin rejects a pending course with a reason that shows on the draft tab", async ({ page }) => {
  const { reject, suffix } = fixture;
  const reason = "Ảnh bìa mờ, cần bổ sung ảnh rõ nét hơn.";

  await page.goto(`/admin/courses?q=${suffix}`);
  await page.getByRole("button", { name: `Từ chối khóa học ${reject.title}` }).click();
  const dialog = page.getByRole("dialog", { name: "Từ chối khóa học" });

  // Lý do quá ngắn: lỗi nằm dưới ô nhập, nội dung đã nhập được giữ và khóa học không đổi.
  await dialog.getByLabel("Lý do từ chối").fill("ngắn");
  await dialog.getByRole("button", { name: "Từ chối khóa học" }).click();
  await expect(dialog.getByText("Lý do từ chối phải có ít nhất 10 ký tự.")).toBeVisible();
  await expect(dialog.getByLabel("Lý do từ chối")).toHaveValue("ngắn");

  await dialog.getByLabel("Lý do từ chối").fill(reason);
  await dialog.getByRole("button", { name: "Từ chối khóa học" }).click();
  await expect(page.getByText("Đã từ chối khóa học.")).toBeVisible();
  await expect(summaryButton(page, reject.title)).toHaveCount(0);

  await page.goto(`/admin/courses?status=draft&q=${suffix}`);
  const row = page.getByRole("row").filter({ has: summaryButton(page, reject.title) });
  await expect(row).toContainText(`Lý do từ chối: ${reason}`);
  // Bản nháp không có nút hành động.
  await expect(row.getByRole("button", { name: /Duyệt|Từ chối|Hạ|Gỡ/ })).toHaveCount(0);
});

test("admin demotes a published course and it leaves the public catalog", async ({ page }) => {
  const { demote, suffix } = fixture;
  const reason = "Nội dung bài học chưa đạt yêu cầu chất lượng.";

  await page.goto("/courses");
  await expect(catalogLink(page, demote.slug).first()).toBeVisible();

  await page.goto(`/admin/courses?status=published&q=${suffix}`);
  await page.getByRole("button", { name: `Hạ về bản nháp: ${demote.title}` }).click();
  const dialog = page.getByRole("dialog", { name: "Hạ khóa học về bản nháp" });
  await expect(dialog).toContainText("rời khỏi danh mục công khai");
  await dialog.getByLabel("Lý do hạ khóa học").fill(reason);
  await dialog.getByRole("button", { name: "Hạ về bản nháp" }).click();

  await expect(page.getByText("Đã hạ khóa học về bản nháp.")).toBeVisible();
  await expect(summaryButton(page, demote.title)).toHaveCount(0);

  await page.goto("/courses");
  await expect(catalogLink(page, demote.slug)).toHaveCount(0);
  await page.goto(`/admin/courses?status=draft&q=${suffix}`);
  await expect(summaryButton(page, demote.title)).toBeVisible();
});
