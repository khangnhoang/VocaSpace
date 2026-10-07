// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFound, { metadata } from "@/app/not-found";

vi.mock("@/components/ui/header", () => ({
  default: () => <header data-testid="site-header" />,
}));

// Test plan:
// - Mục tiêu: trang not-found ở root cho người học một lối đi tiếp và có title riêng (F1 AC4–AC5, G4).
// - Loại test: component test cho trang tĩnh; Header (async server component) được mock vì đã có test riêng.
// - Đối tượng: app/not-found.tsx.
// - Case thành công: một heading "Không tìm thấy trang", link "Về trang chủ" → / và "Xem khóa học" → /courses; đúng một Header.
// - Case thất bại: không có link/nút nào trỏ tới route cần đăng nhập.
// - Invariant cần giữ: title tuyệt đối "Không tìm thấy trang | VocaSpace" chỉ đến từ metadata, không có thẻ <title> thứ hai trong cây; noindex do Next tự chèn.
// - Ghi chú: title thực tế khi điều hướng được kiểm bằng browser QA, không phải jsdom.
// - Kết quả verify gần nhất: xem milestone F1 CP3 trong progress.md (`npx vitest run __tests__/components/not-found.test.tsx`).

const EXPECTED_TITLE = "Không tìm thấy trang | VocaSpace";

afterEach(cleanup);

describe("root not-found page", () => {
  it("renders one header, one heading and two recovery links", () => {
    const { container } = render(<NotFound />);

    expect(screen.getAllByTestId("site-header")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Không tìm thấy trang" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Về trang chủ" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Xem khóa học" }).getAttribute("href")).toBe("/courses");
    expect(Array.from(container.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"))).toEqual(["/", "/courses"]);
  });

  it("owns the absolute title through metadata only", () => {
    render(<NotFound />);

    expect(metadata.title).toEqual({ absolute: EXPECTED_TITLE });
    // React 19 đưa <title> trong cây lên <head>; không được có title thứ hai cạnh title từ metadata.
    expect(document.querySelectorAll("title")).toHaveLength(0);
  });
});
