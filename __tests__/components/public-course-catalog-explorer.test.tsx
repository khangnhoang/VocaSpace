// @vitest-environment jsdom

import { useSyncExternalStore } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogExplorer } from "@/app/(client)/courses/_components/catalog/CatalogExplorer";
import { toCatalogCourses } from "@/lib/public-courses/catalog-query";
import type { PublicCourseCatalogListingItem } from "@/lib/schemas/public-course";

// Test plan:
// - Mục tiêu: bảo vệ hành vi người dùng thấy trên /courses (U2 AC2–AC9): tìm, lọc, sắp xếp, URL, phân trang, thẻ, không có kết quả.
// - Loại test: component (jsdom + Testing Library) qua thao tác thật trên control.
// - Mock: useSearchParams đọc window.location và render lại khi history.pushState/replaceState đổi URL, giống cách Next
//   đồng bộ router với history API; không mock logic lọc/sắp xếp.
// - Case thành công: tìm không dấu + highlight; nhóm giá + số đếm; học thử; sắp xếp; trang 2 thêm mục lịch sử và dời focus.
// - Case biên: không có kết quả (chip, chuyển nhóm giá, xóa tất cả, gợi ý); một khóa → thẻ rộng không có toolbar.
// - Quyền: chỉ khóa có trong enrolledCourseIds hiện "Đang học"/"Tiếp tục học"; còn lại "Học thử" hoặc "Xem chi tiết".

const urlListeners = new Set<() => void>();
const notifyUrl = () => urlListeners.forEach((listener) => listener());

vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    useSyncExternalStore(
      (listener) => {
        urlListeners.add(listener);
        return () => urlListeners.delete(listener);
      },
      () => window.location.search,
      () => "",
    ) && new URLSearchParams(window.location.search),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

const originalPush = window.history.pushState.bind(window.history);
const originalReplace = window.history.replaceState.bind(window.history);
let pushCount = 0;

function listing(index: number, overrides: Partial<PublicCourseCatalogListingItem> = {}): PublicCourseCatalogListingItem {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `Khóa ${String(index).padStart(2, "0")}`,
    slug: `khoa-${index}`,
    thumbnail_url: null,
    price: index % 2 === 0 ? 0 : 150000,
    created_at: `2026-0${(index % 9) + 1}-01T00:00:00.000Z`,
    enrollment_count: 100 - index,
    recent_enrollment_count: index,
    topic_count: 3,
    card_count: 40,
    preview_topic_slug: null,
    instructor_name: "Nguyễn Minh Anh",
    description_excerpt: "Mô tả ngắn",
    ...overrides,
  };
}

const NOW = new Date("2026-11-05T12:00:00.000Z");

function renderExplorer(items: PublicCourseCatalogListingItem[], enrolledCourseIds: string[] = []) {
  return render(<CatalogExplorer courses={toCatalogCourses(items, NOW)} enrolledCourseIds={enrolledCourseIds} />);
}

const cardTitles = () => screen.queryAllByRole("article").map((card) => within(card).getByRole("heading", { level: 3 }).textContent);

