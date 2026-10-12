import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ precedence, protected-read boundary, exact topic relation và query budget C2.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: getLearningWorkspace.
// - Case thành công: enrolled learner nhận ordered syllabus, exact content, topic-scoped history và private managed-media delivery.
// - Case thất bại: malformed/missing route, query failure và malformed aggregate trả state an toàn.
// - Bảo mật/phân quyền: guest/unenrolled dừng trước protected syllabus/topic reads.
// - Ổn định/resilience: wrong-course topic không fallback; output không chứa option correctness.
// - Invariant cần giữ: success path dùng một auth và đúng ba DB requests, không client waterfall.
// - D3: memory check đi trong cùng topic query; "đã đúng" theo option đang đúng, không theo is_correct đã lưu; option không lộ is_correct.
// - D4: câu standalone (không group) có trong DTO; `answers` của câu exercise cũng theo option đang đúng (G3);
//   câu exercise không gửi `explanation` (lộ đáp án) trước khi trả lời;
//   topic chưa hoàn thành thì gọi RPC `d4_sync_topic_progress` đúng một lần, đã hoàn thành thì không gọi;
//   RPC lỗi lúc tải trang vẫn trả success với progress đã lưu;
//   syllabus đánh dấu `isCompleted` chỉ theo dòng progress đã hoàn thành của chính learner.
// - LF3: danh sách thẻ chưa xem/chưa Ổn-Dễ chỉ từ dòng user_flashcards của chính học viên (admin đọc được mọi dòng), thiếu dữ liệu thì lỗi rõ.
// - LF4: `dueCardIds` (thẻ đã xem mà đến hạn FSRS hoặc chưa Ổn/Dễ) lấy từ cùng embed `ratings` (thêm `next_review_date`, không thêm truy vấn),
//   chỉ từ dòng của chính học viên, biên thời gian trước/bằng/sau `now` của server, thẻ chưa xem không bao giờ đến hạn.
// - LF5 (G2/AC9): `explanation` của câu memory chỉ có khi đáp án đã lưu đang đúng (kể cả `null`); câu sai, chưa làm hoặc bị đổi key không có khóa này
//   và chuỗi giải thích không xuất hiện trong payload; câu exercise không bao giờ có.
// - Kết quả verify gần nhất: xem lần chạy cuối của `npx vitest run __tests__/actions/learning-workspace.test.ts`.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

