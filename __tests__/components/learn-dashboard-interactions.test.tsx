// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearnDashboardClient from "@/app/(client)/learn/_components/LearnDashboardClient";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import type {
  LearnDashboardCourse,
  LearnDashboardResult,
  PendingPaymentSummary,
  ReviewSummary,
} from "@/lib/schemas/learn-dashboard";

// Test plan:
// - Mục tiêu: kiểm tra hành vi filter, pagination, hierarchy và thẻ thanh toán từ góc nhìn learner.
// - Loại test: component interaction trong jsdom.
// - Đối tượng: LearnDashboardClient, CoursePagination và PendingPayments.
// - Case thành công:
//   - filter đổi đúng danh sách và reset về trang đầu;
//   - next/previous, disabled, aria-current và hai pagination hoạt động độc lập;
//   - thẻ thanh toán chọn khoản có hạn gần nhất, và chỉ khoản pending còn hạn mới có link "Tiếp tục thanh toán" tới ?thanh-toan=tiep-tuc; ẩn khoản đang hiện thì khoản kế tiếp thay chỗ và vẫn ẩn sau khi tải lại cùng tab.
// - Case thất bại:
//   - không có enrollment chỉ render một global empty state;
//   - không có in-progress không render empty Học tiếp;
//   - ẩn khoản cuối cùng thì không còn thẻ thanh toán.
// - Bảo mật/phân quyền: không áp dụng; auth và DTO boundary được kiểm tra ở action/page tests.
// - Ổn định/resilience: due=0 dùng copy trung tính; completed CTA giữ semantic outline.
// - Invariant cần giữ: filter/pagination độc lập, payment dismiss theo paymentId và không suy diễn trạng thái từ DTO.
// - D6: dialog thật refresh sau lưu và trả focus về opener còn tồn tại hoặc heading sau due=0.
// - Giới hạn: action được mock; persistence/FSRS được kiểm tra riêng bằng browser local.
// - Verify: xem State D6 trong progress.md.

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/app/actions/profile", () => ({ getDeckReviewCards: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));

type ViewportMode = "desktop" | "mobile" | "tablet";

function setViewportMode(mode: ViewportMode) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches:
        query === "(min-width: 768px)"
          ? mode !== "mobile"
          : query === "(min-width: 1024px)"
            ? mode === "desktop"
            : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });
}

function buildCourse(
  index: number,
  status: LearnDashboardCourse["status"],
): LearnDashboardCourse {
  const hasContent = status !== "no-content";
  const isCompleted = status === "completed";

  return {
    enrollmentId: `enrollment-${status}-${index}`,
    courseId: `course-${status}-${index}`,
    courseSlug: `course-${status}-${index}`,
    courseTitle: `Khóa học ${status} ${index}`,
    courseThumbnailUrl: null,
    totalTopicCount: hasContent ? 4 : 0,
    completedTopicCount: isCompleted ? 4 : status === "in-progress" ? 2 : 0,
    progressPercentage: hasContent
      ? isCompleted
        ? 100
        : status === "in-progress"
          ? 50
          : 0
      : null,
    status,
    nextTopic:
      hasContent && !isCompleted
        ? {
            slug: `topic-next-${index}`,
            title: `Bài tiếp theo ${index}`,
            chapterTitle: "Chương 1",
          }
        : null,
    lastTopic: hasContent
      ? {
          slug: `topic-last-${index}`,
          title: `Bài cuối ${index}`,
          chapterTitle: "Chương cuối",
        }
      : null,
  };
}

function buildPayments(count: number): PendingPaymentSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    paymentId: `payment-${index + 1}`,
    courseId: `payment-course-${index + 1}`,
    courseSlug: `payment-course-${index + 1}`,
    courseTitle: `Khóa học thanh toán ${index + 1}`,
    status: index === 1 ? ("creating" as const) : ("pending" as const),
    createdAt: `2026-07-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`,
    expiresAt: index === 0 ? "2099-07-25T00:00:00.000Z" : null,
  }));
}

