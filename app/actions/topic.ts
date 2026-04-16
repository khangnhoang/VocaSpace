// File: app/actions/topic.ts (hoặc file action tương ứng)
"use server";
import { createClient } from "@/utils/supabase/server";

// ==========================================
// 1. API LẤY THỐNG KÊ KHÓA HỌC (Realtime Count)
// ==========================================
export async function getCourseStats(courseId: string) {
  const supabase = await createClient();

  // 1. Đếm số Chương
  const { count: chaptersCount, data: chapters } = await supabase
    .from('chapters')
    .select('id', { count: 'exact' })
    .eq('course_id', courseId)
    .is('removed_at', null);

  const chapterIds = chapters?.map(c => c.id) || [];

  let topicsCount = 0;
  let topicIds: string[] = [];
  
  if (chapterIds.length > 0) {
    // 2. Đếm số Topic
    const { count, data: topics } = await supabase
      .from('topics')
      .select('id', { count: 'exact' })
      .in('chapter_id', chapterIds)
      .is('removed_at', null);
      
    topicsCount = count || 0;
    topicIds = topics?.map(t => t.id) || [];
  }

  let cardsCount = 0;
  let exercisesCount = 0;

  if (topicIds.length > 0) {
    // 3. Đếm số thẻ Từ vựng (Flashcards)
    const { count: cards } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .in('topic_id', topicIds)
      .is('removed_at', null);
    cardsCount = cards || 0;

    // 4. Đếm số bài tập (Exercises)
    const { count: exercises } = await supabase
      .from('exercises')
      .select('*', { count: 'exact', head: true })
      .in('topic_id', topicIds);
    exercisesCount = exercises || 0;
  }

  return {
    chapters: chaptersCount || 0,
    topics: topicsCount,
    cards: cardsCount,
    exercises: exercisesCount
  };
}

// ==========================================
// 2. API LẤY DANH SÁCH TOPIC TRONG 1 CHƯƠNG
// ==========================================
export async function getTopicsByChapterId(chapterId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("chapter_id", chapterId)
    .is("removed_at", null)
    .order("order_index", { ascending: true });

  if (error) return { error: error.message };
  return { data };
}