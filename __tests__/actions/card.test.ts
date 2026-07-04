import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBulkCards,
  createCard,
  deleteCard,
  updateCard,
} from "@/app/actions/card";
import { createClient } from "@/utils/supabase/server";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Test plan:
// - Mục tiêu: kiểm tra card Server Actions an toàn cho tạo/sửa/xóa mềm/bulk flashcard.
// - Loại test: action/unit với Supabase mock.
// - Đối tượng: createCard, updateCard, deleteCard, createBulkCards.
// - Case thành công:
//   - Chỉ trả success khi Supabase trả đúng một row đã được update.
// - Case thất bại:
//   - UUID/topic ID sai bị chặn trước DB; thiếu row, row đã xóa, partial insert, hoặc bị RLS chặn không được xem là success.
//   - Lỗi Supabase không lộ raw database message ra UI.
// - Bảo mật/phân quyền:
//   - RLS vẫn là chốt quyền cuối; action gom lỗi không có row thành thông báo an toàn.
// - Ổn định/resilience:
//   - Query chỉ update card active qua removed_at IS NULL.
// - Invariant cần giữ:
//   - Zero-row update không bao giờ được báo xóa thành công.

const mockedCreateClient = vi.mocked(createClient);
const cardId = "11111111-1111-4111-8111-111111111111";
const topicId = "33333333-3333-4333-8333-333333333333";
const validCardValues = {
  word: "hello",
  pos: "interjection",
  phonetic: "/həˈloʊ/",
  translation: "xin chào",
  explanation: "A common greeting.",
  example: "Hello, teacher!",
  exampleTranslation: "Xin chào, giáo viên!",
  hint: "greeting",
};

function mockCreateClient(client: unknown) {
  mockedCreateClient.mockResolvedValueOnce(
    client as Awaited<ReturnType<typeof createClient>>,
  );
}

function authClient(query: unknown) {
  return authClientWithQueries([query]);
}

function authClientWithQueries(queries: unknown[]) {
  const queuedQueries = [...queries];

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
      }),
    },
    from: vi.fn(() => {
      const query = queuedQueries.shift();
      if (!query) throw new Error("Unexpected Supabase query");
      return query;
    }),
  };
}

function deleteQuery(result: { data: unknown[] | null; error: unknown | null }) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    select: vi.fn().mockResolvedValue(result),
  };

  return query;
}

function maxOrderQuery(result: { data: unknown | null; error: unknown | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
  };

  return query;
}

function insertQuery(result: { data: unknown[] | null; error: unknown | null }) {
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn().mockResolvedValue(result),
  };

  return query;
}

function updateQuery(result: { data: unknown[] | null; error: unknown | null }) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    select: vi.fn().mockResolvedValue(result),
  };

  return query;
}

