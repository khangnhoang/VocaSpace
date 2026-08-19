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
// - Case thất bại: malformed ID, inaccessible parent, cross-question option và DB error không báo success.
// - Bảo mật/phân quyền: missing auth hoặc untrusted relation không tạo mutation.
// - Ổn định/resilience: multiple-correct-option giữ first-returned correctness semantics hiện tại.
// - Invariant cần giữ: mỗi valid write dùng một bounded context read và một checked mutation.
// - Kết quả verify gần nhất: 27/27 test passed trong focused CP2 Vitest command.

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
    const from = mockSupabase({
      topics: singleQuery(progressTopic),
      user_topic_progress: mutation,
    });

    await expect(updateStageProgress(ids.topic, "exercise")).resolves.toEqual({
      success: true,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "topics",
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

  it("rejects an option that does not belong to the submitted question", async () => {
    const from = mockSupabase({ questions: singleQuery(question) });
    const foreignOption = "88888888-8888-4888-8888-888888888888";

    await expect(
      submitQuestionAnswer(ids.question, foreignOption),
    ).resolves.toEqual({ error: "Đáp án không khả dụng." });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["questions"]);
  });

  it("keeps first-returned correct-option semantics within two DB requests", async () => {
    const mutation = mutationQuery();
    const from = mockSupabase({
      questions: singleQuery(question),
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
