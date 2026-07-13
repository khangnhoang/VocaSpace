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
  let rangeFrom = 0;
  let rangeTo = Number.MAX_SAFE_INTEGER;
  for (const method of ["select", "eq", "in", "is", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.range = vi.fn((from: number, to: number) => {
    rangeFrom = from;
    rangeTo = to;
    return query;
  });
  query.then = (
    resolve: (value: { data: unknown[]; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({
      data: error ? [] : data.slice(rangeFrom, rangeTo + 1),
      error,
    }).then(resolve, reject);
  return query;
}

const visibleEnrollment = {
  id: "enrollment-one",
  course_id: "course-one",
  course: {
    id: "course-one",
    title: "TOEIC nền tảng",
    slug: "toeic-nen-tang",
    thumbnail_url: null,
    status: "published",
    removed_at: null,
  },
};

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

  it("returns a safe error when a primary dashboard query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const queries = {
      enrollments: createQuery([], { message: "sensitive enrollment error" }),
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
      success: false,
      errorCode: "QUERY_FAILED",
      error: "Không thể tải dashboard học tập lúc này.",
    });
  });

  it("returns a safe error when a downstream content query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const queries = {
      enrollments: createQuery([visibleEnrollment]),
      user_flashcards: createQuery(),
      payments: createQuery(),
      chapters: createQuery([], { message: "sensitive chapter error" }),
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
      success: false,
      errorCode: "QUERY_FAILED",
      error: "Không thể tải dashboard học tập lúc này.",
    });
  });

  it("rejects malformed aggregated output with a stable error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const queries = {
      enrollments: createQuery([
        {
          ...visibleEnrollment,
          course: { ...visibleEnrollment.course, title: "" },
        },
      ]),
      user_flashcards: createQuery(),
      payments: createQuery(),
      chapters: createQuery(),
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
      success: false,
      errorCode: "INVALID_DATA",
      error: "Dữ liệu dashboard học tập không hợp lệ.",
    });
  });

  it("reads every flashcard page instead of silently truncating the summary", async () => {
    const flashcards = Array.from({ length: 501 }, (_, index) => ({
      id: `flashcard-${index}`,
      next_review_date: "2026-07-01T00:00:00.000Z",
      fsrs_meta: { state: 1 },
    }));
    const queries = {
      enrollments: createQuery(),
      user_flashcards: createQuery(flashcards),
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

    const result = await getLearnDashboard();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reviewSummary).toMatchObject({
        totalCardCount: 501,
        learningCardCount: 501,
        dueCardCount: 501,
      });
    }
    expect(queries.user_flashcards.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(queries.user_flashcards.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
});
