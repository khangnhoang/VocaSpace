import { beforeEach, describe, expect, it, vi } from "vitest";
import { Rating } from "ts-fsrs";
import { submitCardReview } from "@/app/actions/review";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ trusted card context (kèm enrollment đọc cùng lượt), bounded FSRS write path và việc ghi + đồng bộ D4 qua một RPC `lf2_submit_card_review`.
// - Loại test: Server Action với Supabase boundary mock; quy tắc ghi, RLS, hàng của người khác và lỗi sync thật được kiểm bằng DB thật ở `__tests__/integration/lf2-learning-action-rpcs.test.ts`.
// - Đối tượng: submitCardReview.
// - Case thành công: accessible active card có enrollment (embed trong context) tạo/cập nhật FSRS, kể cả legacy metadata, qua đúng một RPC rồi trả `topicProgress` từ kết quả RPC.
//   - LF1: lần chấm được gửi thành `p_last_rating` cùng `p_fsrs_meta` trong một lần ghi, cho cả tạo mới (`p_user_flashcard_id` null) lẫn cập nhật (AC5).
// - Case thất bại: malformed rating, inaccessible parent, missing enrollment, invalid metadata, RPC lỗi, kết quả sai shape và `mutation_failed` (0 dòng được ghi) trả safe failure.
// - Bảo mật/phân quyền: missing auth, mismatched card/topic/chapter không tạo RPC; course id lấy từ topic tin cậy, không từ client; không có enrollment trong embed thì đọc lại enrollments như trước.
// - Ổn định/resilience: RPC không xác nhận dòng được ghi không báo success và không có progress; progress null hoặc sai shape sau khi đã ghi vẫn `success: true` + `progressError`.
// - Invariant cần giữ: caller chỉ gửi cardId + rating; FSRS scheduling semantics không đổi; không ghi trực tiếp bảng nào bằng Data API.
// - Kết quả verify gần nhất: 18/18 passed (2026-10-11) bằng `npx vitest run __tests__/actions/review.test.ts`.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const ids = {
  user: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  card: "44444444-4444-4444-8444-444444444444",
  userFlashcard: "55555555-5555-4555-8555-555555555555",
};

function singleQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

const syncedProgress = {
  is_flashcard_completed: true,
  is_memory_check_passed: true,
  is_exercise_completed: true,
  is_topic_completed: true,
  newly_completed: true,
};
const topicProgress = {
  isFlashcardCompleted: true,
  isMemoryCheckPassed: true,
  isExerciseCompleted: true,
  isTopicCompleted: true,
  newlyCompleted: true,
};
const PROGRESS_SYNC_ERROR = "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học.";
const MUTATION_ERROR = "Chưa thể đồng bộ tiến độ ôn tập.";

function mockSupabase(
  queries: Record<string, Record<string, unknown>> = {},
  currentUser: { id: string } | null = { id: ids.user },
  rpc = vi.fn().mockResolvedValue({ data: { status: "ok", progress: syncedProgress }, error: null }),
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
    rpc,
  } as never);
  return Object.assign(from, { rpc });
}

const enrolledCourse = { id: ids.course, enrollments: [{ id: "enrollment", user_id: ids.user }] };
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
    course: enrolledCourse,
  },
  user_flashcards: [],
};

