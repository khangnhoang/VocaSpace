// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "@/app/admin/_components/admin-dashboard";
import type { AdminDashboardDTO } from "@/lib/schemas/admin-dashboard";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn(), replace: vi.fn() }),
}));

// Test plan:
// - Mục tiêu: kiểm tra trang /admin dựng từ dữ liệu của action đúng Admin design mục 14 và AD4 AC1-AC8, AC11 (G6, G8).
// - Loại test: component interaction trong jsdom (RTL) qua `AdminDashboard`; dữ liệu dựng sẵn như action trả về, số liệu thật do integration kiểm.
// - Đối tượng: AdminDashboard và các vùng con (cần xử lý, dải chỉ số, thẻ doanh thu, cơ cấu, top khóa học, ghi danh mới, trạng thái lỗi).
// - Case thành công:
//   - đúng một h1 "Tổng quan Quản trị"; sáu vùng h2 theo thứ tự cần xử lý, doanh thu theo tháng, cơ cấu, top khóa học, ghi danh mới (sau dải chỉ số).
//   - panel cần xử lý: số khóa chờ, thời gian chờ lâu nhất, một liên kết Action Blue tới /admin/courses?status=pending; không có pending thì chữ trung tính, không thời gian chờ, không liên kết.
//   - dải chỉ số có bốn chỉ số, mỗi chỉ số một dòng cơ sở (doanh thu nêu "theo thời điểm tạo đơn" và 6 tháng); không chữ xu hướng hay so sánh.
//   - thẻ doanh thu: mặc định "Xu hướng"; bấm hoặc phím mũi tên/Home/End đổi cách xem (roving tabindex, panel ẩn khỏi cây truy cập); cả ba cách xem cùng sáu giá trị; chiều cao thân không đổi.
//   - đồ thị xu hướng: một nhóm focus được; focus/mũi tên/hover hiện tooltip "Tháng 8 · 12.000.000 ₫" và vùng thông báo polite cùng chữ.
//   - cơ cấu người dùng: ba thanh ngang có nhãn, số lượng và tỷ lệ, độ dài tỷ lệ với giá trị, không biểu đồ tròn.
//   - top khóa học giữ thứ tự, số ghi danh, doanh thu; ghi danh mới có tên, email, khóa học, thời gian tương đối và không có giá.
// - Case thất bại: học viên không còn hồ sơ hiện nhãn có sẵn và không có email; lỗi action hiện trạng thái lỗi an toàn, không con số nào, có "Thử lại" gọi làm mới.
// - Bảo mật/phân quyền: không áp dụng ở lớp này; cổng admin và RPC được kiểm ở action và integration test.
// - Hiệu ứng lộ dần: chỉ chạy một lần khi biểu đồ vào khung nhìn (IntersectionObserver giả), chọn lại cách xem thì lộ lại một lần, không có observer thì hiện ngay.
// - Ổn định/resilience: danh sách rỗng, mọi tháng bằng 0, pending không có mốc gửi duyệt; tên dài; thanh khác 0 giữ độ dài tối thiểu.
// - Invariant cần giữ: không giá trị, chuỗi xu hướng, ô chọn "Theo tuần" hay con số mặc định nào không có nguồn thật.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/admin-dashboard.test.tsx`.
// - Ghi chú: hiệu ứng lộ dần, prefers-reduced-motion thật, bố cục 1440/375/320 px và tương phản nằm ở QA trình duyệt (plan §4.1); ở đây chỉ kiểm tĩnh rằng CSS tắt animation khi giảm chuyển động.

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// IntersectionObserver giả: ghi lại từng observer để test tự quyết định lúc nào biểu đồ "vào khung nhìn".
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  elements: Element[] = [];
  disconnected = false;
  constructor(private callback: (entries: { isIntersecting: boolean; target: Element }[]) => void) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) {
    this.elements.push(element);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
  enter() {
    act(() => this.callback(this.elements.map((target) => ({ isIntersecting: true, target }))));
  }
}

