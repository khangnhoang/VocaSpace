import { expect, test } from "@playwright/test";
import {
  getProfileUsername,
  prepareProfileUsernameFixture,
} from "../../scripts/e2e/profile-username-fixture.mjs";
import { loginAsStudent } from "../support/auth";

// Test plan:
// - Mục tiêu: user chưa có username thấy lỗi validate khi nhập username quá ngắn trên /profile.
// - Loại test: smoke E2E trên dev server có React Compiler (jsdom của component test không chạy compiler).
// - Đối tượng: EditProfileForm, zodResolver(profileSchema), hiển thị formState.errors.username.
// - Case lỗi: username 2 ký tự hiện "Username phải từ 3 ký tự trở lên" và không ghi gì xuống DB.
// - Bảo mật/phân quyền: service-role chỉ tạo fixture và đọc profiles trong Node.
// - Invariant cần giữ: lỗi phải hiện thay vì form chặn submit trong im lặng (A3 AC8).

test("user without a username sees the short-username error on /profile", async ({ page }) => {
  const fixture = await prepareProfileUsernameFixture();

  await loginAsStudent(page, fixture);
  await page.goto("/profile");

  const username = page.getByLabel(/Tên định danh/);
  await expect(username).toBeEditable();
  await expect(page.getByText("Bạn chỉ đặt được username một lần.")).toBeVisible();

  await username.fill("ab");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();

  await expect(page.getByText("Username phải từ 3 ký tự trở lên")).toBeVisible();
  expect(await getProfileUsername()).toBeNull();
});
