import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDeckReviewCards } from "@/app/actions/profile";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ queue/count eligibility đồng nhất với submitCardReview.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: getDeckReviewCards.
// - Case thành công: chỉ active published card context xuất hiện trong queue và counters.
// - Case thất bại: metadata/card query error trả safe failure.
// - Bảo mật/phân quyền: queue không trả client-owned topic identity hoặc inaccessible card.
// - Ổn định/resilience: stale/draft card không làm tăng due/learning counts.
// - Invariant cần giữ: queue và mutation dùng cùng card-topic-chapter eligibility.
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