function successResult({
  courses = [],
  pendingPayments = [],
  reviewSummary = {
    totalCardCount: 8,
    learningCardCount: 3,
    dueCardCount: 2,
  },
}: {
  courses?: LearnDashboardCourse[];
  pendingPayments?: PendingPaymentSummary[];
  reviewSummary?: ReviewSummary;
} = {}): LearnDashboardResult {
  return {
    success: true,
    data: {
      courses,
      reviewSummary,
      pendingPayments,
      pendingPaymentCount: pendingPayments.length,
    },
  };
}

function renderDashboard(result: LearnDashboardResult) {
  return render(<LearnDashboardClient result={result} />);
}

function expectPageSelected(container: HTMLElement, page: number) {
  expect(
    within(container)
      .getByRole("button", { name: `Trang ${page}` })
      .getAttribute("aria-current"),
  ).toBe("page");
}

beforeEach(() => {
  setViewportMode("mobile");
  sessionStorage.clear();
  refresh.mockClear();
  vi.mocked(getDeckReviewCards).mockResolvedValue({ success: true, cards: [{ id: "44444444-4444-4444-8444-444444444444", front_content: { word: "focus" }, back_content: { translation: "tập trung" }, audio_url: null, image_url: null }], counts: { learningLeft: 1, dueLeft: 1 } });
  vi.mocked(submitCardReview).mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("D6 dashboard review integration", () => {
  it("restores summary focus when a delayed refresh removes the opener after close", async () => {
    const view = renderDashboard(successResult());
    const trigger = screen.getByRole("button", { name: "Ôn ngay" });
    vi.spyOn(trigger, "getClientRects").mockReturnValue([new DOMRect(0, 0, 100, 44)] as unknown as DOMRectList);
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByText("focus");
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Dễ" }));
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    view.rerender(<LearnDashboardClient result={successResult({ reviewSummary: { totalCardCount: 8, learningCardCount: 3, dueCardCount: 0 } })} />);
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("review-summary-title")));
  });
  it.each([false, true])("refreshes saved reviews and restores focus with opener removed=%s", async (removed) => {
    const view = renderDashboard(successResult());
    const trigger = screen.getByRole("button", { name: "Ôn ngay" });
    vi.spyOn(trigger, "getClientRects").mockReturnValue([new DOMRect(0, 0, 100, 44)] as unknown as DOMRectList);
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Ôn tập tập trung" });
    await within(dialog).findByText("focus");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Dễ" }));
    await within(dialog).findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
    expect(refresh).toHaveBeenCalledOnce();
    if (removed) view.rerender(<LearnDashboardClient result={successResult({ reviewSummary: { totalCardCount: 8, learningCardCount: 3, dueCardCount: 0 } })} />);
    fireEvent.click(within(dialog).getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(removed ? document.getElementById("review-summary-title") : trigger);
    if (removed) expect(screen.queryByRole("button", { name: "Ôn ngay" })).toBeNull();
  });
});

describe("LearnDashboardClient course interactions", () => {
  it("filters visible courses and resets pagination to the first page", () => {
    const courses = [
      ...Array.from({ length: 4 }, (_, index) =>
        buildCourse(index + 1, "not-started"),
      ),
      buildCourse(1, "completed"),
    ];
    renderDashboard(successResult({ courses }));

    const pagination = screen.getByRole("navigation", {
      name: "Phân trang khóa học",
    });
    fireEvent.click(
      within(pagination).getByRole("button", { name: "Trang sau" }),
    );
    expectPageSelected(pagination, 2);
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Khóa học not-started 4",
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Chưa bắt đầu học · 4" }),
    );

    expectPageSelected(pagination, 1);
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Khóa học not-started 1",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        level: 3,
        name: "Khóa học not-started 4",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", {
        level: 3,
        name: "Khóa học completed 1",
      }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Đã hoàn thành · 1" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Khóa học completed 1",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        level: 3,
        name: "Khóa học not-started 1",
      }),
    ).toBeNull();
  });

  it("moves next and previous with correct disabled and aria-current states", () => {
    const courses = Array.from({ length: 5 }, (_, index) =>
      buildCourse(index + 1, "not-started"),
    );
    renderDashboard(successResult({ courses }));

    const pagination = screen.getByRole("navigation", {
      name: "Phân trang khóa học",
    });
    const previous = within(pagination).getByRole("button", {
      name: "Trang trước",
    }) as HTMLButtonElement;
    const next = within(pagination).getByRole("button", {
      name: "Trang sau",
    }) as HTMLButtonElement;

    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expectPageSelected(pagination, 1);

    fireEvent.click(next);
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);
    expectPageSelected(pagination, 2);

    fireEvent.click(previous);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expectPageSelected(pagination, 1);
  });

  it("keeps continuing and remaining pagination independent", () => {
    const courses = [
      ...Array.from({ length: 4 }, (_, index) =>
        buildCourse(index + 1, "in-progress"),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        buildCourse(index + 1, "not-started"),
      ),
    ];
    renderDashboard(successResult({ courses }));

    const continuingPagination = screen.getByRole("navigation", {
      name: "Phân trang khóa học đang học",
    });
    const remainingPagination = screen.getByRole("navigation", {
      name: "Phân trang khóa học",
    });

    fireEvent.click(
      within(continuingPagination).getByRole("button", {
        name: "Trang sau",
      }),
    );
    expectPageSelected(continuingPagination, 2);
    expectPageSelected(remainingPagination, 1);

    fireEvent.click(
      within(remainingPagination).getByRole("button", {
        name: "Trang sau",
      }),
    );
    expectPageSelected(continuingPagination, 2);
    expectPageSelected(remainingPagination, 2);
  });

  it("renders one global empty state without hiding payment reminders", () => {
    renderDashboard(
      successResult({ courses: [], pendingPayments: buildPayments(1) }),
    );

    expect(
      screen.getAllByRole("heading", {
        name: "Bạn chưa có khóa học để tiếp tục",
      }),
    ).toHaveLength(1);
    expect(
      screen
        .getByRole("link", { name: "Khám phá khóa học" })
        .getAttribute("href"),
    ).toBe("/courses");
    expect(screen.queryByRole("heading", { name: "Học tiếp" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Các khóa học còn lại" }),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "Thanh toán cần xử lý" }),
    ).toBeTruthy();
  });

  it("prioritizes a not-started course without rendering an empty continuing section", () => {
    renderDashboard(
      successResult({ courses: [buildCourse(1, "not-started")] }),
    );

    const remainingHeading = screen.getByRole("heading", {
      name: "Các khóa học còn lại",
    });
    const reviewHeading = screen.getByRole("heading", {
      name: "Ôn tập hôm nay",
    });

    expect(screen.queryByRole("heading", { name: "Học tiếp" })).toBeNull();
    expect(
      remainingHeading.compareDocumentPosition(reviewHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(screen.getByRole("link", { name: "Bắt đầu học" })).toBeTruthy();
  });

  it("uses neutral due-zero copy and an outline completed action", () => {
    renderDashboard(
      successResult({
        courses: [
          buildCourse(1, "not-started"),
          buildCourse(1, "completed"),
        ],
        reviewSummary: {
          totalCardCount: 4,
          learningCardCount: 2,
          dueCardCount: 0,
        },
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Hôm nay chưa có thẻ cần ôn" }),
    ).toBeTruthy();
    expect(screen.getByText("Không có thẻ đến hạn.")).toBeTruthy();
    expect(screen.queryByText("Đã hoàn thành ôn tập hôm nay")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Xem lại bài học cuối" })
        .getAttribute("data-variant"),
    ).toBe("outline");
    expect(
      screen
        .getByRole("link", { name: "Bắt đầu học" })
        .getAttribute("data-variant"),
    ).toBe("default");
  });
});

describe("LearnDashboardClient payment card", () => {
  function pendingPayment(
    id: string,
    expiresAt: string | null,
    createdAt: string,
  ): PendingPaymentSummary {
    return {
      paymentId: id,
      courseId: `course-${id}`,
      courseSlug: `slug-${id}`,
      courseTitle: `Khóa ${id}`,
      status: "pending",
      createdAt,
      expiresAt,
    };
  }

  const nearest = pendingPayment("near", "2026-08-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z");
  const tieOlder = pendingPayment("tie-old", "2026-08-05T00:00:00.000Z", "2026-07-02T00:00:00.000Z");
  const tieNewer = pendingPayment("tie-new", "2026-08-05T00:00:00.000Z", "2026-07-03T00:00:00.000Z");
  const undatedNewest = pendingPayment("undated", null, "2026-07-09T00:00:00.000Z");
  const dismissLabel = (id: string) => `Ẩn nhắc nhở này: Khóa ${id}`;
  const cardName = "Thanh toán cần xử lý";

  it("shows one quiet card for the nearest deadline with a text link, the dismiss button, and no sheet", () => {
    renderDashboard(
      successResult({
        courses: [buildCourse(1, "in-progress")],
        pendingPayments: buildPayments(4),
      }),
    );

    const card = screen.getByRole("region", { name: cardName });
    expect(within(card).getByText("Khóa học thanh toán 1")).toBeTruthy();
    expect(within(card).getByText("Hạn 25/07/2099")).toBeTruthy();
    expect(screen.queryByText("Khóa học thanh toán 2")).toBeNull();
    const resume = within(card).getByRole("link", {
      name: "Tiếp tục thanh toán cho Khóa học thanh toán 1",
    });
    expect(resume.getAttribute("href")).toBe("/courses/payment-course-1?thanh-toan=tiep-tuc");
    // Không dùng nút đặc trong thẻ này (AC8).
    expect(resume.getAttribute("data-variant")).toBeNull();
    expect(resume.className).not.toContain("bg-action");
    const dismiss = within(card).getByRole("button", {
      name: "Ẩn nhắc nhở này: Khóa học thanh toán 1",
    });
    expect(dismiss.getAttribute("data-variant")).toBe("ghost");
    expect(dismiss.getAttribute("data-icon-only")).toBe("true");
    const more = within(card).getByRole("link", {
      name: "+3 khoản khác · Xem trong hồ sơ",
    });
    expect(more.getAttribute("href")).toBe("/profile?tab=payments");
    expect(screen.queryByText(/Xem tất cả/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers the continue link only for a pending payment that has not expired, never for creating or past-due ones", () => {
    const continueName = /Tiếp tục thanh toán cho/;
    const visible = (payment: PendingPaymentSummary) => {
      renderDashboard(
        successResult({
          courses: [buildCourse(1, "in-progress")],
          pendingPayments: [payment],
        }),
      );
      const card = screen.getByRole("region", { name: cardName });
      const link = within(card).queryByRole("link", { name: continueName });
      const title = within(card).getByRole("heading", { level: 2 });
      cleanup();
      return { link, titleText: title.textContent };
    };

    const eligible = visible({ ...nearest, expiresAt: "2099-01-01T00:00:00.000Z" });
    expect(eligible.link?.getAttribute("href")).toBe("/courses/slug-near?thanh-toan=tiep-tuc");
    // Tiêu đề vẫn là heading một dòng, không phải link (AC9).
    expect(eligible.titleText).toBe("Khóa near");

    for (const payment of [
      { ...nearest, status: "creating" as const, expiresAt: "2099-01-01T00:00:00.000Z" },
      { ...nearest, expiresAt: "2020-01-01T00:00:00.000Z" },
      { ...nearest, expiresAt: null },
    ]) {
      const result = visible(payment);
      expect(result.link).toBeNull();
      expect(result.titleText).toBe("Khóa near");
    }
  });

  it("omits the +N line when only one payment is visible", () => {
    renderDashboard(
      successResult({
        courses: [buildCourse(1, "in-progress")],
        pendingPayments: buildPayments(1),
      }),
    );

    expect(screen.getByText("Khóa học thanh toán 1")).toBeTruthy();
    expect(screen.queryByText(/khoản khác/)).toBeNull();
  });

  it("picks the nearest deadline, then the newer payment on a tie, and puts undated payments last", () => {
    renderDashboard(
      successResult({
        courses: [buildCourse(1, "in-progress")],
        pendingPayments: [undatedNewest, tieOlder, tieNewer, nearest],
      }),
    );
    expect(screen.getByText("Khóa near")).toBeTruthy();
    cleanup();

    renderDashboard(
      successResult({
        courses: [buildCourse(1, "in-progress")],
        pendingPayments: [undatedNewest, tieOlder, tieNewer],
      }),
    );
    expect(screen.getByText("Khóa tie-new")).toBeTruthy();
    expect(screen.queryByText("Khóa tie-old")).toBeNull();
    expect(
      screen.getByRole("link", { name: "+2 khoản khác · Xem trong hồ sơ" }),
    ).toBeTruthy();
  });

  it("shows an undated payment when it is the only one left, without a Hạn line", () => {
    renderDashboard(
      successResult({
        courses: [buildCourse(1, "in-progress")],
        pendingPayments: [undatedNewest],
      }),
    );

    const card = screen.getByRole("region", { name: cardName });
    expect(within(card).getByText("Khóa undated")).toBeTruthy();
    expect(within(card).queryByText(/Hạn/)).toBeNull();
  });

  it("falls back to the newest payment when none has a deadline", () => {
    const older = pendingPayment("older", null, "2026-07-01T00:00:00.000Z");
    const newer = pendingPayment("newer", null, "2026-07-05T00:00:00.000Z");
    renderDashboard(
      successResult({
        courses: [buildCourse(1, "in-progress")],
        pendingPayments: [older, newer],
      }),
    );

    expect(screen.getByText("Khóa newer")).toBeTruthy();
    expect(screen.queryByText("Khóa older")).toBeNull();
  });

  it("dismisses the shown payment so the next one takes its place, then removes the card", () => {
    renderDashboard(
      successResult({
        courses: [buildCourse(1, "in-progress")],
        pendingPayments: [undatedNewest, tieOlder, nearest],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: dismissLabel("near") }));
    expect(screen.queryByText("Khóa near")).toBeNull();
    expect(screen.getByText("Khóa tie-old")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "+1 khoản khác · Xem trong hồ sơ" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: dismissLabel("tie-old") }));
    const card = screen.getByRole("region", { name: cardName });
    expect(within(card).getByText("Khóa undated")).toBeTruthy();
    expect(within(card).queryByText(/Hạn/)).toBeNull();
    expect(screen.queryByText(/khoản khác/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: dismissLabel("undated") }));
    expect(screen.queryByRole("region", { name: cardName })).toBeNull();
  });

  it("keeps a dismissed payment hidden after a reload in the same tab and does not hide the others", async () => {
    const payments = [tieOlder, nearest];
    const first = renderDashboard(
      successResult({ courses: [buildCourse(1, "in-progress")], pendingPayments: payments }),
    );
    fireEvent.click(screen.getByRole("button", { name: dismissLabel("near") }));
    first.unmount();

    renderDashboard(
      successResult({ courses: [buildCourse(1, "in-progress")], pendingPayments: payments }),
    );

    await waitFor(() => expect(screen.queryByText("Khóa near")).toBeNull());
    expect(screen.getByText("Khóa tie-old")).toBeTruthy();
  });

  it("renders no card when there are no payments", () => {
    renderDashboard(successResult({ courses: [buildCourse(1, "in-progress")] }));

    expect(screen.queryByRole("region", { name: cardName })).toBeNull();
  });
});