const ids = {
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  card: "44444444-4444-4444-8444-444444444444",
  exercise: "55555555-5555-4555-8555-555555555555",
  group: "66666666-6666-4666-8666-666666666666",
  question: "77777777-7777-4777-8777-777777777777",
  option: "88888888-8888-4888-8888-888888888888",
  enrollment: "99999999-9999-4999-8999-999999999999",
  standalone: "12121212-1212-4212-8212-121212121212",
  standaloneRight: "13131313-1313-4313-8313-131313131313",
  standaloneWrong: "14141414-1414-4414-8414-141414141414",
};

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const course = {
  id: ids.course,
  slug: "toeic-nen-tang",
  title: "TOEIC nền tảng",
  enrollments: [{ id: ids.enrollment, user_id: user.id }],
};
const chapter = {
  id: ids.chapter,
  title: "Chương 1",
  order_index: 1,
  course_id: ids.course,
  removed_at: null,
  topics: [
    {
      id: ids.topic,
      slug: "bai-1",
      title: "Bài 1",
      status: "published",
      order_index: 1,
      chapter_id: ids.chapter,
      course_id: ids.course,
      removed_at: null,
    },
  ],
};
const topic = {
  ...chapter.topics[0],
  chapter: {
    id: ids.chapter,
    course_id: ids.course,
    removed_at: null,
  },
  cards: [
    {
      id: ids.card,
      topic_id: ids.topic,
      front_content: { word: "reliable" },
      back_content: { translation: "đáng tin cậy" },
      audio_url: null,
      image_url: null,
      order_index: 1,
      removed_at: null,
      // LF3: dòng user_flashcards của chính học viên, embed cùng truy vấn topic (không thêm round trip).
      ratings: [{ user_id: user.id, last_rating: 3, next_review_date: "2099-01-01T00:00:00Z" }],
    },
  ],
  progress: [
    {
      topic_id: ids.topic,
      is_flashcard_completed: true,
      is_exercise_completed: false,
      is_topic_completed: false,
    },
  ],
  exercises: [
    {
      id: ids.exercise,
      topic_id: ids.topic,
      course_id: ids.course,
      title: "Bài tập",
      activity_stage: "exercise",
      part_type: "single-choice",
      order_index: 1,
      removed_at: null,
      groups: [
        {
          id: ids.group,
          exercise_id: ids.exercise,
          passage_text: null,
          audio_url: null,
          image_url: null,
          order_index: 1,
          removed_at: null,
          questions: [
            {
              id: ids.question,
              exercise_id: ids.exercise,
              group_id: ids.group,
              course_id: ids.course,
              content: "Chọn đáp án đúng",
              explanation: "Giải thích",
              order_index: 1,
              removed_at: null,
              options: [
                {
                  id: ids.option,
                  question_id: ids.question,
                  content: "Đáp án A",
                  label: "A",
                  is_correct: true,
                  order_index: 1,
                  removed_at: null,
                },
              ],
              answers: [{ selected_option_id: ids.option }],
            },
          ],
        },
      ],
    },
  ],
};
// PostgREST embed `exercises.questions` trả cả câu thuộc group; DTO chỉ giữ câu group_id = null.
const standaloneQuestion = {
  id: ids.standalone,
  exercise_id: ids.exercise,
  group_id: null,
  course_id: ids.course,
  content: "Câu Part 5",
  explanation: "Đáp án đúng là A",
  order_index: 1,
  removed_at: null,
  options: [
    { id: ids.standaloneRight, question_id: ids.standalone, content: "Đúng", label: "A", is_correct: true, order_index: 1, removed_at: null },
    { id: ids.standaloneWrong, question_id: ids.standalone, content: "Sai", label: "B", is_correct: false, order_index: 2, removed_at: null },
  ],
  // Learner chọn option sai: không được tính vào `answers`.
  answers: [{ selected_option_id: ids.standaloneWrong }],
};
Object.assign(topic.exercises[0], {
  questions: [standaloneQuestion, topic.exercises[0].groups[0].questions[0]],
});
const syncedProgress = {
  is_flashcard_completed: true,
  is_memory_check_passed: true,
  is_exercise_completed: false,
  is_topic_completed: false,
  newly_completed: false,
};

function singleQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

function rowsQuery(data: unknown[], error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: { data: unknown[]; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve({ data, error }).then(resolve, reject);
  return query;
}

function mockSupabase({
  currentUser = user,
  authError = null,
  queries = {},
  rpc = vi.fn().mockResolvedValue({ data: syncedProgress, error: null }),
}: {
  currentUser?: typeof user | null;
  authError?: unknown;
  queries?: Record<string, Record<string, unknown>>;
  rpc?: ReturnType<typeof vi.fn>;
} = {}) {
  const from = vi.fn((table: string) => {
    const query = queries[table];
    if (!query) throw new Error(`Unexpected table query: ${table}`);
    return query;
  });
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: currentUser },
        error: authError,
      }),
    },
    from,
    rpc,
  } as never);
  return Object.assign(from, { rpc });
}