describe("submitCardReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("rejects malformed input before creating a database client", async () => {
    await expect(
      submitCardReview("bad-id", Rating.Manual),
    ).resolves.toEqual({ error: "Dữ liệu đánh giá thẻ không hợp lệ." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("does not call the RPC without an authenticated user", async () => {
    const from = mockSupabase({}, null);

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: "Vui lòng đăng nhập" });
    expect(from).not.toHaveBeenCalled();
    expect(from.rpc).not.toHaveBeenCalled();
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
    expect(from.rpc).not.toHaveBeenCalled();
  });

  it("reads the card and the learner's own enrollment in one query, then creates FSRS state and syncs progress in one RPC", async () => {
    const cards = singleQuery(card);
    const from = mockSupabase({ cards });

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      success: true,
      topicProgress,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["cards"]);
    expect(cards.eq).toHaveBeenCalledWith("id", ids.card);
    expect(cards.eq).toHaveBeenCalledWith("topic.course.enrollments.user_id", ids.user);
    expect(from.rpc).toHaveBeenCalledTimes(1);
    expect(from.rpc).toHaveBeenCalledWith(
      "lf2_submit_card_review",
      expect.objectContaining({
        p_card_id: ids.card,
        p_user_flashcard_id: null,
        p_last_rating: Rating.Good,
        p_fsrs_meta: expect.objectContaining({ reps: expect.any(Number) }),
        p_next_review_date: expect.any(String),
        p_updated_at: expect.any(String),
      }),
    );
  });

  it("falls back to the enrollment read when the context shows no enrollment, and denies when there is none", async () => {
    const enrollments = singleQuery(null);
    const from = mockSupabase({
      cards: singleQuery({ ...card, topic: { ...card.topic, course: { id: ids.course, enrollments: [] } } }),
      enrollments,
    });

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      error: "Bạn cần ghi danh khóa học để lưu ôn tập.",
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["cards", "enrollments"]);
    expect(enrollments.eq).toHaveBeenCalledWith("user_id", ids.user);
    expect(enrollments.eq).toHaveBeenCalledWith("course_id", ids.course);
    expect(from.rpc).not.toHaveBeenCalled();
  });

  it("keeps today's result for an enrolled learner whose course row is hidden from the embed", async () => {
    const from = mockSupabase({
      cards: singleQuery({ ...card, topic: { ...card.topic, course: null } }),
      enrollments: singleQuery({ id: "enrollment" }),
    });

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ success: true, topicProgress });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["cards", "enrollments"]);
    expect(from.rpc).toHaveBeenCalledTimes(1);
  });

  it("ignores an embedded enrollment of another user or another course", async () => {
    const from = mockSupabase({
      cards: singleQuery({
        ...card,
        topic: {
          ...card.topic,
          course: { id: ids.course, enrollments: [{ id: "other", user_id: ids.topic }] },
        },
      }),
      enrollments: singleQuery(null),
    });

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      error: "Bạn cần ghi danh khóa học để lưu ôn tập.",
    });
    expect(from.rpc).not.toHaveBeenCalled();
  });

  it("keeps a saved review successful, with a progress error, when the RPC returns no progress", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "ok", progress: null }, error: null });
    mockSupabase({ cards: singleQuery(card) }, { id: ids.user }, rpc);

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      success: true,
      progressError: PROGRESS_SYNC_ERROR,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps a saved review successful when the RPC progress is malformed", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "ok", progress: { unexpected: true } }, error: null });
    mockSupabase({ cards: singleQuery(card) }, { id: ids.user }, rpc);

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      success: true,
      progressError: PROGRESS_SYNC_ERROR,
    });
  });

  it("updates legacy seeded FSRS metadata without learning_steps through the update branch", async () => {
    const from = mockSupabase({
      cards: singleQuery({
        ...card,
        user_flashcards: [
          {
            id: ids.userFlashcard,
            card_id: ids.card,
            fsrs_meta: {
              due: "2026-07-01T01:00:00.000Z",
              stability: 1,
              difficulty: 5,
              elapsed_days: 1,
              scheduled_days: 1,
              reps: 1,
              lapses: 0,
              state: 1,
              last_review: "2026-06-30T01:00:00.000Z",
            },
          },
        ],
      }),
    });

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      success: true,
      topicProgress,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["cards"]);
    expect(from.rpc).toHaveBeenCalledWith(
      "lf2_submit_card_review",
      expect.objectContaining({
        p_user_flashcard_id: ids.userFlashcard,
        p_fsrs_meta: expect.objectContaining({ learning_steps: expect.any(Number) }),
        p_last_rating: Rating.Good,
      }),
    );
  });

  it("does not schedule from invalid stored FSRS metadata", async () => {
    const from = mockSupabase({
      cards: singleQuery({
        ...card,
        user_flashcards: [{ id: ids.userFlashcard, card_id: ids.card, fsrs_meta: { stability: "bad" } }],
      }),
    });

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({
      error: "Dữ liệu ôn tập hiện tại không hợp lệ.",
    });
    expect(from.rpc).not.toHaveBeenCalled();
  });

  it.each([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy])(
    "sends rating %i with the FSRS state on both the first review and a later one",
    async (rating) => {
      const first = mockSupabase({ cards: singleQuery(card) });
      await submitCardReview(ids.card, rating);
      expect(first.rpc).toHaveBeenCalledWith(
        "lf2_submit_card_review",
        expect.objectContaining({
          p_user_flashcard_id: null,
          p_last_rating: rating,
          p_fsrs_meta: expect.objectContaining({ reps: expect.any(Number) }),
        }),
      );

      const later = mockSupabase({
        cards: singleQuery({
          ...card,
          user_flashcards: [{ id: ids.userFlashcard, card_id: ids.card, fsrs_meta: null }],
        }),
      });
      await submitCardReview(ids.card, rating);
      expect(later.rpc).toHaveBeenCalledWith(
        "lf2_submit_card_review",
        expect.objectContaining({
          p_user_flashcard_id: ids.userFlashcard,
          p_last_rating: rating,
          p_fsrs_meta: expect.objectContaining({ reps: expect.any(Number) }),
        }),
      );
    },
  );

  it("returns a safe failure, without leaking the database error, when the RPC fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "sensitive error" } });
    mockSupabase({ cards: singleQuery(card) }, { id: ids.user }, rpc);

    const result = await submitCardReview(ids.card, Rating.Easy);

    expect(result).toEqual({ error: MUTATION_ERROR });
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("reports the mutation error, with no progress, when the RPC confirms no written row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "mutation_failed" }, error: null });
    mockSupabase({ cards: singleQuery(card) }, { id: ids.user }, rpc);

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: MUTATION_ERROR });
  });

  it("reports the mutation error for an unrecognised RPC result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "surprise" }, error: null });
    mockSupabase({ cards: singleQuery(card) }, { id: ids.user }, rpc);

    await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: MUTATION_ERROR });
  });
});
