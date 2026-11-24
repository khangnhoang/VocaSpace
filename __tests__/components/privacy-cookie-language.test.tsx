// @vitest-environment jsdom

import { cleanup, render, screen } from "@/__tests__/support/intl";
import { afterEach, describe, expect, it } from "vitest";
import PrivacyPage from "@/app/(client)/privacy/page";

// Test plan:
// - Mục tiêu: English localization U1 AC8 / quyết định 6 (ENLOC-002) - mục Cookie của /privacy nêu cookie ngôn ngữ hiển thị.
// - Loại test: render trang tĩnh trong jsdom. Ngày cập nhật dùng chung đã có test "cùng ngày" trong legal-pages.test.tsx;
//   giá trị ngày merge được kiểm ngay trước khi merge (plan U1, Final).

afterEach(() => cleanup());

describe("/privacy cookie section", () => {
  it("names the display language as remembered interface state", () => {
    render(<PrivacyPage />);
    const heading = screen.getByRole("heading", { name: "3. Cookie" });
    const section = heading.closest("section") ?? heading.parentElement!;
    expect(section.textContent?.replace(/\s+/g, " ")).toContain(
      "VocaSpace dùng cookie để giữ phiên đăng nhập và để ghi nhớ trạng thái giao diện (ví dụ ngôn ngữ hiển thị, hay thanh bên đang đóng hay mở).",
    );
  });
});