describe("CatalogExplorer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    pushCount = 0;
    originalReplace(null, "", "/courses");
    window.history.pushState = (...args: Parameters<History["pushState"]>) => {
      pushCount += 1;
      originalPush(...args);
      notifyUrl();
    };
    window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
      originalReplace(...args);
      notifyUrl();
    };
    // Motion đọc prefers-reduced-motion một lần cho cả file, nên mọi test chạy với chuyển động bật.
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    cleanup();
    window.history.pushState = originalPush;
    window.history.replaceState = originalReplace;
    vi.useRealTimers();
  });

  it("filters by title without diacritics after typing, highlights the match and writes q to the URL", async () => {
    renderExplorer([
      listing(1, { title: "Từ vựng IELTS" }),
      listing(2, { title: "Ngữ pháp" }),
      listing(3, { title: "3000 từ vựng" }),
    ]);

    fireEvent.change(screen.getByLabelText("Tìm khóa học theo tên"), { target: { value: "tu vung" } });
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(window.location.search).toBe("?q=tu+vung");
    expect(cardTitles()).toEqual(["Từ vựng IELTS", "3000 từ vựng"]);
    expect(screen.getAllByText("Từ vựng", { selector: "mark" })).toHaveLength(1);
    expect(screen.getByText("Tìm thấy 2 khóa học.")).toBeTruthy();
    expect(pushCount).toBe(0);
  });

  it("shows price-group counts for the current search and filters by price and preview", async () => {
    renderExplorer([
      listing(1, { title: "Anh 1", price: 0, preview_topic_slug: "t-1" }),
      listing(2, { title: "Anh 2", price: 100000 }),
      listing(3, { title: "Nhật", price: 100000, preview_topic_slug: "t-3" }),
    ]);
    const group = screen.getByRole("group", { name: "Lọc theo giá" });
    expect(within(group).getByRole("button", { name: /Trả phí/ }).textContent).toContain("2");

    fireEvent.click(within(group).getByRole("button", { name: /Trả phí/ }));
    expect(window.location.search).toBe("?gia=paid");
    expect(within(group).getByRole("button", { name: /Trả phí/ }).getAttribute("aria-pressed")).toBe("true");
    expect(cardTitles()).toEqual(["Anh 2", "Nhật"]);

    fireEvent.click(screen.getByRole("button", { name: "Có học thử" }));
    expect(window.location.search).toBe("?gia=paid&hoc-thu=1");
    expect(cardTitles()).toEqual(["Nhật"]);
  });

  it("sorts by the selected option", () => {
    renderExplorer([
      listing(1, { title: "Bảng", enrollment_count: 5, price: 300 }),
      listing(2, { title: "An", enrollment_count: 50, price: 100 }),
      listing(3, { title: "Cờ", enrollment_count: 20, price: 0 }),
    ]);
    expect(cardTitles()).toEqual(["An", "Cờ", "Bảng"]);

    // Select của Radix: mở bằng bàn phím, chọn bằng Enter trên option.
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Sắp xếp" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("option", { name: "Giá cao đến thấp" }), { key: "Enter" });
    expect(window.location.search).toBe("?sap-xep=price-desc");
    expect(cardTitles()).toEqual(["Bảng", "An", "Cờ"]);
  });

  it("paginates 12 per page, pushes a history entry and moves focus to the first course of the new page", () => {
    renderExplorer(Array.from({ length: 14 }, (_, index) => listing(index + 1)));
    expect(screen.getAllByRole("article")).toHaveLength(12);
    fireEvent.click(screen.getByRole("link", { name: "Trang 1" }));
    expect(pushCount).toBe(0);
    expect(screen.getByText("Hiển thị 1–12 trong 14 khóa học")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Trang 2" }));

    expect(window.location.search).toBe("?trang=2");
    expect(pushCount).toBe(1);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Trang 2" }).getAttribute("aria-current")).toBe("page");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Xem chi tiết khóa học Khóa 13");

    // Back của trình duyệt: URL đổi thì danh sách render lại theo URL.
    act(() => {
      originalReplace(null, "", "/courses");
      notifyUrl();
    });
    expect(screen.getAllByRole("article")).toHaveLength(12);
  });

  it("shows the no-results panel with removable conditions, the other price group and suggestions", () => {
    renderExplorer([
      listing(1, { title: "Hợp đồng", price: 100000, enrollment_count: 1 }),
      listing(2, { title: "Du lịch", price: 0, enrollment_count: 9 }),
    ]);
    act(() => window.history.replaceState(null, "", "/courses?q=hop+dong&gia=free"));

    expect(screen.getByRole("heading", { level: 2, name: "Không có khóa học nào khớp “hop dong” trong nhóm Miễn phí" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Khóa học được ghi danh nhiều nhất" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Xem 1 khóa trả phí" }));
    expect(window.location.search).toBe("?q=hop+dong&gia=paid");
    expect(cardTitles()).toEqual(["Hợp đồng"]);

    act(() => window.history.replaceState(null, "", "/courses?q=khong+co"));
    fireEvent.click(screen.getByRole("button", { name: "Xóa tất cả bộ lọc" }));
    expect(window.location.search).toBe("");
  });

  it("renders enrolled, preview and detail-only card actions and omits missing optional data", () => {
    renderExplorer(
      [
        listing(1, { title: "Đang học", preview_topic_slug: "t-1" }),
        listing(2, { title: "Có học thử", preview_topic_slug: "chu-de-dau" }),
        listing(3, { title: "Chưa có nội dung", topic_count: 0, card_count: 0, instructor_name: null, description_excerpt: null }),
      ],
      ["00000000-0000-4000-8000-000000000001"],
    );
    const [enrolled, preview, bare] = ["Đang học", "Có học thử", "Chưa có nội dung"].map((title) =>
      screen.getByRole("link", { name: `Xem chi tiết khóa học ${title}` }).closest("article")!,
    );

    expect(within(enrolled).getByText("Đang học", { selector: "span" })).toBeTruthy();
    expect(within(enrolled).getByRole("link", { name: "Tiếp tục học khóa Đang học" }).getAttribute("href")).toBe("/learn/khoa-1");
    expect(within(preview).getByRole("link", { name: "Học thử khóa Có học thử" }).getAttribute("href")).toBe(
      "/courses/khoa-2/preview/chu-de-dau",
    );
    expect(within(preview).getByText("3 chủ đề")).toBeTruthy();
    expect(within(preview).getByText("40 thẻ từ vựng")).toBeTruthy();
    expect(within(bare).queryByText(/chủ đề/)).toBeNull();
    expect(within(bare).queryByText("Nguyễn Minh Anh")).toBeNull();
    expect(within(bare).queryAllByRole("link")).toHaveLength(1);
  });

  it("keeps new results usable at once while removed cards leave inert and hidden from assistive technology", () => {
    renderExplorer([listing(1, { title: "Anh văn" }), listing(2, { title: "Nhật ngữ" })]);

    fireEvent.click(within(screen.getByRole("group", { name: "Lọc theo giá" })).getByRole("button", { name: /Miễn phí/ }));

    expect(cardTitles()).toEqual(["Nhật ngữ"]);
    expect(screen.getByRole("link", { name: "Xem chi tiết khóa học Nhật ngữ" })).toBeTruthy();
    const leaving = document.querySelector('[aria-hidden="true"] article');
    if (leaving) {
      expect(leaving.closest("[inert]")).not.toBeNull();
    }
  });

  it("only arms the scroll reveal for cards below the viewport, never for visible ones", () => {
    const callbacks = new Map<Element, IntersectionObserverCallback>();
    class FakeObserver {
      constructor(private readonly cb: IntersectionObserverCallback) {}
      observe(element: Element) {
        callbacks.set(element, this.cb);
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const realRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const isBelow = this.textContent?.includes("Khóa 12") && this.hasAttribute("data-reveal-item");
      return { ...realRect.call(this), top: isBelow ? window.innerHeight + 200 : 10 } as DOMRect;
    };

    try {
      renderExplorer(Array.from({ length: 12 }, (_, index) => listing(index + 1)));
      const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-item]"));
      const pending = items.filter((element) => element.dataset.reveal === "pending");

      expect(pending).toHaveLength(1);
      expect(pending[0].textContent).toContain("Khóa 12");
      expect([...callbacks.keys()].filter((element) => element.hasAttribute("data-reveal-item"))).toEqual(pending);

      act(() =>
        callbacks.get(pending[0])!(
          [{ isIntersecting: true, target: pending[0], boundingClientRect: { top: 0, left: 0 } } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      );
      expect(pending[0].dataset.reveal).toBe("in");
    } finally {
      Element.prototype.getBoundingClientRect = realRect;
      vi.unstubAllGlobals();
    }
  });

  it("shows the back-to-top button only after the third card scrolls above the viewport", async () => {
    const realRect = Element.prototype.getBoundingClientRect;
    let thirdCardTop = 300;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const grid = this.parentElement;
      const isThird = grid?.id === "catalog-results-grid" && grid.children.item(2) === this;
      return { ...realRect.call(this), top: isThird ? thirdCardTop : 0 } as DOMRect;
    };
    window.scrollTo = vi.fn();
    const heading = document.createElement("h1");
    heading.id = "catalog-title";
    heading.tabIndex = -1;
    document.body.append(heading);

    try {
      renderExplorer(Array.from({ length: 6 }, (_, index) => listing(index + 1)));
      expect(screen.queryByRole("button", { name: "Lên đầu trang" })).toBeNull();

      thirdCardTop = -20;
      await act(async () => {
        window.dispatchEvent(new Event("scroll"));
        await vi.advanceTimersByTimeAsync(50);
      });
      fireEvent.click(screen.getByRole("button", { name: "Lên đầu trang" }));
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
      expect(document.activeElement).toBe(heading);

      // Nút đang rời đi bằng animation vẫn còn trong DOM nhưng đã inert và aria-hidden, nên không còn là một nút.
      thirdCardTop = 300;
      await act(async () => {
        window.dispatchEvent(new Event("scroll"));
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.queryByRole("button", { name: "Lên đầu trang" })).toBeNull();
    } finally {
      Element.prototype.getBoundingClientRect = realRect;
      heading.remove();
    }
  });

  it("shows a single wide card without the toolbar when the catalog has one course", () => {
    renderExplorer([listing(1, { title: "Khóa duy nhất" })]);
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByLabelText("Sắp xếp")).toBeNull();
    expect(cardTitles()).toEqual(["Khóa duy nhất"]);
  });
});
