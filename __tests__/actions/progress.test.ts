import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ parsed-only inputs, trusted parent relations, checked answer writes và đồng bộ tiến độ D4 sau khi ghi.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: submitQuestionAnswer.
// - Case thành công: câu có hai option đúng chấm đúng cả hai (G3); kết quả kèm `topicProgress` từ RPC `d4_sync_topic_progress`.
// - Case thất bại: malformed ID, cross-question option, parent không tin cậy, missing enrollment và DB error không ghi và không sync.
// - Bảo mật/phân quyền: missing auth, untrusted relation hoặc previewer-only không tạo mutation hay RPC.
// - Ổn định/resilience: RPC lỗi, kết quả RPC sai shape hoặc tải lại memory check lỗi sau khi ghi vẫn trả `success: true` + kết quả chấm + `progressError`; giá trị chưa xác minh để trống.
// - Invariant cần giữ: mỗi valid write kiểm tra enrollment cùng user/course trước checked mutation; tiến độ chỉ do RPC suy ra.
// - D3 G3/G7: chưa qua memory check thì không ghi đáp án exercise; is_correct learner tự ghi không mở cổng.
// - Kết quả verify gần nhất: 14/14 passed (2026-10-02) bằng `npx vitest run __tests__/actions/progress.test.ts`.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const ids = {
  user: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  exercise: "44444444-4444-4444-8444-444444444444",
  question: "55555555-5555-4555-8555-555555555555",
  optionOne: "66666666-6666-4666-8666-666666666666",
  optionTwo: "77777777-7777-4777-8777-777777777777",
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
  for (const method of ["upsert", "select", "eq"]) {
    query[method] = vi.fn(() => query);
  }
  query.single = vi.fn().mockResolvedValue({ data: error ? null : { id: "row" }, error });
  return query;
}

function defaultQuery(table: string) {
  if (table === "enrollments") return singleQuery({ id: "enrollment" });
  // No active memory check unless a test provides one.
  if (table === "exercises") return singleQuery(null);
  return undefined;
}

const memoryIds = {
  exercise: "99999999-9999-4999-8999-999999999991",
  first: "99999999-9999-4999-8999-999999999992",
  second: "99999999-9999-4999-8999-999999999993",
};
const rightOption = (order: number) => `aaaaaaaa-0000-4000-8000-00000000000${order}`;
const wrongOption = (order: number) => `bbbbbbbb-0000-4000-8000-00000000000${order}`;

function memoryCheckRow(selected: Record<string, string | null>) {
  const memoryQuestionRow = (questionId: string, order: number) => ({
    id: questionId,
    exercise_id: memoryIds.exercise,
    group_id: null,
    content: `Câu nhớ ${order}`,
    explanation: null,
    order_index: order,
    removed_at: null,
    options: [
      { id: rightOption(order), question_id: questionId, content: "đúng", label: "A", is_correct: true, order_index: 1, removed_at: null },
      { id: wrongOption(order), question_id: questionId, content: "sai", label: "B", is_correct: false, order_index: 2, removed_at: null },
    ],
    answers: selected[questionId] ? [{ user_id: ids.user, selected_option_id: selected[questionId] }] : [],
  });
  return {
    id: memoryIds.exercise,
    topic_id: ids.topic,
    activity_stage: "memory_check",
    removed_at: null,
    questions: [memoryQuestionRow(memoryIds.first, 1), memoryQuestionRow(memoryIds.second, 2)],
  };
}

const syncedProgress = {
  is_flashcard_completed: true,
  is_memory_check_passed: true,
  is_exercise_completed: false,
  is_topic_completed: false,
  newly_completed: false,
};
const topicProgress = {
  isFlashcardCompleted: true,
  isMemoryCheckPassed: true,
  isExerciseCompleted: false,
  isTopicCompleted: false,
  newlyCompleted: false,
};
const PROGRESS_SYNC_ERROR = "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.";

