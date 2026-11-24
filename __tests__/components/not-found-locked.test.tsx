// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@/__tests__/support/intl";
import NotFound from "@/app/not-found";

vi.mock("@/components/ui/header", () => ({
  default: (props: { hideSwitcherInLockedAreas?: boolean }) => (
    <header data-testid="site-header" data-hide={String(props.hideSwitcherInLockedAreas)} />
  ),
}));

// Test plan:
// - Mục tiêu: U9 AC2/AC5 - not-found gốc hiện đúng ngôn ngữ của request (khu bị khóa nhận vi, khu mở khóa nhận en) và yêu cầu
//   Header ẩn bộ chọn ở khu bị khóa; việc Header thật ẩn bộ chọn được kiểm ở header-locked-switcher.test.tsx.
// - Loại test: component test; Header được mock để ghi lại prop.
// - Case: ngôn ngữ vi và en; Header luôn nhận cờ opt-in; test not-found hiện có giữ nguyên.

afterEach(cleanup);

describe("root not-found under the language lock", () => {
  it.each([
    ["vi", "Không tìm thấy trang"],
    ["en", "Page not found"],
  ] as const)("renders the %s heading and opts the header into the lock", (locale, heading) => {
    render(<NotFound />, { locale });

    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
    expect(screen.getByTestId("site-header").getAttribute("data-hide")).toBe("true");
  });
});
