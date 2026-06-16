"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  topicAuthoringContextSchema,
  topicCreateSchema,
  topicDeleteSchema,
  topicUpdateSchema,
  type TopicAuthoringContextInput,
  type TopicCreateInput,
  type TopicDeleteInput,
  type TopicUpdateInput,
} from "@/lib/schemas/topic";

function mapTopicReadError(code?: string) {
  if (code === "42501") {
    return "Bạn không có quyền xem dữ liệu bài học này.";
  }

  return "Không thể tải dữ liệu bài học. Vui lòng thử lại.";
}

function mapTopicMutationError(code?: string) {
  if (code === "23505") {
    return "Đường dẫn bài học đã tồn tại.";
  }

  if (code === "42501") {
    return "Bạn không có quyền chỉnh sửa bài học này.";
  }

  return "Không thể lưu bài học. Vui lòng thử lại.";
}

function mapCourseStatsError(code?: string) {
  if (code === "42501") {
    return "Bạn không có quyền xem thống kê của khóa học này.";
  }

  return "Không thể tải thống kê khóa học. Vui lòng thử lại.";
}

function revalidateCourseStructure(courseId: string) {
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/structure`);
}

const topicUnavailableMessage =
  "Bài học không còn khả dụng trong cấu trúc hiện tại của khóa học.";

export async function verifyTopicAuthoringContext(
  rawInput: TopicAuthoringContextInput,
) {
  const parsed = topicAuthoringContextSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      isValid: false,
      reason: "unavailable" as const,
      error:
        parsed.error.issues[0]?.message ??
        "Đường dẫn bài học không hợp lệ.",
    };
  }

  const { courseId, topicId } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isValid: false,
      reason: "forbidden" as const,
      error: "Vui lòng đăng nhập lại.",
    };
  }

  const { data: hasManagementAccess, error: accessError } =
    await supabase.rpc("has_course_management_access", {
      target_course_id: courseId,
    });

  if (accessError || !hasManagementAccess) {
    if (accessError) console.error("[TOPIC CONTEXT ACCESS ERROR]:", accessError);
    return {
      isValid: false,
      reason: accessError ? ("error" as const) : ("forbidden" as const),
      error: accessError
        ? "Không thể kiểm tra quyền chỉnh sửa khóa học. Vui lòng thử lại."
        : "Bạn không có quyền chỉnh sửa khóa học này.",
    };
  }

  const { data, error } = await supabase
    .from("topics")
    .select(
      `
      id,
      title,
      course_id,
      removed_at,
      chapters!inner (
        id,
        course_id,
        removed_at
      )
    `,
    )
    .eq("id", topicId)
    .eq("course_id", courseId)
    .is("removed_at", null)
    .eq("chapters.course_id", courseId)
    .is("chapters.removed_at", null)
    .single();

  if (error || !data) {
    if (error?.code && error.code !== "PGRST116") {
      console.error("[TOPIC CONTEXT ERROR]:", error);
      return {
        isValid: false,
        reason: "error" as const,
        error: "Không thể kiểm tra trạng thái bài học. Vui lòng thử lại.",
      };
    }

    return {
      isValid: false,
      reason: "unavailable" as const,
      error: topicUnavailableMessage,
    };
  }

  return { isValid: true, data };
}

export async function getTopicById(topicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, title, status")
    .eq("id", topicId)
    .is("removed_at", null)
    .single();

  if (error) {
    console.error("[TOPIC GET ERROR]:", error);
    return { error: mapTopicReadError(error.code) };
  }

  return { data };
}

export async function updateTopic(rawInput: TopicUpdateInput) {
  const parsed = topicUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin bài học không hợp lệ.",
    };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase
    .from("topics")
    .update({
      title: input.title,
      status: input.status,
    })
    .eq("id", input.topicId)
    .is("removed_at", null)
    .select("id, course_id, chapter_id, title, status, order_index, created_at")
    .single();

  if (error) {
    console.error("[TOPIC UPDATE ERROR]:", error);
    return { error: mapTopicMutationError(error.code) };
  }

  revalidateCourseStructure(data.course_id);
  return { success: true, message: "Đã cập nhật bài học.", data };
}

export async function deleteTopic(rawInput: TopicDeleteInput) {
  const parsed = topicDeleteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin bài học không hợp lệ.",
    };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase
    .from("topics")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", input.topicId)
    .is("removed_at", null)
    .select("id, course_id")
    .single();

  if (error) {
    console.error("[TOPIC DELETE ERROR]:", error);
    return { error: mapTopicMutationError(error.code) };
  }

  revalidateCourseStructure(data.course_id);
  return { success: true, message: "Đã ẩn bài học khỏi khóa học." };
}

export async function getCourseStats(courseId: string) {
  const supabase = await createClient();

  const {
    count: chaptersCount,
    data: chapters,
    error: chaptersError,
  } = await supabase
    .from("chapters")
    .select("id", { count: "exact" })
    .eq("course_id", courseId)
    .is("removed_at", null);

  if (chaptersError) {
    console.error("[COURSE STATS CHAPTERS ERROR]:", chaptersError);
    return { error: mapCourseStatsError(chaptersError.code) };
  }

  const chapterIds = chapters?.map((chapter) => chapter.id) ?? [];
  let topicsCount = 0;
  let topicIds: string[] = [];

  if (chapterIds.length > 0) {
    const { count, data: topics, error: topicsError } = await supabase
      .from("topics")
      .select("id", { count: "exact" })
      .in("chapter_id", chapterIds)
      .eq("course_id", courseId)
      .is("removed_at", null);

    if (topicsError) {
      console.error("[COURSE STATS TOPICS ERROR]:", topicsError);
      return { error: mapCourseStatsError(topicsError.code) };
    }

    topicsCount = count ?? 0;
    topicIds = topics?.map((topic) => topic.id) ?? [];
  }

  let cardsCount = 0;
  let exercisesCount = 0;

  if (topicIds.length > 0) {
    const { count: cards, error: cardsError } = await supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .in("topic_id", topicIds)
      .is("removed_at", null);

    if (cardsError) {
      console.error("[COURSE STATS CARDS ERROR]:", cardsError);
      return { error: mapCourseStatsError(cardsError.code) };
    }

    cardsCount = cards ?? 0;

    const { count: exercises, error: exercisesError } = await supabase
      .from("exercises")
      .select("*", { count: "exact", head: true })
      .in("topic_id", topicIds)
      .is("removed_at", null);

    if (exercisesError) {
      console.error("[COURSE STATS EXERCISES ERROR]:", exercisesError);
      return { error: mapCourseStatsError(exercisesError.code) };
    }

    exercisesCount = exercises ?? 0;
  }

  return {
    chapters: chaptersCount ?? 0,
    topics: topicsCount,
    cards: cardsCount,
    exercises: exercisesCount,
  };
}

export async function getTopicsByChapterId(chapterId: string) {
  const supabase = await createClient();
  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id")
    .eq("id", chapterId)
    .is("removed_at", null)
    .single();

  if (chapterError || !chapter) {
    if (chapterError) console.error("[TOPIC CHAPTER ERROR]:", chapterError);
    return {
      error:
        chapterError?.code === "42501"
          ? mapTopicReadError(chapterError.code)
          : "Chương không còn hoạt động hoặc bạn không có quyền xem bài học.",
    };
  }

  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("chapter_id", chapterId)
    .is("removed_at", null)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[TOPIC LIST ERROR]:", error);
    return { error: mapTopicReadError(error.code) };
  }

  return { data };
}

export async function createTopic(rawInput: TopicCreateInput) {
  const parsed = topicCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin bài học không hợp lệ.",
    };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id")
    .eq("id", input.chapterId)
    .eq("course_id", input.courseId)
    .is("removed_at", null)
    .single();

  if (chapterError || !chapter) {
    if (chapterError) console.error("[TOPIC CREATE CHAPTER ERROR]:", chapterError);
    return {
      error: "Không thể thêm bài học vào chương không còn hoạt động.",
    };
  }

  const { data: maxTopic, error: maxError } = await supabase
    .from("topics")
    .select("order_index")
    .eq("chapter_id", input.chapterId)
    .order("order_index", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    console.error("[TOPIC ORDER ERROR]:", maxError);
    return { error: mapTopicMutationError(maxError.code) };
  }

  const nextOrderIndex = (maxTopic?.order_index ?? 0) + 1;
  const { data, error } = await supabase
    .from("topics")
    .insert({
      course_id: input.courseId,
      chapter_id: input.chapterId,
      title: input.title,
      status: input.status,
      order_index: nextOrderIndex,
    })
    .select("id, course_id, chapter_id, title, status, order_index, created_at")
    .single();

  if (error) {
    console.error("[TOPIC CREATE ERROR]:", error);
    return { error: mapTopicMutationError(error.code) };
  }

  revalidateCourseStructure(input.courseId);
  return { success: true, message: "Thêm bài học mới thành công.", data };
}
