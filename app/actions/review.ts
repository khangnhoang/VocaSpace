// app/actions/review.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { fsrs, createEmptyCard, Rating, Card as FSRSCard } from "ts-fsrs";

export async function submitCardReview(cardId: string, topicId: string, rating: Rating) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập" };

  try {
    // ========================================================================
    // 🔥 CHIẾN LƯỢC MỚI: TẠO TRƯỚC DÒNG TIẾN ĐỘ TOPIC (DEFENSIVE PROGRAMMING)
    // ========================================================================
    if (topicId) {
      // Dùng upsert để nếu dòng đã có (từ click thứ 2 trở đi) thì không bị lỗi trùng lặp
      // Các cờ mặc định sẽ là false khi khởi tạo mới
      const { error: initProgressError } = await supabase
        .from("user_topic_progress")
        .upsert(
          {
            user_id: user.id,
            topic_id: topicId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, topic_id" }
        );

      if (initProgressError) {
        console.error("❌ [FSRS INIT PROGRESS ERROR]:", initProgressError.message);
        // Không throw error để tránh làm gián đoạn luồng lật thẻ, nhưng log ra để theo dõi
      }
    }

    // ========================================================================
    // XỬ LÝ FSRS CHO FLASHCARD (Giữ nguyên logic chuẩn xác cũ)
    // ========================================================================
    const { data: uf, error: fetchError } = await supabase
      .from("user_flashcards")
      .select("*")
      .eq("user_id", user.id)
      .eq("card_id", cardId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);

    const f = fsrs();
    let currentCard: FSRSCard;

    if (!uf || !uf.fsrs_meta) {
      currentCard = createEmptyCard(new Date()); 
    } else {
      const meta = uf.fsrs_meta as any;
      currentCard = {
        ...meta,
        due: new Date(meta.due),
        last_review: meta.last_review ? new Date(meta.last_review) : undefined,
      };
    }

    const now = new Date();
    const schedulingCards = f.repeat(currentCard, now);
    
    // Ép kiểu để loại bỏ Rating.Manual khỏi TypeScript Interface
    const validRating = rating as 1 | 2 | 3 | 4;
    const nextRecord = schedulingCards[validRating].card;

    if (uf) {
      await supabase
        .from("user_flashcards")
        .update({
          next_review_date: nextRecord.due.toISOString(),
          fsrs_meta: nextRecord as any, 
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
          fsrs_meta: nextRecord as any,
        });
    }

    return { success: true };
  } catch (error: any) {
    console.error("❌ [FSRS SYSTEM ERROR]:", error?.message);
    return { error: "Lỗi đồng bộ FSRS" };
  }
}