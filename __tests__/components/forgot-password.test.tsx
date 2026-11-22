// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@/__tests__/support/intl";
import { afterEach, expect, it, vi } from "vitest";
import { AuthShell } from "@/components/auth/auth-shell";
import ForgotPasswordPage from "@/app/(client)/(auth)/forgot-password/page";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({ requestPasswordRecovery: request }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/forgot-password",
}));

// Test plan:
// - Mục tiêu: chặn gửi trùng, giữ cooldown và thông báo đồng nhất khi action lỗi.
// - Loại test: form thật trong jsdom (trang U3 trong AuthShell), thay action tại ranh giới; thông báo là role=status
//   ngay trong trang (U3 AC10) thay cho toast của trang cũ.
// - Resilience: submit lại sau cooldown mà không gửi email thật.

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("deduplicates pending recovery and permits retry after a rejected request and cooldown", async () => {
  vi.useFakeTimers();
  let rejectRequest!: (error: Error) => void;
  request.mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
  request.mockResolvedValueOnce(undefined);

  render(
    <AuthShell lastSignInMethod={null}>
      <ForgotPasswordPage />
    </AuthShell>,
  );
  const email = screen.getByRole("textbox", { name: "Email" });
  fireEvent.change(email, { target: { value: "learner@example.test" } });
  const form = email.closest("form")!;
  await act(async () => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("learner@example.test");

  await act(async () => rejectRequest(new Error("network")));
  const message = screen.getByRole("status").textContent;
  expect(message).toContain("Bạn kiểm tra hộp thư");
  expect((screen.getByRole("button", { name: /60s/ }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { fireEvent.submit(form); });
  expect(request).toHaveBeenCalledTimes(1);

  for (let seconds = 0; seconds < 60; seconds++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  }
  await act(async () => { fireEvent.submit(form); });
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("status").textContent).toBe(message);
});
