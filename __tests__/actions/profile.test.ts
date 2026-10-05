import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDeckReviewCards, updateUserPassword, updateUserProfile } from "@/app/actions/profile";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ queue/count eligibility đồng nhất với submitCardReview; đổi mật khẩu /profile theo A2b;
//   lưu hồ sơ với username đặt một lần theo A3.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: getDeckReviewCards, updateUserPassword, updateUserProfile.
// - Case thành công: chỉ active published card context xuất hiện trong queue và counters; đổi mật khẩu gửi kèm
//   current_password sau khi đăng nhập lại.
// - Case thất bại: metadata/card query error trả safe failure; mật khẩu hiện tại sai, mật khẩu trùng/yếu,
//   reauthentication_needed và lỗi lạ trả thông báo tiếng Việt, không lộ message gốc của GoTrue; lưu hồ sơ: đọc
//   lỗi/không thấy dòng, update 0 dòng, 23505, input sai và chưa đăng nhập đều không báo thành công.
// - Bảo mật/phân quyền: queue không trả client-owned topic identity hoặc inaccessible card; chưa đăng nhập hoặc
//   input sai không gọi Auth; mật khẩu không xuất hiện trong log; payload hồ sơ tự chế có username khác không
//   được đưa vào UPDATE khi user đã có username; input sai/chưa đăng nhập không chạm DB.
// - Ổn định/resilience: stale/draft card không làm tăng due/learning counts.
// - Invariant cần giữ: queue và mutation dùng cùng card-topic-chapter eligibility; updateUser chỉ chạy sau khi
//   signInWithPassword xác nhận mật khẩu hiện tại; hồ sơ chỉ bị ghi sau khi đọc được dòng của chính user, UPDATE
//   đặt username luôn lọc `username is null`, UPDATE thường không chứa `username`.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/actions/profile.test.ts` (A3 CP1).

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

