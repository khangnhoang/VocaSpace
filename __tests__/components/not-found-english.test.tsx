// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@/__tests__/support/intl";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import NotFound, { generateMetadata } from "@/app/not-found";

vi.mock("@/components/ui/header", () => ({
  default: () => <header data-testid="site-header" />,
}));

// Test plan:
// - Mục tiêu: English localization U1 AC2 - trang not-found ở root hiện tiếng Anh khi ngôn ngữ của request là `en`.
// - Loại test: component test; Header được mock như not-found.test.tsx (Header tiếng Anh có test riêng).
// - Case: title tuyệt đối từ generateMetadata, heading, nội dung và hai link khôi phục; vẫn không có thẻ <title> trong cây.
// - Ghi chú: title thật mà bản build phục vụ cho URL lạ và slug khóa học không tồn tại được kiểm bằng browser ở CP3.

afterEach(() => {
  cleanup();
  setServerTestLocale("vi");
});

describe("root not-found page in English", () => {
  it("serves the English title, heading, explanation and recovery links", async () => {
    setServerTestLocale("en");
    render(<NotFound />, { locale: "en" });

    expect((await generateMetadata()).title).toEqual({ absolute: "Page not found | VocaSpace" });
    expect(document.querySelectorAll("title")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
    expect(
      screen.getByText(
        "The link you opened doesn't exist, or this content is no longer available. You can go back to the home page or browse the open courses.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Browse courses" }).getAttribute("href")).toBe("/courses");
  });
});
