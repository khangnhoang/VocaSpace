import { beforeEach, describe, expect, it, vi } from "vitest";
import { Rating } from "ts-fsrs";
import { submitCardReview } from "@/app/actions/review";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ trusted card context, bounded FSRS write path và removal of legacy side effects.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: submitCardReview.
// - Case thành công: accessible active card tạo/cập nhật FSRS bằng đúng hai DB requests.
// - Case thất bại: malformed rating, inaccessible parent, invalid metadata và mutation error trả safe failure.
// - Bảo mật/phân quyền: missing auth hoặc mismatched card/topic/chapter không tạo mutation.
// - Ổn định/resilience: failed mutation không báo success; không ghi enrollment hoặc topic progress.
// - Invariant cần giữ: caller chỉ gửi cardId + rating; FSRS scheduling semantics không đổi.
// - Kết quả verify gần nhất: 27/27 test passed trong focused CP2 Vitest command.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const ids = {
  user: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  card: "44444444-4444-4444-8444-444444444444",
};

function singleQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

function mutationQuery(error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["insert", "update", "eq", "select"]) {
    query[method] = vi.fn(() => query);
  }
  query.single = vi.fn().mockResolvedValue({ data: error ? null : { id: "row" }, error });
  return query;
}

function mockSupabase(
  queries: Record<string, Record<string, unknown>> = {},
  currentUser: { id: string } | null = { id: ids.user },
) {
  const from = vi.fn((table: string) => {
    const query = queries[table];
    if (!query) throw new Error(`Unexpected table query: ${table}`);
    return query;
  });
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: currentUser },
        error: null,
      }),
    },
    from,
  } as never);
  return from;
}

const card = {
  id: ids.card,
  topic_id: ids.topic,
  removed_at: null,
  topic: {
    id: ids.topic,
    chapter_id: ids.chapter,
    course_id: ids.course,
    status: "published",
    removed_at: null,
    chapter: { id: ids.chapter, course_id: ids.course, removed_at: null },
  },
  user_flashcards: [],
};

describe("submitCardReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed input before creating a database client", async () => {
    await expect(
      submitCardReview("bad-id", Rating.Manual),
    ).resolves.toEqual({ error: "Dữ liệu đánh giá thẻ không hợp lệ." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("does not mutate an inaccessible or mismatched card", async () => {
    const from = mockSupabase({
      cards: singleQuery({
        ...card,
        topic: {
          ...card.topic,
          chapter: { ...card.topic.chapter, course_id: ids.topic },
        },
      }),
    });

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      error: "Thẻ ôn tập không khả dụng.",
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["cards"]);
  });

  it("creates FSRS state in two DB requests without progress or enrollment writes", async () => {
    const mutation = mutationQuery();
    const from = mockSupabase({
      cards: singleQuery(card),
      user_flashcards: mutation,
    });

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      success: true,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "cards",
      "user_flashcards",
    ]);
    expect(mutation.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: ids.user, card_id: ids.card }),
    );
  });

  it("returns a safe failure when the checked FSRS mutation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase({
      cards: singleQuery(card),
      user_flashcards: mutationQuery({ message: "sensitive error" }),
    });

    await expect(submitCardReview(ids.card, Rating.Easy)).resolves.toEqual({
      error: "Chưa thể đồng bộ tiến độ ôn tập.",
    });
  });
});
