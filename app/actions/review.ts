"use server";

import { type Card as FSRSCard, Rating, createEmptyCard, fsrs } from "ts-fsrs";
import { cardReviewInputSchema, fsrsMetaSchema } from "@/lib/schemas/fsrs";
import { createClient } from "@/utils/supabase/server";

type RawUserFlashcard = {
  id: string;
  card_id: string;
  fsrs_meta: unknown;
};

type RawReviewCard = {
  id: string;
  topic_id: string;
  removed_at: string | null;
  topic?: {
    id: string;
    chapter_id: string | null;
    course_id: string;
    status: string | null;
    removed_at: string | null;
    chapter?: {
      id: string;
      course_id: string;
      removed_at: string | null;
    } | null;
  } | null;
  user_flashcards?: RawUserFlashcard[] | null;
};

export async function submitCardReview(rawCardId: string, rawRating: Rating) {
  const parsed = cardReviewInputSchema.safeParse({
    cardId: rawCardId,
    rating: rawRating,
  });
  if (!parsed.success) return { error: "Dữ liệu đánh giá thẻ không hợp lệ." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Vui lòng đăng nhập" };

  try {
    const { data: rawCard, error: cardError } = await supabase
      .from("cards")
      .select(
        `
        id, topic_id, removed_at,
        topic:topics!inner (
          id, chapter_id, course_id, status, removed_at,
          chapter:chapters!inner (id, course_id, removed_at)
        ),
        user_flashcards (id, card_id, fsrs_meta)
      `,
      )
      .eq("id", parsed.data.cardId)
      .is("removed_at", null)
      .maybeSingle();

    if (cardError) {
      console.error("Card review context query failed", cardError);
      return { error: "Không thể kiểm tra thẻ ôn tập lúc này." };
    }
    if (!rawCard) return { error: "Thẻ ôn tập không khả dụng." };

    const card = rawCard as unknown as RawReviewCard;
    const topic = card.topic;
    const chapter = topic?.chapter;
    const hasTrustedParentChain =
      card.id === parsed.data.cardId &&
      card.removed_at === null &&
      topic?.id === card.topic_id &&
      topic.status === "published" &&
      topic.removed_at === null &&
      chapter?.id === topic.chapter_id &&
      chapter.removed_at === null &&
      chapter.course_id === topic.course_id;
    if (!hasTrustedParentChain) {
      return { error: "Thẻ ôn tập không khả dụng." };
    }

    const userFlashcard = (card.user_flashcards ?? []).find(
      (item) => item.card_id === card.id,
    );
    let currentCard: FSRSCard;
    if (!userFlashcard?.fsrs_meta) {
      currentCard = createEmptyCard(new Date());
    } else {
      const parsedMeta = fsrsMetaSchema.safeParse(userFlashcard.fsrs_meta);
      if (!parsedMeta.success) {
        console.error("Card review FSRS metadata is invalid", parsedMeta.error.issues);
        return { error: "Dữ liệu ôn tập hiện tại không hợp lệ." };
      }
      currentCard = {
        ...parsedMeta.data,
        last_review: parsedMeta.data.last_review ?? undefined,
      } as FSRSCard;
    }

    const nextRecord = fsrs().repeat(currentCard, new Date())[parsed.data.rating]
      .card;
    const nextValues = {
      next_review_date: nextRecord.due.toISOString(),
      fsrs_meta: nextRecord,
      updated_at: new Date().toISOString(),
    };

    const mutation = userFlashcard
      ? supabase
          .from("user_flashcards")
          .update(nextValues)
          .eq("id", userFlashcard.id)
      : supabase.from("user_flashcards").insert({
          user_id: user.id,
          card_id: card.id,
          ...nextValues,
        });
    const { error: mutationError } = await mutation.select("id").single();

    if (mutationError) {
      console.error("Card review FSRS mutation failed", mutationError);
      return { error: "Chưa thể đồng bộ tiến độ ôn tập." };
    }

    return { success: true };
  } catch (error) {
    console.error("Card review unexpected failure", error);
    return { error: "Chưa thể đồng bộ tiến độ ôn tập." };
  }
}
