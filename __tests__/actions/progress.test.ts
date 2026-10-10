import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ parsed-only inputs, thứ tự kiểm tra và kết quả quan sát được của action khi toàn bộ phần ghi đi qua RPC `lf2_submit_question_answer`.
// - Loại test: Server Action với Supabase boundary mock (RPC); quy tắc ghi, thứ tự ưu tiên và race được kiểm bằng DB thật ở `__tests__/integration/lf2-learning-action-rpcs.test.ts`.
// - Đối tượng: submitQuestionAnswer.
// - Case thành công: kết quả RPC `ok` trả `isCorrect`, `topicProgress` đã parse; LF1 (AC6): câu đúng trả `explanation` của tác giả khi có
//   và không có khóa `explanation` khi để trống; câu sai giữ nguyên lời giải thích và lời nhắc mặc định.
// - Case thất bại: malformed ID không tạo client; mỗi status của RPC map đúng message/errorCode hiện tại (AC3, AC5): unavailable, not_enrolled,
//   option_unavailable, memory_locked (`MEMORY_CHECK_REQUIRED`), save_failed; RPC lỗi hoặc sai shape trả lỗi lưu chung, không lộ lỗi DB.
// - Bảo mật/phân quyền: thiếu auth không gọi RPC; action chỉ gửi questionId + selectedOptionId đã parse, không gửi user hay đáp án đúng.
// - Ổn định/resilience (D4 H4, AC3a): đã lưu thì luôn `success: true`; progress null hoặc sai shape cho `progressError` và không có `topicProgress`;
//   trạng thái memory đến từ RPC (sync hoặc suy ra khi sync hỏng) và để trống khi RPC không xác minh được.
// - Invariant cần giữ: đúng một lần gọi RPC, không đọc hay ghi bảng nào bằng Data API.
// - Kết quả verify gần nhất: 21/21 passed (2026-10-11) bằng `npx vitest run __tests__/actions/progress.test.ts`.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const ids = {
  user: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  question: "55555555-5555-4555-8555-555555555555",
  option: "66666666-6666-4666-8666-666666666666",
};

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
const GENERIC_SAVE_ERROR = "Không thể lưu câu trả lời lúc này.";

const saved = (overrides: Record<string, unknown> = {}) => ({
  status: "ok",
  is_correct: true,
  explanation: "Hãy đọc lại ngữ liệu.",
  is_memory_check: false,
  progress: syncedProgress,
  memory_check_passed: null,
  ...overrides,
});

function mockSupabase(
  rpcResult: { data: unknown; error: unknown } = { data: saved(), error: null },
  currentUser: { id: string } | null = { id: ids.user },
) {
  const from = vi.fn(() => {
    throw new Error("The action must not use the Data API tables");
  });
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: currentUser }, error: null }) },
    from,
    rpc,
  } as never);
  return { from, rpc };
}

