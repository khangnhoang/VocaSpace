// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/(client)/register/page";
import LoginPage from "@/app/(client)/login/page";
import { CheckEmailPanel } from "@/app/(client)/register/_components/CheckEmailPanel";
import { SetPasswordForm } from "@/app/auth/set-password/_components/SetPasswordForm";

const mocks = vi.hoisted(() => ({
  signUpUser: vi.fn(),
  signInUser: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  setPasswordAfterConfirmation: vi.fn(),
  searchParams: new URLSearchParams(),
  push: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  signUpUser: mocks.signUpUser,
  signInUser: mocks.signInUser,
  resendSignupConfirmation: mocks.resendSignupConfirmation,
  setPasswordAfterConfirmation: mocks.setPasswordAfterConfirmation,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => mocks.searchParams,
  unstable_rethrow: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

// Test plan:
// - Mục tiêu: kiểm tra UI đăng ký A1 — form không có mật khẩu, màn "kiểm tra email", gửi lại có cooldown,
//   trang đăng nhập báo link xác minh lỗi, và form đặt mật khẩu sau xác minh.
// - Loại test: component interaction trong jsdom (RTL), server action được mock.
// - Đối tượng: /register page, CheckEmailPanel, /login page, SetPasswordForm.
// - Case thành công: đăng ký xong hiện email đã nhập + 3 lối đi; "Gửi lại form đăng ký" mở lại form với dữ liệu cũ và
//   gửi lại đúng dữ liệu, kể cả file avatar; gửi lại email hiện thông điệp trung tính bằng toast.
// - Case thất bại: action trả lỗi → toast, vẫn ở form; mật khẩu ngắn/không khớp chặn submit; lỗi server hiện toast;
//   request đặt mật khẩu bị lỗi mạng → toast cố định, nút mở lại và gửi lại được.
// - Bảo mật/phân quyền: không có ô mật khẩu khi đăng ký (G8); không có nút Google (Decision 8); login chỉ hiện
//   thông điệp cố định cho `auth_error=confirm` (không phản chiếu giá trị query, kể cả `__proto__`/`constructor`).
// - Ổn định/resilience: nút gửi lại bị khóa 60 giây sau mỗi lần bấm, kể cả khi đang chờ server.
// - Invariant cần giữ: nhãn login "Email", "Password", "Sign in" không đổi (G9, smoke E2E dựa vào chúng).
// - Kết quả verify gần nhất: passed (18 test) bằng `npx vitest run __tests__/components/auth-onboarding.test.tsx`.

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
URL.createObjectURL = vi.fn(() => "blob:avatar-preview");

const RESEND_MESSAGE = "Mail xác minh mới sẽ tới trong vài phút, bạn kiểm tra cả mục Spam nhé!";

function fillById(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Missing input #${id}`);
  fireEvent.change(input, { target: { value } });
}

async function completeRegistration(container: HTMLElement, avatar?: File) {
  fillById(container, "username", "learner01");
  fillById(container, "email", "learner@example.com");
  fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/ }));

  await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
  fillById(container, "phone", "0912345678");
  fillById(container, "full_name", "Nguyễn Văn A");

  fireEvent.click(screen.getByRole("button", { name: /Chọn ngày sinh/ }));
  const grid = await screen.findByRole("grid");
  const day = within(grid)
    .getAllByRole("button")
    .find((button) => !button.hasAttribute("disabled"));
  if (!day) throw new Error("No selectable day");
  fireEvent.click(day);

  // Lịch có dropdown tháng/năm cũng là combobox, nên chọn đúng trigger giới tính theo placeholder.
  const genderTrigger = screen.getByText("Chọn giới tính").closest("button");
  if (!genderTrigger) throw new Error("Missing gender trigger");
  fireEvent.click(genderTrigger);
  fireEvent.click(await screen.findByRole("option", { name: "Nam" }));

  fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/ }));
  const submit = await screen.findByRole("button", { name: "Hoàn tất Đăng ký" });
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
  mocks.resendSignupConfirmation.mockResolvedValue({ success: true, message: RESEND_MESSAGE });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("/register", () => {
  it("asks only for username and email on step 1 and has no Google button", () => {
    const { container } = render(<RegisterPage />);

    expect(container.querySelector("#username")).not.toBeNull();
    expect(container.querySelector("#email")).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByText(/Google/)).toBeNull();
  });

  it("shows the check-email screen after a neutral result and can reopen the form with the same data", async () => {
    mocks.signUpUser.mockResolvedValue({ success: true, needsEmailConfirmation: true });
    const { container } = render(<RegisterPage />);
    const avatar = new File(["avatar"], "avatar.png", { type: "image/png" });

    await completeRegistration(container, avatar);

    expect(await screen.findByText("Kiểm tra email của bạn")).toBeTruthy();
    expect(screen.getByText("learner@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gửi lại email" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByText(/Google/)).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
    const firstSubmission = submittedFields(0);
    expect(firstSubmission).not.toHaveProperty("password");

    fireEvent.click(screen.getByRole("button", { name: "Gửi lại form đăng ký" }));
    await waitFor(() => expect(container.querySelector("#username")).not.toBeNull());
    expect(container.querySelector<HTMLInputElement>("#username")?.value).toBe("learner01");
    expect(container.querySelector<HTMLInputElement>("#email")?.value).toBe("learner@example.com");

    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/ }));
    await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Hoàn tất Đăng ký" }));

    await waitFor(() => expect(mocks.signUpUser).toHaveBeenCalledTimes(2));
    expect(submittedFields(1)).toEqual(firstSubmission);
    const submittedAvatar = (call: number) => (mocks.signUpUser.mock.calls[call][0] as FormData).get("avatar");
    expect(submittedAvatar(0)).toBe(avatar);
    expect(submittedAvatar(1)).toBe(avatar);
    expect(await screen.findByText("Kiểm tra email của bạn")).toBeTruthy();
  });

  it("keeps the form and shows a toast when the action returns an error", async () => {
    mocks.signUpUser.mockResolvedValue({ error: "Username đã được dùng, hãy thử username khác." });
    const { container } = render(<RegisterPage />);

    await completeRegistration(container);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Username đã được dùng, hãy thử username khác."),
    );
    expect(screen.queryByText("Kiểm tra email của bạn")).toBeNull();
    expect(screen.getByRole("button", { name: "Hoàn tất Đăng ký" })).toBeTruthy();
  });
});

