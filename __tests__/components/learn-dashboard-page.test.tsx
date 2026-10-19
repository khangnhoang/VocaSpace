import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLearnDashboard } from "@/app/actions/learn-dashboard";
import { getLearningSummary } from "@/app/actions/learning-activity";
import LearnDashboardPage from "@/app/(client)/learn/page";

// Test plan:
// - Mục tiêu: bảo vệ redirect /learn → /login kèm lý do đăng nhập (F1 AUTH-003).
// - Loại test: route orchestration, action boundary mock.
// - Đối tượng: LearnDashboardPage.
// - Case thành công: kết quả thành công và lỗi query không redirect.
// - Case thất bại: `{ success: false, errorCode: "AUTH_REQUIRED" }` redirect đúng `/login?reason=signin_required`.
// - Invariant cần giữ: chỉ AUTH_REQUIRED mới redirect; literal reason cố định, không mang query nào khác.
// - FEAT3 (AC10): chuỗi ngày học được đọc song song và truyền xuống như một kết quả riêng; thất bại của nó không redirect và không đổi kết quả dashboard.
// - Kết quả verify gần nhất: xem milestone F1 CP1 trong progress.md (`npx vitest run __tests__/components/learn-dashboard-page.test.tsx`).

vi.mock("server-only", () => ({}));
vi.mock("@/app/actions/learn-dashboard", () => ({
  getLearnDashboard: vi.fn(),
}));
vi.mock("@/app/actions/learning-activity", () => ({
  getLearningSummary: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const mockedGetDashboard = vi.mocked(getLearnDashboard);
const mockedGetSummary = vi.mocked(getLearningSummary);
const mockedRedirect = vi.mocked(redirect);

describe("F1 /learn dashboard sign-in redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSummary.mockResolvedValue({ success: false, error: "Không thể tải chuỗi ngày học lúc này." });
  });

  it("redirects a signed-out visitor to login with the sign-in reason", async () => {
    mockedGetDashboard.mockResolvedValue({
      success: false,
      errorCode: "AUTH_REQUIRED",
      error: "Vui lòng đăng nhập để xem dashboard học tập.",
    });

    await expect(LearnDashboardPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockedRedirect).toHaveBeenCalledExactlyOnceWith("/login?reason=signin_required");
  });

  it("does not redirect a recoverable query failure", async () => {
    mockedGetDashboard.mockResolvedValue({
      success: false,
      errorCode: "QUERY_FAILED",
      error: "Không thể tải dashboard học tập lúc này.",
    });

    await LearnDashboardPage();

    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("hands the dashboard result and the learning summary result to the client as separate props", async () => {
    const dashboard = {
      success: true as const,
      data: {
        courses: [],
        reviewSummary: { totalCardCount: 0, learningCardCount: 0, dueCardCount: 0 },
        pendingPayments: [],
        pendingPaymentCount: 0,
      },
    };
    const summary = {
      success: true as const,
      data: {
        streak: 2,
        studiedToday: false,
        days: Array.from({ length: 7 }, (_, index) => ({ date: `2026-03-${String(5 + index).padStart(2, "0")}`, studied: index >= 5 })),
        weekStudyMinutes: 12,
      },
    };
    mockedGetDashboard.mockResolvedValue(dashboard);
    mockedGetSummary.mockResolvedValue(summary);

    const element = await LearnDashboardPage();

    expect(element.props).toEqual({ result: dashboard, learningSummary: summary });
  });

  it("keeps the dashboard result and does not redirect when only the learning summary is unavailable", async () => {
    const failure = { success: false as const, error: "Không thể tải chuỗi ngày học lúc này." };
    mockedGetDashboard.mockResolvedValue({
      success: false,
      errorCode: "QUERY_FAILED",
      error: "Không thể tải dashboard học tập lúc này.",
    });
    mockedGetSummary.mockResolvedValue(failure);

    const element = await LearnDashboardPage();

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(element.props.learningSummary).toEqual(failure);
  });
});
