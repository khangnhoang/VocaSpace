import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

const studentId = "33333333-3333-4333-8333-333333333333";
const topicId = "b2200000-0000-4000-8000-000000000111";
const seedCardIds = ["b2500000-0000-4000-8000-000000000001", "b2500000-0000-4000-8000-000000000002"];
const extraIds = Array.from({ length: 49 }, (_, i) => `d6600000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);

// Chỉ fixture này được phép thay lịch ôn của B2; không dùng helper trên runtime dev/hosted.
function localAdmin(env) {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" || url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "45441") {
    throw new Error("Review fixture requires the isolated loopback E2E runtime on port 45441.");
  }
  return createSupabaseAdmin(env);
}
function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

export async function prepareReviewSessionFixture(count = 2, longContent = false, env = process.env) {
  if (![0, 2, 51].includes(count)) throw new Error("Review fixture supports only 0, 2 or 51 due cards.");
  const supabase = localAdmin(env);
  const topic = checked(await supabase.from("topics").select("id, course_id, chapter_id, status, removed_at").eq("id", topicId).single(), "B2 topic");
  const chapter = checked(await supabase.from("chapters").select("id, course_id, removed_at").eq("id", topic.chapter_id).single(), "B2 chapter");
  const enrollment = checked(await supabase.from("enrollments").select("id").eq("user_id", studentId).eq("course_id", topic.course_id).single(), "B2 enrollment");
  if (!enrollment || topic.status !== "published" || topic.removed_at || chapter.removed_at || chapter.course_id !== topic.course_id) throw new Error("B2 review eligibility is not ready.");
  const originalReviews = checked(await supabase.from("user_flashcards").select("*").eq("user_id", studentId).in("card_id", seedCardIds), "B2 reviews");
  const originalCard = checked(await supabase.from("cards").select("front_content, back_content").eq("id", seedCardIds[0]).single(), "B2 card");
  if (originalReviews.length !== 2) throw new Error("Expected exactly two canonical B2 due rows.");
  const seedCards = checked(await supabase.from("cards").select("id, topic_id, removed_at").in("id", seedCardIds), "B2 card parents");
  const topicIds = [...new Set(seedCards.map((card) => card.topic_id))];
  const topics = checked(await supabase.from("topics").select("id, course_id, chapter_id, status, removed_at").in("id", topicIds), "B2 topic eligibility");
  const chapters = checked(await supabase.from("chapters").select("id, course_id, removed_at").in("id", topics.map((row) => row.chapter_id)), "B2 chapter eligibility");
  if (seedCards.length !== 2 || seedCards.some((card) => card.removed_at) || topics.length !== topicIds.length || topics.some((row) => row.status !== "published" || row.removed_at || row.course_id !== topic.course_id || !chapters.some((parent) => parent.id === row.chapter_id && parent.course_id === row.course_id && !parent.removed_at))) throw new Error("Every B2 review card must have an eligible published parent.");
  const originalProgress = checked(await supabase.from("user_topic_progress").select("*").eq("user_id", studentId).in("topic_id", topicIds), "Snapshot B2 progress");

  async function restore() {
    checked(await supabase.from("user_flashcards").delete().eq("user_id", studentId).in("card_id", extraIds), "Clean D6 reviews");
    checked(await supabase.from("cards").delete().in("id", extraIds), "Clean D6 cards");
    checked(await supabase.from("user_flashcards").upsert(originalReviews, { onConflict: "id" }), "Restore B2 reviews");
    checked(await supabase.from("cards").update(originalCard).eq("id", seedCardIds[0]), "Restore B2 content");
    // submitCardReview đồng bộ D4; khôi phục cả tiến độ, không chỉ lịch FSRS.
    if (originalProgress.length) checked(await supabase.from("user_topic_progress").upsert(originalProgress, { onConflict: "id" }), "Restore B2 progress");
    const createdTopics = topicIds.filter((id) => !originalProgress.some((row) => row.topic_id === id));
    if (createdTopics.length) checked(await supabase.from("user_topic_progress").delete().eq("user_id", studentId).in("topic_id", createdTopics), "Clean created B2 progress");
  }

  try {
    const due = "2026-07-01T01:00:00.000Z";
    const nextDate = count === 0 ? "2099-01-01T00:00:00.000Z" : due;
    const metadata = { due: nextDate, stability: 4, difficulty: 4, elapsed_days: 7, scheduled_days: 7, reps: 3, lapses: 0, state: 2, last_review: "2026-06-24T01:00:00.000Z" };
    checked(await supabase.from("user_flashcards").update({ next_review_date: nextDate, fsrs_meta: metadata }).eq("user_id", studentId).in("card_id", seedCardIds), "Set B2 due cards");
    if (longContent) {
      checked(await supabase.from("cards").update({
        front_content: { word: "deterministic", pos: "adjective", phonetic: "/dɪˌtɜː.mɪˈnɪs.tɪk/".repeat(12) },
        back_content: { translation: "có tính xác định", example: "A deterministic review keeps your learning progress clear. ".repeat(12), exampleTranslation: "Tiến độ được ghi nhận sau khi đánh giá đã lưu. ".repeat(12), explanation: "Nội dung dài vẫn đọc được và các nút đánh giá không bị che. ".repeat(12), hint: "Luyện nhớ rồi tự đánh giá." },
      }).eq("id", seedCardIds[0]), "Set long B2 content");
    }
    if (count === 51) {
      checked(await supabase.from("cards").upsert(extraIds.map((id, index) => ({ id, topic_id: topicId, front_content: { word: `review-${index + 3}` }, back_content: { translation: `thẻ ôn ${index + 3}` }, order_index: index + 2, removed_at: null }))), "Create D6 cards");
      checked(await supabase.from("user_flashcards").upsert(extraIds.map((id, index) => ({
        id: `d6610000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, user_id: studentId, card_id: id,
        next_review_date: `2026-07-01T01:00:${String(index + 1).padStart(2, "0")}.000Z`, fsrs_meta: metadata, ease_factor: 2.5, interval_days: 7, last_rating: 3,
      }))), "Create D6 reviews");
    }
    const dueRows = checked(await supabase.from("user_flashcards").select("card_id").eq("user_id", studentId).lte("next_review_date", new Date().toISOString()), "Inspect due cardinality");
    if (dueRows.length !== count) throw new Error(`Expected ${count} due cards; found ${dueRows.length}.`);
  } catch (error) {
    await restore();
    throw error;
  }
  return {
    studentId,
    restore,
    async dueCount() {
      const rows = checked(await supabase.from("user_flashcards").select("card_id").eq("user_id", studentId).lte("next_review_date", new Date().toISOString()), "Read remaining due rows");
      return rows.length;
    },
    async assertSaved(cardId) {
      const row = checked(await supabase.from("user_flashcards").select("fsrs_meta, next_review_date").eq("user_id", studentId).eq("card_id", cardId).single(), "Read saved review");
      if (row.fsrs_meta.reps !== 4 || Date.parse(row.next_review_date) <= Date.now()) throw new Error("Expected one persisted rating and a future due date.");
    },
  };
}
