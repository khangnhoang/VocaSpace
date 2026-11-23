// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import RegisterPage from "@/app/(client)/(auth)/register/page";
import LoginPage from "@/app/(client)/(auth)/login/page";
import ForgotPasswordPage from "@/app/(client)/(auth)/forgot-password/page";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailPanel } from "@/app/(client)/(auth)/register/_components/CheckEmailPanel";
import { SetPasswordForm } from "@/app/auth/set-password/_components/SetPasswordForm";

// Test plan:
// - Mục tiêu: English localization U2 AC1/AC2 - các màn auth (đăng nhập, đăng ký đủ 4 chặng, quên mật khẩu, check-email, đặt mật khẩu)
//   hiện hoàn toàn bằng tiếng Anh khi locale là en: nhãn, nút, gợi ý, lỗi theo trường, thông báo từ action, panel minh hoạ.
// - Loại test: component interaction trong jsdom với trang thật trong AuthShell qua provider next-intl dùng chung; server action
//   được thay tại ranh giới và trả đúng câu tiếng Anh của catalog.
// - Case chính: từng trang ở locale en; điều hướng hết các chặng đăng ký; lỗi trường của login/forgot/set-password; thông báo
//   `auth_error` / `reason` của login; kết quả gửi lại và khôi phục.
// - Case biên: ngày sinh hiện theo định dạng MM/dd/yyyy; nội dung thẻ mẫu của hero (từ, phiên âm, nghĩa) giữ nguyên theo quyết định 1
//   nên được loại khỏi phép quét chữ tiếng Việt.
// - Giới hạn: không chạy build thật (provider lồng nhau thiếu namespace chỉ lộ ra ở bản build, xem bằng chứng H2 riêng).

