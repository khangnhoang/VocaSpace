import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLearnDashboard } from "@/app/actions/learn-dashboard";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: kiểm tra auth và read boundary không có enrollment của learner dashboard.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: getLearnDashboard.
// - Case thành công: authenticated learner không có enrollment nhận DTO rỗng hợp lệ.
// - Case thất bại: unauthenticated user nhận mã AUTH_REQUIRED và không query dữ liệu.
// - Bảo mật/phân quyền: action luôn xác thực bằng getUser trước khi đọc bảng.
// - Ổn định/resilience: kết quả rỗng vẫn giữ đủ review/payment summary.
// - Invariant cần giữ: raw Supabase error/data không rò ra result.
// - Kết quả verify gần nhất: passed bằng `npm run test:run -- __tests__/utils/learn-dashboard.test.ts __tests__/utils/learn-navigation.test.ts __tests__/actions/learn-dashboard.test.ts __tests__/components/learn-dashboard.test.tsx`.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

function createQuery(data: unknown[] = [], error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: { data: unknown[]; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve({ data, error }).then(resolve, reject);
  return query;
}

describe("getLearnDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated user before querying dashboard tables", async () => {
    const from = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from,
    } as never);

    await expect(getLearnDashboard()).resolves.toEqual({
      success: false,
      errorCode: "AUTH_REQUIRED",
      error: "Vui lòng đăng nhập để xem dashboard học tập.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns a stable empty dashboard for an authenticated user without enrollment", async () => {
    const queries = {
      enrollments: createQuery(),
      user_flashcards: createQuery(),
      payments: createQuery(),
    };
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-one" } },
          error: null,
        }),
      },
      from: vi.fn((table: keyof typeof queries) => queries[table]),
    } as never);

    await expect(getLearnDashboard()).resolves.toEqual({
      success: true,
      data: {
        courses: [],
        reviewSummary: {
          totalCardCount: 0,
          learningCardCount: 0,
          dueCardCount: 0,
        },
        pendingPayments: [],
        pendingPaymentCount: 0,
      },
    });
  });
});
