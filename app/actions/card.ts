"use server";
import { createClient } from "@/utils/supabase/server";
import {
  createBulkCardsActionSchema,
  createCardActionSchema,
  deleteCardSchema,
  updateCardActionSchema,
  type CardFormValues,
} from "@/lib/schemas/card";

const CARD_CREATE_UNAVAILABLE_MESSAGE =
  "Không thể thêm thẻ từ vựng. Bài học có thể không tồn tại hoặc bạn không có quyền chỉnh sửa.";
const CARD_CREATE_FAILED_MESSAGE =
  "Không thể thêm thẻ từ vựng. Vui lòng tải lại trang và thử lại.";
const CARD_UPDATE_UNAVAILABLE_MESSAGE =
  "Không thể cập nhật thẻ này. Thẻ có thể đã bị xóa hoặc bạn không có quyền chỉnh sửa.";
const CARD_UPDATE_FAILED_MESSAGE =
  "Không thể cập nhật thẻ từ vựng. Vui lòng tải lại trang và thử lại.";
const CARD_BULK_CREATE_UNAVAILABLE_MESSAGE =
  "Không thể thêm đầy đủ danh sách thẻ từ vựng. Bài học có thể không tồn tại hoặc bạn không có quyền chỉnh sửa.";
const CARD_BULK_CREATE_FAILED_MESSAGE =
  "Không thể thêm hàng loạt thẻ từ vựng. Vui lòng tải lại trang và thử lại.";
const CARD_DELETE_UNAVAILABLE_MESSAGE =
  "Không thể xóa thẻ này. Thẻ có thể đã bị xóa hoặc bạn không có quyền chỉnh sửa.";
const CARD_DELETE_FAILED_MESSAGE =
  "Không thể xóa thẻ từ vựng. Vui lòng tải lại trang và thử lại.";

function mapCardRpcError(message: string, fallback: string) {
  const errorMap: Record<string, string> = {
    AUTH_REQUIRED: "Vui lòng đăng nhập lại.",
    TOPIC_NOT_FOUND: CARD_CREATE_UNAVAILABLE_MESSAGE,
    COURSE_EDIT_FORBIDDEN: "Bạn không có quyền chỉnh sửa nội dung bài học này.",
    TOPIC_PENDING_FROZEN:
      "Bài học đang chờ duyệt và tạm thời không nhận thay đổi.",
    TOPIC_PUBLISHED_CONFIRM_REQUIRED:
      "Bài học đã publish. Vui lòng xác nhận để chuyển về bản nháp trước khi thay đổi.",
    CARD_PAYLOAD_INVALID: "Dữ liệu thẻ từ vựng không hợp lệ.",
  };

  return errorMap[message] || fallback;
}

// Lấy danh sách thẻ của 1 Topic
export async function getCardsByTopicId(topicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("topic_id", topicId)
    .is("removed_at", null)
    .order("order_index", { ascending: true });

  if (error) return { error: error.message };
  return { data };
}