function stubObserver() {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
}

const liveObservers = () => FakeIntersectionObserver.instances.filter((observer) => !observer.disconnected);
const scopeOf = (testId: string) => screen.getAllByTestId(testId)[0].closest("[data-reveal]") as HTMLElement | null;

const COURSE_A = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const COURSE_B = "8a1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e";
const COURSE_C = "7c1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f";

function makeData(overrides: Partial<AdminDashboardDTO> = {}): AdminDashboardDTO {
  return {
    generatedAt: "2026-10-15T08:00:00+00:00",
    pending: { count: 3, oldestSubmittedAt: "2026-10-12T08:00:00+00:00" },
    metrics: { revenue: 6_300_000, students: 120, publishedCourses: 15, learningCards: 45230 },
    revenueMonths: [
      { month: "2026-05", revenue: 0 },
      { month: "2026-06", revenue: 1_000_000 },
      { month: "2026-07", revenue: 0 },
      { month: "2026-08", revenue: 2_000_000 },
      { month: "2026-09", revenue: 3_000_000 },
      { month: "2026-10", revenue: 300_000 },
    ],
    userDistribution: { students: 120, teachers: 20, admins: 4 },
    topCourses: [
      { id: COURSE_A, title: "TOEIC 750+ Cấp tốc", enrollmentCount: 1500, revenue: 5_000_000 },
      { id: COURSE_B, title: "Giao tiếp công sở", enrollmentCount: 750, revenue: 0 },
      { id: COURSE_C, title: "Ngữ pháp nền tảng với một tiêu đề rất dài để kiểm tra việc xuống dòng trong danh sách", enrollmentCount: 3, revenue: 12_000 },
    ],
    recentEnrollments: [
      {
        id: "a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d",
        studentName: "Nguyễn Văn A",
        studentEmail: "nva@gmail.com",
        studentAvatar: null,
        courseTitle: "TOEIC 750+ Cấp tốc",
        enrolledAt: "2026-10-15T07:30:00+00:00",
      },
      {
        id: "b1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d",
        studentName: "Học viên ẩn danh",
        studentEmail: null,
        studentAvatar: null,
        courseTitle: "Giao tiếp công sở",
        enrolledAt: "2026-10-14T08:00:00+00:00",
      },
    ],
    ...overrides,
  };
}

function renderDashboard(data: AdminDashboardDTO | null = makeData(), error: string | null = null) {
  return render(<AdminDashboard data={data} error={error} />);
}