const mocks = vi.hoisted(() => ({
  signUpUser: vi.fn(),
  signInUser: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  setPasswordAfterConfirmation: vi.fn(),
  searchParams: new URLSearchParams(),
  pathname: "/login",
  prepareAvatar: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  signUpUser: mocks.signUpUser,
  signInUser: mocks.signInUser,
  requestPasswordRecovery: mocks.requestPasswordRecovery,
  resendSignupConfirmation: mocks.resendSignupConfirmation,
  setPasswordAfterConfirmation: mocks.setPasswordAfterConfirmation,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
  usePathname: () => mocks.pathname,
  unstable_rethrow: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/auth/avatar-image", () => ({ prepareAvatar: mocks.prepareAvatar }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
URL.createObjectURL = vi.fn(() => "blob:avatar-preview");
URL.revokeObjectURL = vi.fn();

// Dấu thanh/mũ sau khi tách NFD, cộng đ/Đ: bắt cả chữ dựng sẵn như ớ, ế, ệ.
const VIETNAMESE_LETTER = { test: (value: string) => /[\u0300-\u036f\u0111\u0110]/.test(value.normalize("NFD")) };
// Nghĩa trên thẻ mẫu của hero (dòng "/rɪˈvjuː/ · ôn lại" và nghĩa từng chặng) là dữ liệu mẫu giữ nguyên theo quyết định 1, không
// phải chữ giao diện.
const SAMPLE_CARD_LINE = /^\/[^/]+\/ · /;
const SAMPLE_CARD_MEANINGS = new Set(["xin chào", "hồ sơ", "ảnh", "xác minh", "bảo mật"]);

// Quét từng phần tử lá để loại đúng dòng thẻ mẫu và trả các đoạn chữ còn chứa ký tự tiếng Việt.
function viLeftovers(root: HTMLElement) {
  return [...root.querySelectorAll("*")]
    .filter((element) => element.children.length === 0)
    .map((element) => element.textContent ?? "")
    .filter((text) => !SAMPLE_CARD_LINE.test(text) && !SAMPLE_CARD_MEANINGS.has(text) && VIETNAMESE_LETTER.test(text));
}

const preparedAvatar = () => new File(["prepared"], "avatar.webp", { type: "image/webp" });

function fillById(container: HTMLElement, id: string, value: string) {
  fireEvent.change(container.querySelector<HTMLInputElement>(`#${id}`)!, { target: { value } });
}

function renderEn(pathname: string, ui: React.ReactElement) {
  mocks.pathname = pathname;
  return render(<AuthShell lastSignInMethod={null}>{ui}</AuthShell>, { locale: "en" });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Wrapper `*Localized` trả kèm ngôn ngữ server; chuỗi action giả trong file này là tiếng Anh nên server cũng ở `en`.
  setServerTestLocale("en");
  mocks.searchParams = new URLSearchParams();
  mocks.prepareAvatar.mockImplementation(async () => preparedAvatar());
});

afterEach(() => {
  cleanup();
  setServerTestLocale("vi");
  vi.useRealTimers();
});

describe("/login in English", () => {
  it("shows every label, button, tab, link and the consent line in English", () => {
    const { container } = renderEn("/login", <LoginPage />);

    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeTruthy();
    const tabs = screen.getByRole("navigation", { name: "Sign in or sign up" });
    expect(within(tabs).getByRole("link", { name: "Sign in" }).getAttribute("aria-current")).toBe("page");
    expect(within(tabs).getByRole("link", { name: "Sign up" })).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms of Use" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getAllByText("Review just before you forget.").length).toBeGreaterThan(0);
    expect(viLeftovers(container)).toEqual([]);
  });

  it("shows field errors, the failed sign-in message and the fixed notices in English", async () => {
    const { container } = renderEn("/login", <LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(container.querySelector("#login-email-error")?.textContent).toBe("Enter a valid email address"));
    expect(container.querySelector("#login-password-error")?.textContent).toBe("Please enter your password");

    mocks.signInUser.mockResolvedValue({ error: "Wrong email or password!" });
    fillById(container, "login-email", "learner@example.com");
    fillById(container, "login-password", "abc123");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await screen.findByText("Wrong email or password!")).toBeTruthy();
  });

  it.each([
    ["auth_error", "recovery", "This password reset link is invalid or has expired. You can request a new one."],
    ["auth_error", "confirm", "This verification link is invalid or has expired"],
    ["auth_error", "oauth", "Google sign-in didn't work. You can try again or sign in with email."],
    ["reason", "signin_required", "Please sign in to continue."],
  ])("explains %s=%s in English", (param, value, text) => {
    mocks.searchParams = new URLSearchParams({ [param]: value });
    renderEn("/login", <LoginPage />);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it("says it cannot reach the server when the sign-in request fails in transit", async () => {
    mocks.signInUser.mockRejectedValue(new Error("network"));
    const { container } = renderEn("/login", <LoginPage />);
    fillById(container, "login-email", "learner@example.com");
    fillById(container, "login-password", "abc123");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await screen.findByText("Can't reach the server. Check your connection and try again.")).toBeTruthy();
  });
});

describe("/register in English", () => {
  it("walks every stage in English, including the check-email panel", async () => {
    mocks.signUpUser.mockResolvedValue({ success: true, needsEmailConfirmation: true });
    const { container } = renderEn("/register", <RegisterPage />);

    // Chặng 1
    expect(screen.getByText("Create your account")).toBeTruthy();
    expect(screen.getByText("STEP 1/5")).toBeTruthy();
    expect(screen.getByText("Each step, one more memory.")).toBeTruthy();
    const rail = screen.getByRole("list", { name: "Sign-up progress" });
    expect(within(rail).getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Account"), expect.stringContaining("Details"), expect.stringContaining("Photo")]),
    );
    expect(screen.getByText("At least 3 characters.")).toBeTruthy();
    expect(screen.getByText("We'll send the verification link to this email.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms of Use" })).toBeTruthy();
    expect(viLeftovers(container)).toEqual([]);

    fillById(container, "username", "learner01");
    fillById(container, "email", "learner@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Chặng 2
    await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
    expect(screen.getByText("About you")).toBeTruthy();
    expect(screen.getByText("STEP 2/5")).toBeTruthy();
    expect(screen.getByText("Full name")).toBeTruthy();
    expect(screen.getByText("Date of birth")).toBeTruthy();
    expect(screen.getByText("Choose your date of birth")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Male" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Female" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Other" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(viLeftovers(container)).toEqual([]);

    fillById(container, "phone", "0912345678");
    fillById(container, "full_name", "Nguyễn Văn A");
    fireEvent.click(container.querySelector("#dob")!);
    const grid = await screen.findByRole("grid");
    fireEvent.click(within(grid).getAllByRole("button").find((button) => !button.hasAttribute("disabled"))!);
    // Ngày sinh hiện theo MM/dd/yyyy ở tiếng Anh.
    expect(container.querySelector("#dob")?.textContent).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    fireEvent.click(screen.getByRole("radio", { name: "Male" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Chặng 3
    const create = await screen.findByRole("button", { name: "Create account" });
    expect(screen.getByText("Profile photo")).toBeTruthy();
    expect(screen.getByText("STEP 3/5")).toBeTruthy();
    expect(screen.getByText("Optional. You can add or change it later in your profile.")).toBeTruthy();
    expect(screen.getByText("Choose photo")).toBeTruthy();
    fireEvent.change(container.querySelector<HTMLInputElement>("#avatar-upload")!, {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("img", { name: "Selected profile photo" })).toBeTruthy();
    expect(screen.getByText("Change photo")).toBeTruthy();
    expect(screen.getByText("Remove photo")).toBeTruthy();
    expect(viLeftovers(container)).toEqual([]);
    fireEvent.click(create);

    // Chặng 4
    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(screen.getByText("Step 4/5")).toBeTruthy();
    expect(screen.getByText("learner@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit sign-up details" })).toBeTruthy();
    expect(viLeftovers(container)).toEqual([]);
  });

  it("shows the sign-up error returned by the action in English", async () => {
    mocks.signUpUser.mockResolvedValue({ error: "That username is already taken. Try another one." });
    const { container } = renderEn("/register", <RegisterPage />);
    fillById(container, "username", "learner01");
    fillById(container, "email", "learner@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
    fillById(container, "phone", "0912345678");
    fillById(container, "full_name", "An Nguyen");
    fireEvent.click(container.querySelector("#dob")!);
    const grid = await screen.findByRole("grid");
    fireEvent.click(within(grid).getAllByRole("button").find((button) => !button.hasAttribute("disabled"))!);
    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create account" }));
    expect(await screen.findByText("That username is already taken. Try another one.")).toBeTruthy();
  });
});

describe("CheckEmailPanel in English", () => {
  it("shows the cooldown button, the resend result and the spam note in English", async () => {
    mocks.resendSignupConfirmation.mockResolvedValue({
      success: true,
      message: "A new verification email will arrive in a few minutes. Check your Spam folder too!",
    });
    const { container } = render(<CheckEmailPanel email="learner@gmail.com" onEditForm={() => {}} />, { locale: "en" });
    expect(screen.getByText("Check your email")).toBeTruthy();
    expect(screen.getByText("We've sent a verification link to")).toBeTruthy();
    expect(screen.getByText("Can't find the email? Check your Spam folder or resend it in a few minutes.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gmail/ })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resend email" }));
    });
    expect(screen.getByRole("status").textContent).toContain("A new verification email will arrive");
    expect(screen.getByRole("button", { name: /Resend email \(60s\)/ })).toBeTruthy();
    expect(viLeftovers(container)).toEqual([]);
  });
});

describe("/forgot-password in English", () => {
  it("validates the email in English and shows the sent state", async () => {
    mocks.requestPasswordRecovery.mockResolvedValue({
      success: true,
      message: "Request sent! Check your inbox (and Spam folder) in a few minutes.",
    });
    const { container } = renderEn("/forgot-password", <ForgotPasswordPage />);
    expect(screen.getByText("Forgot your password?")).toBeTruthy();
    expect(screen.getAllByText("Forgetting is normal.").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Back to sign in" })).toBeTruthy();

    fillById(container, "recovery-email", "nope");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(container.querySelector("#recovery-email-error")?.textContent).toBe("This email address isn't valid"));

    fillById(container, "recovery-email", "learner@example.com");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(screen.getByRole("status").textContent).toContain("Request sent!");
    expect(screen.getByText("One review and you remember.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Resend link \(60s\)/ })).toBeTruthy();
  });
});

describe("SetPasswordForm in English", () => {
  it("shows labels, strength, the match line and field errors in English", async () => {
    const { container } = render(<SetPasswordForm />, { locale: "en" });
    expect(screen.getByText("Set your password")).toBeTruthy();
    expect(screen.getByText("Verify email")).toBeTruthy();
    expect(screen.getByText("At least 6 characters.")).toBeTruthy();

    fillById(container, "new-password", "abc");
    expect(screen.getByText(/Under 6 characters/)).toBeTruthy();
    fillById(container, "new-password", "abc12345");
    fillById(container, "confirm-new-password", "abc12345");
    expect(screen.getByText("The passwords match")).toBeTruthy();

    fillById(container, "confirm-new-password", "different1");
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    await waitFor(() => expect(container.querySelector("#confirm-new-password-error")?.textContent).toBe("The passwords don't match"));
    expect(viLeftovers(container)).toEqual([]);
  });

  it("shows the server error returned by the action in English", async () => {
    mocks.setPasswordAfterConfirmation.mockResolvedValue({
      error: "This password is too weak or easy to guess. Choose a different one.",
    });
    const { container } = render(<SetPasswordForm />, { locale: "en" });
    fillById(container, "new-password", "abc12345");
    fillById(container, "confirm-new-password", "abc12345");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await screen.findByText("This password is too weak or easy to guess. Choose a different one.")).toBeTruthy();
  });
});