describe("getLearningWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid course syntax before creating a database client", async () => {
    await expect(
      getLearningWorkspace("BAD COURSE", "bad/topic"),
    ).resolves.toEqual({ status: "not_found" });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("requires authentication before classifying an invalid topic", async () => {
    const from = mockSupabase({ currentUser: null });

    await expect(
      getLearningWorkspace(course.slug, "bad/topic"),
    ).resolves.toEqual({ status: "auth_required" });
    expect(from).not.toHaveBeenCalled();
  });

  it("lets missing course and unenrolled states win before child classification", async () => {
    let from = mockSupabase({
      queries: { courses: singleQuery(null) },
    });
    await expect(
      getLearningWorkspace(course.slug, "bad/topic"),
    ).resolves.toEqual({ status: "not_found" });
    expect(from).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    from = mockSupabase({
      queries: {
        courses: singleQuery({ ...course, enrollments: [] }),
      },
    });
    await expect(
      getLearningWorkspace(course.slug, "bad/topic"),
    ).resolves.toEqual({
      status: "unenrolled",
      course: { slug: course.slug, title: course.title },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["courses"]);
  });

  it("returns topic unavailable without protected reads for enrolled malformed input", async () => {
    const from = mockSupabase({
      queries: { courses: singleQuery(course) },
    });

    await expect(
      getLearningWorkspace(course.slug, "bad/topic"),
    ).resolves.toEqual({
      status: "topic_unavailable",
      course: { slug: course.slug, title: course.title },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["courses"]);
  });

  it("does not fall back when the exact enrolled topic is unavailable", async () => {
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(null),
      },
    });

    await expect(
      getLearningWorkspace(course.slug, "khong-ton-tai"),
    ).resolves.toEqual({
      status: "topic_unavailable",
      course: { slug: course.slug, title: course.title },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "courses",
      "chapters",
      "topics",
    ]);
  });

  it("returns exact learner-safe content and history within the three-query budget", async () => {
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(topic),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.currentTopic.slug).toBe(topic.slug);
    expect(result.data.syllabus[0].topics[0].slug).toBe(topic.slug);
    expect(result.data.answers).toEqual({ [ids.question]: ids.option });
    expect(result.data.exercises[0].questions).toEqual([
      {
        id: ids.standalone,
        content: "Câu Part 5",
        order_index: 1,
        options: [
          { id: ids.standaloneRight, content: "Đúng", label: "A", order_index: 1 },
          { id: ids.standaloneWrong, content: "Sai", label: "B", order_index: 2 },
        ],
      },
    ]);
    expect(result.data.progress).toEqual({
      isFlashcardCompleted: true,
      isExerciseCompleted: false,
      isTopicCompleted: false,
    });
    expect(from.rpc).toHaveBeenCalledTimes(1);
    expect(from.rpc).toHaveBeenCalledWith("d4_sync_topic_progress", { p_topic_id: ids.topic });
    expect(result.data.exercises[0].groups[0].questions[0].options[0]).toEqual({
      id: ids.option,
      content: "Đáp án A",
      label: "A",
      order_index: 1,
    });
    expect(
      result.data.exercises[0].groups[0].questions[0].options[0],
    ).not.toHaveProperty("is_correct");
    // Explanation lộ đáp án nên không gửi trước khi trả lời, kể cả khi DB có giá trị.
    expect(result.data.exercises[0].questions[0]).not.toHaveProperty("explanation");
    expect(result.data.exercises[0].groups[0].questions[0]).not.toHaveProperty("explanation");
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "courses",
      "chapters",
      "topics",
    ]);
  });

  it("derives the unseen cards and the cards still to rate only from the learner's own flashcard rows (LF3)", async () => {
    const secondCard = { ...topic.cards[0], id: "45454545-4545-4545-8545-454545454545", order_index: 2, ratings: [] as unknown[] };
    const removedCard = { ...topic.cards[0], id: "46464646-4646-4646-8646-464646464646", order_index: 3, removed_at: "2026-01-01T00:00:00Z", ratings: [] as unknown[] };
    const load = async (cards: unknown[]) => {
      mockSupabase({
        queries: {
          courses: singleQuery(course),
          chapters: rowsQuery([chapter]),
          topics: singleQuery({ ...topic, cards }),
        },
      });
      const result = await getLearningWorkspace(course.slug, topic.slug);
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("expected success");
      return result.data;
    };

    // Thẻ 1 đã chấm Ổn, thẻ 2 chưa có dòng nào, thẻ đã gỡ không tính.
    expect(await load([topic.cards[0], secondCard, removedCard])).toMatchObject({ unseenCardIds: [secondCard.id], unratedCardIds: [secondCard.id] });
    // Có dòng với Lại (1): đã xem nhưng vẫn còn một thẻ chưa Ổn/Dễ.
    expect(await load([topic.cards[0], { ...secondCard, ratings: [{ user_id: user.id, last_rating: 1 }] }]))
      .toMatchObject({ unseenCardIds: [], unratedCardIds: [secondCard.id] });
    // Dòng của học viên khác (admin đọc được mọi dòng) không làm thẻ thành "đã xem".
    expect(await load([topic.cards[0], { ...secondCard, ratings: [{ user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", last_rating: 4 }] }]))
      .toMatchObject({ unseenCardIds: [secondCard.id], unratedCardIds: [secondCard.id] });
    // Topic không có thẻ active không khóa.
    expect(await load([removedCard])).toMatchObject({ unseenCardIds: [], unratedCardIds: [], dueCardIds: [] });
  });

  it("returns the cards due for review from the learner's own rows with the time boundary at the server clock (LF4 AC5)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T10:00:00.000Z"));
    try {
      const card = (suffix: string, index: number, ratings: unknown[]) => ({
        ...topic.cards[0],
        id: `5${suffix}000000-0000-4000-8000-000000000000`,
        order_index: index,
        ratings,
      });
      const own = (lastRating: number | null, nextReviewDate: string | null) => ({
        user_id: user.id,
        last_rating: lastRating,
        next_review_date: nextReviewDate,
      });
      const before = card("1", 1, [own(3, "2026-10-12T09:59:59.999Z")]);
      const equal = card("2", 2, [own(4, "2026-10-12T10:00:00.000Z")]);
      const after = card("3", 3, [own(3, "2026-10-12T10:00:00.001Z")]);
      const again = card("4", 4, [own(1, "2099-01-01T00:00:00Z")]);
      const hard = card("5", 5, [own(2, "2099-01-01T00:00:00Z")]);
      const unseen = card("6", 6, []);
      const otherLearnerOnly = card("7", 7, [
        { user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", last_rating: 1, next_review_date: "2000-01-01T00:00:00Z" },
      ]);
      const removed = { ...card("8", 8, [own(1, "2000-01-01T00:00:00Z")]), removed_at: "2026-01-01T00:00:00Z" };
      const topics = singleQuery({ ...topic, cards: [before, equal, after, again, hard, unseen, otherLearnerOnly, removed] });
      mockSupabase({ queries: { courses: singleQuery(course), chapters: rowsQuery([chapter]), topics } });

      const result = await getLearningWorkspace(course.slug, topic.slug);
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("expected success");
      // Trước hoặc đúng `now` thì đến hạn; sau `now` thì không. Lại/Khó đến hạn dù ngày còn xa. Thẻ chưa xem,
      // thẻ chỉ có dòng của người khác và thẻ đã gỡ không bao giờ đến hạn.
      expect(result.data.dueCardIds).toEqual([before.id, equal.id, again.id, hard.id]);
      expect(result.data.unseenCardIds).toEqual([unseen.id, otherLearnerOnly.id]);
      // G1: cùng embed `ratings` của truy vấn topic, thêm cột ngày; vẫn đúng ba request.
      const select = (topics.select as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(select).toContain("ratings:user_flashcards (user_id, last_rating, next_review_date)");
    } finally {
      vi.useRealTimers();
    }
  });

  it("scopes the embedded flashcard rows to the learner and fails loud when they were not loaded (LF3 G4/G7)", async () => {
    const topics = singleQuery(topic);
    mockSupabase({ queries: { courses: singleQuery(course), chapters: rowsQuery([chapter]), topics } });
    await getLearningWorkspace(course.slug, topic.slug);
    expect(topics.eq).toHaveBeenCalledWith("cards.ratings.user_id", user.id);

    const cardWithoutRatings = { ...topic.cards[0], ratings: undefined };
    mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery({ ...topic, cards: [cardWithoutRatings] }),
      },
    });
    const failed = await getLearningWorkspace(course.slug, topic.slug);
    expect(failed.status).toBe("error");
  });

  it("returns the memory check separately and derives passed answers from the current answer key", async () => {
    const memory = {
      exercise: "abababab-abab-4bab-8bab-abababababab",
      first: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      second: "efefefef-efef-4fef-8fef-efefefefefef",
    };
    const option = (questionId: string, suffix: string, isCorrect: boolean) => ({
      id: `${questionId.slice(0, 35)}${suffix}`,
      question_id: questionId,
      content: `Đáp án ${suffix}`,
      label: suffix === "1" ? "A" : "B",
      is_correct: isCorrect,
      order_index: Number(suffix),
      removed_at: null,
    });
    const memoryQuestion = (id: string, order: number, selectedSuffix: string) => ({
      id,
      exercise_id: memory.exercise,
      group_id: null,
      content: `Câu nhớ ${order}`,
      explanation: null,
      order_index: order,
      removed_at: null,
      options: [option(id, "1", true), option(id, "2", false)],
      answers: [{ user_id: user.id, selected_option_id: `${id.slice(0, 35)}${selectedSuffix}` }],
    });
    const memoryTopic = {
      ...topic,
      exercises: [
        ...topic.exercises,
        { ...topic.exercises[0], id: memory.exercise, activity_stage: "memory_check", part_type: null, groups: [] },
      ],
      memory_checks: [{
        id: memory.exercise,
        topic_id: ids.topic,
        activity_stage: "memory_check",
        removed_at: null,
        // Câu 1 chọn option đang đúng; câu 2 chọn option sai (dù learner có tự ghi is_correct).
        questions: [memoryQuestion(memory.first, 1, "1"), memoryQuestion(memory.second, 2, "2")],
      }],
    };
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(memoryTopic),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.exercises.map((exercise) => exercise.id)).toEqual([ids.exercise]);
    expect(result.data.memoryCheck?.questions.map((question) => question.id)).toEqual([memory.first, memory.second]);
    expect(result.data.memoryCheck?.questions[0].options[0]).not.toHaveProperty("is_correct");
    expect(result.data.isMemoryCheckPassed).toBe(false);
    expect(result.data.answers).toEqual({
      [ids.question]: ids.option,
      [memory.first]: `${memory.first.slice(0, 35)}1`,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["courses", "chapters", "topics"]);
  });

  it("sends a memory-check explanation only for questions whose stored answer is currently correct", async () => {
    const memoryExercise = "abababab-abab-4bab-8bab-abababababab";
    const questionIds = {
      correct: "c0c0c0c0-c0c0-4cc0-8cc0-c0c0c0c0c0c0",
      correctNoExplanation: "c1c1c1c1-c1c1-4cc1-8cc1-c1c1c1c1c1c1",
      wrong: "c2c2c2c2-c2c2-4cc2-8cc2-c2c2c2c2c2c2",
      unanswered: "c3c3c3c3-c3c3-4cc3-8cc3-c3c3c3c3c3c3",
      invalidated: "c4c4c4c4-c4c4-4cc4-8cc4-c4c4c4c4c4c4",
    };
    const optionId = (questionId: string, suffix: string) => `${questionId.slice(0, 35)}${suffix}`;
    const memoryQuestion = (
      id: string,
      order: number,
      explanation: string | null,
      selectedSuffix: string | null,
      // Option "1" là đáp án đúng ban đầu; với `keyFlipped` giáo viên đã đổi đáp án đúng sang option "2".
      keyFlipped = false,
    ) => ({
      id,
      exercise_id: memoryExercise,
      group_id: null,
      content: `Câu nhớ ${order}`,
      explanation,
      order_index: order,
      removed_at: null,
      options: [
        { id: optionId(id, "1"), question_id: id, content: "A", label: "A", is_correct: !keyFlipped, order_index: 1, removed_at: null },
        { id: optionId(id, "2"), question_id: id, content: "B", label: "B", is_correct: keyFlipped, order_index: 2, removed_at: null },
      ],
      answers: selectedSuffix
        ? [{ user_id: user.id, selected_option_id: optionId(id, selectedSuffix) }]
        : [],
    });
    const memoryTopic = {
      ...topic,
      memory_checks: [{
        id: memoryExercise,
        topic_id: ids.topic,
        activity_stage: "memory_check",
        removed_at: null,
        questions: [
          memoryQuestion(questionIds.correct, 1, "Vì sao A đúng", "1"),
          memoryQuestion(questionIds.correctNoExplanation, 2, null, "1"),
          memoryQuestion(questionIds.wrong, 3, "Lộ đáp án câu sai", "2"),
          memoryQuestion(questionIds.unanswered, 4, "Lộ đáp án câu chưa làm", null),
          // Learner đã chọn A khi A đúng; sau đó giáo viên đổi đáp án đúng sang B.
          memoryQuestion(questionIds.invalidated, 5, "Lộ đáp án câu bị đổi key", "1", true),
        ],
      }],
    };
    mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(memoryTopic),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const byId = new Map(result.data.memoryCheck?.questions.map((question) => [question.id, question]));
    expect(byId.get(questionIds.correct)?.explanation).toBe("Vì sao A đúng");
    // Câu đúng nhưng không có giải thích vẫn mang khóa `explanation: null` để client biết là không có gì để hiện.
    expect(byId.get(questionIds.correctNoExplanation)).toHaveProperty("explanation", null);
    for (const hidden of [questionIds.wrong, questionIds.unanswered, questionIds.invalidated]) {
      expect(byId.get(hidden)).not.toHaveProperty("explanation");
    }
    expect(Object.keys(result.data.answers)).toEqual(
      expect.arrayContaining([questionIds.correct, questionIds.correctNoExplanation]),
    );
    expect(Object.keys(result.data.answers)).not.toEqual(
      expect.arrayContaining([questionIds.wrong]),
    );
    // Không chuỗi giải thích nào của câu chưa đúng được lọt vào payload gửi xuống client.
    const payload = JSON.stringify(result.data);
    expect(payload).not.toContain("Lộ đáp án");
    // Câu exercise vẫn không bao giờ mang explanation.
    expect(result.data.exercises[0].questions[0]).not.toHaveProperty("explanation");
    expect(result.data.exercises[0].groups[0].questions[0]).not.toHaveProperty("explanation");
  });

  it("counts an exercise answer only while its selected option is currently correct", async () => {
    // Learner đã chọn option đúng, sau đó teacher đổi đáp án: câu không còn tính là đúng.
    const changedKey = {
      ...topic,
      exercises: [{
        ...topic.exercises[0],
        questions: [{ ...standaloneQuestion, answers: [{ selected_option_id: ids.standaloneRight }] }],
        groups: [{
          ...topic.exercises[0].groups[0],
          questions: [{
            ...topic.exercises[0].groups[0].questions[0],
            options: [{ ...topic.exercises[0].groups[0].questions[0].options[0], is_correct: false }],
          }],
        }],
      }],
    };
    mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(changedKey),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.answers).toEqual({ [ids.standalone]: ids.standaloneRight });
  });

  it("marks syllabus topics completed only from the learner's own completed progress", async () => {
    const doneTopic = {
      ...chapter.topics[0],
      id: "15151515-1515-4515-8515-151515151515",
      slug: "bai-2",
      order_index: 2,
      progress: [{ user_id: user.id, is_topic_completed: true }],
    };
    const otherLearnerTopic = {
      ...chapter.topics[0],
      id: "16161616-1616-4616-8616-161616161616",
      slug: "bai-3",
      order_index: 3,
      progress: [{ user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", is_topic_completed: true }],
    };
    const chapters = rowsQuery([
      {
        ...chapter,
        topics: [
          { ...chapter.topics[0], progress: [{ user_id: user.id, is_topic_completed: false }] },
          doneTopic,
          otherLearnerTopic,
        ],
      },
    ]);
    mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters,
        topics: singleQuery(topic),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(
      result.data.syllabus[0].topics.map(({ slug, isCompleted }) => ({ slug, isCompleted })),
    ).toEqual([
      { slug: "bai-1", isCompleted: false },
      { slug: "bai-2", isCompleted: true },
      { slug: "bai-3", isCompleted: false },
    ]);
    expect(chapters.eq).toHaveBeenCalledWith("topics.progress.user_id", user.id);
    expect(result.data.currentTopic).not.toHaveProperty("isCompleted");
  });

  it("skips the progress sync for a topic already completed", async () => {
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery({
          ...topic,
          progress: [{ ...topic.progress[0], is_exercise_completed: true, is_topic_completed: true }],
        }),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.progress?.isTopicCompleted).toBe(true);
    expect(from.rpc).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("uses the synced completion and keeps stored progress when the sync fails", async () => {
    let from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(topic),
      },
      rpc: vi.fn().mockResolvedValue({
        data: { ...syncedProgress, is_exercise_completed: true, is_topic_completed: true, newly_completed: true },
        error: null,
      }),
    });
    let result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status === "success" && result.data.progress).toEqual({
      isFlashcardCompleted: true,
      isExerciseCompleted: true,
      isTopicCompleted: true,
    });
    expect(from.rpc).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(topic),
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "sensitive sql" } }),
    });
    result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status === "success" && result.data.progress).toEqual({
      isFlashcardCompleted: true,
      isExerciseCompleted: false,
      isTopicCompleted: false,
    });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(from.rpc).toHaveBeenCalledTimes(1);
  });

  it("treats a topic without a memory check as passed", async () => {
    mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery({ ...topic, memory_checks: [] }),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.memoryCheck).toBeNull();
    expect(result.data.isMemoryCheckPassed).toBe(true);
  });

  it("maps managed group media to authenticated GET while preserving external URLs", async () => {
    const oldOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:45321";
    try {
      const path = `${ids.course}/${ids.topic}/${user.id}/media.png`;
      const mediaTopic = {
        ...topic,
        exercises: [{
          ...topic.exercises[0],
          groups: [{
            ...topic.exercises[0].groups[0],
            image_url: `storage://question_group_images/${path}`,
            audio_url: "https://cdn.example.com/sound.mp3",
          }],
        }],
      };
      mockSupabase({
        queries: {
          courses: singleQuery(course),
          chapters: rowsQuery([chapter]),
          topics: singleQuery(mediaTopic),
        },
      });
      const result = await getLearningWorkspace(course.slug, topic.slug);
      expect(result.status).toBe("success");
      if (result.status !== "success") return;
      expect(result.data.exercises[0].groups[0].image_url)
        .toBe(`/api/question-group-media/${ids.group}/image`);
      expect(result.data.exercises[0].groups[0].audio_url)
        .toBe("https://cdn.example.com/sound.mp3");
    } finally {
      if (oldOrigin === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = oldOrigin;
    }
  });

  it("rejects a mismatched parent chain without serializing content", async () => {
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery({
          ...topic,
          chapter: { ...topic.chapter, course_id: ids.topic },
        }),
      },
    });

    await expect(
      getLearningWorkspace(course.slug, topic.slug),
    ).resolves.toEqual({
      status: "topic_unavailable",
      course: { slug: course.slug, title: course.title },
    });
    expect(from).toHaveBeenCalledTimes(3);
    expect(from.rpc).not.toHaveBeenCalled();
  });
});
