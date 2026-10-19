// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "@/app/(client)/profile/page";
import ProfileLayout from "@/app/(client)/profile/_components/profile-layout";

// Test plan:
// - Mục tiêu: bố cục /profile theo FEAT6 AC1-AC2 và G4 (một bản lịch sử tại một thời điểm, chỉ mount khi đã biết chiều rộng).
// - Loại test: component trong jsdom; matchMedia được điều khiển; hai Server Action và hai form con được mock.
// - Đối tượng: ProfilePage (đọc ?tab), ProfileLayout, ProfileSidebar, PaymentHistory.
// - Case thành công: từ 1024 px có cột lịch sử và không có tab "Thanh toán"; dưới 1024 px có tab thứ ba hiện đúng lịch sử;
//   ?tab=payments mở tab đó dưới lg và bị bỏ qua từ lg; đổi tab Hồ sơ/Bảo mật vẫn như cũ.
// - Case thất bại: giá trị tab lạ rơi về Hồ sơ cá nhân.
// - Bảo mật/phân quyền: không áp dụng ở tầng này.
// - Ổn định/resilience: hydration trên desktop với ?tab=payments chỉ đọc đúng một lần; đổi chiều rộng qua 1023/1024 px luôn còn đúng một bản.
// - Invariant cần giữ: không bao giờ có hai bản PaymentHistory cùng tồn tại hay cùng đọc.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/profile-layout.test.tsx`.

const mocks = vi.hoisted(() => ({
  getPaymentHistory: vi.fn(),
  getUserProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));

vi.mock("@/app/actions/payment-history", () => ({
  getPaymentHistory: mocks.getPaymentHistory,
}));
vi.mock("@/app/actions/profile", () => ({
  getUserProfile: mocks.getUserProfile,
  uploadAvatar: mocks.uploadAvatar,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(client)/profile/_components/edit-profile-form", () => ({
  default: () => <div>Form hồ sơ</div>,
}));
vi.mock("@/app/(client)/profile/_components/change-pwd-form", () => ({
  default: () => <div>Form mật khẩu</div>,
}));

type Listener = () => void;
let desktopListeners: Listener[] = [];
let isDesktopViewport = true;

function installMatchMedia() {
  desktopListeners = [];
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      get matches() {
        return query === "(min-width: 1024px)" ? isDesktopViewport : false;
      },
      media: query,
      addEventListener: (_event: string, listener: Listener) => {
        desktopListeners.push(listener);
      },
      removeEventListener: (_event: string, listener: Listener) => {
        desktopListeners = desktopListeners.filter((entry) => entry !== listener);
      },
    })),
  });
}

async function resizeTo(desktop: boolean) {
  isDesktopViewport = desktop;
  await act(async () => {
    for (const listener of [...desktopListeners]) listener();
  });
}

const historyHeadings = () =>
  screen.queryAllByRole("heading", { name: "Lịch sử thanh toán" });

describe("profile layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMatchMedia();
    mocks.getUserProfile.mockResolvedValue({
      data: { id: "u1", full_name: "Học viên A", role: "student", avatar_url: null },
    });
    mocks.getPaymentHistory.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 10 },
    });
  });
  afterEach(() => {
    cleanup();
  });

  it("shows the history column and no Thanh toán tab from 1024 px, with the profile tab open", async () => {
    isDesktopViewport = true;

    render(<ProfileLayout initialTab="profile" />);

    await waitFor(() => expect(historyHeadings()).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Thanh toán" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Hồ sơ cá nhân" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(await screen.findByText("Form hồ sơ")).toBeTruthy();
    expect(mocks.getPaymentHistory).toHaveBeenCalledTimes(1);
  });

  it("ignores ?tab=payments from 1024 px and opens the profile tab", async () => {
    isDesktopViewport = true;

    render(await ProfilePage({ searchParams: Promise.resolve({ tab: "payments" }) }));

    await waitFor(() => expect(historyHeadings()).toHaveLength(1));
    expect(
      screen.getByRole("button", { name: "Hồ sơ cá nhân" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(await screen.findByText("Form hồ sơ")).toBeTruthy();
  });

  it("adds a third Thanh toán tab below 1024 px that shows the same history and no right column", async () => {
    isDesktopViewport = false;

    render(<ProfileLayout initialTab="profile" />);

    const tab = await screen.findByRole("button", { name: "Thanh toán" });
    expect(historyHeadings()).toHaveLength(0);
    expect(mocks.getPaymentHistory).not.toHaveBeenCalled();

    fireEvent.click(tab);

    await waitFor(() => expect(historyHeadings()).toHaveLength(1));
    expect(tab.getAttribute("aria-current")).toBe("true");
    expect(mocks.getPaymentHistory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Bảo mật" }));
    expect(await screen.findByText("Form mật khẩu")).toBeTruthy();
    expect(historyHeadings()).toHaveLength(0);
  });

  it("opens the Thanh toán tab below 1024 px for ?tab=payments and falls back to Hồ sơ cá nhân for an unknown tab", async () => {
    isDesktopViewport = false;

    render(await ProfilePage({ searchParams: Promise.resolve({ tab: "payments" }) }));
    await waitFor(() => expect(historyHeadings()).toHaveLength(1));
    expect(
      screen.getByRole("button", { name: "Thanh toán" }).getAttribute("aria-current"),
    ).toBe("true");
    cleanup();

    render(await ProfilePage({ searchParams: Promise.resolve({ tab: "other" }) }));
    expect(
      (await screen.findByRole("button", { name: "Hồ sơ cá nhân" })).getAttribute("aria-current"),
    ).toBe("true");
    expect(historyHeadings()).toHaveLength(0);
  });

  it("reads exactly once when a desktop page hydrates with ?tab=payments", async () => {
    isDesktopViewport = true;
    const html = renderToString(<ProfileLayout initialTab="payments" />);
    // Chưa biết chiều rộng lúc SSR: chỗ của lịch sử là khung chờ, chưa có tiêu đề hay lần đọc nào.
    expect(html).not.toContain("Lịch sử thanh toán");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, <ProfileLayout initialTab="payments" />);
    });

    await waitFor(() => expect(historyHeadings()).toHaveLength(1));
    expect(mocks.getPaymentHistory).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Thanh toán" })).toBeNull();
    container.remove();
  });

  it("keeps a single history instance when the width crosses 1023 and 1024 px", async () => {
    isDesktopViewport = true;
    render(<ProfileLayout initialTab="profile" />);
    await waitFor(() => expect(historyHeadings()).toHaveLength(1));

    await resizeTo(false);
    expect(historyHeadings()).toHaveLength(0);
    const tab = await screen.findByRole("button", { name: "Thanh toán" });
    fireEvent.click(tab);
    await waitFor(() => expect(historyHeadings()).toHaveLength(1));

    await resizeTo(true);
    await waitFor(() => expect(historyHeadings()).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Thanh toán" })).toBeNull();
    // Mỗi lần remount tại chỗ mới được đọc lại một lần: desktop, tab dưới lg, rồi desktop.
    expect(mocks.getPaymentHistory).toHaveBeenCalledTimes(3);
  });
});