describe("submitQuestionAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("rejects malformed answer IDs before creating a client", async () => {
    await expect(submitQuestionAnswer("bad-id", "bad-id")).resolves.toEqual({
      error: "Dữ liệu câu trả lời không hợp lệ.",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("does not call the RPC without an authenticated user", async () => {
    const { rpc, from } = mockSupabase(undefined, null);

    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toEqual({ error: "Vui lòng đăng nhập" });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("sends only the parsed question and option IDs in a single RPC call and returns the graded result with progress", async () => {
    const { rpc, from } = mockSupabase();

    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toEqual({
      success: true,
      isCorrect: true,
      explanation: "Hãy đọc lại ngữ liệu.",
      topicProgress,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("lf2_submit_question_answer", {
      p_question_id: ids.question,
      p_selected_option_id: ids.option,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["unavailable", { error: "Câu hỏi không khả dụng." }],
    ["not_enrolled", { error: "Bạn cần ghi danh khóa học để lưu câu trả lời." }],
    ["option_unavailable", { error: "Đáp án không khả dụng." }],
    ["memory_locked", { error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.", errorCode: "MEMORY_CHECK_REQUIRED" }],
    ["save_failed", { error: GENERIC_SAVE_ERROR }],
    ["auth_required", { error: "Vui lòng đăng nhập" }],
  ])("maps the %s status to today's message without any grading or progress", async (status, expected) => {
    mockSupabase({ data: { status }, error: null });

    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toEqual(expected);
  });

  it("returns the generic save error, without leaking the database error, when the RPC fails", async () => {
    mockSupabase({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });

    const result = await submitQuestionAnswer(ids.question, ids.option);

    expect(result).toEqual({ error: GENERIC_SAVE_ERROR });
    expect(JSON.stringify(result)).not.toContain("statement timeout");
  });

  it.each([
    ["an unknown status", { status: "surprise" }],
    ["a success without grading", { status: "ok", is_correct: "yes" }],
    ["no payload", null],
  ])("returns the generic save error for %s", async (_name, data) => {
    mockSupabase({ data, error: null });

    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toEqual({ error: GENERIC_SAVE_ERROR });
  });

  it("keeps the author's explanation for a correct answer and omits the key when there is none", async () => {
    mockSupabase({ data: saved({ explanation: null }), error: null });

    const result = await submitQuestionAnswer(ids.question, ids.option);

    expect(result).toMatchObject({ success: true, isCorrect: true });
    expect(result).not.toHaveProperty("explanation");
  });

  it("explains a wrong answer with the author's text or the default prompt", async () => {
    mockSupabase({ data: saved({ is_correct: false }), error: null });
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toMatchObject({
      success: true, isCorrect: false, explanation: "Hãy đọc lại ngữ liệu.",
    });

    mockSupabase({ data: saved({ is_correct: false, explanation: null }), error: null });
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toMatchObject({
      success: true, isCorrect: false, explanation: "Đáp án chưa chính xác. Bạn hãy thử lại nhé!",
    });
  });

  describe("progress after a saved answer (D4 H4, AC3a)", () => {
    it.each([
      ["null", null],
      ["a malformed payload", { unexpected: true }],
    ])("keeps a saved answer successful when the RPC progress is %s", async (_name, progress) => {
      mockSupabase({ data: saved({ progress }), error: null });

      const result = await submitQuestionAnswer(ids.question, ids.option);

      expect(result).toEqual({
        success: true, isCorrect: true, explanation: "Hãy đọc lại ngữ liệu.", progressError: PROGRESS_SYNC_ERROR,
      });
    });

    it("takes the memory status of a memory answer from the RPC", async () => {
      mockSupabase({ data: saved({ is_memory_check: true, memory_check_passed: false, progress: { ...syncedProgress, is_memory_check_passed: false } }), error: null });

      await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toMatchObject({
        success: true,
        isMemoryCheckPassed: false,
        topicProgress: { ...topicProgress, isMemoryCheckPassed: false },
      });
    });

    it("keeps the derived memory status when the sync failed but the fallback derived it", async () => {
      mockSupabase({ data: saved({ is_memory_check: true, memory_check_passed: true, progress: null }), error: null });

      const result = await submitQuestionAnswer(ids.question, ids.option);

      expect(result).toMatchObject({ success: true, isMemoryCheckPassed: true, progressError: PROGRESS_SYNC_ERROR });
      expect(result).not.toHaveProperty("topicProgress");
    });

    it("omits the memory status when neither the sync nor the fallback could verify it", async () => {
      mockSupabase({ data: saved({ is_memory_check: true, memory_check_passed: null, progress: null }), error: null });

      const result = await submitQuestionAnswer(ids.question, ids.option);

      expect(result).toMatchObject({ success: true, isCorrect: true, progressError: PROGRESS_SYNC_ERROR });
      expect(result).not.toHaveProperty("isMemoryCheckPassed");
    });

    it("omits the memory status when the RPC returns an invalid one, and never reports it for an exercise answer", async () => {
      mockSupabase({ data: saved({ is_memory_check: true, memory_check_passed: "maybe" }), error: null });
      expect(await submitQuestionAnswer(ids.question, ids.option)).not.toHaveProperty("isMemoryCheckPassed");

      mockSupabase({ data: saved({ is_memory_check: false, memory_check_passed: true }), error: null });
      expect(await submitQuestionAnswer(ids.question, ids.option)).not.toHaveProperty("isMemoryCheckPassed");
    });
  });
});
