// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@/__tests__/support/intl";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import PrivacyPage, { generateMetadata as privacyMetadata } from "@/app/(client)/privacy/page";
import TermsPage, { generateMetadata as termsMetadata } from "@/app/(client)/terms/page";

// Test plan:
// - Mục tiêu: English localization U7 AC2, AC3 — /privacy và /terms hiện bản tiếng Anh đã duyệt (plan U7, Appendix A/B) khi
//   ngôn ngữ là `en`, kèm câu nêu bản tiếng Việt có giá trị ưu tiên; bản tiếng Việt không có câu đó (AC1).
// - Loại test: component render trong jsdom qua provider của test; title lấy từ generateMetadata với locale server của test.
// - Case: heading, dòng ngày cập nhật cùng ngày với bản tiếng Việt, câu ưu tiên, mailto và link chéo, các mục công bố dữ liệu
//   mà test tiếng Việt đang bảo vệ, không còn chữ tiếng Việt trên trang tiếng Anh.
// - Ngoài phạm vi: đối chiếu từng chữ với Appendix (kiểm bằng diff khi review và Owner đọc lúc QA); `<html lang>` và route table
//   kiểm trên bản build.

const NOTICE =
  "This English version is a translation provided for convenience. If it differs from the Vietnamese version, the Vietnamese version prevails.";
// Chữ cái có dấu tiếng Việt (gồm đ); trang tiếng Anh không được còn chữ nào như vậy.
const VIETNAMESE_LETTER = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

function pageText() {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

afterEach(() => {
  cleanup();
  setServerTestLocale("vi");
});

describe("/privacy in English", () => {
  it("shows the English title, the same date, the prevailing-language notice and the contact links", async () => {
    setServerTestLocale("en");
    render(<PrivacyPage />, { locale: "en" });

    expect((await privacyMetadata()).title).toBe("Privacy Policy | VocaSpace");
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByText("Last updated: 22 November 2026")).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByRole("link", { name: "support@vocaspace.com" }).getAttribute("href")).toBe(
      "mailto:support@vocaspace.com",
    );
    expect(screen.getByRole("link", { name: "Terms of Use" }).getAttribute("href")).toBe("/terms");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(10);
    expect(pageText()).not.toMatch(VIETNAMESE_LETTER);
  });

  it("keeps the disclosures the Vietnamese page is tested for", () => {
    render(<PrivacyPage />, { locale: "en" });
    const text = pageText();

    expect(text).toContain("receives only the account identifier (not the email)");
    expect(screen.getByRole("heading", { level: 2, name: "8. Users under 16" })).toBeTruthy();
    expect(text).toContain("we record the time (to the minute, with the related course and lesson)");
    expect(text).toContain("Data about when you study is visible only to you in VocaSpace");
    expect(text).toContain(
      "You can still see the title of a course you paid for in your payment history, even if that course is later hidden.",
    );
    expect(text).toContain("can see aggregate figures for that course");
    expect(text).toContain("for a course with very few students they may reflect one particular person's progress");
    expect(text).toContain(
      "to remember interface state (for example the display language, or whether the sidebar is open or closed)",
    );
  });
});

describe("/terms in English", () => {
  it("shows the English title, the same date, the notice, the age rule and the payment and removed-course sections", async () => {
    setServerTestLocale("en");
    render(<TermsPage />, { locale: "en" });

    expect((await termsMetadata()).title).toBe("Terms of Use | VocaSpace");
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeTruthy();
    expect(screen.getByText("Last updated: 22 November 2026")).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByText("You must be at least 16 years old to use VocaSpace.")).toBeTruthy();
    expect(pageText()).toContain("Successful payments are not refunded, except in case of a system error");
    expect(screen.getByRole("heading", { level: 2, name: "6. Removed courses" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "support@vocaspace.com" }).getAttribute("href")).toBe(
      "mailto:support@vocaspace.com",
    );
    for (const link of screen.getAllByRole("link", { name: "Privacy Policy" })) {
      expect(link.getAttribute("href")).toBe("/privacy");
    }
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(10);
    expect(pageText()).not.toMatch(VIETNAMESE_LETTER);
  });
});

describe("legal pages in Vietnamese", () => {
  it("do not show the English prevailing-language notice", () => {
    const privacy = render(<PrivacyPage />);
    expect(screen.queryByText(NOTICE)).toBeNull();
    privacy.unmount();
    render(<TermsPage />);
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});
