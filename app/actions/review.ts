"use server";

import { type Card as FSRSCard, Rating, createEmptyCard, fsrs } from "ts-fsrs";
import { cardReviewInputSchema, fsrsMetaSchema } from "@/lib/schemas/fsrs";
import {
  cardReviewRpcResultSchema,
  topicProgressRpcResultSchema,
  type TopicProgress,
} from "@/lib/schemas/learning-workspace";
import { createClient } from "@/utils/supabase/server";
import { hasLearningEnrollment } from "@/lib/learning-enrollment";
import { createActionTimer, type ActionTimer } from "@/lib/learning-action-timing";

const PROGRESS_SYNC_ERROR = "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học.";
const MUTATION_ERROR = "Chưa thể đồng bộ tiến độ ôn tập.";

type RawUserFlashcard = {
  id: string;
  user_id?: string;
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
    // LF2: enrollment của chính người học đọc cùng lượt với context (embed không inner, đã lọc theo user).
    course?: { id: string; enrollments?: { id: string; user_id: string }[] | null } | null;
  } | null;
  user_flashcards?: RawUserFlashcard[] | null;
};

// Failure and success share optional keys so callers can read fields after `if (result.error)`.
type SubmitCardReviewResult =
  | { error: string; success?: never; topicProgress?: never; progressError?: never }
  | { error?: never; success: true; topicProgress?: TopicProgress; progressError?: string };

export async function submitCardReview(
  rawCardId: string,
  rawRating: Rating,
): Promise<SubmitCardReviewResult> {
  // LF2: đo thời gian server khi LEARNING_ACTION_TIMING=1; mặc định tắt, không đổi hành vi action.
  const timer = createActionTimer("submitCardReview");
  try {
    return await reviewCard(rawCardId, rawRating, timer);
  } finally {
    timer.end();
  }
}

async function reviewCard(
  rawCardId: string,
  rawRating: Rating,
  timer: ActionTimer,
): Promise<SubmitCardReviewResult> {
  const parsed = cardReviewInputSchema.safeParse({
    cardId: rawCardId,
    rating: rawRating,
  });
  if (!parsed.success) return { error: "Dữ liệu đánh giá thẻ không hợp lệ." };

  const supabase = await timer.step("createClient", () => createClient());
  const {
    data: { user },
    error: authError,
  } = await timer.step("auth.getUser", () => supabase.auth.getUser());
  if (authError || !user) return { error: "Vui lòng đăng nhập" };

  try {
    const { data: rawCard, error: cardError } = await timer.step("context.query", () => supabase
      .from("cards")
      .select(
        `
        id, topic_id, removed_at,
        topic:topics!inner (
          id, chapter_id, course_id, status, removed_at,
          chapter:chapters!inner (id, course_id, removed_at),
          course:courses (id, enrollments (id, user_id))
        ),
        user_flashcards (id, user_id, card_id, fsrs_meta)
      `,
      )
      .eq("id", parsed.data.cardId)
      .eq("topic.course.enrollments.user_id", user.id)
      // An active admin can read every learner's user_flashcards rows (f11eb22), so the embed is limited to the caller's own row;
      // otherwise another learner's row id reaches the RPC, whose own-row UPDATE then matches nothing.
      .eq("user_flashcards.user_id", user.id)
      .is("removed_at", null)
      .maybeSingle());

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

    // LF2: đường nhanh dùng enrollment đã đọc cùng context (course_id lấy từ topic tin cậy, không từ client).
    // Không thấy enrollment trong embed (khóa học ẩn với RLS hoặc chưa ghi danh) thì đọc lại như trước để giữ nguyên kết quả.
    const enrolledByContext = topic.course?.id === topic.course_id &&
      (topic.course.enrollments ?? []).some((enrollment) => enrollment.user_id === user.id);
    if (
      !enrolledByContext &&
      !await timer.step("enrollment", () => hasLearningEnrollment(supabase, user.id, topic.course_id))
    ) {
      return { error: "Bạn cần ghi danh khóa học để lưu ôn tập." };
    }

    // Defense in depth next to the embed filter: only the caller's own row for this card is ever used.
    const userFlashcard = (card.user_flashcards ?? []).find(
      (item) => item.card_id === card.id && item.user_id === user.id,
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
      // Cùng một lần ghi với fsrs_meta: quy tắc hoàn thành flashcard đọc đúng lần chấm gần nhất.
      last_rating: parsed.data.rating,
      updated_at: new Date().toISOString(),
    };

    timer.label(userFlashcard ? "card-review:update" : "card-review:create");
    // LF2: một RPC SECURITY INVOKER ghi (RLS L1 vẫn quyết định), xác nhận đúng một dòng rồi đồng bộ D4.
    const { data, error: mutationError } = await timer.step("rpc", () => supabase.rpc("lf2_submit_card_review", {
      p_card_id: card.id,
      p_user_flashcard_id: userFlashcard?.id ?? null,
      p_next_review_date: nextValues.next_review_date,
      p_fsrs_meta: nextValues.fsrs_meta,
      p_last_rating: nextValues.last_rating,
      p_updated_at: nextValues.updated_at,
    }));
    if (mutationError) {
      console.error("Card review FSRS mutation failed", mutationError);
      return { error: MUTATION_ERROR };
    }

    const result = cardReviewRpcResultSchema.safeParse(data);
    if (!result.success) {
      console.error("Card review RPC returned invalid data", result.error.issues);
      return { error: MUTATION_ERROR };
    }
    if (result.data.status !== "ok") {
      console.error("Card review FSRS mutation wrote no row");
      return { error: MUTATION_ERROR };
    }

    // D4 H4: the review is already saved; missing or malformed progress must not turn it into an error.
    const progress = topicProgressRpcResultSchema.safeParse(result.data.progress);
    if (!progress.success && result.data.progress != null) {
      console.error("Card review progress is invalid", progress.error.issues);
    }

    return {
      success: true,
      ...(progress.success ? { topicProgress: progress.data } : { progressError: PROGRESS_SYNC_ERROR }),
    };
  } catch (error) {
    console.error("Card review unexpected failure", error);
    return { error: MUTATION_ERROR };
  }
}
