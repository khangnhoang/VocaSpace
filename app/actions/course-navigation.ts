"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";

export async function getFirstTopicSlugByCourseSlug(courseSlug: string) {
  const t = await getTranslations("courses");

  if (!courseSlug) {
    return {
      error: t("actions.firstTopic.missingSlug"),
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
      error: t("actions.firstTopic.notFound"),
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
      error: t("actions.firstTopic.chaptersFailed"),
      topicSlug: null,
    };
  }

  if (!chapters?.length) {
    return {
      error: t("actions.firstTopic.noChapters"),
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
        error: t("actions.firstTopic.topicFailed"),
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
    error: t("actions.firstTopic.noTopic"),
    topicSlug: null,
  };
}