import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitQuestionAnswerLocalized } from "@/app/actions/progress-localized";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U3 CP4 (AC3, AC4) - mọi thông báo hệ thống của submitQuestionAnswer (lỗi, lời nhắc mặc định của câu
//   sai, cảnh báo tiến độ) đúng theo ngôn ngữ của request; tiếng Việt đúng nguyên văn cũ; mã lỗi `MEMORY_CHECK_REQUIRED`/`CARDS_REQUIRED`
//   và hình dạng kết quả không đổi; giải thích do tác giả viết trả về nguyên văn ở cả hai ngôn ngữ.
// - Loại test: Server Action với next-intl thật (cấu hình request bản test chọn ngôn ngữ); chỉ Supabase bị mock. Quy tắc ghi, thứ tự
//   ưu tiên và race của RPC do __tests__/actions/progress.test.ts và các test tích hợp giữ.
// - Đối tượng: submitQuestionAnswer và wrapper submitQuestionAnswerLocalized (ngôn ngữ của server và khóa catalog từng trường).
// - Case biên: câu đúng có và không có giải thích tác giả; câu sai có giải thích tác giả (không tham chiếu) và không có (tham chiếu tới lời
//   nhắc mặc định); progress sai shape cho `progressError` cùng lời giải thích trong MỘT kết quả, mỗi trường một khóa riêng.
// - Giới hạn: không kiểm DB thật; nội dung giải thích do giáo viên viết là dữ liệu nên không dịch.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

const LOCALES: Locale[] = ["vi", "en"];
const TEXT = {
  invalid: { vi: "Dữ liệu câu trả lời không hợp lệ.", en: "The answer data is invalid." },
  auth: { vi: "Vui lòng đăng nhập", en: "Please sign in" },
  unavailable: { vi: "Câu hỏi không khả dụng.", en: "This question isn't available." },
  notEnrolled: { vi: "Bạn cần ghi danh khóa học để lưu câu trả lời.", en: "You need to enroll in the course to save your answer." },
  option: { vi: "Đáp án không khả dụng.", en: "That answer option isn't available." },
  memory: {
    vi: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.",
    en: "Answer every Memory check question correctly before starting the exercises.",
  },
  cards: {
    vi: "Bạn cần học hết flashcard của bài này trước khi làm memory check.",
    en: "Study all the flashcards in this lesson before taking the Memory check.",
  },
  save: { vi: "Không thể lưu câu trả lời lúc này.", en: "Couldn't save your answer right now." },
  progress: {
    vi: "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    en: "Your answer was saved, but your lesson progress couldn't be recorded.",
  },
  defaultExplanation: { vi: "Đáp án chưa chính xác. Bạn hãy thử lại nhé!", en: "That answer isn't correct. Give it another try!" },
} as const;

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
const saved = (overrides: Record<string, unknown> = {}) => ({
  status: "ok",
  is_correct: true,
  explanation: null,
  is_memory_check: false,
  progress: syncedProgress,
  memory_check_passed: null,
  ...overrides,
});

function mockSupabase(
  rpcResult: { data: unknown; error: unknown } = { data: saved(), error: null },
  currentUser: { id: string } | null = { id: ids.user },
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: currentUser }, error: null }) },
    from: vi.fn(() => {
      throw new Error("The action must not use the Data API tables");
    }),
    rpc,
  } as never);
  return { rpc };
}

