// app/actions/review.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { fsrs, createEmptyCard, Rating, Card as FSRSCard } from "ts-fsrs";
import { fsrsMetaSchema } from "@/lib/schemas/fsrs"; // <--- Import schema vừa tạo

export async function submitCardReview(cardId: string, topicId: string, rating: Rating) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập" };

  try {
    const { data: uf, error: fetchError } = await supabase
      .from("user_flashcards")
      .select("*")
      .eq("user_id", user.id)
      .eq("card_id", cardId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);

    const f = fsrs();
    let currentCard: FSRSCard;

    // 1. Phục hồi thẻ từ DB bằng Zod (An toàn tuyệt đối, không dùng any)
    if (!uf || !uf.fsrs_meta) {
      currentCard = createEmptyCard(new Date()); 
    } else {
      const parsedMeta = fsrsMetaSchema.safeParse(uf.fsrs_meta);
      if (parsedMeta.success) {
        // Zod đã tự động đổi chuỗi ngày tháng thành Object Date
        currentCard = parsedMeta.data as FSRSCard; 
      } else {
        // Fallback an toàn nếu DB bị rác
        currentCard = createEmptyCard(new Date());
      }
    }

    // 2. Chạy thuật toán
    const now = new Date();
    const schedulingCards = f.repeat(currentCard, now);
    
    // FIX LỖI TYPE Ở ĐÂY: Ép kiểu để loại bỏ Rating.Manual khỏi TypeScript Interface
    const validRating = rating as 1 | 2 | 3 | 4;
    const nextRecord = schedulingCards[validRating].card;

    // 3. Xử lý dữ liệu trước khi đẩy lên DB (Xóa bỏ "any")
    // Biến Date object thành string chuẩn JSON để Supabase không báo lỗi Type
    const metaToSave = JSON.parse(JSON.stringify(nextRecord));

    if (uf) {
      await supabase
        .from("user_flashcards")
        .update({
          next_review_date: nextRecord.due.toISOString(),
          fsrs_meta: metaToSave, // <--- Truyền vào đây, sạch sẽ, không any
          updated_at: new Date().toISOString()
        })
        .eq("id", uf.id);
    } else {
      await supabase
        .from("user_flashcards")
        .insert({
          user_id: user.id,
          card_id: cardId,
          next_review_date: nextRecord.due.toISOString(),
          fsrs_meta: metaToSave, // <--- Tương tự
        });
    }

    return { success: true };
  } catch (error) {
    return { error: "Lỗi đồng bộ FSRS" };
  }
}