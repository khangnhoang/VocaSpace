// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCourseCatalogResult } from "@/app/actions/public-course";
import HeroPractice, {
  INTRO_FLIP_DELAY_MS,
  INTRO_FLIP_HOLD_MS,
  INTRO_VISIBLE_RATIO,
} from "@/app/(client)/_components/home/HeroPractice";
import HomeFooter from "@/app/(client)/_components/home/HomeFooter";
import HomeHero from "@/app/(client)/_components/home/HomeHero";
import HomeTeacherSection from "@/app/(client)/_components/home/HomeTeacherSection";
import HomeTestimonials from "@/app/(client)/_components/home/HomeTestimonials";
import { getHomeViewer } from "@/app/(client)/_components/home/home-data";
import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";
import { getHomeContent, HOME_SOCIAL_LINKS, HOME_TESTIMONIALS } from "@/lib/homepage/content";
import type { PublicCourseCatalogItem } from "@/lib/schemas/public-course";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getPublicCourseCatalog: vi.fn(),
  confetti: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/app/actions/public-course", () => ({ getPublicCourseCatalog: mocks.getPublicCourseCatalog }));
// jsdom không có canvas; chỉ cần biết confetti được gọi đúng một lần khi hoàn thành bộ thử.
vi.mock("canvas-confetti", () => ({ default: mocks.confetti }));
// Fact "khóa miễn phí" là server component async, jsdom không render được; nó có test riêng bên dưới.
vi.mock("@/app/(client)/_components/home/HeroFreeCourseFact", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/(client)/_components/home/HeroFreeCourseFact")>()),
  default: () => null,
}));

// Test plan:
// - Mục tiêu: U1 AC1–AC4, AC7–AC9 và r2 — hero đúng hành động theo trạng thái đăng nhập, thẻ học thử chạy đúng trình tự bằng bàn phím,
//   đổi bộ thẻ theo tab, tự lật một lần lúc mở đầu, hoàn thành bộ thử; fact "khóa miễn phí" chỉ hiện khi có thật; đánh giá/mạng xã hội
//   ẩn khi trống và nội dung mẫu chỉ có ngoài production; nút giáo viên theo role; footer chỉ có link thật.
// - Loại test và đối tượng: component render trong jsdom (RTL) cho các khối trang chủ; gọi trực tiếp các server function async
//   (HeroFreeCourseFact, getHomeViewer) với Supabase và catalog mock.
// - Thành công / thất bại: khách và người đã đăng nhập; lật → đánh giá → thẻ tiếp theo; catalog có khóa miễn phí, chỉ trả phí, lỗi;
//   nội dung rỗng và có dữ liệu; teacher, học viên, khách.
// - Phân quyền / resilience: nút soạn khóa học chỉ với profiles.role = 'teacher'; khách không gọi bảng profiles.
// - Invariant và cleanup: nhãn đánh giá lấy từ FLASHCARD_RATINGS; nội dung trang chủ phát hành để trống; RTL cleanup sau mỗi test.
// - Khoảng trống đã biết: hiệu ứng CSS (trượt, mờ, đường ray chạy), bố cục responsive và confetti thật được kiểm bằng trình duyệt;
//   suite này chỉ kiểm điều kiện tự lật (thẻ đã vào màn hình) và việc bỏ qua khi tương tác trước hoặc giảm chuyển động.

// Mặt thẻ đang úp vẫn nằm trong DOM với aria-hidden; chỉ tìm chữ ở mặt người dùng đang thấy.
const VISIBLE_ONLY = "[aria-hidden='true'] *, script, style";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function course(id: string, price: number): PublicCourseCatalogItem {
  return {
    id,
    slug: `khoa-hoc-${id}`,
    title: `Khóa học ${id}`,
    thumbnail_url: null,
    price,
    enrollment_count: 10,
    created_at: "2026-10-01T00:00:00.000Z",
  } as PublicCourseCatalogItem;
}

