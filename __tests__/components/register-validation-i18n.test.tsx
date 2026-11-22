// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@/__tests__/support/intl";
import type { Locale } from "@/lib/i18n/config";
import RegisterPage from "@/app/(client)/(auth)/register/page";
import { AuthShell } from "@/components/auth/auth-shell";

// Test plan:
// - Mục tiêu: English localization U1 AC4 - lỗi của registerSchema hiện cạnh đúng trường theo ngôn ngữ đang dùng; tiếng
//   Việt giữ đúng nguyên văn cũ (G7: phần kiểm câu chữ chuyển từ test schema sang đây).
// - Loại test: component interaction trong jsdom với RegisterPage thật trong AuthShell, qua provider next-intl dùng chung.
// - Đối tượng: register page (bước 1 và 2), registerSchema.
// - Case: bỏ trống bước 1 và bước 2; số điện thoại có chữ, quá ngắn, quá dài; ở cả tiếng Việt và tiếng Anh.
// - Ngoài phạm vi: phần chữ khác của trang đăng ký vẫn là tiếng Việt cho tới U2.

vi.mock("@/app/actions/auth", () => ({ signUpUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/register",
  unstable_rethrow: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

afterEach(() => cleanup());

function renderRegister(locale: Locale) {
  return render(
    <AuthShell lastSignInMethod={null}>
      <RegisterPage />
    </AuthShell>,
    { locale },
  );
}

function fill(container: HTMLElement, id: string, value: string) {
  fireEvent.change(container.querySelector<HTMLInputElement>(`#${id}`)!, { target: { value } });
}

// U2 đã chuyển cả nút "Tiếp tục" sang catalog, nên tên nút theo ngôn ngữ của test.
async function goToStepTwo(container: HTMLElement, next: string) {
  fill(container, "username", "learner01");
  fill(container, "email", "learner@example.com");
  fireEvent.click(screen.getByRole("button", { name: next }));
  await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
}

const fieldMessage = (container: HTMLElement, id: string) => container.querySelector(`#${id}-error`)?.textContent;

const MESSAGES = {
  vi: {
    next: "Tiếp tục",
    username: "Tên tài khoản phải từ 3 ký tự trở lên",
    email: "Email này không đúng định dạng",
    fullName: "Vui lòng nhập họ và tên",
    phoneDigits: "Số điện thoại chỉ được chứa số",
    phoneInvalid: "Số điện thoại không hợp lệ",
    phoneLong: "Số điện thoại quá dài",
    dob: "Vui lòng chọn ngày sinh hợp lệ",
    gender: "Vui lòng chọn giới tính",
  },
  en: {
    next: "Continue",
    username: "Username must be at least 3 characters",
    email: "This email address isn't valid",
    fullName: "Please enter your full name",
    phoneDigits: "Phone number can only contain digits",
    phoneInvalid: "Phone number isn't valid",
    phoneLong: "Phone number is too long",
    dob: "Please choose a valid date of birth",
    gender: "Please choose a gender",
  },
} as const;

describe.each(["vi", "en"] as const)("register validation messages in %s", (locale) => {
  const expected = MESSAGES[locale];

  it("shows the account-step messages beside their fields", async () => {
    const { container } = renderRegister(locale);
    fireEvent.click(screen.getByRole("button", { name: expected.next }));

    await waitFor(() => expect(fieldMessage(container, "username")).toBe(expected.username));
    expect(fieldMessage(container, "email")).toBe(expected.email);
  });

  it("shows the profile-step messages beside their fields", async () => {
    const { container } = renderRegister(locale);
    await goToStepTwo(container, expected.next);
    fireEvent.click(screen.getByRole("button", { name: expected.next }));

    await waitFor(() => expect(fieldMessage(container, "full_name")).toBe(expected.fullName));
    expect(fieldMessage(container, "phone")).toBe(expected.phoneDigits);
    expect(fieldMessage(container, "dob")).toBe(expected.dob);
    expect(fieldMessage(container, "gender")).toBe(expected.gender);
  });

  it.each([
    ["09123abc78", "phoneDigits"],
    ["091234", "phoneInvalid"],
    ["091234567890", "phoneLong"],
  ] as const)("explains the phone number %s", async (phone, key) => {
    const { container } = renderRegister(locale);
    await goToStepTwo(container, expected.next);
    fill(container, "phone", phone);
    fireEvent.click(screen.getByRole("button", { name: expected.next }));

    await waitFor(() => expect(fieldMessage(container, "phone")).toBe(expected[key]));
  });
});