describe("updateUserProfile", () => {
  const validInput = { full_name: "Nguyễn Văn A", username: "", dob: "", gender: "" };

  interface Calls {
    reads: unknown[][];
    updates: { payload: Record<string, unknown>; filters: [string, ...unknown[]][] }[];
  }

  // `read` là kết quả của select("username").eq("id").single(); `write` là kết quả của update(...).select("id").
  function mockProfiles(
    read: { data: { username: string | null } | null; error?: unknown },
    write: { data?: { id: string }[] | null; error?: unknown } = { data: [{ id: ids.user }] },
    user: { id: string } | null = { id: ids.user },
  ) {
    const calls: Calls = { reads: [], updates: [] };
    const from = vi.fn(() => ({
      select: (columns: string) => ({
        eq: (...args: unknown[]) => ({
          single: async () => {
            calls.reads.push([columns, ...args]);
            return { data: read.data, error: read.error ?? null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        const entry = { payload, filters: [] as [string, ...unknown[]][] };
        calls.updates.push(entry);
        const chain = {
          eq: (...args: unknown[]) => (entry.filters.push(["eq", ...args]), chain),
          is: (...args: unknown[]) => (entry.filters.push(["is", ...args]), chain),
          select: async () => ({ data: write.data ?? null, error: write.error ?? null }),
        };
        return chain;
      },
    }));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from,
    } as never);
    return { from, calls };
  }

  beforeEach(() => vi.clearAllMocks());

  it("sets the first username through one update conditioned on username is null", async () => {
    const { calls } = mockProfiles({ data: { username: null } });

    await expect(updateUserProfile({ ...validInput, username: "my_name" })).resolves.toEqual({ success: true });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].payload).toMatchObject({ full_name: "Nguyễn Văn A", username: "my_name", dob: null, gender: null });
    expect(calls.updates[0].filters).toEqual([
      ["eq", "id", ids.user],
      ["is", "username", null],
    ]);
  });

  it("saves other fields and keeps the username null when a null-username user leaves it blank", async () => {
    const { calls } = mockProfiles({ data: { username: null } });

    await expect(
      updateUserProfile({ ...validInput, dob: "2000-01-31", gender: "female" }),
    ).resolves.toEqual({ success: true });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].payload).not.toHaveProperty("username");
    expect(calls.updates[0].payload).toMatchObject({ dob: "2000-01-31", gender: "female" });
    expect(calls.updates[0].filters).toEqual([["eq", "id", ids.user]]);
  });

  it("ignores a crafted different username when the user already has one and still saves other fields", async () => {
    const { calls } = mockProfiles({ data: { username: "existing_name" } });

    await expect(
      updateUserProfile({ ...validInput, username: "hijacked", dob: "1999-12-31" }),
    ).resolves.toEqual({ success: true });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].payload).not.toHaveProperty("username");
    expect(calls.updates[0].payload).toMatchObject({ dob: "1999-12-31" });
    expect(calls.updates[0].filters).toEqual([["eq", "id", ids.user]]);
  });

  it("targets only the signed-in user's row even when the payload carries another id", async () => {
    const { calls } = mockProfiles({ data: { username: "existing_name" } });

    await updateUserProfile({ ...validInput, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    expect(calls.reads[0]).toEqual(["username", "id", ids.user]);
    expect(calls.updates[0].payload).not.toHaveProperty("id");
    expect(calls.updates[0].filters).toEqual([["eq", "id", ids.user]]);
  });

  it("reports the reload message when the conditional first set writes zero rows", async () => {
    const { calls } = mockProfiles({ data: { username: null } }, { data: [] });

    await expect(updateUserProfile({ ...validInput, username: "my_name" })).resolves.toEqual({
      error: "Username đã được thiết lập, vui lòng tải lại trang.",
    });
    expect(calls.updates).toHaveLength(1);
  });

  it("maps a unique violation on the first set to the duplicate username message", async () => {
    mockProfiles(
      { data: { username: null } },
      { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "profiles_username_key"' } },
    );

    await expect(updateUserProfile({ ...validInput, username: "taken_name" })).resolves.toEqual({
      error: "Tên người dùng (Username) đã tồn tại!",
    });
  });

  it("returns the system error without leaking a raw database message on another update failure", async () => {
    mockProfiles({ data: { username: null } }, { data: null, error: { code: "XX000", message: "raw db failure" } });

    await expect(updateUserProfile({ ...validInput, username: "my_name" })).resolves.toEqual({
      error: "Lỗi hệ thống khi cập nhật hồ sơ.",
    });
  });

  it.each([
    ["the read fails", { data: null, error: { code: "XX000", message: "raw read failure" } }],
    ["the read finds no visible row", { data: null }],
  ])("returns the system error and writes nothing when %s, even with a username requested", async (_label, read) => {
    const { calls } = mockProfiles(read);

    await expect(updateUserProfile({ ...validInput, username: "my_name" })).resolves.toEqual({
      error: "Lỗi hệ thống khi cập nhật hồ sơ.",
    });
    expect(calls.updates).toHaveLength(0);
  });

  it("returns the system error when the ordinary update writes zero rows", async () => {
    mockProfiles({ data: { username: "existing_name" } }, { data: [] });

    await expect(updateUserProfile(validInput)).resolves.toEqual({
      error: "Lỗi hệ thống khi cập nhật hồ sơ.",
    });
  });

  it("rejects invalid input before any database call", async () => {
    const { from } = mockProfiles({ data: { username: null } });

    await expect(updateUserProfile({ ...validInput, full_name: "A" })).resolves.toEqual({
      error: "Họ tên phải có ít nhất 2 ký tự",
    });
    await expect(updateUserProfile({ ...validInput, username: "ab" })).resolves.toEqual({
      error: "Username phải từ 3 ký tự trở lên",
    });
    await expect(updateUserProfile({ ...validInput, gender: "nam" })).resolves.toEqual({
      error: "Giới tính không hợp lệ.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("asks a signed-out caller to sign in without any database call", async () => {
    const { from } = mockProfiles({ data: { username: null } }, undefined, null);

    await expect(updateUserProfile(validInput)).resolves.toEqual({ error: "Vui lòng đăng nhập" });
    expect(from).not.toHaveBeenCalled();
  });
});