describe("dashboard structure", () => {
  it("shows one h1 and the regions in the Admin design order", () => {
    renderDashboard();

    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual(["Tổng quan Quản trị"]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Cần xử lý",
      "Doanh thu theo tháng",
      "Cơ cấu người dùng",
      "Khóa học nhiều học viên nhất",
      "Ghi danh mới nhất",
    ]);
    // Dải chỉ số nằm giữa panel cần xử lý và thẻ doanh thu.
    const attention = screen.getByRole("region", { name: "Cần xử lý" });
    const band = screen.getByRole("region", { name: "Chỉ số chính" });
    const revenue = screen.getByRole("region", { name: "Doanh thu theo tháng" });
    expect(attention.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(band.compareDocumentPosition(revenue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("carries no fabricated trend text, weekly selector or unsourced control", () => {
    renderDashboard();

    expect(screen.queryByText(/so với tháng trước|học viên mới tuần này|Stability|142 bài học|85%/)).toBeNull();
    expect(screen.queryByText(/Theo tuần|Weekly/)).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/FSRS|Lượt ôn tập/)).toBeNull();
  });
});

describe("needs-attention panel", () => {
  it("states the pending count, the longest wait and one link into the queue", () => {
    renderDashboard();

    const panel = screen.getByRole("region", { name: "Cần xử lý" });
    expect(within(panel).getByText(/khóa học đang chờ duyệt/).textContent).toBe("3 khóa học đang chờ duyệt");
    expect(within(panel).getByText(/đã chờ/).textContent).toBe("Khóa học chờ lâu nhất đã chờ 3 ngày.");
    const link = within(panel).getByRole("link");
    expect(link).toHaveProperty("textContent", "Xem hàng đợi duyệt");
    expect(link.getAttribute("href")).toBe("/admin/courses?status=pending");
    expect(link.getAttribute("data-variant")).toBe("default");
  });

  it("says plainly that nothing waits, with no wait time and no link", () => {
    renderDashboard(makeData({ pending: { count: 0, oldestSubmittedAt: null } }));

    const panel = screen.getByRole("region", { name: "Cần xử lý" });
    expect(within(panel).getByText("Không có khóa học nào đang chờ duyệt.")).toBeTruthy();
    expect(within(panel).queryByText(/đã chờ/)).toBeNull();
    expect(within(panel).queryByRole("link")).toBeNull();
  });

  it("shows the count without inventing a wait when no submission time is stored", () => {
    renderDashboard(makeData({ pending: { count: 2, oldestSubmittedAt: null } }));

    const panel = screen.getByRole("region", { name: "Cần xử lý" });
    expect(within(panel).getByText(/khóa học đang chờ duyệt/).textContent).toBe("2 khóa học đang chờ duyệt");
    expect(within(panel).queryByText(/đã chờ/)).toBeNull();
    expect(within(panel).getByRole("link").getAttribute("href")).toBe("/admin/courses?status=pending");
  });
});

describe("metric band", () => {
  it("shows four metrics, each with its value and a basis line", () => {
    renderDashboard();

    const band = screen.getByRole("region", { name: "Chỉ số chính" });
    const items = within(band).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.textContent)).toEqual([
      "Doanh thu6.300.000 ₫Thanh toán thành công theo thời điểm tạo đơn, 6 tháng gần nhất",
      "Học viên120Tài khoản học viên đang hoạt động",
      "Khóa học đã xuất bản15Khóa học đã xuất bản và chưa bị gỡ",
      "Thẻ đang học45.230Thẻ mà học viên đã bắt đầu học, mọi khóa học",
    ]);
  });

  it("shows no percentage, growth or comparison text", () => {
    renderDashboard();

    const band = screen.getByRole("region", { name: "Chỉ số chính" });
    expect(band.textContent).not.toMatch(/%|\+|so với|tăng|giảm/);
  });
});

