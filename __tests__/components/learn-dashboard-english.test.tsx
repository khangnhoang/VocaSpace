// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, renderSwitchable, screen, within } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Rating } from "ts-fsrs";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import LearnDashboardClient from "@/app/(client)/learn/_components/LearnDashboardClient";
import LearningStreakCard from "@/app/(client)/learn/_components/LearningStreakCard";
import CoursePagination from "@/app/(client)/learn/_components/CoursePagination";
import ReviewSheet from "@/app/(client)/learn/_components/ReviewSheet";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import { CARD_REVIEW_RETRY_DELAY_MS, resetCardReviewQueueForTests } from "@/hooks/use-card-review-queue";
import { recordedTranslations } from "@/lib/i18n/message-ref";
import {
  dayMonthLabel,
  formatStudyDuration,
  translateDayMonth,
  translateStudyDuration,
  translateWeekday,
  weekdayLabel,
} from "@/lib/learning-activity-format";
import { MESSAGES } from "@/lib/i18n/messages";
import { staticTranslate } from "@/lib/i18n/translate";
import type { LearnDashboardCourse, LearnDashboardResult } from "@/lib/schemas/learn-dashboard";

// Test plan:
// - Mục tiêu: English localization U3 CP1 - bảng điều khiển /learn, thẻ chuỗi ngày học, phân trang và ReviewSheet hiện tiếng Anh khi
//   ngôn ngữ là en, và thông báo hệ thống đổi theo ngôn ngữ đang hiển thị (AC2, AC4, AC5, AC6).
// - Loại test: component interaction trong jsdom; Server Action thay tại ranh giới và trả chuỗi như thật, dịch qua
//   `recordedTranslations` khi test cần khóa. Ngôn ngữ SERVER tách khỏi ngôn ngữ provider qua `setServerTestLocale`.
// - Case chính: số thẻ đến hạn 1234 là "1234" ở vi và "1,234" ở en; nhãn "Today"/thứ/ngày-tháng của thẻ chuỗi ngày ở cả chữ hiển
//   thị lẫn chữ cho trình đọc màn hình; ReviewSheet rỗng, có thẻ đến hạn và lỗi lưu; lỗi tải thẻ, lỗi lưu và cảnh báo tiến độ đổi chữ
//   khi chuyển VI <-> EN lúc đang hiện; phản hồi của server ở ngôn ngữ khác (tab khác đã đổi cookie) hiện bằng ngôn ngữ đang hiển thị.
// - Giới hạn: chữ tiếng Việt nguyên văn do các test hiện có giữ; thẻ thanh toán vẫn tiếng Việt (U5).

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/profile", () => ({ getDeckReviewCards: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
const getDeck = vi.mocked(getDeckReviewCards);
const submit = vi.mocked(submitCardReview);

const card = {
  id: "44444444-4444-4444-8444-444444444444",
  front_content: { word: "reliable" },
  back_content: { translation: "đáng tin cậy", hint: "gợi ý của giáo viên" },
  audio_url: null,
  image_url: null,
};
const deck = (cards = [card], dueLeft = cards.length) => ({ success: true, cards, counts: { learningLeft: 1, dueLeft } }) as never;
const hasVietnamese = (text: string | null) => /[ăâđêôơưáàảãạéèíìóòúùýỳ]/i.test(text ?? "");