describe("CheckEmailPanel", () => {
  it("resends with the shown email, shows the neutral message and locks for 60 seconds after every click", async () => {
    vi.useFakeTimers();
    render(<CheckEmailPanel email="learner@example.com" onEditForm={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gửi lại email" }));
    });

    expect(mocks.resendSignupConfirmation).toHaveBeenCalledWith("learner@example.com");
    expect(mocks.toastSuccess).toHaveBeenCalledWith(RESEND_MESSAGE);
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

    const pending = await screen.findByRole("button", { name: "Đang gửi..." });
    expect(pending.hasAttribute("disabled")).toBe(true);
  });

  it("unlocks after the cooldown and shows a toast when the request throws", async () => {
    vi.useFakeTimers();
    mocks.resendSignupConfirmation.mockRejectedValue(new Error("network"));
    render(<CheckEmailPanel email="learner@example.com" onEditForm={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gửi lại email" }));
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Chưa gửi lại được email, vui lòng thử lại sau.");
    expect(screen.getByRole("button", { name: "Gửi lại email (60s)" })).toBeTruthy();
  });

  it("calls onEditForm from the resend-form button", () => {
    const onEditForm = vi.fn();
    render(<CheckEmailPanel email="learner@example.com" onEditForm={onEditForm} />);

    fireEvent.click(screen.getByRole("button", { name: "Gửi lại form đăng ký" }));

    expect(onEditForm).toHaveBeenCalledTimes(1);
  });
});

describe("/login", () => {
  it("keeps the G9 labels and has no Google button", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByText(/Google/)).toBeNull();
  });

  it("shows the fixed message for auth_error=confirm", async () => {
    mocks.searchParams = new URLSearchParams("auth_error=confirm");
    render(<LoginPage />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Link xác minh không hợp lệ hoặc đã hết hạn",
    );
  });

  it.each([
    "",
    "auth_error=oauth",
    "auth_error=<b>boom</b>",
    "auth_error=__proto__",
    "auth_error=constructor",
    "auth_error=toString",
  ])("shows no message for %j", (query) => {
    mocks.searchParams = new URLSearchParams(query);
    render(<LoginPage />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/boom/)).toBeNull();
  });
});

describe("SetPasswordForm", () => {
  function fill(password: string, confirmPassword: string) {
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu"), { target: { value: confirmPassword } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
  }

  it("blocks a short or mismatched password before calling the action", async () => {
    render(<SetPasswordForm />);

    fill("abc12", "abc12");
    expect(await screen.findByText("Mật khẩu ít nhất 6 ký tự cho an toàn")).toBeTruthy();

    fill("abc123", "abc124");
    expect(await screen.findByText("Mật khẩu xác nhận không khớp")).toBeTruthy();
    expect(screen.getByLabelText("Nhập lại mật khẩu").getAttribute("aria-invalid")).toBe("true");
    expect(mocks.setPasswordAfterConfirmation).not.toHaveBeenCalled();
  });

  it("shows the pending state, then a toast on a server error and stays retryable", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    mocks.setPasswordAfterConfirmation.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    render(<SetPasswordForm />);

    fill("abc123", "abc123");

    const pending = await screen.findByRole("button", { name: "Đang lưu..." });
    expect(pending.hasAttribute("disabled")).toBe(true);
    const formData = mocks.setPasswordAfterConfirmation.mock.calls[0][0] as FormData;
    expect(formData.get("password")).toBe("abc123");
    expect(formData.get("confirmPassword")).toBe("abc123");

    await act(async () => {
      resolveAction({ error: "Chưa đặt được mật khẩu, vui lòng thử lại." });
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Chưa đặt được mật khẩu, vui lòng thử lại.");
    expect(screen.getByRole("button", { name: "Lưu mật khẩu" }).hasAttribute("disabled")).toBe(false);
  });

  it("unlocks with a fixed toast when the request itself fails, then can submit again", async () => {
    mocks.setPasswordAfterConfirmation.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<SetPasswordForm />);

    fill("abc123", "abc123");

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Chưa đặt được mật khẩu, vui lòng thử lại."),
    );
    const retry = screen.getByRole("button", { name: "Lưu mật khẩu" });
    expect(retry.hasAttribute("disabled")).toBe(false);
    expect((screen.getByLabelText("Mật khẩu mới") as HTMLInputElement).value).toBe("abc123");

    mocks.setPasswordAfterConfirmation.mockResolvedValueOnce(undefined);
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.setPasswordAfterConfirmation).toHaveBeenCalledTimes(2));
  });
});
