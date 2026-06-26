import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCard } from "@/app/actions/card";
import { createClient } from "@/utils/supabase/server";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Test plan:
// - Mục tiêu: kiểm tra deleteCard là Server Action an toàn cho xóa mềm flashcard.
// - Loại test: action/unit với Supabase mock.
// - Đối tượng: deleteCard.
// - Case thành công:
//   - Chỉ trả success khi Supabase trả đúng một row đã được update.
// - Case thất bại:
//   - UUID sai bị chặn trước DB; thiếu row, row đã xóa, hoặc bị RLS chặn không được xem là success.
//   - Lỗi Supabase không lộ raw database message ra UI.
// - Bảo mật/phân quyền:
//   - RLS vẫn là chốt quyền cuối; action gom lỗi không có row thành thông báo an toàn.
// - Ổn định/resilience:
//   - Query chỉ update card active qua removed_at IS NULL.
// - Invariant cần giữ:
//   - Zero-row update không bao giờ được báo xóa thành công.

const mockedCreateClient = vi.mocked(createClient);
const cardId = "11111111-1111-4111-8111-111111111111";

function mockCreateClient(client: unknown) {
  mockedCreateClient.mockResolvedValueOnce(
    client as Awaited<ReturnType<typeof createClient>>,
  );
}

function authClient(query: unknown) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
      }),
    },
    from: vi.fn(() => query),
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
