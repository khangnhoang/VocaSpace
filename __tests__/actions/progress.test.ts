import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  submitQuestionAnswer,
  updateStageProgress,
} from "@/app/actions/progress";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ parsed-only inputs, trusted parent relations và checked learning writes.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: updateStageProgress và submitQuestionAnswer.
// - Case thành công: valid content access giữ flags hiện tại và lưu đúng answer/progress.
// - Case thất bại: malformed ID, inaccessible parent, missing enrollment, cross-question option và DB error không báo success.
// - Bảo mật/phân quyền: missing auth, untrusted relation hoặc previewer-only không tạo mutation.
// - Ổn định/resilience: multiple-correct-option giữ first-returned correctness semantics hiện tại.
// - Invariant cần giữ: mỗi valid write kiểm tra enrollment cùng user/course trước checked mutation.
// - D3 G3/G7: chưa qua memory check thì không ghi đáp án exercise hay exercise stage; câu memory chấm theo option đang đúng; is_correct learner tự ghi không mở cổng.
// - Kết quả verify gần nhất: passed trong focused `npm.cmd test -- --run __tests__/actions/progress.test.ts __tests__/actions/review.test.ts` (14/14 toàn cặp).

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

function mockSupabase(
  queries: Record<string, Record<string, unknown>> = {},
  currentUser: { id: string } | null = { id: ids.user },
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
  } as never);
  return from;
}

const progressTopic = {
  id: ids.topic,
  course_id: ids.course,
  status: "published",
  removed_at: null,
  chapter: { id: ids.chapter, course_id: ids.course, removed_at: null },
  progress: [
    {
      topic_id: ids.topic,
      is_flashcard_completed: true,
      is_exercise_completed: false,
      is_topic_completed: false,
    },
  ],
};

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

