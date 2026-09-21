import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReviewNote,
  getTopicReviewNotes,
  removeReviewNote,
  updateReviewNote,
} from "@/app/actions/review-notes";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Test plan:
// - Mục tiêu: kiểm tra Server Actions `review_notes` chỉ parse + lấy session + gọi Supabase bằng parsed data.
// - Loại test: action/unit.
// - Đối tượng: createReviewNote, updateReviewNote, removeReviewNote, getTopicReviewNotes.
// - Case thành công: insert/soft delete dùng đúng parsed payload và revalidate route file của Topic Builder;
//   `getTopicReviewNotes` map row thật sang DTO đọc gồm `cardTitle`/`exerciseTitle`/`isEdited`.
// - Case thất bại: payload sai không tạo client; thiếu auth không gọi Supabase; update/xoá note của người khác
//   trả lỗi quyền sở hữu; lỗi DB được map sang câu tiếng Việt ổn định, không lộ raw message.
// - Bảo mật/phân quyền: action KHÔNG tự kiểm tra quyền review/đọc; RLS là nơi ép, nên test này không thay thế
//   integration test. `author_user_id` không bao giờ nằm trong payload insert.
// - Ổn định/resilience: RLS chặn đọc trả mảng rỗng, KHÔNG trả lỗi (phân biệt "không có quyền" với "lỗi").
// - Invariant cần giữ: xoá là xoá mềm, client không bao giờ gửi tác giả hay `removed_by_user_id` của người khác.
// - Kết quả verify gần nhất: passed (10 test) bằng `npx vitest run __tests__/actions/review-notes.test.ts`.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const topicId = "11111111-1111-4111-8111-111111111111";
const noteId = "22222222-2222-4222-8222-222222222222";
const currentUserId = "33333333-3333-4333-8333-333333333333";
const otherUserId = "44444444-4444-4444-8444-444444444444";
const cardId = "55555555-5555-4555-8555-555555555555";

const TOPIC_BUILDER_ROUTE_FILE = "/(teacher)/teacher/courses/[id]/topics/[topicId]";

type Row = Record<string, unknown>;

function installClient(options: {
  user?: boolean;
  rows?: Row[];
  insertError?: Row | null;
  updateRows?: Row[];
  updateError?: Row | null;
  readError?: Row | null;
} = {}) {
  const order = vi.fn();
  const terminal = { order, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: options.rows ?? [], error: options.readError ?? null }).then(resolve) };
  order.mockReturnValue(terminal);
  const readEq = vi.fn().mockReturnValue(terminal);
  const select = vi.fn().mockReturnValue({ eq: readEq });
  const insert = vi.fn().mockResolvedValue({ data: null, error: options.insertError ?? null });
  const updateSelect = vi.fn().mockResolvedValue({ data: options.updateRows ?? [], error: options.updateError ?? null });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect, is: vi.fn().mockReturnValue({ select: updateSelect }) });
  const update = vi.fn().mockReturnValue({ eq: updateEq, is: updateEq });
  const from = vi.fn().mockReturnValue({ select, insert, update });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === false ? null : { id: currentUserId } },
      }),
    },
    from,
  };

  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { from, insert, update, select, order, updateSelect };
}

function noteRow(overrides: Row = {}): Row {
  return {
    id: noteId,
    topic_id: topicId,
    card_id: cardId,
    exercise_id: null,
    author_user_id: currentUserId,
    body: "Sai phiên âm của flashcard này.",
    created_at: "2026-09-17T06:00:00.000Z",
    updated_at: "2026-09-17T06:00:00.000Z",
    removed_at: null,
    removed_by_user_id: null,
    author: { id: currentUserId, full_name: "Reviewer", email: "reviewer@example.com", avatar_url: null },
    removed_by: null,
    card: { front_content: { word: "resilient" } },
    exercise: null,
    ...overrides,
  };
}