describe("home hero", () => {
  it("shows guests the catalog action and the free sign-up link", () => {
    render(<HomeHero isSignedIn={false} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Nhớ từ vựng lâu hơn, ôn đúng lúc bạn sắp quên",
    );
    expect(screen.getByRole("link", { name: "Khám phá khóa học" }).getAttribute("href")).toBe("/courses");
    expect(screen.getByRole("link", { name: "Đăng ký miễn phí" }).getAttribute("href")).toBe("/register");
    expect(screen.queryByRole("link", { name: "Tiếp tục học" })).toBeNull();
    expect(screen.getByText("Nhiều khóa cho học thử không cần đăng nhập")).toBeTruthy();
  });

  it("replaces the sign-up link with continue learning for signed-in users", () => {
    render(<HomeHero isSignedIn />);

    expect(screen.getByRole("link", { name: "Tiếp tục học" }).getAttribute("href")).toBe("/learn");
    expect(screen.queryByRole("link", { name: "Đăng ký miễn phí" })).toBeNull();
  });
});

describe("hero free-course fact", () => {
  it.each<[string, PublicCourseCatalogResult, boolean]>([
    ["a highlighted free course", { status: "success", data: [course("1", 0), course("2", 199000)] }, true],
    ["only paid courses", { status: "success", data: [course("1", 199000)] }, false],
    ["an empty catalog", { status: "success", data: [] }, false],
    ["a catalog error", { status: "error", error: "Không tải được" } as PublicCourseCatalogResult, false],
  ])("with %s, shows the fact only when it is true", async (_label, result, expected) => {
    mocks.getPublicCourseCatalog.mockResolvedValue(result);
    const { default: RealFact } = await vi.importActual<
      typeof import("@/app/(client)/_components/home/HeroFreeCourseFact")
    >("@/app/(client)/_components/home/HeroFreeCourseFact");

    const html = renderToStaticMarkup(<ul>{await RealFact()}</ul>);

    expect(html.includes("Có khóa học miễn phí")).toBe(expected);
  });
});

describe("hero practice", () => {
  it("reveals, rates and moves to the next card with keyboard focus following the next action", () => {
    render(<HeroPractice />);
    const status = screen.getByRole("status");

    expect(screen.getByText("commute", { ignore: VISIBLE_ONLY })).toBeTruthy();
    expect(status.textContent).toBe("Lật thẻ rồi chọn mức nhớ để xem lần ôn tiếp theo.");
    expect(screen.getByText("Ví dụ minh họa")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));

    const group = screen.getByRole("group", { name: "Bạn nhớ từ này ở mức nào?" });
    const ratingButtons = within(group).getAllByRole("button");
    expect(ratingButtons.map((button) => button.textContent)).toEqual(FLASHCARD_RATINGS.map(({ label }) => label));
    expect(document.activeElement).toBe(ratingButtons[0]);
    expect(screen.getByText("đi lại hằng ngày giữa nhà và nơi làm")).toBeTruthy();

    fireEvent.click(within(group).getByRole("button", { name: "Ổn" }));

    expect(status.textContent).toBe("Ôn lại sau khoảng 3 ngày.");
    expect(document.querySelector('[data-rail-mark="3 ngày"]')?.getAttribute("data-state")).toBe("current");
    expect(document.querySelector('[data-rail-mark="1 ngày"]')?.getAttribute("data-state")).toBe("done");
    const next = screen.getByRole("button", { name: "Thẻ tiếp theo" });
    expect(document.activeElement).toBe(next);

    fireEvent.click(next);

    expect(screen.getByText("itinerary", { ignore: VISIBLE_ONLY })).toBeTruthy();
    expect(screen.getByText("Thẻ 2/3")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(document.querySelector('[data-rail-mark="Hôm nay"]')?.getAttribute("data-state")).toBe("current");
  });

  it("keeps the hidden face out of the accessibility tree", () => {
    render(<HeroPractice />);

    expect(screen.queryByText("đi lại hằng ngày giữa nhà và nơi làm")?.closest("[aria-hidden='true']")).toBeTruthy();
  });
});

