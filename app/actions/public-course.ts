"use server";

import { unstable_noStore } from "next/cache";
import {
  buildLearnCourseProgressProjection,
  type LearnDashboardChapterRow,
  type LearnDashboardTopicProgressRow,
  type LearnDashboardTopicRow,
} from "@/lib/learn-dashboard";
import {
  publicCourseCatalogRpcSchema,
  publicCourseDetailRpcSchema,
  publicCourseSlugSchema,
  type PublicCourseCatalogItem,
  type PublicCourseDetail,
  type PublicCourseDetailRpc,
  type PublicCourseLearnerProgress,
} from "@/lib/schemas/public-course";
import { readChunkedSupabaseRows } from "@/lib/supabase-pagination";
import { createClient } from "@/utils/supabase/server";

export type PublicCourseCatalogResult =
  | { status: "success"; data: PublicCourseCatalogItem[] }
  | { status: "error"; error: string };

export type PublicCourseDetailResult =
  | { status: "success"; data: PublicCourseDetail }
  | { status: "not_found" }
  | { status: "error"; error: string };

const PUBLIC_CATALOG_ERROR =
  "Không thể tải danh sách khóa học lúc này. Vui lòng thử lại.";
const PUBLIC_DETAIL_ERROR =
  "Không thể tải thông tin khóa học lúc này. Vui lòng thử lại.";

// LF3 AC10: hàng đầu vào của projection lấy từ chính syllabus RPC (đã chỉ gồm chủ đề published, chưa gỡ, trong chương chưa gỡ).
function toProjectionRows(course: PublicCourseDetailRpc) {
  const chapters: LearnDashboardChapterRow[] = [];
  const topics: LearnDashboardTopicRow[] = [];

  for (const chapter of course.syllabus) {
    chapters.push({
      id: chapter.id,
      title: chapter.title,
      order_index: chapter.order_index,
      removed_at: null,
      course_id: course.id,
    });
    for (const topic of chapter.topics) {
      topics.push({
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        order_index: topic.order_index,
        status: "published",
        removed_at: null,
        chapter_id: chapter.id,
        course_id: course.id,
      });
    }
  }

  return { chapters, topics };
}

export async function getPublicCourseCatalog(): Promise<PublicCourseCatalogResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_catalog");

  if (error) {
    console.error("Public course catalog RPC failed", error);
    return { status: "error", error: PUBLIC_CATALOG_ERROR };
  }

  const parsed = publicCourseCatalogRpcSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Public course catalog contract drift", parsed.error.issues);
    return { status: "error", error: PUBLIC_CATALOG_ERROR };
  }

  return { status: "success", data: parsed.data };
}

export async function getPublicCourseDetail(
  rawCourseSlug: string,
): Promise<PublicCourseDetailResult> {
  unstable_noStore();
  const slugResult = publicCourseSlugSchema.safeParse(rawCourseSlug);
  if (!slugResult.success) return { status: "not_found" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_detail", {
    p_course_slug: slugResult.data,
  });

  if (error) {
    console.error("Public course detail RPC failed", error);
    return { status: "error", error: PUBLIC_DETAIL_ERROR };
  }
  if (data === null) return { status: "not_found" };

  const parsed = publicCourseDetailRpcSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Public course detail contract drift", parsed.error.issues);
    return { status: "error", error: PUBLIC_DETAIL_ERROR };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isEnrolled = false;
  let learnerProgress: PublicCourseLearnerProgress | null = null;

  if (user) {
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", parsed.data.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (enrollmentError) {
      console.error("Public course enrollment overlay failed", enrollmentError);
      return { status: "error", error: PUBLIC_DETAIL_ERROR };
    }
    isEnrolled = enrollment !== null;

    if (isEnrolled) {
      const { chapters, topics } = toProjectionRows(parsed.data);
      let progress: LearnDashboardTopicProgressRow[] = [];

      if (topics.length > 0) {
        // Chỉ đọc hàng của chính người học (kể cả admin): user_topic_progress chỉ có policy own-row.
        const progressResult = await readChunkedSupabaseRows(
          topics.map((topic) => topic.id),
          (ids, from, to) =>
            supabase
              .from("user_topic_progress")
              .select("topic_id, is_topic_completed")
              .eq("user_id", user.id)
              .in("topic_id", ids)
              .eq("is_topic_completed", true)
              .order("topic_id", { ascending: true })
              .range(from, to),
        );

        if (progressResult.error) {
          console.error(
            "Public course progress overlay failed",
            progressResult.error,
          );
          return { status: "error", error: PUBLIC_DETAIL_ERROR };
        }
        progress = (progressResult.data ?? []) as LearnDashboardTopicProgressRow[];
      }

      const projection = buildLearnCourseProgressProjection({
        courseId: parsed.data.id,
        chapters,
        topics,
        progress,
      });
      learnerProgress = {
        completed_topic_ids: projection.chapters.flatMap((chapter) =>
          chapter.topics
            .filter((topic) => topic.isCompleted)
            .map((topic) => topic.id),
        ),
        next_topic_slug: projection.nextTopic?.slug ?? null,
      };
    }
  }

  return {
    status: "success",
    data: {
      ...parsed.data,
      is_enrolled: isEnrolled,
      learner_progress: learnerProgress,
    },
  };
}