// Thêm thẻ mới
export async function createCard(
  topicId: string,
  values: CardFormValues,
  confirmPublished = false,
) {
  const parsed = createCardActionSchema.safeParse({
    topicId,
    values,
    confirmPublished,
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin thẻ từ vựng không hợp lệ.",
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const input = parsed.data;

  try {
    const front_content = {
      word: input.values.word,
      pos: input.values.pos,
      phonetic: input.values.phonetic,
    };

    const back_content = {
      translation: input.values.translation,
      explanation: input.values.explanation,
      example: input.values.example,
      exampleTranslation: input.values.exampleTranslation,
      hint: input.values.hint,
    };

    const { data, error } = await supabase.rpc("d1_create_card", {
      p_topic_id: input.topicId,
      p_front_content: front_content,
      p_back_content: back_content,
      p_confirm_published: input.confirmPublished,
    });

    if (error) {
      console.error("[CARD CREATE ERROR]:", error);
      return { error: mapCardRpcError(error.message, CARD_CREATE_FAILED_MESSAGE) };
    }

    if (!data || typeof data !== "object") {
      return { error: CARD_CREATE_UNAVAILABLE_MESSAGE };
    }

    return { success: true, message: "Thêm từ vựng thành công!" };
  } catch {
    return { error: "Lỗi hệ thống khi thêm thẻ." };
  }
}

// Sửa thẻ (Update)
export async function updateCard(
  cardId: string,
  values: CardFormValues,
  confirmPublished = false,
) {
  const parsed = updateCardActionSchema.safeParse({
    cardId,
    values,
    confirmPublished,
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin thẻ từ vựng không hợp lệ.",
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const input = parsed.data;

  try {
    const front_content = {
      word: input.values.word,
      pos: input.values.pos,
      phonetic: input.values.phonetic,
    };
    const back_content = {
      translation: input.values.translation,
      explanation: input.values.explanation,
      example: input.values.example,
      exampleTranslation: input.values.exampleTranslation,
      hint: input.values.hint,
    };

    const { data, error } = await supabase.rpc("d1_update_card", {
      p_card_id: input.cardId,
      p_front_content: front_content,
      p_back_content: back_content,
      p_confirm_published: input.confirmPublished,
    });

    if (error) {
      console.error("[CARD UPDATE ERROR]:", error);
      return { error: mapCardRpcError(error.message, CARD_UPDATE_FAILED_MESSAGE) };
    }

    if (!data || typeof data !== "object") {
      return { error: CARD_UPDATE_UNAVAILABLE_MESSAGE };
    }

    return { success: true, message: "Cập nhật từ vựng thành công!" };
  } catch {
    return { error: "Lỗi hệ thống khi cập nhật thẻ." };
  }
}

// Xóa thẻ (Soft Delete)
export async function deleteCard(cardId: string, confirmPublished = false) {
  const parsed = deleteCardSchema.safeParse({ cardId, confirmPublished });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ID thẻ từ vựng không hợp lệ." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { data, error } = await supabase.rpc("d1_delete_card", {
    p_card_id: parsed.data.cardId,
    p_confirm_published: parsed.data.confirmPublished,
  });

  if (error) {
    console.error("[CARD DELETE ERROR]:", error);
    return { error: mapCardRpcError(error.message, CARD_DELETE_FAILED_MESSAGE) };
  }

  if (!data || typeof data !== "object") {
    return { error: CARD_DELETE_UNAVAILABLE_MESSAGE };
  }

  return { success: true, message: "Đã xóa từ vựng thành công!" };
}

// Thêm hàng loạt thẻ (Bulk Insert)
export async function createBulkCards(
  topicId: string,
  cardsData: CardFormValues[],
  confirmPublished = false,
) {
  const parsed = createBulkCardsActionSchema.safeParse({
    topicId,
    cardsData,
    confirmPublished,
  });
  if (!parsed.success) {
    return {
      error: `Dữ liệu lỗi: ${
        parsed.error.issues[0]?.message ?? "Thông tin thẻ từ vựng không hợp lệ."
      }`,
    };
  }

  const supabase = await createClient();
  
  // 1. Self-Audit: Kiểm tra quyền
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập để thực hiện!" };

  const input = parsed.data;

  try {
    const cardsToInsert = input.cardsData.map((card) => {
      return {
        front_content: {
          word: card.word,
          pos: card.pos || "",
          phonetic: card.phonetic || "",
        },
        back_content: {
          translation: card.translation,
          explanation: card.explanation || "",
          example: card.example || "",
          exampleTranslation: card.exampleTranslation || "",
          hint: card.hint || "",
        }
      };
    });

    const { data, error } = await supabase.rpc("d1_bulk_create_cards", {
      p_topic_id: input.topicId,
      p_cards: cardsToInsert,
      p_confirm_published: input.confirmPublished,
    });

    if (error) {
      console.error("[CARD BULK CREATE ERROR]:", error);
      return {
        error: mapCardRpcError(error.message, CARD_BULK_CREATE_FAILED_MESSAGE),
      };
    }

    if (!data || typeof data !== "object") {
      return { error: CARD_BULK_CREATE_UNAVAILABLE_MESSAGE };
    }
    
    return { success: true, message: `Đã thêm thành công ${cardsToInsert.length} từ vựng!` };
  } catch {
    return { error: "Lỗi hệ thống khi thêm hàng loạt thẻ." };
  }
}