describe("learning progress actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed progress and answer IDs before creating a client", async () => {
    await expect(updateStageProgress("bad-id", "flashcard")).resolves.toEqual({
      error: "Dữ liệu tiến độ không hợp lệ.",
    });
    await expect(submitQuestionAnswer("bad-id", "bad-id")).resolves.toEqual({
      error: "Dữ liệu câu trả lời không hợp lệ.",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("preserves the other stage flag and checks the progress upsert", async () => {
    const mutation = mutationQuery();
    const enrollment = singleQuery({ id: "enrollment" });
    const from = mockSupabase({
      topics: singleQuery(progressTopic),
      enrollments: enrollment,
      user_topic_progress: mutation,
    });

    await expect(updateStageProgress(ids.topic, "exercise")).resolves.toEqual({
      success: true,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "topics",
      "enrollments",
      "exercises",
      "user_topic_progress",
    ]);
    expect(mutation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: ids.user,
        topic_id: ids.topic,
        is_flashcard_completed: true,
        is_exercise_completed: true,
        is_topic_completed: true,
      }),
      { onConflict: "user_id,topic_id" },
    );
    expect(enrollment.eq).toHaveBeenCalledWith("user_id", ids.user);
    expect(enrollment.eq).toHaveBeenCalledWith("course_id", ids.course);
  });

  it("does not mutate progress for an inconsistent topic parent", async () => {
    const from = mockSupabase({
      topics: singleQuery({
        ...progressTopic,
        chapter: { ...progressTopic.chapter, course_id: ids.topic },
      }),
    });

    await expect(updateStageProgress(ids.topic, "flashcard")).resolves.toEqual({
      error: "Bài học không khả dụng.",
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("denies progress when the actor has no course enrollment", async () => {
    const from = mockSupabase({
      topics: singleQuery(progressTopic),
      enrollments: singleQuery(null),
    });
    await expect(updateStageProgress(ids.topic, "flashcard")).resolves.toEqual({
      error: "Bạn cần ghi danh khóa học để lưu tiến độ.",
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["topics", "enrollments"]);
  });

  it("rejects an option that does not belong to the submitted question", async () => {
    const from = mockSupabase({ questions: singleQuery(question) });
    const foreignOption = "88888888-8888-4888-8888-888888888888";

    await expect(
      submitQuestionAnswer(ids.question, foreignOption),
    ).resolves.toEqual({ error: "Đáp án không khả dụng." });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["questions", "enrollments"]);
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
  });

  it("keeps first-returned correct-option semantics after enrollment check", async () => {
    const mutation = mutationQuery();
    const enrollment = singleQuery({ id: "enrollment" });
    const from = mockSupabase({
      questions: singleQuery(question),
      enrollments: enrollment,
      user_question_answers: mutation,
    });

    await expect(
      submitQuestionAnswer(ids.question, ids.optionTwo),
    ).resolves.toEqual({
      success: true,
      isCorrect: false,
      explanation: "Hãy đọc lại ngữ liệu.",
    });
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
        is_correct: false,
      }),
      { onConflict: "user_id,question_id" },
    );
    expect(enrollment.eq).toHaveBeenCalledWith("user_id", ids.user);
    expect(enrollment.eq).toHaveBeenCalledWith("course_id", ids.course);
  });

  it("refuses exercise answers and exercise stage until the memory check is passed", async () => {
    // Câu 2 đang chọn option sai; cột is_correct learner tự ghi không được đọc.
    const gate = singleQuery(memoryCheckRow({ [memoryIds.first]: rightOption(1), [memoryIds.second]: wrongOption(2) }));
    const answerMutation = mutationQuery();
    const progressMutation = mutationQuery();
    mockSupabase({
      questions: singleQuery(question),
      topics: singleQuery(progressTopic),
      exercises: gate,
      user_question_answers: answerMutation,
      user_topic_progress: progressMutation,
    });
    const required = {
      error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.",
      errorCode: "MEMORY_CHECK_REQUIRED",
    };

    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toEqual(required);
    await expect(updateStageProgress(ids.topic, "exercise")).resolves.toEqual(required);
    expect(answerMutation.upsert).not.toHaveBeenCalled();
    expect(progressMutation.upsert).not.toHaveBeenCalled();
    expect(gate.eq).toHaveBeenCalledWith("topic_id", ids.topic);
    expect(gate.eq).toHaveBeenCalledWith("activity_stage", "memory_check");
    expect(gate.eq).toHaveBeenCalledWith("questions.answers.user_id", ids.user);
  });

  it("allows exercise writes once every memory question is currently correct", async () => {
    const answerMutation = mutationQuery();
    const progressMutation = mutationQuery();
    mockSupabase({
      questions: singleQuery(question),
      topics: singleQuery(progressTopic),
      exercises: singleQuery(memoryCheckRow({ [memoryIds.first]: rightOption(1), [memoryIds.second]: rightOption(2) })),
      user_question_answers: answerMutation,
      user_topic_progress: progressMutation,
    });

    await expect(submitQuestionAnswer(ids.question, ids.optionOne)).resolves.toMatchObject({ success: true, isCorrect: true });
    await expect(updateStageProgress(ids.topic, "exercise")).resolves.toEqual({ success: true });
    expect(answerMutation.upsert).toHaveBeenCalledTimes(1);
    expect(progressMutation.upsert).toHaveBeenCalledTimes(1);
  });

  it("grades a memory question by the selected option and reports the derived passed state", async () => {
    const memoryQuestion = {
      ...question,
      id: memoryIds.first,
      exercise_id: memoryIds.exercise,
      explanation: null,
      options: question.options.map((option) => ({ ...option, question_id: memoryIds.first })),
      exercise: { ...question.exercise, id: memoryIds.exercise, activity_stage: "memory_check" },
    };
    const answerMutation = mutationQuery();
    const from = mockSupabase({
      questions: singleQuery(memoryQuestion),
      exercises: singleQuery(memoryCheckRow({ [memoryIds.first]: rightOption(1), [memoryIds.second]: null })),
      user_question_answers: answerMutation,
    });

    // Option thứ hai cũng đúng: G7 chấm đúng, khác cách chấm exercise.
    await expect(submitQuestionAnswer(memoryIds.first, ids.optionTwo)).resolves.toEqual({
      success: true,
      isCorrect: true,
      isMemoryCheckPassed: false,
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

  it("keeps the flashcard stage independent of the memory check", async () => {
    const from = mockSupabase({
      topics: singleQuery(progressTopic),
      exercises: singleQuery(memoryCheckRow({})),
      user_topic_progress: mutationQuery(),
    });
    await expect(updateStageProgress(ids.topic, "flashcard")).resolves.toEqual({ success: true });
    expect(from).not.toHaveBeenCalledWith("exercises");
  });

  it("returns a safe failure when the answer upsert fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase({
      questions: singleQuery(question),
      user_question_answers: mutationQuery({ message: "sensitive error" }),
    });

    await expect(
      submitQuestionAnswer(ids.question, ids.optionOne),
    ).resolves.toEqual({ error: "Không thể lưu câu trả lời lúc này." });
  });
});
