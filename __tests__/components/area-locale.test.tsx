// @vitest-environment jsdom

import { useTranslations } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, renderSwitchable, screen } from "@/__tests__/support/intl";
import AreaLocale from "@/components/i18n/area-locale";

// Test plan:
// - Mục tiêu: U9 H4 - layout khu vực đặt lại `<html lang>` và provider client theo ngôn ngữ mà server chọn cho khu đó.
// - Loại test: component test qua provider dùng chung (AreaLocale đọc ngôn ngữ từ provider cha như server đọc từ request).
// - Case: `lang` của document và nhãn client theo ngôn ngữ của khu; đổi ngôn ngữ cập nhật cả hai mà không remount cây con.
// - Ghi chú: việc layout gốc giữ `lang` cũ khi điều hướng client được quan sát trên build thật bằng script H7, không phải jsdom.

function Label() {
  return <span data-testid="label">{useTranslations("common.notFound")("heading")}</span>;
}

afterEach(() => {
  cleanup();
  document.documentElement.lang = "";
});

describe("AreaLocale", () => {
  it.each([
    ["vi", "Không tìm thấy trang"],
    ["en", "Page not found"],
  ] as const)("sets the document language and client messages for %s", (locale, heading) => {
    document.documentElement.lang = locale === "vi" ? "en" : "vi";
    render(
      <AreaLocale>
        <Label />
      </AreaLocale>,
      { locale },
    );

    expect(document.documentElement.lang).toBe(locale);
    expect(screen.getByTestId("label").textContent).toBe(heading);
  });

  it("follows a locale change without remounting its children", () => {
    const view = renderSwitchable(
      <AreaLocale>
        <Label />
      </AreaLocale>,
      "vi",
    );
    const label = screen.getByTestId("label");
    expect(document.documentElement.lang).toBe("vi");

    view.switchLocale("en");

    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByTestId("label")).toBe(label);
    expect(label.textContent).toBe("Page not found");
  });
});
