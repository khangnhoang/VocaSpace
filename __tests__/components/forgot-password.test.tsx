// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ForgotPasswordPage from "@/app/(client)/forgot-password/page";

const { request, success } = vi.hoisted(() => ({ request: vi.fn(), success: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({ requestPasswordRecovery: request }));
vi.mock("sonner", () => ({ toast: { success } }));

// Test plan:
// - Mục tiêu: chặn gửi trùng, giữ cooldown và thông báo đồng nhất khi action lỗi.
// - Loại test: form thật trong jsdom, thay action và toast tại ranh giới.
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

  render(<ForgotPasswordPage />);
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
  const message = success.mock.calls[0][0];
  expect(message).toContain("Bạn kiểm tra hộp thư");
  expect((screen.getByRole("button", { name: /60s/ }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { fireEvent.submit(form); });
  expect(request).toHaveBeenCalledTimes(1);

  for (let seconds = 0; seconds < 60; seconds++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  }
  await act(async () => { fireEvent.submit(form); });
  expect(request).toHaveBeenCalledTimes(2);
  expect(success).toHaveBeenLastCalledWith(message);
});
