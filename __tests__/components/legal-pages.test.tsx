// @vitest-environment jsdom

import { render, screen, within } from "@/__tests__/support/intl";
import { describe, expect, it } from "vitest";
import HomeFooter from "@/app/(client)/_components/home/HomeFooter";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/(client)/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/(client)/terms/page";

// Test plan:
// - Mục tiêu: A4b AC1–AC4 — /privacy và /terms hiện đúng tiêu đề, ngày cập nhật, link liên hệ và link chéo; footer trang chủ trỏ tới hai trang.
// - Loại test: component render trong jsdom (RTL); trang là server component tĩnh, không mock dữ liệu.
// - Đối tượng: PrivacyPage, TermsPage (kèm metadata.title) và cột "Pháp lý" của HomeFooter.
// - Case thành công: tiêu đề h1, một dòng "Cập nhật lần cuối" cùng giá trị ở cả hai trang, mailto support, link sang trang kia,
//   quy tắc 16+ và điều khoản thanh toán/khoá học bị gỡ trong /terms; footer có đúng hai link tên tiếng Việt.
// - Case thất bại: không áp dụng (không có dữ liệu, form hay lỗi).
// - Bảo mật/phân quyền: trang không đọc auth/dữ liệu nên không có nhánh phân quyền; việc không redirect do middleware giữ nguyên
//   và được kiểm bằng browser QA.
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: nội dung đúng Appendix A/B (so sánh bằng script riêng, không nằm trong suite); hai trang dùng chung một ngày.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/legal-pages.test.tsx`.

const LAST_UPDATED_PATTERN = /^Cập nhật lần cuối: \d{2}\/\d{2}\/\d{4}$/;

function lastUpdatedLines() {
  return screen.getAllByText(/^Cập nhật lần cuối:/).map((node) => node.textContent);
}

describe("/privacy", () => {
  it("shows the title, the last-updated date, the support mailto link and a link to the terms", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Chính sách quyền riêng tư" })).toBeTruthy();
    expect(lastUpdatedLines()).toHaveLength(1);
    expect(lastUpdatedLines()[0]).toMatch(LAST_UPDATED_PATTERN);
    expect(
      screen.getByRole("link", { name: "support@vocaspace.com" }).getAttribute("href"),
    ).toBe("mailto:support@vocaspace.com");
    expect(screen.getByRole("link", { name: "Điều khoản sử dụng" }).getAttribute("href")).toBe("/terms");
  });

  it("lists DiceBear as receiving only the account id and states the 16+ audience", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/chỉ nhận mã định danh của tài khoản \(không nhận email\)/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "8. Người dưới 16 tuổi" })).toBeTruthy();
  });

  it("discloses the per-minute learning-action times and who can see them (FEAT3 AC9)", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/ghi\s+lại thời điểm đó \(theo từng phút, kèm khoá học và bài học liên quan\)/)).toBeTruthy();
    expect(screen.getByText(/Dữ liệu về thời điểm học của bạn chỉ bạn xem được trong VocaSpace/)).toBeTruthy();
  });

  it("discloses that a learner still sees the title of a paid course after it is hidden (FEAT6 AC10)", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(/Bạn vẫn xem được tên khoá học đã thanh toán trong lịch sử thanh toán của mình, kể cả khi khoá\s+học đó sau này bị ẩn/),
    ).toBeTruthy();
  });

  it("discloses the aggregate enrollment and progress figures course collaborators can see (TOV1 AC16)", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/xem được số liệu tổng hợp của khoá học đó/)).toBeTruthy();
    expect(screen.getByText(/với khoá học có rất ít học viên, số liệu có thể phản ánh tiến độ của\s+một người cụ thể/)).toBeTruthy();
  });

  it("exports the browser tab title", () => {
    expect(privacyMetadata.title).toBe("Chính sách quyền riêng tư | VocaSpace");
  });
});

describe("/terms", () => {
  it("shows the title, the last-updated date, the support mailto link and a link to the privacy policy", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Điều khoản sử dụng" })).toBeTruthy();
    expect(lastUpdatedLines()).toHaveLength(1);
    expect(lastUpdatedLines()[0]).toMatch(LAST_UPDATED_PATTERN);
    expect(
      screen.getByRole("link", { name: "support@vocaspace.com" }).getAttribute("href"),
    ).toBe("mailto:support@vocaspace.com");
    const privacyLinks = screen.getAllByRole("link", { name: "Chính sách quyền riêng tư" });
    expect(privacyLinks.length).toBeGreaterThan(0);
    for (const link of privacyLinks) expect(link.getAttribute("href")).toBe("/privacy");
  });

  it("states the 16+ rule, the payment refund clause and the removed-course clause", () => {
    render(<TermsPage />);

    expect(screen.getByText("Bạn phải từ 16 tuổi trở lên để sử dụng VocaSpace.")).toBeTruthy();
    expect(screen.getByText(/Khoản thanh toán thành công không được hoàn lại, trừ khi lỗi từ hệ thống/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "6. Khoá học bị gỡ" })).toBeTruthy();
  });

  it("exports the browser tab title", () => {
    expect(termsMetadata.title).toBe("Điều khoản sử dụng | VocaSpace");
  });
});

describe("legal pages together", () => {
  it("show the same last-updated date", () => {
    const privacy = render(<PrivacyPage />);
    const privacyDate = lastUpdatedLines()[0];
    privacy.unmount();
    render(<TermsPage />);

    expect(lastUpdatedLines()[0]).toBe(privacyDate);
  });
});

describe("home footer", () => {
  it("links the Pháp lý column to /privacy and /terms only", () => {
    render(<HomeFooter socialLinks={[]} />);

    const legalColumn = screen.getByRole("heading", { name: "Pháp lý" }).parentElement as HTMLElement;
    expect(within(legalColumn).getByRole("link", { name: "Chính sách quyền riêng tư" }).getAttribute("href")).toBe(
      "/privacy",
    );
    expect(within(legalColumn).getByRole("link", { name: "Điều khoản sử dụng" }).getAttribute("href")).toBe("/terms");
    expect(within(legalColumn).getAllByRole("link")).toHaveLength(2);
  });
});
