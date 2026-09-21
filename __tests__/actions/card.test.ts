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
//   - Chỉ trả success khi trusted card RPC trả shape kết quả hợp lệ.
// - Case thất bại:
//   - UUID/topic ID sai bị chặn trước DB; thiếu row, row đã xóa, partial insert, hoặc bị RLS chặn không được xem là success.
//   - Lỗi Supabase không lộ raw database message ra UI.
// - Bảo mật/phân quyền:
//   - RLS vẫn là chốt quyền cuối; action gom lỗi không có row thành thông báo an toàn.
// - Ổn định/resilience:
//   - Action truyền confirmation mặc định false và không tự ghi trực tiếp vào bảng cards.
// - Invariant cần giữ:
//   - RPC error hoặc response shape không hợp lệ không bao giờ được báo mutation thành công.

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

function authClientWithQueries(
  queries: unknown[],
  rpcResult: { data: unknown; error: unknown | null } = {
    data: { status: "ok" },
    error: null,
  },
) {
  const queuedQueries = [...queries];

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
      }),
    },
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn(() => {
      const query = queuedQueries.shift();
      if (!query) throw new Error("Unexpected Supabase query");
      return query;
    }),
  };
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

  it("soft-deletes one card through the trusted RPC and returns success", async () => {
    const client = authClientWithQueries([], {
      data: { status: "removed", card_id: cardId },
      error: null,
    });
    mockCreateClient(client);

    const result = await deleteCard(cardId);

    expect(result).toEqual({
      success: true,
      message: "Đã xóa từ vựng thành công!",
    });
    expect(client.rpc).toHaveBeenCalledWith("d1_delete_card", {
      p_card_id: cardId,
      p_confirm_published: false,
    });
  });

  it("returns a safe error when the trusted RPC returns no row", async () => {
    const client = authClientWithQueries([], { data: null, error: null });
    mockCreateClient(client);

    const result = await deleteCard(cardId);

    expect(result).toEqual({
      error:
        "Không thể xóa thẻ này. Thẻ có thể đã bị xóa hoặc bạn không có quyền chỉnh sửa.",
    });
  });

  it("does not report success when the trusted RPC returns an invalid shape", async () => {
    const client = authClientWithQueries([], { data: "unexpected", error: null });
    mockCreateClient(client);

    const result = await deleteCard(cardId);

    expect(result).toEqual({
      error:
        "Không thể xóa thẻ này. Thẻ có thể đã bị xóa hoặc bạn không có quyền chỉnh sửa.",
    });
  });

  it("logs database failures without exposing raw Supabase text", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = authClientWithQueries([], {
      data: null,
      error: {
        code: "42501",
        message: 'new row violates row-level security policy for table "cards"',
      },
    });
    mockCreateClient(client);

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
    const client = authClientWithQueries([], { data: null, error: null });
    mockCreateClient(client);

    const result = await createCard(topicId, validCardValues);

    expect(result).toEqual({
      error:
        "Không thể thêm thẻ từ vựng. Bài học có thể không tồn tại hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(client.rpc).toHaveBeenCalledWith("d1_create_card", expect.objectContaining({
      p_topic_id: topicId,
      p_confirm_published: false,
    }));
  });

  it("does not report update success when the trusted RPC returns no row", async () => {
    const client = authClientWithQueries([], { data: null, error: null });
    mockCreateClient(client);

    const result = await updateCard(cardId, validCardValues);

    expect(result).toEqual({
      error:
        "Không thể cập nhật thẻ này. Thẻ có thể đã bị xóa hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(client.rpc).toHaveBeenCalledWith("d1_update_card", expect.objectContaining({
      p_card_id: cardId,
      p_confirm_published: false,
    }));
  });

  it("does not report bulk success when the trusted RPC returns no row", async () => {
    const client = authClientWithQueries([], { data: null, error: null });
    mockCreateClient(client);

    const result = await createBulkCards(topicId, [
      validCardValues,
      { ...validCardValues, word: "goodbye", translation: "tạm biệt" },
    ]);

    expect(result).toEqual({
      error:
        "Không thể thêm đầy đủ danh sách thẻ từ vựng. Bài học có thể không tồn tại hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(client.rpc).toHaveBeenCalledWith("d1_bulk_create_cards", expect.objectContaining({
      p_topic_id: topicId,
      p_confirm_published: false,
    }));
  });
});
