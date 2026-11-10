// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Test plan:
// - Mục tiêu: U3 AC13 — khi hệ điều hành bật giảm chuyển động, bước đăng ký mới hiện ngay (không mờ, không dịch) với
//   cùng tiêu đề, focus và nút; thẻ từ đổi mặt không có transition.
// - Loại test: component trong jsdom; Motion đọc `prefers-reduced-motion` một lần cho cả module nên file này stub
//   matchMedia trước khi import component.
// - Giới hạn: jsdom không tính CSS media query; lớp `motion-reduce:` của Tailwind được kiểm tra trên trình duyệt.

vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

vi.mock("@/app/actions/auth", () => ({
  signInUser: vi.fn(),
  signUpUser: vi.fn(),
  resendSignupConfirmation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/register",
}));

const { AuthShell } = await import("@/components/auth/auth-shell");
const { default: RegisterPage } = await import("@/app/(client)/(auth)/register/page");

describe("auth motion under reduced motion", () => {
  it("shows the next registration step at once with focus on its title (AC13)", async () => {
    const { container } = render(
      <AuthShell lastSignInMethod={null}>
        <RegisterPage />
      </AuthShell>,
    );

    fireEvent.change(container.querySelector("#username")!, { target: { value: "learner01" } });
    fireEvent.change(container.querySelector("#email")!, { target: { value: "learner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());

    const step = screen.getByRole("heading", { level: 1, name: "Thông tin của bạn" }).closest("section")!.parentElement!;
    expect(step.style.opacity === "" || step.style.opacity === "1").toBe(true);
    expect(step.style.transform === "" || step.style.transform === "none").toBe(true);
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Thông tin của bạn"));
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeTruthy();
  });
});
