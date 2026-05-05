// File: app/actions/topic.ts (hoặc file action tương ứng)
"use server";
import { createClient } from "@/utils/supabase/server";
import { topicSchema } from "@/lib/schemas/topic";

// Tạo Schema Update bằng cách loại bỏ trường order_index từ Schema gốc
const topicUpdateSchema = topicSchema.omit({ order_index: true });

// ==========================================
// 1. LẤY THÔNG TIN TOPIC HIỆN TẠI
// ==========================================
export async function getTopicById(topicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, title, status")
    .eq("id", topicId)
    .single();

  if (error) return { error: error.message };
  return { data };
}

// ==========================================
// 2. CẬP NHẬT THÔNG TIN CƠ BẢN
// ==========================================
export async function updateTopic(topicId: string, rawData: { title: string; status: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  // Sử dụng Schema đã loại bỏ order_index
  const validated = topicUpdateSchema.safeParse(rawData);
  if (!validated.success) return { error: validated.error.issues[0].message };

  const { error } = await supabase
    .from("topics")
    .update({ 
      title: validated.data.title, 
      status: validated.data.status, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", topicId);

  if (error) return { error: "Lỗi hệ thống khi cập nhật." };
  return { success: true, message: "Đã lưu cài đặt bài học!" };
}

// ==========================================
// 3. XÓA BÀI HỌC (SOFT DELETE)
// ==========================================
export async function deleteTopic(topicId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { error } = await supabase
    .from("topics")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", topicId);

  if (error) return { error: "Lỗi hệ thống khi xóa bài học." };
  return { success: true, message: "Đã xóa bài học thành công!" };
}

// ==========================================
// 4. API LẤY THỐNG KÊ KHÓA HỌC (Realtime Count)
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
// 5. API LẤY DANH SÁCH TOPIC TRONG 1 CHƯƠNG
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
// 6. API THÊM BÀI HỌC (TOPIC)
// ==========================================
export async function createTopic(chapterId: string, rawData: { title: string; order_index: number; status: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  // Dùng trực tiếp topicSchema được import từ lib
  const validatedFields = topicSchema.safeParse(rawData);
  if (!validatedFields.success) {
    return { error: "Dữ liệu không hợp lệ: " + validatedFields.error.issues[0].message };
  }
  
  const { title, order_index, status } = validatedFields.data;

  try {
    const { data: maxTopic } = await supabase
      .from("topics")
      .select("order_index")
      .eq("chapter_id", chapterId)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();

    const currentMax = maxTopic ? maxTopic.order_index : 0;

    if (order_index <= currentMax) {
      return { error: `Số thứ tự phải lớn hơn ${currentMax}. Đã có người cập nhật bài học trước bạn!` };
    }

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