describe("revenue card view switch", () => {
  const tabNames = ["Cột", "Xu hướng", "Bảng"];

  it("defaults to the trend view and exposes a labelled tablist with one tab in the tab order", () => {
    renderDashboard();

    const tablist = screen.getByRole("tablist", { name: "Cách xem doanh thu theo tháng" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(tabNames);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    expect(screen.getByRole("tabpanel", { name: "Xu hướng" })).toBeTruthy();
    // Panel ẩn không nằm trong cây truy cập.
    expect(screen.queryByRole("tabpanel", { name: "Cột" })).toBeNull();
    expect(screen.queryByRole("tabpanel", { name: "Bảng" })).toBeNull();
  });

  it("switches view on click and links each tab to its panel", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("tab", { name: "Bảng" }));

    const tab = screen.getByRole("tab", { name: "Bảng" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    const panel = screen.getByRole("tabpanel", { name: "Bảng" });
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
    expect(screen.queryByRole("tabpanel", { name: "Xu hướng" })).toBeNull();
  });

  it("moves, wraps and jumps with the arrow, Home and End keys, moving focus with the selection", () => {
    renderDashboard();
    const trendTab = screen.getByRole("tab", { name: "Xu hướng" });
    trendTab.focus();

    fireEvent.keyDown(trendTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Bảng" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Bảng" }));

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Cột" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Bảng" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(screen.getByRole("tab", { name: "Cột" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("tab", { name: "Bảng" }).getAttribute("aria-selected")).toBe("true");
  });

  it("keeps the same fixed body height in every view so switching never moves the page", () => {
    renderDashboard();

    const heights = new Set<string>();
    for (const name of tabNames) {
      fireEvent.click(screen.getByRole("tab", { name }));
      const panel = screen.getByRole("tabpanel", { name });
      heights.add(panel.className.match(/h-\[\d+px\]/)?.[0] ?? "missing");
    }
    expect([...heights]).toEqual(["h-[262px]"]);
  });

  it("shows the same six values in the table, column and trend views, in millions of dong", () => {
    renderDashboard();
    const expected = ["0", "1", "0", "2", "3", "0,3"];

    fireEvent.click(screen.getByRole("tab", { name: "Bảng" }));
    const table = within(screen.getByRole("tabpanel", { name: "Bảng" })).getByRole("table", {
      name: /Doanh thu theo tháng, triệu đồng/,
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(expected);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
      "Tháng 5/2026",
      "Tháng 6/2026",
      "Tháng 7/2026",
      "Tháng 8/2026",
      "Tháng 9/2026",
      "Tháng 10/2026",
    ]);
    expect(within(table).getByRole("columnheader", { name: "Doanh thu (triệu ₫)" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Cột" }));
    const columns = screen.getByRole("img", { name: /dạng cột/ });
    expect(columns.getAttribute("aria-label")).toBe(
      "Doanh thu theo tháng, dạng cột, triệu đồng: Tháng 5: 0; Tháng 6: 1; Tháng 7: 0; Tháng 8: 2; Tháng 9: 3; Tháng 10: 0,3.",
    );
    expect(within(columns).getAllByTestId("revenue-column")).toHaveLength(4);

    fireEvent.click(screen.getByRole("tab", { name: "Xu hướng" }));
    const slots = within(screen.getByRole("group", { name: "Doanh thu theo tháng, dạng xu hướng" })).getAllByTestId("trend-slot");
    expect(slots.map((slot) => slot.textContent)).toEqual(expected);
  });

  it("draws column heights from zero in proportion to value, with a minimum for a small non-zero value", () => {
    renderDashboard(
      makeData({
        revenueMonths: [
          { month: "2026-05", revenue: 0 },
          { month: "2026-06", revenue: 1_000_000 },
          { month: "2026-07", revenue: 4_000_000 },
          { month: "2026-08", revenue: 2_000 },
          { month: "2026-09", revenue: 0 },
          { month: "2026-10", revenue: 2_000_000 },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Cột" }));

    const columns = screen.getAllByTestId("revenue-column").map((column) => (column as HTMLElement).style);
    expect(columns.map((style) => style.height)).toEqual(["25%", "100%", "0.05%", "50%"]);
    expect(columns.map((style) => style.minHeight)).toEqual(["4px", "4px", "4px", "4px"]);
  });

  it("shows no percentage, growth rate or comparison in the card", () => {
    renderDashboard();

    for (const name of tabNames) {
      fireEvent.click(screen.getByRole("tab", { name }));
      expect(screen.getByRole("region", { name: "Doanh thu theo tháng" }).textContent).not.toMatch(/%|so với|tăng trưởng/);
    }
  });

  it("keeps every value in the document from the first render when motion is reduced or not", () => {
    renderDashboard();

    const trend = screen.getByRole("group", { name: "Doanh thu theo tháng, dạng xu hướng" });
    // Số và nhãn tháng có sẵn trong DOM; hiệu ứng chỉ cắt vùng vẽ bằng CSS.
    expect(trend.textContent).toContain("0,3");
    expect(trend.textContent).toContain("T10");
  });

  it("disables every reveal animation under prefers-reduced-motion (static check of the stylesheet)", () => {
    const css = readFileSync("app/admin/_components/dashboard-motion.module.css", "utf8");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(reduced).toMatch(/\.revealUp[\s\S]*\.revealRight[\s\S]*\.trendReveal[\s\S]*\.markerFade[\s\S]*animation:\s*none/);
  });
});

describe("reveal on first view", () => {
  it("draws share bars at once without an observer (no IntersectionObserver available)", () => {
    renderDashboard();

    expect(document.querySelector("[data-reveal]")).toBeNull();
    expect(screen.getAllByTestId("data-bar").length).toBeGreaterThan(0);
  });

  it("holds the share bars until their chart enters view, then plays once and never again", () => {
    stubObserver();
    renderDashboard();
    const composition = scopeOf("data-bar")!;
    expect(composition.getAttribute("data-reveal")).toBe("waiting");

    const observer = liveObservers().find((item) => item.elements.includes(composition))!;
    observer.enter();
    expect(composition.getAttribute("data-reveal")).toBe("playing");
    expect(observer.disconnected).toBe(true);

    // Sau khi đã chạy không còn observer nào theo dõi biểu đồ này, nên không thể lộ lại.
    expect(liveObservers().some((item) => item.elements.includes(composition))).toBe(false);
  });

  it("reveals each chart on its own, keeping values and labels in the document throughout", () => {
    stubObserver();
    renderDashboard();

    const scopes = [...document.querySelectorAll("[data-reveal]")];
    expect(scopes.every((scope) => scope.getAttribute("data-reveal") === "waiting")).toBe(true);
    expect(screen.getByRole("region", { name: "Cơ cấu người dùng" }).textContent).toContain("Học viên");
    expect(screen.getByRole("region", { name: "Khóa học nhiều học viên nhất" }).textContent).toContain("TOEIC 750+ Cấp tốc");

    const top = scopeOf("data-bar")!;
    liveObservers().find((item) => item.elements.includes(top))!.enter();
    expect(scopes.filter((scope) => scope.getAttribute("data-reveal") === "playing")).toHaveLength(1);
  });

  it("replays the chosen revenue view once each time it is selected", () => {
    stubObserver();
    renderDashboard();
    const trend = screen.getByRole("group", { name: "Doanh thu theo tháng, dạng xu hướng" }).closest("[data-reveal]") as HTMLElement;
    liveObservers().find((item) => item.elements.includes(trend))!.enter();
    expect(trend.getAttribute("data-reveal")).toBe("playing");

    fireEvent.click(screen.getByRole("tab", { name: "Cột" }));
    expect(trend.getAttribute("data-reveal")).toBe("waiting");
    const columns = screen.getByRole("img", { name: /dạng cột/ }) as HTMLElement;
    expect(columns.getAttribute("data-reveal")).toBe("waiting");
    liveObservers().find((item) => item.elements.includes(columns))!.enter();
    expect(columns.getAttribute("data-reveal")).toBe("playing");

    fireEvent.click(screen.getByRole("tab", { name: "Xu hướng" }));
    expect(columns.getAttribute("data-reveal")).toBe("waiting");
    expect(trend.getAttribute("data-reveal")).toBe("waiting");
    liveObservers().find((item) => item.elements.includes(trend))!.enter();
    expect(trend.getAttribute("data-reveal")).toBe("playing");
  });

  it("makes the Cột and Bảng panels focusable so keyboard users can reach their content", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("tab", { name: "Cột" }));
    expect(screen.getByRole("tabpanel", { name: "Cột" }).getAttribute("tabindex")).toBe("0");
    fireEvent.click(screen.getByRole("tab", { name: "Bảng" }));
    expect(screen.getByRole("tabpanel", { name: "Bảng" }).getAttribute("tabindex")).toBe("0");
  });
});

describe("revenue trend plot", () => {
  const group = () => screen.getByRole("group", { name: "Doanh thu theo tháng, dạng xu hướng" });
  const status = () => screen.getByRole("status");

  it("is one focusable group that shows the latest month on focus and announces the same text", () => {
    renderDashboard();

    expect(group().getAttribute("tabindex")).toBe("0");
    expect(status().textContent).toBe("");
    fireEvent.focus(group());

    expect(screen.getByTestId("trend-tooltip").textContent).toBe("Tháng 10 · 300.000 ₫");
    expect(status().textContent).toBe("Tháng 10 · 300.000 ₫");
    expect(status().getAttribute("aria-live")).toBe("polite");
  });

  it("moves between points with Left and Right Arrow and stops at the ends", () => {
    renderDashboard();
    fireEvent.focus(group());

    fireEvent.keyDown(group(), { key: "ArrowLeft" });
    expect(status().textContent).toBe("Tháng 9 · 3.000.000 ₫");
    expect(screen.getByTestId("trend-tooltip").textContent).toBe("Tháng 9 · 3.000.000 ₫");

    fireEvent.keyDown(group(), { key: "ArrowRight" });
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(status().textContent).toBe("Tháng 10 · 300.000 ₫");

    fireEvent.keyDown(group(), { key: "Home" });
    expect(status().textContent).toBe("Tháng 5 · 0 ₫");
    fireEvent.keyDown(group(), { key: "ArrowLeft" });
    expect(status().textContent).toBe("Tháng 5 · 0 ₫");
  });

  it("shows the exact amount on hover and clears it when the pointer leaves", () => {
    renderDashboard();
    const slots = within(group()).getAllByTestId("trend-slot");

    fireEvent.mouseEnter(slots[3]);
    expect(screen.getByTestId("trend-tooltip").textContent).toBe("Tháng 8 · 2.000.000 ₫");
    expect(status().textContent).toBe("Tháng 8 · 2.000.000 ₫");

    fireEvent.mouseLeave(group());
    expect(screen.queryByTestId("trend-tooltip")).toBeNull();
    expect(status().textContent).toBe("");
  });

  it("clears the tooltip with Escape and on blur", () => {
    renderDashboard();
    fireEvent.focus(group());
    expect(screen.getByTestId("trend-tooltip")).toBeTruthy();

    fireEvent.keyDown(group(), { key: "Escape" });
    expect(screen.queryByTestId("trend-tooltip")).toBeNull();

    fireEvent.focus(group());
    fireEvent.blur(group());
    expect(screen.queryByTestId("trend-tooltip")).toBeNull();
  });

  it("starts the value axis at zero: an all-zero year puts every point on the baseline", () => {
    renderDashboard(
      makeData({
        metrics: { revenue: 0, students: 1, publishedCourses: 0, learningCards: 0 },
        revenueMonths: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((month) => ({ month, revenue: 0 })),
      }),
    );

    const slots = within(group()).getAllByTestId("trend-slot");
    expect(slots).toHaveLength(6);
    expect(slots.map((slot) => slot.textContent)).toEqual(["0", "0", "0", "0", "0", "0"]);
  });
});

describe("user composition", () => {
  it("lists students, teachers and admins as labelled bars with count and share, with no donut", () => {
    renderDashboard();

    const section = screen.getByRole("region", { name: "Cơ cấu người dùng" });
    const rows = within(section).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["Học viên120 · 83,3%", "Giáo viên20 · 13,9%", "Quản trị viên4 · 2,8%"]);
    expect(within(section).getByText(/144 tài khoản/)).toBeTruthy();
    expect(section.querySelector("circle")).toBeNull();
    expect(section.querySelector("svg")).toBeNull();
  });

  it("sizes each bar by its share of the three roles and keeps a visible minimum for a small non-zero role", () => {
    renderDashboard(makeData({ userDistribution: { students: 996, teachers: 3, admins: 0 } }));

    const section = screen.getByRole("region", { name: "Cơ cấu người dùng" });
    const bars = within(section).getAllByTestId("data-bar").map((bar) => (bar as HTMLElement).style);
    // Vai trò bằng 0 không vẽ thanh; vai trò nhỏ giữ tối thiểu 4px nhờ min-width.
    expect(bars).toHaveLength(2);
    expect(bars.map((style) => Number.parseFloat(style.width))).toEqual([
      expect.closeTo((996 / 999) * 100, 3),
      expect.closeTo((3 / 999) * 100, 3),
    ]);
    expect(bars.map((style) => style.minWidth)).toEqual(["4px", "4px"]);
  });
});

describe("top courses", () => {
  it("keeps the ranking order and shows enrollments and revenue for each course", () => {
    renderDashboard();

    const section = screen.getByRole("region", { name: "Khóa học nhiều học viên nhất" });
    const items = within(section).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "1.TOEIC 750+ Cấp tốc1.500 học viênDoanh thu: 5.000.000 ₫",
      "2.Giao tiếp công sở750 học viênDoanh thu: 0 ₫",
      "3.Ngữ pháp nền tảng với một tiêu đề rất dài để kiểm tra việc xuống dòng trong danh sách3 học viênDoanh thu: 12.000 ₫",
    ]);
  });

  it("scales bars against the largest enrollment count from zero", () => {
    renderDashboard();

    const section = screen.getByRole("region", { name: "Khóa học nhiều học viên nhất" });
    const widths = within(section).getAllByTestId("data-bar").map((bar) => (bar as HTMLElement).style.width);
    expect(widths).toEqual(["100%", "50%", "0.2%"]);
  });

  it("says so when there is no course and draws no bar when nobody has enrolled", () => {
    const { unmount } = renderDashboard(makeData({ topCourses: [] }));
    expect(screen.getByText("Chưa có khóa học nào.")).toBeTruthy();
    unmount();

    renderDashboard(
      makeData({ topCourses: [{ id: COURSE_A, title: "Khóa chưa có ai", enrollmentCount: 0, revenue: 0 }] }),
    );
    const section = screen.getByRole("region", { name: "Khóa học nhiều học viên nhất" });
    expect(within(section).queryAllByTestId("data-bar")).toHaveLength(0);
    expect(within(section).getByText(/Khóa chưa có ai/)).toBeTruthy();
  });
});

describe("recent enrollments", () => {
  it("shows learner, email when stored, course and relative time, with no price", () => {
    renderDashboard();

    const section = screen.getByRole("region", { name: "Ghi danh mới nhất" });
    const items = within(section).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "NNguyễn Văn Anva@gmail.comTOEIC 750+ Cấp tốc30 phút trước",
      "HHọc viên ẩn danhGiao tiếp công sở1 ngày trước",
    ]);
    expect(section.textContent).not.toMatch(/₫|đ\b|Miễn phí/);
  });

  it("shows the missing-learner label with no email and never an invented address", () => {
    renderDashboard();

    const section = screen.getByRole("region", { name: "Ghi danh mới nhất" });
    const missing = within(section).getAllByRole("listitem")[1];
    expect(within(missing).getByText("Học viên ẩn danh")).toBeTruthy();
    expect(missing.textContent).not.toContain("@");
    expect(section.textContent).not.toContain("no-email@vocaspace.com");
  });

  it("says so when there is no enrollment", () => {
    renderDashboard(makeData({ recentEnrollments: [] }));

    expect(screen.getByText("Chưa có lượt ghi danh nào.")).toBeTruthy();
  });
});

describe("error state", () => {
  it("shows a safe error with no numbers, keeps the h1 and reloads the data on Thử lại", () => {
    renderDashboard(null, "Gặp sự cố hệ thống khi tải báo cáo dữ liệu quản trị.");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Tổng quan Quản trị");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Không thể tải số liệu tổng quan.");
    expect(alert.textContent).toContain("Gặp sự cố hệ thống khi tải báo cáo dữ liệu quản trị.");
    expect(screen.queryByRole("region", { name: "Chỉ số chính" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Cần xử lý" })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d{2,}/);

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows no partial numbers even when data is passed alongside an error", () => {
    renderDashboard(makeData(), "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Chỉ số chính" })).toBeNull();
    expect(screen.queryByText("6.300.000 ₫")).toBeNull();
  });
});
