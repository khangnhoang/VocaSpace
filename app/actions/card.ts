"use server";
import { createClient } from "@/utils/supabase/server";
import { cardSchema, type CardFormValues } from "@/lib/schemas/card";
import z from "zod";

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const validated = cardSchema.safeParse(values);
  if (!validated.success) return { error: validated.error.issues[0].message };

  try {
    // 1. Tự động tính order_index tiếp theo
    const { data: maxCard } = await supabase
      .from("cards").select("order_index").eq("topic_id", topicId)
      .order("order_index", { ascending: false }).limit(1).single();
    
    const nextOrder = maxCard ? maxCard.order_index + 1 : 1;

    // 2. Gom dữ liệu vào JSONB
    const front_content = {
      word: validated.data.word,
      pos: validated.data.pos,
      phonetic: validated.data.phonetic,
    };

    const back_content = {
      translation: validated.data.translation,
      explanation: validated.data.explanation,
      example: validated.data.example,
      exampleTranslation: validated.data.exampleTranslation,
      hint: validated.data.hint,
    };

    // 3. Insert vào Database
    const { error } = await supabase.from("cards").insert({
      topic_id: topicId,
      front_content,
      back_content,
      order_index: nextOrder,
    });

    if (error) return { error: error.message };
    return { success: true, message: "Thêm từ vựng thành công!" };
  } catch (err) {
    return { error: "Lỗi hệ thống khi thêm thẻ." };
  }
}

// Sửa thẻ (Update)
export async function updateCard(cardId: string, values: CardFormValues) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const validated = cardSchema.safeParse(values);
  if (!validated.success) return { error: validated.error.issues[0].message };

  try {
    const front_content = {
      word: validated.data.word,
      pos: validated.data.pos,
      phonetic: validated.data.phonetic,
    };
    const back_content = {
      translation: validated.data.translation,
      explanation: validated.data.explanation,
      example: validated.data.example,
      exampleTranslation: validated.data.exampleTranslation,
      hint: validated.data.hint,
    };

    const { error } = await supabase.from("cards").update({
      front_content,
      back_content,
      updated_at: new Date().toISOString(),
    }).eq("id", cardId);

    if (error) return { error: error.message };
    return { success: true, message: "Cập nhật từ vựng thành công!" };
  } catch (err) {
    return { error: "Lỗi hệ thống khi cập nhật thẻ." };
  }
}

// Xóa thẻ (Soft Delete)
export async function deleteCard(cardId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { error } = await supabase.from("cards").update({
    removed_at: new Date().toISOString(),
  }).eq("id", cardId);

  if (error) return { error: error.message };
  return { success: true, message: "Đã xóa từ vựng thành công!" };
}

// Thêm hàng loạt thẻ (Bulk Insert)
export async function createBulkCards(topicId: string, cardsData: CardFormValues[]) {
  const supabase = await createClient();
  
  // 1. Self-Audit: Kiểm tra quyền
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập để thực hiện!" };

  // 2. Schema Structuring: Dùng Zod để validate MẢNG dữ liệu
  const validated = z.array(cardSchema).safeParse(cardsData);
  if (!validated.success) {
    // Tuân thủ chuẩn Vocaspace: Lấy message lỗi đầu tiên
    return { error: `Dữ liệu lỗi: ${validated.error.issues[0].message}` };
  }

  try {
    // Lấy order_index lớn nhất hiện tại để cộng dồn
    const { data: maxCard } = await supabase
      .from("cards")
      .select("order_index")
      .eq("topic_id", topicId)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();
    
    let currentOrder = maxCard ? maxCard.order_index : 0;

    // 3. Map dữ liệu sang chuẩn DB (front_content, back_content)
    const cardsToInsert = validated.data.map((card) => {
      currentOrder += 1; // Tăng index cho từng thẻ
      return {
        topic_id: topicId,
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
    const { error } = await supabase.from("cards").insert(cardsToInsert);

    if (error) throw new Error(error.message);
    
    return { success: true, message: `Đã thêm thành công ${cardsToInsert.length} từ vựng!` };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi hệ thống khi thêm hàng loạt thẻ." };
  }
}