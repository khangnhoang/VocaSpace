// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/(client)/(auth)/register/page";
import LoginPage from "@/app/(client)/(auth)/login/page";
import ForgotPasswordPage from "@/app/(client)/(auth)/forgot-password/page";
import { renderToString } from "react-dom/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailPanel } from "@/app/(client)/(auth)/register/_components/CheckEmailPanel";
import { SetPasswordForm } from "@/app/auth/set-password/_components/SetPasswordForm";

const mocks = vi.hoisted(() => ({
  signUpUser: vi.fn(),
  signInUser: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  setPasswordAfterConfirmation: vi.fn(),
  searchParams: new URLSearchParams(),
  pathname: "/login",
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  signUpUser: mocks.signUpUser,
  signInUser: mocks.signInUser,
  requestPasswordRecovery: mocks.requestPasswordRecovery,
  resendSignupConfirmation: mocks.resendSignupConfirmation,
  setPasswordAfterConfirmation: mocks.setPasswordAfterConfirmation,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => mocks.searchParams,
  usePathname: () => mocks.pathname,
  unstable_rethrow: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

// Test plan:
// - Mục tiêu: UI A1/A2 — đăng ký không có mật khẩu, check-email, forgot-password và đặt mật khẩu.
// - Loại test: component interaction trong jsdom (RTL), server action được mock.
// - Đối tượng: /register, CheckEmailPanel, /login, /forgot-password, SetPasswordForm.
// - Case thành công: đăng ký xong hiện chặng kiểm tra email (rail 4/5) với email đã nhập; "Sửa thông tin đăng ký" mở lại
//   form với dữ liệu cũ và gửi lại đúng dữ liệu, kể cả file avatar; gửi lại email hiện thông điệp trung tính ngay trong trang.
// - Case thất bại: action trả lỗi → báo ngay trong trang (role=alert), vẫn ở form; mật khẩu ngắn/không khớp chặn submit;
//   lỗi server hoặc lỗi mạng khi đặt mật khẩu → câu cố định ngay trong trang, thử lại được; recovery lỗi provider/transport
//   vẫn cùng notice và giữ input.
// - U3 (CP3): rail 5 chặng của /register (aria-current, "đã xong") và rail 2 chặng của đặt mật khẩu; mỗi bước chỉ kiểm tra
//   trường của bước đó, focus vào ô lỗi đầu tiên, Enter sang bước, focus tiêu đề bước mới; tab chỉ ở bước 1; tên nút ngày
//   sinh gồm cả giá trị; thước đo độ mạnh và dòng "Hai mật khẩu đã khớp" (AC4); mọi form `method="post"` (G10).
// - Dòng đồng ý 16+ (A4b AC5): /login và /register step 1 hiện đúng một dòng với link /terms và /privacy dưới nút Google, không có checkbox;
//   step 2, step 3 và màn check-email không hiện.
// - Bảo mật/phân quyền: không có ô mật khẩu khi đăng ký (G8); nút Google (A4) chỉ ở /login và /register step 1, không có ở step 2–3 và màn check-email; login chỉ hiện
//   thông điệp cố định cho `auth_error=confirm|recovery|oauth`, có link quên mật khẩu, chặn key prototype;
//   notice F1 chỉ hiện đúng chuỗi cố định cho `reason=signin_required` (role=status, không phải alert), bỏ qua giá trị khác và key prototype.
// - Ổn định/resilience: cooldown 60s sau mỗi submit; recovery chặn double-submit kể cả request lâu hơn cooldown.
// - U3 (CP2) /login và /forgot-password trong AuthShell: tab có aria-current; form `method="post"` (G10); nút Google
//   "Tiếp tục với Google" và nhãn "Lần trước" theo cookie server đọc (AC6); hiện/ẩn mật khẩu, Caps Lock, thẻ lật khi
//   focus mật khẩu; gợi ý email chỉ áp dụng khi bấm (AC5); đăng nhập sai báo ngay trong trang, giữ giá trị, chọn lại
//   mật khẩu; đăng nhập đúng chuyển ngay tới `redirectTo` server trả về; recovery báo trung tính ngay trong trang (AC10).
// - Invariant cần giữ: tên tiếp cận login là nhãn tiếng Việt đang hiển thị "Email", "Mật khẩu", "Đăng nhập" (U3 G9,
//   thay hợp đồng aria-label A1 G9); smoke E2E đăng nhập theo các tên này.

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
URL.createObjectURL = vi.fn(() => "blob:avatar-preview");

// Dòng đồng ý gồm cả hai link nên so khớp theo toàn bộ textContent của thẻ <p>.
const CONSENT_TEXT = (_: string, element: Element | null) =>
  element?.tagName === "P" &&
  element.textContent ===
    "Bằng việc tiếp tục, bạn xác nhận đã đủ 16 tuổi và đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư của VocaSpace.";

const RESEND_MESSAGE = "Mail xác minh mới sẽ tới trong vài phút, bạn kiểm tra cả mục Spam nhé!";

function fillById(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Missing input #${id}`);
  fireEvent.change(input, { target: { value } });
}

async function completeRegistration(container: HTMLElement, avatar?: File) {
  fillById(container, "username", "learner01");
  fillById(container, "email", "learner@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

  await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
  fillById(container, "phone", "0912345678");
  fillById(container, "full_name", "Nguyễn Văn A");

  fireEvent.click(container.querySelector("#dob")!);
  const grid = await screen.findByRole("grid");
  const day = within(grid)
    .getAllByRole("button")
    .find((button) => !button.hasAttribute("disabled"));
  if (!day) throw new Error("No selectable day");
  fireEvent.click(day);
  fireEvent.click(screen.getByRole("radio", { name: "Nam" }));

  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  const submit = await screen.findByRole("button", { name: "Tạo tài khoản" });
  if (avatar) {
    const fileInput = container.querySelector<HTMLInputElement>("#avatar-upload");
    if (!fileInput) throw new Error("Missing avatar input");
    fireEvent.change(fileInput, { target: { files: [avatar] } });
  }
  fireEvent.click(submit);
}

function submittedFields(call: number) {
  const formData = mocks.signUpUser.mock.calls[call][0] as FormData;
  return Object.fromEntries(
    [...formData.entries()].filter(([key]) => key !== "avatar").map(([key, value]) => [key, String(value)]),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = new URLSearchParams();
  mocks.pathname = "/login";
  mocks.resendSignupConfirmation.mockResolvedValue({ success: true, message: RESEND_MESSAGE });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("/register", () => {
  function renderRegister() {
    mocks.pathname = "/register";
    return render(
      <AuthShell lastSignInMethod={null}>
        <RegisterPage />
      </AuthShell>,
    );
  }
  const currentStage = () => document.querySelector('[aria-current="step"]')?.textContent;
  const tabs = () => screen.queryByRole("navigation", { name: "Đăng nhập hoặc đăng ký" });

  it("asks only for username and email on step 1 with the five-stage rail, tabs and the Google button under Tiếp tục", () => {
    const { container } = renderRegister();

    expect(container.querySelector("#username")).not.toBeNull();
    expect(container.querySelector("#email")).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByText("Bước 1/5")).toBeTruthy();
    expect(currentStage()).toBe("Tài khoản");
    expect(screen.getByRole("list", { name: "Tiến trình đăng ký" }).querySelectorAll("li")).toHaveLength(5);
    expect(tabs()).not.toBeNull();
    const next = screen.getByRole("button", { name: "Tiếp tục" });
    const google = screen.getByRole("button", { name: "Tiếp tục với Google" });
    expect(google.getAttribute("type")).toBe("button");
    expect(next.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the 16+ consent line with links to the terms and privacy policy on step 1, without a checkbox", () => {
    const { container } = renderRegister();

    expect(screen.getByText(CONSENT_TEXT)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Điều khoản sử dụng" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Chính sách quyền riêng tư" }).getAttribute("href")).toBe("/privacy");
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    const google = screen.getByRole("button", { name: "Tiếp tục với Google" });
    const consent = screen.getByText(CONSENT_TEXT);
    expect(google.compareDocumentPosition(consent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("posts every step form so a pre-hydration submit keeps values out of the URL (G10)", () => {
    mocks.pathname = "/register";
    const html = renderToString(
      <AuthShell lastSignInMethod={null}>
        <RegisterPage />
      </AuthShell>,
    );
    const forms = html.match(/<form[^>]*>/g) ?? [];
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) expect(form).toContain('method="post"');
  });

  it("validates only the current step, keeps errors beside the fields and focuses the first invalid field (AC8)", async () => {
    const { container } = renderRegister();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

    expect(await screen.findByText("Tên tài khoản phải từ 3 ký tự trở lên")).toBeTruthy();
    expect(screen.getByText("Email này không đúng định dạng")).toBeTruthy();
    expect(container.querySelector("#username")?.getAttribute("aria-describedby")).toContain("username-error");
    await waitFor(() => expect(document.activeElement?.id).toBe("username"));
    expect(container.querySelector("#phone")).toBeNull();
  });

  it("moves forward with Enter, focuses the new step title, hides the tabs and Google, and keeps values on Quay lại", async () => {
    const { container } = renderRegister();
    fillById(container, "username", "learner01");
    fillById(container, "email", "learner@example.com");

    fireEvent.submit(container.querySelector("#username")!.closest("form")!);

    await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
    expect(document.activeElement?.textContent).toBe("Thông tin của bạn");
    expect(currentStage()).toBe("Thông tin");
    expect(screen.getByRole("list", { name: "Tiến trình đăng ký" }).querySelector("li")?.textContent).toBe("Tài khoản, đã xong");
    expect(tabs()).toBeNull();
    expect(screen.queryByText(/Google/)).toBeNull();
    expect(screen.queryByText(CONSENT_TEXT)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(container.querySelector("#username")).not.toBeNull());
    expect(container.querySelector<HTMLInputElement>("#username")?.value).toBe("learner01");
    expect(container.querySelector<HTMLInputElement>("#email")?.value).toBe("learner@example.com");
  });

  it("names the date-of-birth button with its label and value", async () => {
    const { container } = renderRegister();
    fillById(container, "username", "learner01");
    fillById(container, "email", "learner@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(container.querySelector("#dob")).not.toBeNull());

    expect(screen.getByRole("button", { name: "Ngày sinh Chọn ngày sinh" }).id).toBe("dob");
  });

  it("shows the check-email stage after a neutral result and can reopen the form with the same data and avatar (AC9)", async () => {
    mocks.signUpUser.mockResolvedValue({ success: true, needsEmailConfirmation: true });
    const { container } = renderRegister();
    const avatar = new File(["avatar"], "avatar.png", { type: "image/png" });

    await completeRegistration(container, avatar);

    expect(await screen.findByText("Kiểm tra email của bạn")).toBeTruthy();
    expect(screen.getByText("learner@example.com")).toBeTruthy();
    expect(currentStage()).toBe("Xác minh");
    expect(screen.getByText("Bước 4/5")).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Kiểm tra email của bạn"));
    expect(screen.getByRole("button", { name: "Gửi lại email" })).toBeTruthy();
    expect(screen.queryByText(/Google/)).toBeNull();
    expect(screen.queryByText(CONSENT_TEXT)).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
    const firstSubmission = submittedFields(0);
    expect(firstSubmission).not.toHaveProperty("password");

    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin đăng ký" }));
    await waitFor(() => expect(container.querySelector("#username")).not.toBeNull());
    expect(container.querySelector<HTMLInputElement>("#username")?.value).toBe("learner01");
    expect(container.querySelector<HTMLInputElement>("#email")?.value).toBe("learner@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(await screen.findByRole("img", { name: "Ảnh đại diện đã chọn" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    await waitFor(() => expect(mocks.signUpUser).toHaveBeenCalledTimes(2));
    expect(submittedFields(1)).toEqual(firstSubmission);
    const submittedAvatar = (call: number) => (mocks.signUpUser.mock.calls[call][0] as FormData).get("avatar");
    expect(submittedAvatar(0)).toBe(avatar);
    expect(submittedAvatar(1)).toBe(avatar);
    expect(await screen.findByText("Kiểm tra email của bạn")).toBeTruthy();
  });

  it("keeps the form and shows the server error inline when the action returns an error (AC8)", async () => {
    mocks.signUpUser.mockResolvedValue({ error: "Username đã được dùng, hãy thử username khác." });
    const { container } = renderRegister();

    await completeRegistration(container);

    expect((await screen.findByRole("alert")).textContent).toBe("Username đã được dùng, hãy thử username khác.");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.queryByText("Kiểm tra email của bạn")).toBeNull();
    expect(screen.getByRole("button", { name: "Tạo tài khoản" }).hasAttribute("disabled")).toBe(false);
  });

  it("does not submit twice while sign-up is pending", async () => {
    mocks.signUpUser.mockReturnValue(new Promise(() => {}));
    const { container } = renderRegister();

    await completeRegistration(container);

    const pending = await screen.findByRole("button", { name: "Đang tạo tài khoản…" });
    expect(pending.hasAttribute("disabled")).toBe(true);
    await act(async () => { fireEvent.submit(pending.closest("form")!); });
    expect(mocks.signUpUser).toHaveBeenCalledTimes(1);
  });

  it("removes a chosen avatar with Bỏ ảnh", async () => {
    const { container } = renderRegister();
    fillById(container, "username", "learner01");
    fillById(container, "email", "learner@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
    fillById(container, "phone", "0912345678");
    fillById(container, "full_name", "Nguyễn Văn A");
    fireEvent.click(container.querySelector("#dob")!);
    const grid = await screen.findByRole("grid");
    fireEvent.click(within(grid).getAllByRole("button").find((button) => !button.hasAttribute("disabled"))!);
    fireEvent.click(screen.getByRole("radio", { name: "Khác" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await screen.findByRole("button", { name: "Tạo tài khoản" });

    fireEvent.change(container.querySelector("#avatar-upload")!, {
      target: { files: [new File(["a"], "a.png", { type: "image/png" })] },
    });
    expect(screen.getByText("Đổi ảnh")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ ảnh" }));
    expect(screen.queryByRole("img", { name: "Ảnh đại diện đã chọn" })).toBeNull();
    expect(screen.getByText("Chọn ảnh")).toBeTruthy();
    const fileInput = container.querySelector<HTMLInputElement>("#avatar-upload")!;
    expect(fileInput.value).toBe("");
    expect(document.activeElement).toBe(fileInput);
  });
});

describe("CheckEmailPanel", () => {
  it("resends with the shown email, shows the neutral message inline and locks for 60 seconds after every click", async () => {
    vi.useFakeTimers();
    render(<CheckEmailPanel email="learner@example.com" onEditForm={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gửi lại email" }));
    });

    expect(mocks.resendSignupConfirmation).toHaveBeenCalledWith("learner@example.com");
    expect(screen.getByRole("status").textContent).toBe(RESEND_MESSAGE);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    const locked = screen.getByRole("button", { name: "Gửi lại email (60s)" });
    expect(locked.hasAttribute("disabled")).toBe(true);

    for (let second = 0; second < 59; second += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(screen.getByRole("button", { name: "Gửi lại email (1s)" }).hasAttribute("disabled")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const unlocked = screen.getByRole("button", { name: "Gửi lại email" });
    expect(unlocked.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      fireEvent.click(unlocked);
    });
    expect(mocks.resendSignupConfirmation).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Gửi lại email (60s)" }).hasAttribute("disabled")).toBe(true);
  });

  it("locks the button while the request is pending", async () => {
    mocks.resendSignupConfirmation.mockReturnValue(new Promise(() => {}));
    render(<CheckEmailPanel email="learner@example.com" onEditForm={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Gửi lại email" }));

    const pending = await screen.findByRole("button", { name: "Đang gửi…" });
    expect(pending.hasAttribute("disabled")).toBe(true);
  });

  it("keeps the cooldown and shows the fixed message inline when the request throws", async () => {
    vi.useFakeTimers();
    mocks.resendSignupConfirmation.mockRejectedValue(new Error("network"));
    render(<CheckEmailPanel email="learner@example.com" onEditForm={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gửi lại email" }));
    });

    expect(screen.getByRole("alert").textContent).toBe("Chưa gửi lại được email, vui lòng thử lại sau.");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Gửi lại email (60s)" })).toBeTruthy();
  });

  it("calls onEditForm from Sửa thông tin đăng ký", () => {
    const onEditForm = vi.fn();
    render(<CheckEmailPanel email="learner@example.com" onEditForm={onEditForm} />);

    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin đăng ký" }));

    expect(onEditForm).toHaveBeenCalledTimes(1);
  });

  it("offers an inbox link only for a known provider (AC5, AC9)", () => {
    const { unmount } = render(<CheckEmailPanel email="learner@gmail.com" onEditForm={vi.fn()} />);
    const link = screen.getByRole("link", { name: "Mở Gmail" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    unmount();

    render(<CheckEmailPanel email="learner@example.com" onEditForm={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /^Mở / })).toBeNull();
  });
});

function renderInShell(ui: React.ReactElement, lastSignInMethod: "email" | "google" | null = null) {
  return render(<AuthShell lastSignInMethod={lastSignInMethod}>{ui}</AuthShell>);
}

describe("/login", () => {
  it("labels the fields in Vietnamese and orders sign-in, Google and the forgot-password link (G9)", () => {
    mocks.pathname = "/login";
    renderInShell(<LoginPage />);

    expect(screen.getByLabelText("Email").getAttribute("type")).toBe("email");
    expect(screen.getByLabelText("Mật khẩu").getAttribute("type")).toBe("password");
    const signIn = screen.getByRole("button", { name: "Đăng nhập" });
    expect(signIn.getAttribute("type")).toBe("submit");
    const google = screen.getByRole("button", { name: "Tiếp tục với Google" });
    expect(google.getAttribute("type")).toBe("button");
    expect(signIn.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quên mật khẩu?" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("shows the login and register tabs with the current route marked", () => {
    mocks.pathname = "/login";
    renderInShell(<LoginPage />);

    const nav = screen.getByRole("navigation", { name: "Đăng nhập hoặc đăng ký" });
    expect(within(nav).getByRole("link", { name: "Đăng nhập" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Đăng ký" }).getAttribute("href")).toBe("/register");
    expect(within(nav).getByRole("link", { name: "Đăng ký" }).hasAttribute("aria-current")).toBe(false);
  });

  it("posts the form instead of the GET default so a pre-hydration submit keeps the password out of the URL (G10)", () => {
    const html = renderToString(
      <AuthShell lastSignInMethod={null}>
        <LoginPage />
      </AuthShell>,
    );
    const form = html.match(/<form[^>]*>/)?.[0] ?? "";
    expect(form).toContain('method="post"');
    expect(form).not.toContain("action=");
  });

  it("shows the 16+ consent line with links to the terms and privacy policy under the Google button, without a checkbox", () => {
    const { container } = renderInShell(<LoginPage />);

    const consent = screen.getByText(CONSENT_TEXT);
    expect(screen.getByRole("link", { name: "Điều khoản sử dụng" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Chính sách quyền riêng tư" }).getAttribute("href")).toBe("/privacy");
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    const google = screen.getByRole("button", { name: "Tiếp tục với Google" });
    expect(google.compareDocumentPosition(consent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("moves the Google button above the email form with a last-used tag when Google was used last (AC6)", () => {
    renderInShell(<LoginPage />, "google");

    const google = screen.getByRole("button", { name: /^Tiếp tục với Google\s*Lần trước$/ });
    const email = screen.getByLabelText("Email");
    expect(google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("hoặc dùng email")).toBeTruthy();
    expect(screen.getAllByText("Lần trước")).toHaveLength(1);
  });

  it("tags the email field and keeps Google below the form when email was used last (AC6)", () => {
    renderInShell(<LoginPage />, "email");

    const google = screen.getByRole("button", { name: "Tiếp tục với Google" });
    const signIn = screen.getByRole("button", { name: "Đăng nhập" });
    expect(signIn.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText("Lần trước")).toHaveLength(1);
    expect(screen.queryByText("hoặc dùng email")).toBeNull();
  });

  it("toggles password visibility with a pressed state and a Vietnamese name (AC4)", () => {
    renderInShell(<LoginPage />);
    const password = screen.getByLabelText("Mật khẩu");

    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(password.getAttribute("type")).toBe("text");
    const hide = screen.getByRole("button", { name: "Ẩn mật khẩu" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(hide);
    expect(password.getAttribute("type")).toBe("password");
    expect(screen.getByRole("button", { name: "Hiện mật khẩu" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("warns while Caps Lock is on and hides the warning on blur (AC4)", () => {
    renderInShell(<LoginPage />);
    const password = screen.getByLabelText("Mật khẩu");

    fireEvent.keyUp(password, { key: "A", modifierCapsLock: true });
    expect(screen.getByText("Caps Lock đang bật")).toBeTruthy();
    expect(password.getAttribute("aria-describedby")).toContain("login-password-caps");

    fireEvent.keyUp(password, { key: "a", modifierCapsLock: false });
    expect(screen.queryByText("Caps Lock đang bật")).toBeNull();

    fireEvent.keyUp(password, { key: "A", modifierCapsLock: true });
    fireEvent.blur(password);
    expect(screen.queryByText("Caps Lock đang bật")).toBeNull();
  });

  it("turns the flashcard away while the password field has focus (AC12)", () => {
    const { container } = renderInShell(<LoginPage />);
    const flipped = () => container.querySelector('[class*="preserve-3d"]')?.className.includes("rotateY(180deg)");

    expect(flipped()).toBe(false);
    fireEvent.focus(screen.getByLabelText("Mật khẩu"));
    expect(flipped()).toBe(true);
    fireEvent.blur(screen.getByLabelText("Mật khẩu"));
    expect(flipped()).toBe(false);
  });

  it("suggests a likely email domain on blur and applies it only when asked (AC5)", async () => {
    renderInShell(<LoginPage />);
    const email = screen.getByLabelText("Email") as HTMLInputElement;

    fireEvent.change(email, { target: { value: "lan@gmial.com" } });
    fireEvent.blur(email);
    expect(await screen.findByText("lan@gmail.com")).toBeTruthy();
    expect(email.value).toBe("lan@gmial.com");

    fireEvent.click(screen.getByRole("button", { name: "Dùng địa chỉ này" }));
    expect(email.value).toBe("lan@gmail.com");
    expect(screen.queryByRole("button", { name: "Dùng địa chỉ này" })).toBeNull();
  });

  it("shows a failed sign-in inline, keeps both values and selects the password (AC3)", async () => {
    mocks.signInUser.mockResolvedValue({ error: "Sai email hoặc mật khẩu!" });
    renderInShell(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "wrong-pass" } });

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Sai email hoặc mật khẩu!");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("lan@example.com");
    expect((screen.getByLabelText("Mật khẩu") as HTMLInputElement).value).toBe("wrong-pass");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Mật khẩu")));
    expect(screen.getByRole("button", { name: "Đăng nhập" }).hasAttribute("disabled")).toBe(false);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("shows a connection message, not a wrong-password message, when the sign-in request fails in transit", async () => {
    mocks.signInUser.mockRejectedValue(new TypeError("Failed to fetch"));
    renderInShell(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "abc123" } });

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.");
    expect(screen.queryByText("Sai email hoặc mật khẩu!")).toBeNull();
    const password = screen.getByLabelText("Mật khẩu") as HTMLInputElement;
    expect(password.value).toBe("abc123");
    await waitFor(() => expect(document.activeElement).toBe(password));
    // Không bôi đen mật khẩu như khi sai thông tin: Enter là thử lại ngay.
    expect(password.selectionEnd! - password.selectionStart!).toBe(0);
    expect(screen.getByRole("button", { name: "Đăng nhập" }).hasAttribute("disabled")).toBe(false);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("navigates at once to the server-validated destination after a successful sign-in (AC3, AC7)", async () => {
    mocks.signInUser.mockResolvedValue({ success: true, redirectTo: "/profile/orders" });
    renderInShell(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "abc123" } });

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("button", { name: "Đã đăng nhập" })).toBeTruthy();
    expect(mocks.replace).toHaveBeenCalledWith("/profile/orders");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    const formData = mocks.signInUser.mock.calls[0][0] as FormData;
    expect([...formData.keys()]).toEqual(["email", "password"]);
  });

  it("does not submit twice while the first sign-in is pending", async () => {
    mocks.signInUser.mockReturnValue(new Promise(() => {}));
    const { container } = renderInShell(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "abc123" } });

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    const pending = await screen.findByRole("button", { name: "Đang đăng nhập…" });
    expect(pending.hasAttribute("disabled")).toBe(true);
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(mocks.signInUser).toHaveBeenCalledTimes(1);
  });

  it("shows only the fixed recovery message for auth_error=recovery", async () => {
    mocks.searchParams = new URLSearchParams("auth_error=recovery");
    renderInShell(<LoginPage />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Bạn có thể gửi lại link mới.",
    );
  });

  it("shows the fixed message for auth_error=oauth", async () => {
    mocks.searchParams = new URLSearchParams("auth_error=oauth");
    renderInShell(<LoginPage />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Đăng nhập Google không thành công. Bạn có thể thử lại hoặc đăng nhập bằng email.",
    );
  });

  it("shows the fixed message for auth_error=confirm", async () => {
    mocks.searchParams = new URLSearchParams("auth_error=confirm");
    renderInShell(<LoginPage />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Link xác minh không hợp lệ hoặc đã hết hạn",
    );
  });

  it("shows a non-error sign-in notice for reason=signin_required", async () => {
    mocks.searchParams = new URLSearchParams("reason=signin_required");
    renderInShell(<LoginPage />);

    expect((await screen.findByRole("status")).textContent).toBe("Vui lòng đăng nhập để tiếp tục.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows both the sign-in notice and the fixed auth_error message when both parameters are present", async () => {
    mocks.searchParams = new URLSearchParams("reason=signin_required&auth_error=oauth");
    renderInShell(<LoginPage />);

    expect((await screen.findByRole("status")).textContent).toBe("Vui lòng đăng nhập để tiếp tục.");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Đăng nhập Google không thành công. Bạn có thể thử lại hoặc đăng nhập bằng email.",
    );
  });

  it.each([
    "",
    "reason=other",
    "reason=<b>boom</b>",
    "reason=__proto__",
    "reason=constructor",
    "reason=toString",
    "reason=SIGNIN_REQUIRED",
  ])("shows no sign-in notice for %j", (query) => {
    mocks.searchParams = new URLSearchParams(query);
    renderInShell(<LoginPage />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/boom|Vui lòng đăng nhập/)).toBeNull();
  });

  it.each([
    "",
    "auth_error=<b>boom</b>",
    "auth_error=__proto__",
    "auth_error=constructor",
    "auth_error=toString",
  ])("shows no message for %j", (query) => {
    mocks.searchParams = new URLSearchParams(query);
    renderInShell(<LoginPage />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/boom/)).toBeNull();
  });
});

describe("/forgot-password", () => {
  const message = "Đã gửi yêu cầu! Bạn kiểm tra hộp thư (cả mục Spam) trong vài phút nhé.";
  function submit(email = "learner@example.com") {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi link đặt lại" }));
  }

  beforeEach(() => {
    mocks.pathname = "/forgot-password";
  });

  it("blocks malformed email with a field error and provides the login link", async () => {
    renderInShell(<ForgotPasswordPage />);
    submit("nope");
    expect(await screen.findByText("Email này không đúng định dạng")).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Email").getAttribute("aria-describedby")).toContain("recovery-email-error");
    expect(mocks.requestPasswordRecovery).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Quay lại đăng nhập" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("navigation", { name: "Đăng nhập hoặc đăng ký" })).toBeNull();
  });

  it("posts the form so a pre-hydration submit keeps the email out of the URL (G10)", () => {
    const html = renderToString(
      <AuthShell lastSignInMethod={null}>
        <ForgotPasswordPage />
      </AuthShell>,
    );
    expect(html.match(/<form[^>]*>/)?.[0]).toContain('method="post"');
  });

  it.each(["success", "provider_error", "transport_error"])(
    "shows the identical inline notice, preserves input and locks for 60 seconds on %s",
    async (outcome) => {
      vi.useFakeTimers();
      if (outcome === "transport_error") mocks.requestPasswordRecovery.mockRejectedValue(new Error("network"));
      else mocks.requestPasswordRecovery.mockResolvedValue(outcome === "success" ? { success: true, message } : { error: "raw provider error" });
      const { container } = renderInShell(<ForgotPasswordPage />);
      await act(async () => { submit(); });
      expect(mocks.requestPasswordRecovery).toHaveBeenCalledWith("learner@example.com");
      expect(screen.getByRole("status").textContent).toBe(message);
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(screen.queryByText(/raw provider error/)).toBeNull();
      expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("learner@example.com");
      expect(screen.getByRole("button", { name: "Gửi lại link (60s)" }).hasAttribute("disabled")).toBe(true);
      await act(async () => { fireEvent.submit(container.querySelector("form")!); });
      expect(mocks.requestPasswordRecovery).toHaveBeenCalledTimes(1);
      for (let second = 0; second < 60; second++) act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.getByRole("button", { name: "Gửi lại link" }).hasAttribute("disabled")).toBe(false);
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gửi lại link" })); });
      expect(mocks.requestPasswordRecovery).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Gửi lại link (60s)" }).hasAttribute("disabled")).toBe(true);
    },
  );

  it("offers an inbox link only for a known provider (AC5, AC10)", async () => {
    mocks.requestPasswordRecovery.mockResolvedValue({ success: true, message });
    renderInShell(<ForgotPasswordPage />);
    await act(async () => { submit("lan@gmail.com"); });

    const link = screen.getByRole("link", { name: "Mở Gmail" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("shows no inbox link for an unknown provider", async () => {
    mocks.requestPasswordRecovery.mockResolvedValue({ success: true, message });
    renderInShell(<ForgotPasswordPage />);
    await act(async () => { submit("lan@company.vn"); });

    expect(screen.getByRole("status").textContent).toBe(message);
    expect(screen.queryByRole("link", { name: /^Mở / })).toBeNull();
  });

  it("prevents duplicate submit while waiting even after cooldown expires", async () => {
    vi.useFakeTimers();
    let finish: (value: unknown) => void = () => {};
    mocks.requestPasswordRecovery.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { container } = renderInShell(<ForgotPasswordPage />);
    await act(async () => { submit(); });
    expect(screen.getByRole("button", { name: "Đang gửi…" }).hasAttribute("disabled")).toBe(true);
    for (let second = 0; second < 60; second++) act(() => { vi.advanceTimersByTime(1000); });
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(mocks.requestPasswordRecovery).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ success: true, message }); });
    expect(screen.getByRole("status").textContent).toBe(message);
    expect(screen.getByRole("button", { name: "Gửi lại link" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("SetPasswordForm", () => {
  function fill(password: string, confirmPassword: string) {
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu"), { target: { value: confirmPassword } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
  }

  it("shows the two-stage rail and neutral copy for every flow that reaches it (AC11)", () => {
    render(<SetPasswordForm />);

    expect(screen.getByText("Bước 2/2")).toBeTruthy();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toBe("Đặt mật khẩu");
    expect(screen.getByRole("list", { name: "Tiến trình đặt mật khẩu" }).querySelector("li")?.textContent).toBe("Xác minh email, đã xong");
    expect(screen.getByRole("heading", { level: 1, name: "Đặt mật khẩu" })).toBeTruthy();
  });

  it("posts the form so a pre-hydration submit keeps the password out of the URL (G10)", () => {
    expect(renderToString(<SetPasswordForm />).match(/<form[^>]*>/)?.[0]).toContain('method="post"');
  });

  it("follows the typed password with the strength meter and announces a match (AC4)", () => {
    render(<SetPasswordForm />);
    const password = screen.getByLabelText("Mật khẩu mới");
    const confirm = screen.getByLabelText("Nhập lại mật khẩu");

    fireEvent.change(password, { target: { value: "abc" } });
    expect(screen.getByText("Độ mạnh: Chưa đủ 6 ký tự")).toBeTruthy();
    fireEvent.change(password, { target: { value: "abcdef" } });
    expect(screen.getByText("Độ mạnh: Yếu")).toBeTruthy();
    fireEvent.change(password, { target: { value: "abcDef#2026xy" } });
    expect(screen.getByText("Độ mạnh: Mạnh")).toBeTruthy();
    expect(password.getAttribute("aria-describedby")).toContain("new-password-strength");

    expect(screen.queryByText("Hai mật khẩu đã khớp")).toBeNull();
    fireEvent.change(confirm, { target: { value: "abcDef#2026xy" } });
    expect(screen.getByText("Hai mật khẩu đã khớp")).toBeTruthy();
    expect(confirm.getAttribute("aria-describedby")).toContain("confirm-new-password-match");
  });

  it("blocks a short or mismatched password before calling the action", async () => {
    render(<SetPasswordForm />);

    fill("abc12", "abc12");
    expect(await screen.findByText("Mật khẩu ít nhất 6 ký tự cho an toàn")).toBeTruthy();

    fill("abc123", "abc124");
    expect(await screen.findByText("Mật khẩu xác nhận không khớp")).toBeTruthy();
    expect(screen.getByLabelText("Nhập lại mật khẩu").getAttribute("aria-invalid")).toBe("true");
    expect(mocks.setPasswordAfterConfirmation).not.toHaveBeenCalled();
  });

  it("shows the pending state, then the server error inline and stays retryable", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    mocks.setPasswordAfterConfirmation.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    render(<SetPasswordForm />);

    fill("abc123", "abc123");

    const pending = await screen.findByRole("button", { name: "Đang lưu…" });
    expect(pending.hasAttribute("disabled")).toBe(true);
    const formData = mocks.setPasswordAfterConfirmation.mock.calls[0][0] as FormData;
    expect(formData.get("password")).toBe("abc123");
    expect(formData.get("confirmPassword")).toBe("abc123");

    await act(async () => {
      resolveAction({ error: "Chưa đặt được mật khẩu, vui lòng thử lại." });
    });

    expect(screen.getByRole("alert").textContent).toBe("Chưa đặt được mật khẩu, vui lòng thử lại.");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Lưu mật khẩu" }).hasAttribute("disabled")).toBe(false);
  });

  it("unlocks with the fixed message when the request itself fails, then can submit again", async () => {
    mocks.setPasswordAfterConfirmation.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<SetPasswordForm />);

    fill("abc123", "abc123");

    expect((await screen.findByRole("alert")).textContent).toBe("Chưa đặt được mật khẩu, vui lòng thử lại.");
    const retry = screen.getByRole("button", { name: "Lưu mật khẩu" });
    expect(retry.hasAttribute("disabled")).toBe(false);
    expect((screen.getByLabelText("Mật khẩu mới") as HTMLInputElement).value).toBe("abc123");

    mocks.setPasswordAfterConfirmation.mockResolvedValueOnce(undefined);
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.setPasswordAfterConfirmation).toHaveBeenCalledTimes(2));
  });
});
