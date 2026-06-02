"use server";

import { createClient } from "@/utils/supabase/server";

export async function getFirstTopicSlugByCourseSlug(courseSlug: string) {
  if (!courseSlug) {
    return {
      error: "Thiếu course slug.",
      topicSlug: null,
    };
  }

  const supabase = await createClient();

  // 1. Check course published
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .eq("status", "published")
    .single();

  if (courseError || !course) {
    return {
      error: "Không tìm thấy khóa học hoặc khóa học chưa được xuất bản.",
      topicSlug: null,
    };
  }

  // 2. Lấy chapters theo thứ tự
  const { data: chapters, error: chaptersError } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", course.id)
    .order("order_index", { ascending: true });

  if (chaptersError) {
    console.error("🚨 [GET_CHAPTERS_ERROR]:", chaptersError);

    return {
      error: "Không thể lấy danh sách chương học.",
      topicSlug: null,
    };
  }

  if (!chapters?.length) {
    return {
      error: "Khóa học chưa có chương học nào.",
      topicSlug: null,
    };
  }

  // 3. Duyệt từng chapter, lấy first published topic
  for (const chapter of chapters) {
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select("slug")
      .eq("course_id", course.id)
      .eq("chapter_id", chapter.id)
      .eq("status", "published")
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (topicError) {
      console.error("🚨 [GET_FIRST_TOPIC_ERROR]:", topicError);

      return {
        error: "Không thể lấy bài học đầu tiên.",
        topicSlug: null,
      };
    }

    if (topic?.slug) {
      return {
        error: null,
        topicSlug: topic.slug,
      };
    }
  }

  // 4. Có chapter nhưng không có topic published nào
  return {
    error: "Khóa học chưa có bài học nào được xuất bản.",
    topicSlug: null,
  };
}