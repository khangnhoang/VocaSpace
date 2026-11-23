// @vitest-environment jsdom

import { useState } from "react";
import { act, cleanup, fireEvent, render, renderToStaticMarkup, screen, within } from "@/__tests__/support/intl";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCourseCatalogResult } from "@/app/actions/public-course";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import FlashcardStage from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage";
import ReviewSheet from "@/app/(client)/learn/_components/ReviewSheet";
import HeroPractice from "@/app/(client)/_components/home/HeroPractice";
import HomeHero from "@/app/(client)/_components/home/HomeHero";
import HomeHowItWorks from "@/app/(client)/_components/home/HomeHowItWorks";
import HomeTeacherSection from "@/app/(client)/_components/home/HomeTeacherSection";
import HomeTestimonials from "@/app/(client)/_components/home/HomeTestimonials";
import { PublicCourseHighlightsView } from "@/app/(client)/_components/PublicCourseHighlights";
import { resetCardReviewQueueForTests } from "@/hooks/use-card-review-queue";
import type { FlashcardDTO } from "@/lib/schemas/learn";

// Test plan:
// - Mục tiêu: English localization U2 CP2 — trang chủ và thẻ flashcard dùng chung hiện tiếng Anh khi ngôn ngữ là `en`, còn nội dung mẫu
//   (từ, phiên âm, nghĩa của thẻ mẫu, lời giới thiệu học viên) giữ nguyên theo quyết định 1.
// - Loại: component render trong jsdom với provider dùng chung (`__tests__/support/intl`); server function async gọi trực tiếp với
//   `setServerTestLocale`. Assertion tiếng Việt của test hiện có không đổi; file này chỉ thêm bản tiếng Anh.
// - Case: hero (tiêu đề rich, nút theo trạng thái đăng nhập), ba bước và bốn nhãn đánh giá, khối giáo viên, vai trò học viên, thẻ học thử
//   (tab, hiện đáp án, đánh giá, trạng thái, mốc lịch), FlashcardStage (nút, progressbar), nhãn đánh giá của ReviewSheet, fact khóa miễn phí,
//   trạng thái lỗi/trống của khóa học nổi bật.
// - Giới hạn: không có chữ tiếng Việt có dấu trong phần giao diện được dịch; chữ tiếng Việt còn lại trong thẻ mẫu là nội dung (quyết định 1).
//   Cấu hình namespace thật của provider lồng nhau chỉ được chứng minh bằng build thật (H2), không bằng helper này.
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
// Nút thử lại của trạng thái lỗi dùng router của app, không có trong jsdom.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/app/actions/public-course", () => ({ getPublicCourseCatalog: vi.fn() }));
vi.mock("@/app/actions/profile", () => ({ getDeckReviewCards: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
vi.mock("@/app/(client)/_components/home/HeroFreeCourseFact", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/(client)/_components/home/HeroFreeCourseFact")>()),
  default: () => null,
}));

const VIETNAMESE_DIACRITIC = /[̀-ͯ]/;
const hasVietnamese = (text: string) => VIETNAMESE_DIACRITIC.test(text.normalize("NFD").replace(/đ/gi, "d"));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setServerTestLocale("vi");
  resetCardReviewQueueForTests();
});

