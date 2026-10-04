import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDeckReviewCards, updateUserPassword } from "@/app/actions/profile";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ queue/count eligibility đồng nhất với submitCardReview; đổi mật khẩu /profile theo A2b.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: getDeckReviewCards, updateUserPassword.
// - Case thành công: chỉ active published card context xuất hiện trong queue và counters; đổi mật khẩu gửi kèm
//   current_password sau khi đăng nhập lại.
// - Case thất bại: metadata/card query error trả safe failure; mật khẩu hiện tại sai, mật khẩu trùng/yếu,
//   reauthentication_needed và lỗi lạ trả thông báo tiếng Việt, không lộ message gốc của GoTrue.
// - Bảo mật/phân quyền: queue không trả client-owned topic identity hoặc inaccessible card; chưa đăng nhập hoặc
//   input sai không gọi Auth; mật khẩu không xuất hiện trong log.
// - Ổn định/resilience: stale/draft card không làm tăng due/learning counts.
// - Invariant cần giữ: queue và mutation dùng cùng card-topic-chapter eligibility; updateUser chỉ chạy sau khi
//   signInWithPassword xác nhận mật khẩu hiện tại.
// - Kết quả verify gần nhất: passed bằng `npm run test:run` (A2b CP1).

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const ids = {
  user: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  card: "44444444-4444-4444-8444-444444444444",
};

function rowsQuery(data: unknown[], error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "lte", "is", "order", "limit"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: { data: unknown[]; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve({ data, error }).then(resolve, reject);
  return query;
}

function card(status = "published") {
  return {
    id: ids.card,
    topic_id: ids.topic,
    removed_at: null,
    front_content: { word: "reliable" },
    back_content: { translation: "đáng tin cậy" },
    audio_url: null,
    image_url: null,
    topic: {
      id: ids.topic,
      chapter_id: ids.chapter,
      course_id: ids.course,
      status,
      removed_at: null,
      chapter: { id: ids.chapter, course_id: ids.course, removed_at: null },
    },
  };
}

function mockSupabase(queries: Record<string, Record<string, unknown>[]>) {
  const offsets = new Map<string, number>();
  const from = vi.fn((table: string) => {
    const index = offsets.get(table) ?? 0;
    const query = queries[table]?.[index];
    if (!query) throw new Error(`Unexpected table query: ${table}#${index}`);
    offsets.set(table, index + 1);
    return query;
  });
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: ids.user } },
        error: null,
      }),
    },
    from,
  } as never);
  return from;
}

describe("getDeckReviewCards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts and returns only cards matching current review eligibility", async () => {
    const due = "2026-01-01T00:00:00.000Z";
    const from = mockSupabase({
      user_flashcards: [
        rowsQuery([
          { next_review_date: due, fsrs_meta: { state: 1 }, card: card() },
          {
            next_review_date: due,
            fsrs_meta: { state: 1 },
            card: card("draft"),
          },
        ]),
        rowsQuery([
          {
            id: "review-row",
            ease_factor: 2.5,
            interval_days: 1,
            next_review_date: due,
            card: card(),
          },
          {
            id: "draft-row",
            ease_factor: 2.5,
            interval_days: 1,
            next_review_date: due,
            card: card("draft"),
          },
        ]),
      ],
    });

    const result = await getDeckReviewCards();

    expect(result.success).toBe(true);
    expect(result.cards).toHaveLength(1);
    expect(result.cards?.[0]).not.toHaveProperty("topic_id");
    expect(result.counts).toEqual({ learningLeft: 1, dueLeft: 1 });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "user_flashcards",
      "user_flashcards",
    ]);
  });

  it("returns a safe failure when eligible metadata cannot be read", async () => {
    mockSupabase({
      user_flashcards: [rowsQuery([], { message: "sensitive error" })],
    });

    await expect(getDeckReviewCards()).resolves.toEqual({
      error: "Không thể tải ngữ liệu thẻ ôn tập lúc này.",
    });
  });
});

describe("updateUserPassword", () => {
  const email = "learner@example.com";
  const form = { currentPassword: "old-pass-1", newPassword: "new-pass-1", confirmPassword: "new-pass-1" };

  function mockAuth(overrides: Record<string, unknown> = {}) {
    const auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: ids.user, email } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      ...overrides,
    };
    mockedCreateClient.mockResolvedValue({ auth } as never);
    return auth;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("re-checks the current password, then sends it with the new password", async () => {
    const auth = mockAuth();

    await expect(updateUserPassword(form)).resolves.toEqual({ success: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email, password: "old-pass-1" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-pass-1", current_password: "old-pass-1" });
    expect(auth.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(auth.updateUser.mock.invocationCallOrder[0]);
  });

  it("rejects a wrong current password at sign-in without calling updateUser", async () => {
    const auth = mockAuth({
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } }),
    });

    await expect(updateUserPassword(form)).resolves.toEqual({ error: "Mật khẩu hiện tại không chính xác!" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["current_password_invalid", 400, "Mật khẩu hiện tại không chính xác!"],
    ["current_password_required", 400, "Mật khẩu hiện tại không chính xác!"],
    ["same_password", 422, "Mật khẩu mới phải khác mật khẩu cũ."],
    ["weak_password", 422, "Mật khẩu này quá yếu hoặc dễ đoán, hãy chọn mật khẩu khác."],
    ["reauthentication_needed", 400, "Phiên đăng nhập đã cũ, bạn đăng nhập lại rồi thử nhé."],
    ["unexpected_failure", 500, "Chưa đổi được mật khẩu, vui lòng thử lại."],
  ])("maps updateUser error %s to a Vietnamese message and logs only the code", async (code, status, message) => {
    mockAuth({
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: { code, status, message: `raw ${code} message` } }),
    });

    await expect(updateUserPassword(form)).resolves.toEqual({ error: message });
    expect(console.error).toHaveBeenCalledWith("updateUserPassword updateUser failed:", code);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/old-pass-1|new-pass-1/);
  });

  it("asks a signed-out caller to sign in without calling Auth mutations", async () => {
    const auth = mockAuth({ getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) });

    await expect(updateUserPassword(form)).resolves.toEqual({ error: "Vui lòng đăng nhập" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation before calling Auth mutations", async () => {
    const auth = mockAuth();

    await expect(updateUserPassword({ ...form, confirmPassword: "other-pass-1" })).resolves.toEqual({
      error: "Mật khẩu xác nhận không khớp",
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
