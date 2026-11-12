// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthShell } from "@/components/auth/auth-shell";
import LoginPage from "@/app/(client)/(auth)/login/page";
import RegisterPage from "@/app/(client)/(auth)/register/page";

// Test plan:
// - Mục tiêu: U3 AC13/G10 — chuyển động không ẩn nội dung lúc server render, đường cong vẽ một lần khi khung mount rồi
//   chỉ vẽ phần mới, và giảm chuyển động hiện ngay trạng thái cuối với cùng chữ, focus và thao tác.
// - Loại test: component trong jsdom (RTL) và renderToString; server action và router được mock.
// - Case: HTML server của /login có form và không có opacity:0; lần mount đầu mọi phần đường cong có hiệu ứng; sang bước 2
//   của /register chỉ đoạn và mốc mới có hiệu ứng mới, phần cũ giữ nguyên timing. Giảm chuyển động: auth-motion-reduced.test.tsx.
// - Giới hạn: jsdom không chạy CSS keyframes hay đo bố cục; nhịp và độ mượt kiểm tra trên trình duyệt (CP4).

const mocks = vi.hoisted(() => ({ pathname: "/login", reduce: false }));

vi.mock("@/app/actions/auth", () => ({
  signInUser: vi.fn(),
  signUpUser: vi.fn(),
  resendSignupConfirmation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mocks.pathname,
}));

function stubReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const part = (key: string) => document.querySelector(`[data-curve-part="${key}"]`);

beforeEach(() => {
  mocks.pathname = "/login";
  stubReducedMotion(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("auth motion", () => {
  it("renders the login form visible in the server HTML, with no element starting at opacity 0 (G10)", () => {
    const html = renderToString(
      <AuthShell lastSignInMethod={null}>
        <LoginPage />
      </AuthShell>,
    );

    expect(html).toContain("<form");
    expect(html).toContain("Chào mừng trở lại");
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });

  it("draws every part of the curve once when the shell first mounts (AC13)", () => {
    render(
      <AuthShell lastSignInMethod={null}>
        <LoginPage />
      </AuthShell>,
    );

    expect(part("node-0")?.getAttribute("data-curve-motion")).toBe("pop");
    expect(part("segment-0")?.getAttribute("data-curve-motion")).toBe("draw");
    expect(part("segment-4")?.getAttribute("data-curve-motion")).toBe("draw");
    expect(part("ghost")?.getAttribute("data-curve-motion")).toBe("fade");
    // Các đoạn nối tiếp nhau: đoạn sau bắt đầu muộn hơn đoạn trước.
    const delay = (key: string) => Number.parseInt((part(key) as SVGElement).style.getPropertyValue("--delay"), 10);
    expect(delay("segment-1")).toBeGreaterThan(delay("segment-0"));
  });

  it("only draws the new part of the curve when registration moves to the next stage (AC13)", async () => {
    mocks.pathname = "/register";
    const { container } = render(
      <AuthShell lastSignInMethod={null}>
        <RegisterPage />
      </AuthShell>,
    );
    const nodeZeroBefore = (part("node-0") as SVGElement).getAttribute("style");
    expect(part("segment-0")).toBeNull();

    fireEvent.change(container.querySelector("#username")!, { target: { value: "learner01" } });
    fireEvent.change(container.querySelector("#email")!, { target: { value: "learner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(container.querySelector("#phone")).not.toBeNull());

    expect((part("node-0") as SVGElement).getAttribute("style")).toBe(nodeZeroBefore);
    expect(part("segment-0")?.getAttribute("data-curve-motion")).toBe("draw");
    expect((part("segment-0") as SVGElement).style.getPropertyValue("--delay")).toBe("120ms");
    expect(part("node-1")?.getAttribute("data-curve-motion")).toBe("pop");
  });
});
