import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLearnDashboard } from "@/app/actions/learn-dashboard";
import LearnDashboardPage from "@/app/(client)/learn/page";

// Test plan:
// - Mục tiêu: bảo vệ redirect /learn → /login kèm lý do đăng nhập (F1 AUTH-003).
// - Loại test: route orchestration, action boundary mock.
// - Đối tượng: LearnDashboardPage.
// - Case thành công: kết quả thành công và lỗi query không redirect.
// - Case thất bại: `{ success: false, errorCode: "AUTH_REQUIRED" }` redirect đúng `/login?reason=signin_required`.
// - Invariant cần giữ: chỉ AUTH_REQUIRED mới redirect; literal reason cố định, không mang query nào khác.
// - Kết quả verify gần nhất: xem milestone F1 CP1 trong progress.md (`npx vitest run __tests__/components/learn-dashboard-page.test.tsx`).

vi.mock("server-only", () => ({}));
vi.mock("@/app/actions/learn-dashboard", () => ({
  getLearnDashboard: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const mockedGetDashboard = vi.mocked(getLearnDashboard);
const mockedRedirect = vi.mocked(redirect);

describe("F1 /learn dashboard sign-in redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
