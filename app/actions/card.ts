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
export async function createCard(topicId: string, values: CardFormValues) {
  const parsed = createCardActionSchema.safeParse({ topicId, values });
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
    // 1. Tự động tính order_index tiếp theo
    const { data: maxCard } = await supabase
      .from("cards").select("order_index").eq("topic_id", input.topicId)
      .order("order_index", { ascending: false }).limit(1).single();
    
    const nextOrder = maxCard ? maxCard.order_index + 1 : 1;

    // 2. Gom dữ liệu vào JSONB
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

    // 3. Insert vào Database
    const { data, error } = await supabase.from("cards").insert({
      topic_id: input.topicId,
      front_content,
      back_content,
      order_index: nextOrder,
    }).select("id");

    if (error) {
      console.error("[CARD CREATE ERROR]:", error);
      return { error: CARD_CREATE_FAILED_MESSAGE };
    }

    if (!data || data.length !== 1) {
      return { error: CARD_CREATE_UNAVAILABLE_MESSAGE };
    }

    return { success: true, message: "Thêm từ vựng thành công!" };
  } catch {
    return { error: "Lỗi hệ thống khi thêm thẻ." };
  }
}

// Sửa thẻ (Update)
export async function updateCard(cardId: string, values: CardFormValues) {
  const parsed = updateCardActionSchema.safeParse({ cardId, values });
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

    const { data, error } = await supabase.from("cards").update({
      front_content,
      back_content,
      updated_at: new Date().toISOString(),
    }).eq("id", input.cardId).is("removed_at", null).select("id");

    if (error) {
      console.error("[CARD UPDATE ERROR]:", error);
      return { error: CARD_UPDATE_FAILED_MESSAGE };
    }

    if (!data || data.length !== 1) {
      return { error: CARD_UPDATE_UNAVAILABLE_MESSAGE };
    }

    return { success: true, message: "Cập nhật từ vựng thành công!" };
  } catch {
    return { error: "Lỗi hệ thống khi cập nhật thẻ." };
  }
}

// Xóa thẻ (Soft Delete)
export async function deleteCard(cardId: string) {
  const parsed = deleteCardSchema.safeParse({ cardId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ID thẻ từ vựng không hợp lệ." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { data, error } = await supabase
    .from("cards")
    .update({
      removed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.cardId)
    .is("removed_at", null)
    .select("id");

  if (error) {
    console.error("[CARD DELETE ERROR]:", error);
    return { error: CARD_DELETE_FAILED_MESSAGE };
  }

  // RLS có thể biến thẻ không tồn tại, đã xóa, hoặc không thuộc quyền sửa thành 0 row.
  // Trả cùng một lỗi an toàn để không tiết lộ thẻ có tồn tại trong khóa học khác hay không.
  if (!data || data.length !== 1) {
    return { error: CARD_DELETE_UNAVAILABLE_MESSAGE };
  }

  return { success: true, message: "Đã xóa từ vựng thành công!" };
}

// Thêm hàng loạt thẻ (Bulk Insert)
export async function createBulkCards(topicId: string, cardsData: CardFormValues[]) {
  const parsed = createBulkCardsActionSchema.safeParse({ topicId, cardsData });
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
    // Lấy order_index lớn nhất hiện tại để cộng dồn
    const { data: maxCard } = await supabase
      .from("cards")
      .select("order_index")
      .eq("topic_id", input.topicId)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();
    
    let currentOrder = maxCard ? maxCard.order_index : 0;

    // 3. Map dữ liệu sang chuẩn DB (front_content, back_content)
    const cardsToInsert = input.cardsData.map((card) => {
      currentOrder += 1; // Tăng index cho từng thẻ
      return {
        topic_id: input.topicId,
        order_index: currentOrder,
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

    // 4. Bulk Insert: Chèn toàn bộ mảng trong 1 query duy nhất (Cực kỳ tối ưu Performance)
    const { data, error } = await supabase.from("cards").insert(cardsToInsert).select("id");

    if (error) {
      console.error("[CARD BULK CREATE ERROR]:", error);
      return { error: CARD_BULK_CREATE_FAILED_MESSAGE };
    }

    if (!data || data.length !== cardsToInsert.length) {
      return { error: CARD_BULK_CREATE_UNAVAILABLE_MESSAGE };
    }
    
    return { success: true, message: `Đã thêm thành công ${cardsToInsert.length} từ vựng!` };
  } catch {
    return { error: "Lỗi hệ thống khi thêm hàng loạt thẻ." };
  }
}
