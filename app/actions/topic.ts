// File: app/actions/topic.ts (hoặc file action tương ứng)
"use server";
import { createClient } from "@/utils/supabase/server";
import { topicSchema } from "@/lib/schemas/topic";

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

// ==========================================
// 3. API THÊM BÀI HỌC (TOPIC)
// ==========================================
export async function createTopic(chapterId: string, rawData: { title: string; order_index: number; status: string }) {
  const supabase = await createClient();
  
  // 1. Kiểm tra đăng nhập
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  // 2. Chốt chặn Backend bằng Zod
  const validatedFields = topicSchema.safeParse(rawData);
  if (!validatedFields.success) {
    return { error: "Dữ liệu không hợp lệ: " + validatedFields.error.issues[0].message };
  }
  
  const { title, order_index, status } = validatedFields.data;

  try {
    // 3. Truy vấn lấy order_index lớn nhất hiện có
    const { data: maxTopic } = await supabase
      .from("topics")
      .select("order_index")
      .eq("chapter_id", chapterId)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();

    const currentMax = maxTopic ? maxTopic.order_index : 0;

    // 4. Kiểm tra logic cứng: Index truyền lên bắt buộc phải lớn hơn Index lớn nhất
    if (order_index <= currentMax) {
      return { error: `Số thứ tự phải lớn hơn ${currentMax}. Đã có người cập nhật bài học trước bạn!` };
    }

    // 5. Thực hiện Insert an toàn
    const { error } = await supabase
      .from("topics")
      .insert({
        chapter_id: chapterId,
        title,
        order_index,
        status: status as "draft" | "pending" | "published",
      });

    if (error) {
      if (error.code === '23505') return { error: "Thứ tự bài học đã tồn tại!" };
      return { error: "Lỗi hệ thống: " + error.message };
    }

    return { success: true, message: "Thêm bài học mới thành công!" };
  } catch (err) {
    return { error: "Đã xảy ra lỗi không xác định." };
  }
}