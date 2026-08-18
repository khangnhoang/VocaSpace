"use server";

import { createClient } from "@/utils/supabase/server";
import {
  buildLearnDashboardCourses,
  buildPendingPaymentSummaries,
  buildReviewSummary,
  getVisibleLearnDashboardEnrollments,
  type LearnDashboardChapterRow,
  type LearnDashboardEnrollmentRow,
  type LearnDashboardFlashcardRow,
  type LearnDashboardPaymentRow,
  type LearnDashboardTopicProgressRow,
  type LearnDashboardTopicRow,
} from "@/lib/learn-dashboard";
import {
  learnDashboardDataSchema,
  type LearnDashboardResult,
} from "@/lib/schemas/learn-dashboard";
import {
  readAllSupabaseRows,
  readChunkedSupabaseRows,
} from "@/lib/supabase-pagination";

const queryFailedResult = (): LearnDashboardResult => ({
  success: false,
  errorCode: "QUERY_FAILED",
  error: "Không thể tải dashboard học tập lúc này.",
});

export async function getLearnDashboard(): Promise<LearnDashboardResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      errorCode: "AUTH_REQUIRED",
      error: "Vui lòng đăng nhập để xem dashboard học tập.",
    };
  }

  try {
    const [enrollmentResult, flashcardResult, paymentResult] =
      await Promise.all([
        readAllSupabaseRows((from, to) =>
          supabase
            .from("enrollments")
            .select(
              `
              id,
              course_id,
              course:courses (id, title, slug, thumbnail_url, status, removed_at)
            `,
            )
            .eq("user_id", user.id)
            .order("enrolled_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to),
        ),
        readAllSupabaseRows((from, to) =>
          supabase
            .from("user_flashcards")
            .select("id, next_review_date, fsrs_meta")
            .eq("user_id", user.id)
            .order("id", { ascending: true })
            .range(from, to),
        ),
        readAllSupabaseRows((from, to) =>
          supabase
            .from("payments")
            .select(
              `
              id,
              course_id,
              status,
              created_at,
              expires_at,
              course:courses (slug, title)
            `,
            )
            .eq("user_id", user.id)
            .in("status", ["creating", "pending"])
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to),
        ),
      ]);

    if (
      enrollmentResult.error ||
      flashcardResult.error ||
      paymentResult.error
    ) {
      console.error("Learn dashboard primary query failed", {
        enrollments: enrollmentResult.error,
        flashcards: flashcardResult.error,
        payments: paymentResult.error,
      });
      return queryFailedResult();
    }

    const enrollments = (enrollmentResult.data ?? []) as unknown as
      LearnDashboardEnrollmentRow[];
    const visibleEnrollments = getVisibleLearnDashboardEnrollments(enrollments);
    const courseIds = Array.from(
      new Set(visibleEnrollments.map((enrollment) => enrollment.course_id)),
    );

    let chapters: LearnDashboardChapterRow[] = [];
    let topics: LearnDashboardTopicRow[] = [];
    let progress: LearnDashboardTopicProgressRow[] = [];

    if (courseIds.length > 0) {
      const chapterResult = await readChunkedSupabaseRows(
        courseIds,
        (chunkCourseIds, from, to) =>
          supabase
            .from("chapters")
            .select("id, title, order_index, removed_at, course_id")
            .in("course_id", chunkCourseIds)
            .is("removed_at", null)
            .order("course_id", { ascending: true })
            .order("order_index", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
      );

      if (chapterResult.error) {
        console.error("Learn dashboard chapter query failed", chapterResult.error);
        return queryFailedResult();
      }

      chapters = (chapterResult.data ?? []) as LearnDashboardChapterRow[];
      const chapterIds = chapters.map((chapter) => chapter.id);

      if (chapterIds.length > 0) {
        const topicResult = await readChunkedSupabaseRows(
          chapterIds,
          (chunkChapterIds, from, to) =>
            supabase
              .from("topics")
              .select(
                "id, slug, title, order_index, status, removed_at, chapter_id, course_id",
              )
              .in("chapter_id", chunkChapterIds)
              .eq("status", "published")
              .is("removed_at", null)
              .order("chapter_id", { ascending: true })
              .order("order_index", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
        );

        if (topicResult.error) {
          console.error("Learn dashboard topic query failed", topicResult.error);
          return queryFailedResult();
        }

        topics = (topicResult.data ?? []) as LearnDashboardTopicRow[];
        const topicIds = topics.map((topic) => topic.id);

        if (topicIds.length > 0) {
          const progressResult = await readChunkedSupabaseRows(
            topicIds,
            (chunkTopicIds, from, to) =>
              supabase
                .from("user_topic_progress")
                .select("topic_id, is_topic_completed")
                .eq("user_id", user.id)
                .in("topic_id", chunkTopicIds)
                .eq("is_topic_completed", true)
                .order("topic_id", { ascending: true })
                .range(from, to),
          );

          if (progressResult.error) {
            console.error(
              "Learn dashboard topic progress query failed",
              progressResult.error,
            );
            return queryFailedResult();
          }

          progress = (progressResult.data ?? []) as
            LearnDashboardTopicProgressRow[];
        }
      }
    }

    const pendingPayments = buildPendingPaymentSummaries(
      (paymentResult.data ?? []) as unknown as LearnDashboardPaymentRow[],
    );
    const parsedData = learnDashboardDataSchema.safeParse({
      courses: buildLearnDashboardCourses({
        enrollments,
        chapters,
        topics,
        progress,
      }),
      reviewSummary: buildReviewSummary(
        (flashcardResult.data ?? []) as unknown as LearnDashboardFlashcardRow[],
      ),
      pendingPayments,
      pendingPaymentCount: pendingPayments.length,
    });

    if (!parsedData.success) {
      console.error(
        "Learn dashboard output validation failed",
        parsedData.error.issues,
      );
      return {
        success: false,
        errorCode: "INVALID_DATA",
        error: "Dữ liệu dashboard học tập không hợp lệ.",
      };
    }

    return { success: true, data: parsedData.data };
  } catch (error) {
    console.error("Learn dashboard unexpected failure", error);
    return queryFailedResult();
  }
}