describe("home page in English", () => {
  it("shows the hero in English with the signed-out and signed-in actions", () => {
    const view = render(<HomeHero isSignedIn={false} />, { locale: "en" });
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.textContent).toBe("Remember words longer, review right on time before you forget");
    expect(screen.getByRole("link", { name: "Explore courses" }).getAttribute("href")).toBe("/courses");
    expect(screen.getByRole("link", { name: "Sign up for free" }).getAttribute("href")).toBe("/register");
    expect(screen.getByText("Many courses offer a free trial without signing in")).toBeTruthy();

    view.unmount();
    render(<HomeHero isSignedIn />, { locale: "en" });
    expect(screen.getByRole("link", { name: "Continue learning" }).getAttribute("href")).toBe("/learn");
    expect(screen.queryByRole("link", { name: "Sign up for free" })).toBeNull();
  });

  it("names the four ratings with the English flashcard labels in the how-it-works section", () => {
    const { container } = render(<HomeHowItWorks />, { locale: "en" });

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Three steps to make a new word your own");
    for (const label of ["Again", "Hard", "Good", "Easy"]) expect(within(container).getByText(label)).toBeTruthy();
    expect(hasVietnamese(container.textContent ?? "")).toBe(false);
  });

  it("translates the teacher section, including the sample structure and its state labels", () => {
    const { container } = render(<HomeTeacherSection isTeacher={false} />, { locale: "en" });

    expect(screen.getByRole("group", { name: "Example course structure" })).toBeTruthy();
    expect(screen.getByText("Teacher accounts are issued by VocaSpace.")).toBeTruthy();
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.getByText("Editing")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    // Tên khóa mẫu "TOEIC 600" là tên khóa mẫu của giáo viên, được dịch phần mô tả nhưng không còn chữ có dấu.
    expect(hasVietnamese(container.textContent ?? "")).toBe(false);
  });

  it("translates the student role line and keeps the owner-provided testimonial text as written", () => {
    // Nội dung phát hành để trống; dùng một lời giới thiệu mẫu cục bộ của test.
    const first = { id: "a", quote: "Ôn mỗi ngày 15 phút.", name: "Minh Anh", courseTitle: "TOEIC 600" };
    const { container } = render(<HomeTestimonials testimonials={[first]} />, { locale: "en" });

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("What learners say about VocaSpace");
    expect(screen.getByText(`Learner · ${first.courseTitle}`)).toBeTruthy();
    expect(container.textContent).toContain(first.quote);
  });

  it("runs the trial deck in English while the sample card words keep their wording", () => {
    render(<HeroPractice />, { locale: "en" });

    expect(screen.getByRole("list", { name: "Try-it steps" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Try it now · TOEIC Part 1");
    expect(screen.getByText("3/3 cards left")).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Choose a deck" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Workplace" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Show the answer, then pick how well you remember to see the next review.");

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByRole("status").textContent).toBe("How well do you remember this word?");
    for (const label of ["Again", "Hard", "Good", "Easy"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hard" }));
    expect(screen.getByRole("status").textContent).toBe(
      "commute: you'll see it again in this deck. Review in about 1 day.",
    );
    expect(screen.getByText("Review schedule for commute")).toBeTruthy();
    expect(screen.getByText("Illustrative example")).toBeTruthy();
    expect(document.querySelector("[data-rail-mark='1 day']")).not.toBeNull();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("3 of 3 cards left");
  });

  it("shows the English completion block and restart action after the last card", () => {
    render(<HeroPractice />, { locale: "en" });

    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
      fireEvent.click(screen.getByRole("button", { name: "Good" }));
    }

    expect(screen.getByText("Deck complete")).toBeTruthy();
    expect(screen.getByText("You remembered 3/3 cards. In the app, every card has its own review schedule.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review this deck again" })).toBeTruthy();
  });

  it("translates the recoverable error and empty states of the featured courses", () => {
    const error = renderToStaticMarkup(
      <PublicCourseHighlightsView result={{ status: "error", error: "x" } as PublicCourseCatalogResult} />,
      { locale: "en" },
    );
    const empty = renderToStaticMarkup(
      <PublicCourseHighlightsView result={{ status: "success", data: [] }} />,
      { locale: "en" },
    );

    expect(error).toContain("Couldn&#x27;t load featured courses");
    expect(empty).toContain("New courses are on the way");
    expect(empty).toContain("Open the course library");
    // Nút thử lại và lưới khóa học thuộc CP3 (courses) nên chỉ kiểm các chữ của khối trang chủ.
    expect(error).not.toContain("Chưa thể tải khóa học nổi bật");
    expect(empty).not.toContain("Khóa học mới đang được chuẩn bị");
  });

  it("shows the free-course fact in English from the server translator", async () => {
    setServerTestLocale("en");
    const { getPublicCourseCatalog } = await import("@/app/actions/public-course");
    vi.mocked(getPublicCourseCatalog).mockResolvedValue({
      status: "success",
      data: [{ id: "1", slug: "a", title: "A", thumbnail_url: null, price: 0, enrollment_count: 1, created_at: "2026-10-01T00:00:00.000Z" }],
    } as PublicCourseCatalogResult);
    const { default: RealFact } = await vi.importActual<
      typeof import("@/app/(client)/_components/home/HeroFreeCourseFact")
    >("@/app/(client)/_components/home/HeroFreeCourseFact");

    expect(renderToStaticMarkup(<ul>{await RealFact()}</ul>, { locale: "en" })).toContain("Free courses available");
  });
});

const flashcard: FlashcardDTO = {
  id: "00000000-0000-4000-8000-000000000001",
  front_content: { word: "reliable", phonetic: "/rɪˈlaɪəbl/", pos: "adj" },
  back_content: {
    translation: "đáng tin cậy",
    example: "A reliable partner",
    exampleTranslation: "Một đối tác đáng tin cậy",
    explanation: "Used for people and things you can depend on.",
    hint: "Think of rely.",
  },
};

describe("flashcard stage in English", () => {
  function Stage() {
    const [isFlipped, setIsFlipped] = useState(false);
    return (
      <FlashcardStage
        currentCard={flashcard}
        cardsLeft={2}
        totalCards={5}
        isFlipped={isFlipped}
        setIsFlipped={setIsFlipped}
        handleRateCard={() => {}}
      />
    );
  }

  it("names the reveal button, rating buttons, back labels and progress in English", () => {
    render(<Stage />, { locale: "en" });
    const bar = screen.getByRole("progressbar");

    expect(bar.getAttribute("aria-label")).toBe("Vocabulary progress");
    expect(bar.getAttribute("aria-valuetext")).toBe("2 of 5 cards left");

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    for (const label of ["Again", "Hard", "Good", "Easy"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(screen.getByText("Meaning:")).toBeTruthy();
    expect(screen.getByText("Example:")).toBeTruthy();
    expect(screen.getByText("Translation:")).toBeTruthy();
    expect(screen.getByText("Detailed explanation")).toBeTruthy();
    expect(screen.getByText("Tip: Think of rely.")).toBeTruthy();
  });

  it("keeps the Vietnamese labels when the language is vi", () => {
    render(<Stage />);

    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    for (const label of ["Lại", "Khó", "Ổn", "Dễ"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Còn 2 trên 5 thẻ");
  });
});

describe("review sheet rating labels in English", () => {
  const card = { id: "44444444-4444-4444-8444-444444444444", front_content: { word: "reliable" }, back_content: { translation: "đáng tin cậy" }, audio_url: null, image_url: null };

  beforeEach(() => {
    vi.mocked(getDeckReviewCards).mockResolvedValue({ success: true, cards: [card], counts: { learningLeft: 1, dueLeft: 1 } } as never);
    vi.mocked(submitCardReview).mockResolvedValue({ success: true } as never);
  });

  it("shows the four rating names in English after the answer is revealed", async () => {
    render(<ReviewSheet isOpen onClose={() => {}} onReviewComplete={() => {}} />, { locale: "en" });
    await screen.findByText("reliable");

    // U3 dịch cả nút hiện đáp án của ReviewSheet nên nút này cũng có nhãn tiếng Anh.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    });
    for (const label of ["Again", "Hard", "Good", "Easy"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });
});