describe("hero practice decks and completion", () => {
  it("switches decks from the tab list and starts the new deck from its first card", () => {
    render(<HeroPractice />);

    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "IELTS" }));
    fireEvent.click(screen.getByRole("tab", { name: "IELTS" }));

    expect(screen.getByRole("tab", { name: "IELTS" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("substantial", { ignore: VISIBLE_ONLY })).toBeTruthy();
    expect(screen.getByText("Thẻ 1/3")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Lật thẻ rồi chọn mức nhớ để xem lần ôn tiếp theo.");
  });

  it("celebrates once after the last card and lets the visitor restart the deck", async () => {
    render(<HeroPractice />);

    for (const label of ["Dễ", "Ổn", "Khó"]) {
      fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
      fireEvent.click(screen.getByRole("button", { name: label }));
      if (label !== "Khó") fireEvent.click(screen.getByRole("button", { name: "Thẻ tiếp theo" }));
    }

    expect(screen.getByText("Hoàn thành bộ thử")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thẻ tiếp theo" })).toBeNull();
    const restart = screen.getByRole("button", { name: "Ôn lại bộ này" });
    expect(document.activeElement).toBe(restart);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("3");
    await waitFor(() => expect(mocks.confetti).toHaveBeenCalledTimes(1));

    fireEvent.click(restart);

    expect(screen.getByText("commute", { ignore: VISIBLE_ONLY })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lật thẻ" }));
  });
});

describe("hero practice intro flip", () => {
  // Mặt trước đứng trước mặt sau trong DOM, nên chữ "commute" đầu tiên thuộc mặt trước.
  const frontFace = () => screen.getAllByText("commute")[0].parentElement!;
  // jsdom không có IntersectionObserver; bản giả này cho test tự quyết lúc nào thẻ vào màn hình.
  let observers: { callback: IntersectionObserverCallback; options?: IntersectionObserverInit }[] = [];
  const showCard = () =>
    act(() =>
      observers.forEach(({ callback }) =>
        callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
      ),
    );

  beforeEach(() => {
    observers = [];
    window.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observers.push({ callback, options });
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, "matchMedia");
    Reflect.deleteProperty(window, "IntersectionObserver");
  });

  it("waits until most of the card is on screen, flips once, then turns it back", () => {
    vi.useFakeTimers();
    render(<HeroPractice />);

    expect(observers[0]?.options?.threshold).toBe(INTRO_VISIBLE_RATIO);
    act(() => vi.advanceTimersByTime(5000));
    expect(frontFace().getAttribute("aria-hidden")).toBeNull();

    showCard();
    act(() => vi.advanceTimersByTime(INTRO_FLIP_DELAY_MS));
    expect(frontFace().getAttribute("aria-hidden")).toBe("true");
    act(() => vi.advanceTimersByTime(INTRO_FLIP_HOLD_MS));
    expect(frontFace().getAttribute("aria-hidden")).toBeNull();
    expect(screen.getByRole("button", { name: "Lật thẻ" })).toBeTruthy();
  });

  it("skips the intro when the visitor interacts first or prefers reduced motion", () => {
    vi.useFakeTimers();
    const { unmount } = render(<HeroPractice />);
    showCard();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Lật thẻ" }));
    act(() => vi.advanceTimersByTime(INTRO_FLIP_DELAY_MS));
    expect(frontFace().getAttribute("aria-hidden")).toBeNull();
    unmount();

    observers = [];
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    render(<HeroPractice />);
    expect(observers).toHaveLength(0);
    act(() => vi.advanceTimersByTime(INTRO_FLIP_DELAY_MS));
    expect(frontFace().getAttribute("aria-hidden")).toBeNull();
  });
});

describe("home sample content", () => {
  it("is used only outside production and only when explicitly enabled", () => {
    expect(getHomeContent({ NODE_ENV: "production", HOME_SAMPLE_CONTENT: "1" }).testimonials).toHaveLength(0);
    expect(getHomeContent({ NODE_ENV: "development" }).socialLinks).toHaveLength(0);

    const sample = getHomeContent({ NODE_ENV: "development", HOME_SAMPLE_CONTENT: "1" });
    expect(sample.testimonials.length).toBeGreaterThan(0);
    expect(sample.socialLinks.map(({ network }) => network)).toEqual(["facebook", "youtube", "instagram"]);
  });
});

describe("testimonials and social links", () => {
  it("ship empty, so neither block renders", () => {
    expect(HOME_TESTIMONIALS).toHaveLength(0);
    expect(HOME_SOCIAL_LINKS).toHaveLength(0);

    const { container } = render(<HomeTestimonials testimonials={HOME_TESTIMONIALS} />);
    expect(container.innerHTML).toBe("");

    render(<HomeFooter socialLinks={HOME_SOCIAL_LINKS} />);
    expect(screen.queryByRole("list", { name: "VocaSpace trên mạng xã hội" })).toBeNull();
  });

  it("render real entries with their course and optional proof", () => {
    render(
      <HomeTestimonials
        testimonials={[
          { id: "a", quote: "Ôn mỗi ngày 15 phút.", name: "Minh Anh", courseTitle: "TOEIC 600", proof: "Đã ôn 1.180 thẻ" },
          { id: "b", quote: "Câu ví dụ rất dễ nhớ.", name: "Thu Linh", courseTitle: "Tiếng Anh văn phòng" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Học viên nói gì về VocaSpace" })).toBeTruthy();
    expect(screen.getByText("Ôn mỗi ngày 15 phút.")).toBeTruthy();
    expect(screen.getByText("Học viên · TOEIC 600")).toBeTruthy();
    expect(screen.getAllByText(/^Đã ôn/)).toHaveLength(1);
  });

  it("open social links in a new tab with an accessible name", () => {
    render(<HomeFooter socialLinks={[{ network: "youtube", href: "https://www.youtube.com/@vocaspace" }]} />);

    const link = screen.getByRole("link", { name: "VocaSpace trên YouTube (mở tab mới)" });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/@vocaspace");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("home footer", () => {
  it("links only to real destinations", () => {
    render(<HomeFooter socialLinks={[]} />);

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/courses", "/learn", "#danh-cho-giao-vien", "/privacy", "/terms"]);
    expect(hrefs).not.toContain("#");
  });
});

describe("teacher section", () => {
  it("offers the authoring workspace only to teachers", () => {
    render(<HomeTeacherSection isTeacher />);
    expect(screen.getByRole("link", { name: "Mở khu soạn khóa học" }).getAttribute("href")).toBe("/teacher/courses");
    expect(screen.queryByText("Tài khoản giáo viên do VocaSpace cấp.")).toBeNull();
  });

  it("explains how teacher accounts are granted to everyone else", () => {
    render(<HomeTeacherSection isTeacher={false} />);
    expect(screen.queryByRole("link", { name: "Mở khu soạn khóa học" })).toBeNull();
    expect(screen.getByText("Tài khoản giáo viên do VocaSpace cấp.")).toBeTruthy();
  });
});

describe("home viewer", () => {
  function mockSupabase(user: { id: string } | null, role?: string) {
    const from = vi.fn(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: role ? { role } : null }),
      };
      return chain;
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user } }) },
      from,
    });
    return from;
  }

  it("treats guests as signed out without reading profiles", async () => {
    const from = mockSupabase(null);
    await expect(getHomeViewer()).resolves.toEqual({ isSignedIn: false, isTeacher: false });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["teacher", true],
    ["student", false],
    ["admin", false],
  ])("marks a signed-in %s as teacher=%s", async (role, isTeacher) => {
    mockSupabase({ id: "user-1" }, role);
    await expect(getHomeViewer()).resolves.toEqual({ isSignedIn: true, isTeacher });
  });
});
