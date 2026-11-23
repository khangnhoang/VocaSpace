"use server";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import {
  buildLearnCourseProgressProjection,
  type LearnDashboardChapterRow,
  type LearnDashboardTopicProgressRow,
  type LearnDashboardTopicRow,
} from "@/lib/learn-dashboard";
import {
  enrolledCourseOverviewResultSchema,
  type EnrolledCourseOverviewResult,
} from "@/lib/schemas/enrolled-course-overview";
import { publicCourseSlugSchema } from "@/lib/schemas/public-course";
import {
  readAllSupabaseRows,
  readChunkedSupabaseRows,
} from "@/lib/supabase-pagination";
import { createClient } from "@/utils/supabase/server";

// Thông báo theo ngôn ngữ của request; chỉ trang server gọi action này nên `router.refresh()` của nút thử lại và của bộ chọn ngôn
// ngữ dựng lại bằng ngôn ngữ mới (U3 H3), không cần wrapper.
type LearnTranslator = Awaited<ReturnType<typeof getTranslations<"learn">>>;

const queryFailedResult = (t: LearnTranslator): EnrolledCourseOverviewResult => ({
  status: "error",
  errorCode: "QUERY_FAILED",
  error: t("actions.overview.queryFailed"),
});

function parseOverviewResult(value: unknown, t: LearnTranslator): EnrolledCourseOverviewResult {
  const parsed = enrolledCourseOverviewResultSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  console.error(
    "Enrolled course overview output validation failed",
    parsed.error.issues,
  );
  return {
    status: "error",
    errorCode: "INVALID_DATA",
    error: t("actions.overview.invalidData"),
  };
}

export async function getEnrolledCourseOverview(
  rawCourseSlug: string,
): Promise<EnrolledCourseOverviewResult> {
  const slugResult = publicCourseSlugSchema.safeParse(rawCourseSlug);
  if (!slugResult.success) return { status: "not_found" };

  const t = await getTranslations("learn");

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError && !isAuthSessionMissingError(authError)) {
      console.error("Enrolled course overview auth query failed", authError);
      return queryFailedResult(t);
    }
    if (authError || !user) return { status: "auth_required" };

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, slug, title, thumbnail_url")
      .eq("slug", slugResult.data)
      .eq("status", "published")
      .is("removed_at", null)
      .maybeSingle();

    if (courseError) {
      console.error("Enrolled course overview course query failed", courseError);
      return queryFailedResult(t);
    }
    if (!course) return { status: "not_found" };

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", course.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Enrolled course overview enrollment query failed",
        enrollmentError,
      );
      return queryFailedResult(t);
    }
    if (!enrollment) {
      return parseOverviewResult({
        status: "unenrolled",
        course: { slug: course.slug, title: course.title },
      }, t);
    }

    const chapterResult = await readAllSupabaseRows((from, to) =>
      supabase
        .from("chapters")
        .select("id, title, order_index, removed_at, course_id")
        .eq("course_id", course.id)
        .is("removed_at", null)
        .order("order_index", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );

    if (chapterResult.error) {
      console.error(
        "Enrolled course overview chapter query failed",
        chapterResult.error,
      );
      return queryFailedResult(t);
    }

    const chapters = (chapterResult.data ?? []) as LearnDashboardChapterRow[];
    const chapterIds = chapters.map((chapter) => chapter.id);
    let topics: LearnDashboardTopicRow[] = [];
    let progress: LearnDashboardTopicProgressRow[] = [];

    if (chapterIds.length > 0) {
      const topicResult = await readChunkedSupabaseRows(
        chapterIds,
        (ids, from, to) =>
          supabase
            .from("topics")
            .select(
              "id, slug, title, order_index, status, removed_at, chapter_id, course_id",
            )
            .in("chapter_id", ids)
            .eq("status", "published")
            .is("removed_at", null)
            .order("chapter_id", { ascending: true })
            .order("order_index", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
      );

      if (topicResult.error) {
        console.error(
          "Enrolled course overview topic query failed",
          topicResult.error,
        );
        return queryFailedResult(t);
      }

      topics = (topicResult.data ?? []) as LearnDashboardTopicRow[];
      const topicIds = topics.map((topic) => topic.id);

      if (topicIds.length > 0) {
        const progressResult = await readChunkedSupabaseRows(
          topicIds,
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
            "Enrolled course overview progress query failed",
            progressResult.error,
          );
          return queryFailedResult(t);
        }

        progress = (progressResult.data ?? []) as
          LearnDashboardTopicProgressRow[];
      }
    }

    const projection = buildLearnCourseProgressProjection({
      courseId: course.id,
      chapters,
      topics,
      progress,
    });

    return parseOverviewResult({
      status: "success",
      data: {
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        courseThumbnailUrl: course.thumbnail_url,
        ...projection,
      },
    }, t);
  } catch (error) {
    console.error("Enrolled course overview unexpected failure", error);
    return queryFailedResult(t);
  }
}