function mockSupabase(
  queries: Record<string, Record<string, unknown>> = {},
  currentUser: { id: string } | null = { id: ids.user },
  rpc = vi.fn().mockResolvedValue({ data: syncedProgress, error: null }),
) {
  const from = vi.fn((table: string) => {
    const query = queries[table] ?? defaultQuery(table);
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

const question = {
  id: ids.question,
  exercise_id: ids.exercise,
  course_id: ids.course,
  explanation: "Hãy đọc lại ngữ liệu.",
  removed_at: null,
  options: [
    {
      id: ids.optionOne,
      question_id: ids.question,
      is_correct: true,
      removed_at: null,
    },
    {
      id: ids.optionTwo,
      question_id: ids.question,
      is_correct: true,
      removed_at: null,
    },
  ],
  exercise: {
    id: ids.exercise,
    topic_id: ids.topic,
    course_id: ids.course,
    removed_at: null,
    topic: {
      id: ids.topic,
      chapter_id: ids.chapter,
      course_id: ids.course,
      status: "published",
      removed_at: null,
      chapter: { id: ids.chapter, course_id: ids.course, removed_at: null },
    },
  },
};

describe("submitQuestionAnswer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed answer IDs before creating a client", async () => {
    await expect(submitQuestionAnswer("bad-id", "bad-id")).resolves.toEqual({
      error: "Dữ liệu câu trả lời không hợp lệ.",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("does not query, write or sync without an authenticated user", async () => {
    const from = mockSupabase({}, null);
    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toEqual({
      error: "Vui lòng đăng nhập",
    });
    expect(from).not.toHaveBeenCalled();
    expect(from.rpc).not.toHaveBeenCalled();
  });

  it("rejects an option that does not belong to the submitted question", async () => {
    const from = mockSupabase({ questions: singleQuery(question) });
    const foreignOption = "88888888-8888-4888-8888-888888888888";

    await expect(
      submitQuestionAnswer(ids.question, foreignOption),
    ).resolves.toEqual({ error: "Đáp án không khả dụng." });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["questions", "enrollments"]);
    expect(from.rpc).not.toHaveBeenCalled();
  });

  it("does not write or sync for a question under a draft topic", async () => {
    const from = mockSupabase({
      questions: singleQuery({
        ...question,
        exercise: { ...question.exercise, topic: { ...question.exercise.topic, status: "draft" } },
      }),
    });
    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toEqual({
      error: "Câu hỏi không khả dụng.",
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from.rpc).not.toHaveBeenCalled();
  });

  it("denies question answers when the actor has no course enrollment", async () => {
    const from = mockSupabase({
      questions: singleQuery(question),
      enrollments: singleQuery(null),
    });
    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toEqual({
      error: "Bạn cần ghi danh khóa học để lưu câu trả lời.",
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["questions", "enrollments"]);
    expect(from.rpc).not.toHaveBeenCalled();
  });

  it("grades either correct option of an exercise question as correct and returns synced progress", async () => {
    const mutation = mutationQuery();
    const enrollment = singleQuery({ id: "enrollment" });
    const from = mockSupabase({
      questions: singleQuery(question),
      enrollments: enrollment,
      user_question_answers: mutation,
    });

    await expect(
      submitQuestionAnswer(ids.question, ids.optionTwo),
    ).resolves.toEqual({ success: true, isCorrect: true, topicProgress });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "questions",
      "enrollments",
      "exercises",
      "user_question_answers",
    ]);
    expect(mutation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        question_id: ids.question,
        selected_option_id: ids.optionTwo,
        is_correct: true,
      }),
      { onConflict: "user_id,question_id" },
    );
    expect(from.rpc).toHaveBeenCalledTimes(1);
    expect(from.rpc).toHaveBeenCalledWith("d4_sync_topic_progress", { p_topic_id: ids.topic });
    expect(enrollment.eq).toHaveBeenCalledWith("user_id", ids.user);
    expect(enrollment.eq).toHaveBeenCalledWith("course_id", ids.course);
  });

  it("returns the explanation for a wrong exercise answer", async () => {
    const singleCorrect = {
      ...question,
      options: [question.options[0], { ...question.options[1], is_correct: false }],
    };
    mockSupabase({ questions: singleQuery(singleCorrect), user_question_answers: mutationQuery() });

    await expect(submitQuestionAnswer(ids.question, ids.optionTwo)).resolves.toEqual({
      success: true,
      isCorrect: false,
      explanation: "Hãy đọc lại ngữ liệu.",
      topicProgress,
    });
  });

  it("keeps a saved answer successful when the progress sync fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mutation = mutationQuery();
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "sensitive sql" } });
    mockSupabase({ questions: singleQuery(question), user_question_answers: mutation }, { id: ids.user }, rpc);

    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toEqual({
      success: true,
      isCorrect: true,
      progressError: PROGRESS_SYNC_ERROR,
    });
    expect(mutation.upsert).toHaveBeenCalledTimes(1);
  });

  it("does not invent progress from a malformed sync result", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({ data: { is_topic_completed: true }, error: null });
    mockSupabase({ questions: singleQuery(question), user_question_answers: mutationQuery() }, { id: ids.user }, rpc);

    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toEqual({
      success: true,
      isCorrect: true,
      progressError: PROGRESS_SYNC_ERROR,
    });
  });

  it("refuses exercise answers until the memory check is passed", async () => {
    // Câu 2 đang chọn option sai; cột is_correct learner tự ghi không được đọc.
    const gate = singleQuery(memoryCheckRow({ [memoryIds.first]: rightOption(1), [memoryIds.second]: wrongOption(2) }));
    const answerMutation = mutationQuery();
    const from = mockSupabase({
      questions: singleQuery(question),
      exercises: gate,
      user_question_answers: answerMutation,
    });

    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toEqual({
      error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.",
      errorCode: "MEMORY_CHECK_REQUIRED",
    });
    expect(answerMutation.upsert).not.toHaveBeenCalled();
    expect(from.rpc).not.toHaveBeenCalled();
    expect(gate.eq).toHaveBeenCalledWith("topic_id", ids.topic);
    expect(gate.eq).toHaveBeenCalledWith("activity_stage", "memory_check");
    expect(gate.eq).toHaveBeenCalledWith("questions.answers.user_id", ids.user);
  });

  it("allows exercise writes once every memory question is currently correct", async () => {
    const answerMutation = mutationQuery();
    mockSupabase({
      questions: singleQuery(question),
      exercises: singleQuery(memoryCheckRow({ [memoryIds.first]: rightOption(1), [memoryIds.second]: rightOption(2) })),
      user_question_answers: answerMutation,
    });

    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toMatchObject({ success: true, isCorrect: true });
    expect(answerMutation.upsert).toHaveBeenCalledTimes(1);
  });

  const memoryQuestion = {
    ...question,
    id: memoryIds.first,
    exercise_id: memoryIds.exercise,
    explanation: null,
    options: question.options.map((option) => ({ ...option, question_id: memoryIds.first })),
    exercise: { ...question.exercise, id: memoryIds.exercise, activity_stage: "memory_check" },
  };

  it("grades a memory question by the selected option and reports the derived passed state", async () => {
    const answerMutation = mutationQuery();
    const from = mockSupabase({
      questions: singleQuery(memoryQuestion),
      exercises: singleQuery(memoryCheckRow({ [memoryIds.first]: rightOption(1), [memoryIds.second]: null })),
      user_question_answers: answerMutation,
    });

    await expect(submitQuestionAnswer(memoryIds.first, ids.optionTwo)).resolves.toEqual({
      success: true,
      isCorrect: true,
      isMemoryCheckPassed: false,
      topicProgress,
    });
    expect(answerMutation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ question_id: memoryIds.first, selected_option_id: ids.optionTwo, is_correct: true }),
      { onConflict: "user_id,question_id" },
    );
    // Câu memory không qua cổng; trạng thái qua được tính sau khi ghi.
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "questions",
      "enrollments",
      "user_question_answers",
      "exercises",
    ]);
  });

  it("keeps a saved memory answer successful when reloading the memory check fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const answerMutation = mutationQuery();
    const from = mockSupabase({
      questions: singleQuery(memoryQuestion),
      exercises: singleQuery(null, { message: "sensitive error" }),
      user_question_answers: answerMutation,
    });

    await expect(submitQuestionAnswer(memoryIds.first, ids.optionTwo)).resolves.toEqual({
      success: true,
      isCorrect: true,
      topicProgress,
      progressError: PROGRESS_SYNC_ERROR,
    });
    expect(answerMutation.upsert).toHaveBeenCalledTimes(1);
    expect(from.rpc).toHaveBeenCalledTimes(1);
  });

  it("returns a safe failure without syncing when the answer upsert fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const from = mockSupabase({
      questions: singleQuery(question),
      user_question_answers: mutationQuery({ message: "sensitive error" }),
    });

    await expect(
      submitQuestionAnswer(ids.question, ids.optionOne),
    ).resolves.toEqual({ error: "Không thể lưu câu trả lời lúc này." });
    expect(from.rpc).not.toHaveBeenCalled();
  });
});