describe("deleteCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid UUID before auth or database access", async () => {
    const result = await deleteCard("not-a-card-id");

    expect(result).toEqual({ error: "ID thẻ từ vựng không hợp lệ." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated user before updating a card", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    mockCreateClient(client);

    const result = await deleteCard(cardId);

    expect(result).toEqual({ error: "Vui lòng đăng nhập!" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("soft-deletes one active card and returns success", async () => {
    const query = deleteQuery({ data: [{ id: cardId }], error: null });
    mockCreateClient(authClient(query));

    const result = await deleteCard(cardId);

    expect(result).toEqual({
      success: true,
      message: "Đã xóa từ vựng thành công!",
    });
    expect(query.update).toHaveBeenCalledWith({
      removed_at: expect.any(String),
    });
    expect(query.eq).toHaveBeenCalledWith("id", cardId);
    expect(query.is).toHaveBeenCalledWith("removed_at", null);
    expect(query.select).toHaveBeenCalledWith("id");
  });

  it("returns a safe error when no card row was updated", async () => {
    const query = deleteQuery({ data: [], error: null });
    mockCreateClient(authClient(query));

    const result = await deleteCard(cardId);

    expect(result).toEqual({
      error:
        "Không thể xóa thẻ này. Thẻ có thể đã bị xóa hoặc bạn không có quyền chỉnh sửa.",
    });
  });

  it("does not report success when the updated row count is unexpected", async () => {
    const query = deleteQuery({
      data: [{ id: cardId }, { id: "33333333-3333-4333-8333-333333333333" }],
      error: null,
    });
    mockCreateClient(authClient(query));

    const result = await deleteCard(cardId);

    expect(result).toEqual({
      error:
        "Không thể xóa thẻ này. Thẻ có thể đã bị xóa hoặc bạn không có quyền chỉnh sửa.",
    });
  });

  it("logs database failures without exposing raw Supabase text", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const query = deleteQuery({
      data: null,
      error: {
        code: "42501",
        message: 'new row violates row-level security policy for table "cards"',
      },
    });
    mockCreateClient(authClient(query));

    const result = await deleteCard(cardId);

    expect(result).toEqual({
      error: "Không thể xóa thẻ từ vựng. Vui lòng tải lại trang và thử lại.",
    });
    expect(result.error).not.toContain("row-level security");
    expect(consoleError).toHaveBeenCalledWith(
      "[CARD DELETE ERROR]:",
      expect.objectContaining({ code: "42501" }),
    );

    consoleError.mockRestore();
  });
});

describe("card create/update/bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid topic and card IDs before auth or database access", async () => {
    const createResult = await createCard("not-a-topic-id", validCardValues);
    const updateResult = await updateCard("not-a-card-id", validCardValues);
    const bulkResult = await createBulkCards("not-a-topic-id", [
      validCardValues,
    ]);

    expect(createResult).toEqual({ error: "ID bài học không hợp lệ." });
    expect(updateResult).toEqual({ error: "ID thẻ từ vựng không hợp lệ." });
    expect(bulkResult).toEqual({
      error: "Dữ liệu lỗi: ID bài học không hợp lệ.",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("rejects malformed card payload before auth or database access", async () => {
    const result = await createCard(topicId, {
      ...validCardValues,
      word: "",
    });

    expect(result).toEqual({ error: "Vui lòng nhập từ vựng" });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("does not report create success when insert returns no card row", async () => {
    const orderQuery = maxOrderQuery({ data: null, error: null });
    const cardInsertQuery = insertQuery({ data: [], error: null });
    mockCreateClient(authClientWithQueries([orderQuery, cardInsertQuery]));

    const result = await createCard(topicId, validCardValues);

    expect(result).toEqual({
      error:
        "Không thể thêm thẻ từ vựng. Bài học có thể không tồn tại hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(orderQuery.eq).toHaveBeenCalledWith("topic_id", topicId);
    expect(cardInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        topic_id: topicId,
        order_index: 1,
      }),
    );
    expect(cardInsertQuery.select).toHaveBeenCalledWith("id");
  });

  it("does not report update success when no card row was updated", async () => {
    const cardUpdateQuery = updateQuery({ data: [], error: null });
    mockCreateClient(authClient(cardUpdateQuery));

    const result = await updateCard(cardId, validCardValues);

    expect(result).toEqual({
      error:
        "Không thể cập nhật thẻ này. Thẻ có thể đã bị xóa hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(cardUpdateQuery.eq).toHaveBeenCalledWith("id", cardId);
    expect(cardUpdateQuery.is).toHaveBeenCalledWith("removed_at", null);
    expect(cardUpdateQuery.select).toHaveBeenCalledWith("id");
  });

  it("does not report bulk success when inserted row count is incomplete", async () => {
    const orderQuery = maxOrderQuery({ data: { order_index: 4 }, error: null });
    const cardInsertQuery = insertQuery({
      data: [{ id: cardId }],
      error: null,
    });
    mockCreateClient(authClientWithQueries([orderQuery, cardInsertQuery]));

    const result = await createBulkCards(topicId, [
      validCardValues,
      { ...validCardValues, word: "goodbye", translation: "tạm biệt" },
    ]);

    expect(result).toEqual({
      error:
        "Không thể thêm đầy đủ danh sách thẻ từ vựng. Bài học có thể không tồn tại hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(orderQuery.eq).toHaveBeenCalledWith("topic_id", topicId);
    expect(cardInsertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({ topic_id: topicId, order_index: 5 }),
      expect.objectContaining({ topic_id: topicId, order_index: 6 }),
    ]);
    expect(cardInsertQuery.select).toHaveBeenCalledWith("id");
  });
});