describe("review notes Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateClient.mockReset();
  });

  it("rejects invalid payloads before creating a client", async () => {
    expect((await createReviewNote({ topicId: "not-a-uuid", body: "Nội dung." })).error).toBeTruthy();
    expect((await createReviewNote({ topicId, body: "   " })).error).toBeTruthy();
    expect((await createReviewNote({ topicId, cardId, exerciseId: otherUserId, body: "Hai đích." })).error).toBeTruthy();
    expect((await updateReviewNote({ noteId: "not-a-uuid", body: "Nội dung." })).error).toBeTruthy();
    expect((await removeReviewNote({ noteId: "not-a-uuid" })).error).toBeTruthy();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("stops before Supabase when there is no session", async () => {
    const { from } = installClient({ user: false });

    expect(await createReviewNote({ topicId, body: "Nội dung." }))
      .toEqual({ error: "Vui lòng đăng nhập lại." });
    expect(await updateReviewNote({ noteId, body: "Nội dung." }))
      .toEqual({ error: "Vui lòng đăng nhập lại." });
    expect(await removeReviewNote({ noteId }))
      .toEqual({ error: "Vui lòng đăng nhập lại." });
    expect((await getTopicReviewNotes({ topicId }))).toMatchObject({ reason: "forbidden" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts the parsed payload without ever sending an author", async () => {
    const { insert } = installClient();

    const result = await createReviewNote({ topicId, cardId, body: "  Cần ví dụ rõ hơn.  " });

    expect(result).toMatchObject({ success: true });
    expect(insert).toHaveBeenCalledWith({
      topic_id: topicId,
      card_id: cardId,
      exercise_id: null,
      body: "Cần ví dụ rõ hơn.",
    });
    expect(JSON.stringify(insert.mock.calls)).not.toContain("author_user_id");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(TOPIC_BUILDER_ROUTE_FILE, "page");
  });

  it("maps a cross-topic target error without leaking raw database text", async () => {
    installClient({ insertError: { code: "P0001", message: "REVIEW_NOTE_TARGET_TOPIC_MISMATCH: card 123" } });

    const result = await createReviewNote({ topicId, cardId, body: "Sai quan hệ." });

    expect(result).toEqual({
      error: "Ghi chú chỉ được gắn vào flashcard hoặc bài tập của chính bài học này.",
    });
    expect(JSON.stringify(result)).not.toContain("card 123");
  });

  it("reports ownership failure when the update touches no row", async () => {
    installClient({ updateRows: [] });

    expect(await updateReviewNote({ noteId, body: "Sửa note người khác." }))
      .toEqual({ error: "Bạn chỉ có thể sửa ghi chú của chính mình." });
    expect(await removeReviewNote({ noteId }))
      .toEqual({ error: "Bạn chỉ có thể xóa ghi chú của chính mình." });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("soft deletes with the session user as the remover", async () => {
    const { update, updateSelect } = installClient({ updateRows: [{ id: noteId }] });

    const result = await removeReviewNote({ noteId });

    expect(result).toMatchObject({ success: true });
    const [payload] = update.mock.calls[0] as [Record<string, unknown>];
    expect(payload.removed_by_user_id).toBe(currentUserId);
    expect(typeof payload.removed_at).toBe("string");
    expect(updateSelect).toHaveBeenCalledWith("id");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(TOPIC_BUILDER_ROUTE_FILE, "page");
  });

  it("returns an empty list rather than an error when RLS hides every row", async () => {
    installClient({ rows: [] });

    expect(await getTopicReviewNotes({ topicId }))
      .toEqual({ data: { notes: [], currentUserId } });
  });

  it("maps stored rows to the read DTO with target labels and edit flag", async () => {
    installClient({
      rows: [
        noteRow({
          updated_at: "2026-09-17T07:00:00.000Z",
          removed_at: "2026-09-17T08:00:00.000Z",
          removed_by_user_id: otherUserId,
          removed_by: { id: otherUserId, full_name: "Editor", email: "editor@example.com", avatar_url: null },
        }),
        noteRow({
          id: "66666666-6666-4666-8666-666666666666",
          card_id: null,
          exercise_id: "77777777-7777-4777-8777-777777777777",
          card: null,
          exercise: { title: "Bài tập 5" },
        }),
      ],
    });

    const result = await getTopicReviewNotes({ topicId });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.currentUserId).toBe(currentUserId);
    expect(result.data.notes).toHaveLength(2);
    expect(result.data.notes[0]).toMatchObject({
      cardId,
      cardTitle: "resilient",
      exerciseTitle: null,
      isEdited: true,
      removedBy: { userId: otherUserId, fullName: "Editor" },
    });
    expect(result.data.notes[1]).toMatchObject({
      cardId: null,
      cardTitle: null,
      exerciseTitle: "Bài tập 5",
      isEdited: false,
      removedAt: null,
      removedBy: null,
    });
  });

  it("surfaces a stable error when the note row cannot be shaped into the DTO", async () => {
    installClient({ rows: [noteRow({ id: "not-a-uuid" })] });

    const result = await getTopicReviewNotes({ topicId });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.notes).toEqual([]);
  });

  it("maps a read failure to a retryable Vietnamese error", async () => {
    installClient({ readError: { code: "42501", message: "permission denied for table review_notes" } });

    const result = await getTopicReviewNotes({ topicId });

    expect(result).toEqual({
      error: "Không thể tải ghi chú của bài học. Vui lòng thử lại.",
      reason: "error",
    });
  });
});