describe.each(LOCALES)("submitQuestionAnswer messages in %s", (locale) => {
  beforeEach(() => {
    vi.clearAllMocks();
    setServerTestLocale(locale);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setServerTestLocale("vi");
  });

  it("rejects malformed IDs with the request-language message before creating a client", async () => {
    await expect(submitQuestionAnswer("bad-id", "bad-id")).resolves.toEqual({ error: TEXT.invalid[locale] });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("asks an anonymous caller to sign in without calling the RPC", async () => {
    const { rpc } = mockSupabase(undefined, null);
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toEqual({ error: TEXT.auth[locale] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["auth_required", () => ({ error: TEXT.auth[locale] })],
    ["unavailable", () => ({ error: TEXT.unavailable[locale] })],
    ["not_enrolled", () => ({ error: TEXT.notEnrolled[locale] })],
    ["option_unavailable", () => ({ error: TEXT.option[locale] })],
    ["memory_locked", () => ({ error: TEXT.memory[locale], errorCode: "MEMORY_CHECK_REQUIRED" })],
    ["cards_locked", () => ({ error: TEXT.cards[locale], errorCode: "CARDS_REQUIRED" })],
    ["save_failed", () => ({ error: TEXT.save[locale] })],
  ])("maps the %s status to its message and keeps the error code", async (status, expected) => {
    mockSupabase({ data: { status }, error: null });
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toEqual(expected());
  });

  it("reports an RPC failure and malformed RPC output with the generic save message and no database detail", async () => {
    mockSupabase({ data: null, error: { message: "sensitive sql" } });
    const failed = await submitQuestionAnswer(ids.question, ids.option);
    expect(failed).toEqual({ error: TEXT.save[locale] });
    expect(JSON.stringify(failed)).not.toContain("sensitive");

    mockSupabase({ data: { status: "ok" }, error: null });
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toEqual({ error: TEXT.save[locale] });
  });

  it("returns the default hint for a wrong answer without an authored explanation, and the authored one unchanged", async () => {
    mockSupabase({ data: saved({ is_correct: false }), error: null });
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toMatchObject({
      success: true,
      isCorrect: false,
      explanation: TEXT.defaultExplanation[locale],
    });

    mockSupabase({ data: saved({ is_correct: false, explanation: "Hãy đọc lại ngữ liệu." }), error: null });
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toMatchObject({
      isCorrect: false,
      explanation: "Hãy đọc lại ngữ liệu.",
    });
  });

  it("returns a correct answer without an explanation key unless the author wrote one", async () => {
    mockSupabase({ data: saved(), error: null });
    const bare = await submitQuestionAnswer(ids.question, ids.option);
    expect(bare).toMatchObject({ success: true, isCorrect: true });
    expect("explanation" in bare).toBe(false);

    mockSupabase({ data: saved({ explanation: "Vì đây là thì hiện tại hoàn thành." }), error: null });
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toMatchObject({
      explanation: "Vì đây là thì hiện tại hoàn thành.",
    });
  });

  it("reports missing lesson progress with the request-language notice while the saved answer stays a success", async () => {
    mockSupabase({ data: saved({ progress: null }), error: null });
    await expect(submitQuestionAnswer(ids.question, ids.option)).resolves.toEqual({
      success: true,
      isCorrect: true,
      progressError: TEXT.progress[locale],
    });
  });
});

describe.each(LOCALES)("submitQuestionAnswerLocalized references in %s", (locale) => {
  beforeEach(() => {
    vi.clearAllMocks();
    setServerTestLocale(locale);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setServerTestLocale("vi");
  });

  it("returns the original result with the server language and the catalog key of the error", async () => {
    mockSupabase({ data: { status: "memory_locked" }, error: null });
    const reply = await submitQuestionAnswerLocalized(ids.question, ids.option);
    expect(reply.result).toEqual({ error: TEXT.memory[locale], errorCode: "MEMORY_CHECK_REQUIRED" });
    expect(reply.locale).toBe(locale);
    expect(reply.messageRefs).toEqual({ error: { key: "learn.actions.progress.memoryRequired" } });
  });

  it("gives the default hint of a wrong answer and the progress notice one reference each, in one result", async () => {
    mockSupabase({ data: saved({ is_correct: false, progress: null }), error: null });
    const reply = await submitQuestionAnswerLocalized(ids.question, ids.option);
    expect(reply.result).toEqual({
      success: true,
      isCorrect: false,
      explanation: TEXT.defaultExplanation[locale],
      progressError: TEXT.progress[locale],
    });
    expect(reply.messageRefs).toEqual({
      explanation: { key: "learn.actions.progress.defaultExplanation" },
      progressError: { key: "learn.actions.progress.progressSync" },
    });
  });

  it("gives an authored explanation no reference while the progress notice keeps its own", async () => {
    mockSupabase({ data: saved({ is_correct: false, explanation: "Giải thích của giáo viên.", progress: null }), error: null });
    const reply = await submitQuestionAnswerLocalized(ids.question, ids.option);
    expect(reply.result).toMatchObject({ explanation: "Giải thích của giáo viên.", progressError: TEXT.progress[locale] });
    expect(reply.messageRefs).toEqual({ progressError: { key: "learn.actions.progress.progressSync" } });
  });

  it("returns no reference for a plain correct answer", async () => {
    mockSupabase();
    const reply = await submitQuestionAnswerLocalized(ids.question, ids.option);
    expect(reply.messageRefs).toEqual({});
    expect(reply.locale).toBe(locale);
  });
});