function setViewport(mode: "mobile" | "desktop") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(min-width: 768px)" ? mode === "desktop" : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function course(index: number, status: LearnDashboardCourse["status"]): LearnDashboardCourse {
  return {
    enrollmentId: `e-${status}-${index}`,
    courseId: `c-${status}-${index}`,
    courseSlug: `c-${status}-${index}`,
    courseTitle: `Khóa ${status} ${index}`,
    courseThumbnailUrl: null,
    totalTopicCount: status === "no-content" ? 0 : 4,
    completedTopicCount: status === "completed" ? 4 : status === "in-progress" ? 2 : 0,
    progressPercentage: status === "no-content" ? null : status === "completed" ? 100 : status === "in-progress" ? 50 : 0,
    status,
    nextTopic: status === "in-progress" || status === "not-started" ? { slug: "t1", title: "Bài 1", chapterTitle: "Chương 1" } : null,
    lastTopic: status === "completed" ? { slug: "t9", title: "Bài cuối", chapterTitle: "Chương cuối" } : null,
  };
}
const dashboard = (courses: LearnDashboardCourse[], dueCardCount: number): LearnDashboardResult => ({
  success: true,
  data: {
    courses,
    reviewSummary: { totalCardCount: 2345, learningCardCount: 1, dueCardCount },
    pendingPayments: [],
    pendingPaymentCount: 0,
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  setViewport("desktop");
  getDeck.mockResolvedValue(deck());
  submit.mockResolvedValue({ success: true } as never);
});
afterEach(() => {
  cleanup();
  resetCardReviewQueueForTests();
  setServerTestLocale("vi");
  vi.useRealTimers();
});

describe("learning helpers (H5)", () => {
  const viText = staticTranslate("learning", MESSAGES.vi.learning);
  const enText = staticTranslate("learning", MESSAGES.en.learning);

  it("keeps the Vietnamese output of the formatters recorded before U3", () => {
    expect([0, 25, 59, 60, 80, 120, 125].map((minutes) => formatStudyDuration(minutes))).toEqual([
      "khoảng 0 phút",
      "khoảng 25 phút",
      "khoảng 59 phút",
      "khoảng 1 giờ",
      "khoảng 1 giờ 20 phút",
      "khoảng 2 giờ",
      "khoảng 2 giờ 5 phút",
    ]);
    expect(["2026-03-08", "2026-03-09", "2026-03-14"].map((date) => weekdayLabel(date))).toEqual(["CN", "T2", "T7"]);
    expect(dayMonthLabel("2026-03-09")).toBe("09/03");
    expect(translateStudyDuration(80, viText)).toBe(formatStudyDuration(80));
  });

  it("gives English duration, weekday and day-month labels", () => {
    expect([0, 25, 60, 80, 120].map((minutes) => translateStudyDuration(minutes, enText))).toEqual([
      "about 0 min",
      "about 25 min",
      "about 1 hr",
      "about 1 hr 20 min",
      "about 2 hr",
    ]);
    expect(["2026-03-08", "2026-03-09"].map((date) => translateWeekday(date, enText))).toEqual(["Sun", "Mon"]);
    expect(translateDayMonth("2026-03-09", enText)).toBe("03/09");
  });
});

describe("dashboard in English", () => {
  it("shows English interface text with grouped counts and no Vietnamese outside course content", () => {
    const courses = [course(1, "in-progress"), course(2, "not-started"), course(3, "completed"), course(4, "no-content")];
    const { container } = render(<LearnDashboardClient result={dashboard(courses, 1234)} />, { locale: "en" });

    expect(screen.getByRole("heading", { name: "What do you want to learn next today?" })).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("cards due")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review now" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "1 card in progress · 2,345 cards in total" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Continue learning" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filter other courses" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All · 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not started · 1" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progress of the course Khóa in-progress 1" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "No cover image for the course Khóa in-progress 1" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review the last lesson" })).toBeTruthy();
    expect(screen.getByText("Content is being updated")).toBeTruthy();

    // Chỉ tên khóa học, bài học và chương (nội dung của giáo viên) còn tiếng Việt.
    const visible = (container.textContent ?? "").replace(/Khóa [\w-]+ \d|Bài \d|Bài cuối|Chương \d|Chương cuối/g, "");
    expect(hasVietnamese(visible)).toBe(false);
    const labels = [...container.querySelectorAll("[aria-label]")].map((element) => element.getAttribute("aria-label"));
    expect(labels.filter((label) => hasVietnamese((label ?? "").replace(/Khóa [\w-]+ \d/g, "")))).toEqual([]);
  });

  it("keeps plain digits for the due count in Vietnamese", () => {
    render(<LearnDashboardClient result={dashboard([course(1, "in-progress")], 1234)} />);
    expect(screen.getByText("1234")).toBeTruthy();
    expect(screen.getByText("thẻ đến hạn")).toBeTruthy();
  });

  it("shows the English empty states and error state", () => {
    const { rerender } = render(<LearnDashboardClient result={dashboard([], 0)} />, { locale: "en" });
    expect(screen.getByRole("heading", { name: "You have no course to continue yet" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No cards to review today" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse courses" })).toBeTruthy();

    rerender(<LearnDashboardClient result={{ success: false, errorCode: "QUERY_FAILED", error: "Couldn't load the learning dashboard right now." }} />);
    expect(screen.getByRole("heading", { name: "Couldn't load your learning space" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("names the pagination in English and follows the language switch", () => {
    const onPageChange = vi.fn();
    const { switchLocale } = renderSwitchable(
      <CoursePagination currentPage={1} itemLabel="x" onPageChange={onPageChange} pageSize={4} totalItems={1234} />,
      "en",
    );
    expect(screen.getByRole("navigation", { name: "x pagination" })).toBeTruthy();
    expect(screen.getByText("Showing 1–4 of 1,234 x")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next page" })).toBeTruthy();
    switchLocale("vi");
    expect(screen.getByText("Hiển thị 1–4 / 1234 x")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeTruthy();
  });
});

describe("learning streak card in English", () => {
  const week = ["2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10", "2026-03-11"].map((date, index) => ({
    date,
    studied: index >= 3,
  }));

  it("labels today, the weekdays and the day-month in visible and screen-reader text", () => {
    const { container } = render(
      <LearningStreakCard result={{ success: true, data: { streak: 4, studiedToday: true, days: week, weekStudyMinutes: 85 } }} />,
      { locale: "en" },
    );
    expect(screen.getByRole("heading", { name: "4 days in a row" })).toBeTruthy();
    expect(screen.getByText("You studied today. Come back tomorrow to keep the streak going.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Last 7 days" })).toBeTruthy();
    const items = within(screen.getByRole("list", { name: "Last 7 days" })).getAllByRole("listitem");
    expect(items[0].textContent).toContain("Thu");
    expect(items[6].textContent).toContain("Today");
    expect(items[0].querySelector(".sr-only")?.textContent).toBe("Thu 03/05: not studied");
    expect(items[6].querySelector(".sr-only")?.textContent).toBe("Today 03/11: studied");
    expect(screen.getByText("This week you studied about 1 hr 25 min (estimate).")).toBeTruthy();
    expect(hasVietnamese(container.textContent)).toBe(false);
  });

  it("shows the English start and unavailable states", () => {
    const { rerender } = render(
      <LearningStreakCard result={{ success: true, data: { streak: 0, studiedToday: false, days: week, weekStudyMinutes: 0 } }} />,
      { locale: "en" },
    );
    expect(screen.getByRole("heading", { name: "Start a learning streak" })).toBeTruthy();
    expect(screen.getByText("No study time has been recorded this week yet.")).toBeTruthy();
    rerender(<LearningStreakCard result={{ success: false, error: "x" }} />);
    expect(screen.getByRole("heading", { name: "Couldn't load your learning streak" })).toBeTruthy();
  });
});

describe("review sheet in English", () => {
  it("shows the English empty and due-card states", async () => {
    getDeck.mockResolvedValue(deck([], 0));
    const view = render(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />, { locale: "en" });
    expect(screen.getByRole("dialog", { name: "Focused review" })).toBeTruthy();
    await screen.findByRole("heading", { name: "No cards are due right now" });
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close review" })).toBeTruthy();
    view.unmount();

    getDeck.mockResolvedValue(deck());
    render(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />, { locale: "en" });
    await screen.findByText("reliable");
    expect(screen.getByText("Cards processed this round: 0/1")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Review progress" })).toBeTruthy();
    expect(screen.getByText("Recall the meaning of the word")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByText("How well did you remember this word?")).toBeTruthy();
    expect(screen.getByText("Tip: gợi ý của giáo viên")).toBeTruthy();
    for (const name of ["Again", "Hard", "Good", "Easy"]) expect(screen.getByRole("button", { name })).toBeTruthy();
  });

  it("shows the English finished state and the English save failure with the card word", async () => {
    render(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />, { locale: "en" });
    await screen.findByText("reliable");
    submit.mockResolvedValue({ error: "boom" } as never);
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS);
    });
    vi.useRealTimers();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Couldn't save your rating for the card \"reliable\". The card was put back in the queue so you can rate it again.",
    );
  });
});

describe("review sheet messages follow the language switch (AC4)", () => {
  async function openSwitchable(initial: "vi" | "en" = "vi") {
    const view = renderSwitchable(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />, initial);
    return view;
  }

  it("switches a load error that stays on the page, and shows a late reply in the displayed language", async () => {
    // Server dùng en nhưng trang đang hiện vi (cookie đã đổi ở tab khác): dịch lại đúng thông báo bằng khóa.
    setServerTestLocale("en");
    getDeck.mockImplementation(async () => {
      const t = await recordedTranslations("learn", "error");
      return { error: t("actions.deck.loadFailed") } as never;
    });
    const view = await openSwitchable("vi");
    expect((await screen.findByRole("alert")).textContent).toBe("Không thể tải ngữ liệu thẻ ôn tập lúc này.");

    view.switchLocale("en");
    expect(screen.getByRole("alert").textContent).toBe("Couldn't load the review card data right now.");
    view.switchLocale("vi");
    expect(screen.getByRole("alert").textContent).toBe("Không thể tải ngữ liệu thẻ ôn tập lúc này.");
  });

  it("keeps the server text when the server language matches the displayed one, and switches it by key afterwards", async () => {
    setServerTestLocale("vi");
    getDeck.mockImplementation(async () => {
      const t = await recordedTranslations("learn", "error");
      return { error: t("actions.deck.queueFailed") } as never;
    });
    const view = await openSwitchable("vi");
    expect((await screen.findByRole("alert")).textContent).toBe("Hệ thống gặp sự cố khi tổng hợp hàng đợi ôn tập.");
    view.switchLocale("en");
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong while building the review queue.");
  });

  it("switches the save failure message built by the client", async () => {
    submit.mockResolvedValue({ error: "boom" } as never);
    const view = await openSwitchable("en");
    await screen.findByText("reliable");
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS);
    });
    vi.useRealTimers();
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't save your rating");
    view.switchLocale("vi");
    expect(screen.getByRole("alert").textContent).toBe('Chưa lưu được đánh giá thẻ "reliable". Thẻ được xếp lại để bạn chấm lại.');
  });

  it("switches the progress warning of a successful review, including a reply from a tab on the other language", async () => {
    // Server dùng vi, trang đang hiện en: `progressError` phải hiện bằng en từ khóa catalog.
    setServerTestLocale("vi");
    submit.mockImplementation(async () => {
      const t = await recordedTranslations("learn", "progressError");
      return { success: true, progressError: t("actions.review.progressSync") } as never;
    });
    getDeck.mockResolvedValue(deck([card, { ...card, id: "55555555-5555-4555-8555-555555555555", front_content: { word: "progress" } }], 2));
    const view = await openSwitchable("en");
    await screen.findByText("reliable");
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Easy" }));
    const warning = await screen.findByText("The card was saved, but your lesson progress couldn't be recorded.");
    expect(warning.getAttribute("role")).toBe("status");
    view.switchLocale("vi");
    expect(screen.getByText("Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học.")).toBeTruthy();
    view.switchLocale("en");
    expect(screen.getByText("The card was saved, but your lesson progress couldn't be recorded.")).toBeTruthy();
    expect(submit).toHaveBeenCalledWith(card.id, Rating.Easy);
  });

  it("falls back to the system message of the displayed language when the progress warning has no key", async () => {
    submit.mockResolvedValue({ success: true, progressError: "Đánh giá đã lưu, tiến độ bài học chưa đồng bộ." } as never);
    getDeck.mockResolvedValue(deck([card, { ...card, id: "55555555-5555-4555-8555-555555555555", front_content: { word: "progress" } }], 2));
    const view = await openSwitchable("vi");
    await screen.findByText("reliable");
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Dễ" }));
    await screen.findByText("Đánh giá đã lưu, tiến độ bài học chưa đồng bộ.");
    view.switchLocale("en");
    expect(screen.getByText("The card was saved, but your lesson progress couldn't be recorded.")).toBeTruthy();
  });
});
