"use server";

import { deriveCourseDashboardReadiness } from "@/lib/course-readiness";
import {
  courseReadinessAccessRowSchema,
  courseReadinessCourseIdSchema,
  courseReadinessGraphSchema,
  type CourseReadinessErrorCode,
  type CourseReadinessResult,
} from "@/lib/schemas/course-readiness";
import { createClient } from "@/utils/supabase/server";

type QueryFailure = {
  table: string;
  error: {
    code?: string;
    message?: string;
  };
};

function safeReadinessError(
  code: CourseReadinessErrorCode,
  message: string,
): CourseReadinessResult {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

function firstCourseFromAccessRow(
  rawAccessRow: unknown,
): ReturnType<typeof courseReadinessAccessRowSchema.safeParse> {
  return courseReadinessAccessRowSchema.safeParse(rawAccessRow);
}

function mapAccessCourse(accessRow: unknown) {
  const parsedAccess = firstCourseFromAccessRow(accessRow);
  if (!parsedAccess.success) return parsedAccess;

  const course = Array.isArray(parsedAccess.data.courses)
    ? parsedAccess.data.courses[0]
    : parsedAccess.data.courses;

  if (!course) {
    return courseReadinessAccessRowSchema.safeParse({
      role: parsedAccess.data.role,
      courses: {},
    });
  }

  return courseReadinessAccessRowSchema.safeParse({
    role: parsedAccess.data.role,
    courses: course,
  });
}

function queryFailed(table: string, result: { error?: unknown }): QueryFailure | null {
  if (!result.error) return null;

  const error =
    typeof result.error === "object" && result.error != null
      ? (result.error as { code?: string; message?: string })
      : { message: "Unknown query error" };

  return { table, error };
}

// Đọc content graph hẹp cho dashboard readiness, validate tại server boundary rồi derive contract thuần.
// Data flow: route param -> auth/access -> bounded Supabase reads -> Zod parse -> deterministic readiness result.
export async function getCourseDashboardReadiness(
  courseId: string,
): Promise<CourseReadinessResult> {
  const parsedCourseId = courseReadinessCourseIdSchema.safeParse(courseId);
  if (!parsedCourseId.success) {
    return safeReadinessError(
      "INVALID_COURSE_ID",
      "ID khóa học không hợp lệ.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return safeReadinessError(
      "AUTH_REQUIRED",
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  }

  const accessResult = await supabase
    .from("course_collaborators")
    .select(
      `
      role,
      courses!inner (
        id, title, slug, description, thumbnail_url, price, status, order_index, removed_at
      )
    `,
    )
    .eq("course_id", parsedCourseId.data)
    .eq("user_id", user.id)
    .is("courses.removed_at", null)
    .single();

  if (accessResult.error || !accessResult.data) {
    return safeReadinessError(
      "COURSE_NOT_FOUND_OR_FORBIDDEN",
      "Khóa học không tồn tại hoặc bạn không có quyền truy cập.",
    );
  }

  const parsedAccess = mapAccessCourse(accessResult.data);
  if (!parsedAccess.success) {
    console.error("[COURSE READINESS ACCESS SHAPE ERROR]:", parsedAccess.error.issues);
    return safeReadinessError(
      "INVALID_READINESS_DATA",
      "Cấu trúc dữ liệu readiness không hợp lệ. Vui lòng thử lại.",
    );
  }

  const course = Array.isArray(parsedAccess.data.courses)
    ? parsedAccess.data.courses[0]
    : parsedAccess.data.courses;

  const chaptersResult = await supabase
    .from("chapters")
    .select("id, course_id, title, order_index, created_at, removed_at")
    .eq("course_id", parsedCourseId.data)
    .is("removed_at", null)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  const chapterFailure = queryFailed("chapters", chaptersResult);
  if (chapterFailure) {
    console.error("[COURSE READINESS QUERY ERROR]:", chapterFailure);
    return safeReadinessError(
      "QUERY_FAILED",
      "Không thể tải dữ liệu readiness của khóa học. Vui lòng thử lại.",
    );
  }

  const chapters = (chaptersResult.data ?? []) as unknown[];
  const chapterIds = chapters
    .map((chapter) =>
      typeof chapter === "object" && chapter != null && "id" in chapter
        ? chapter.id
        : null,
    )
    .filter((id): id is string => typeof id === "string");

  let topics: unknown[] = [];
  if (chapterIds.length > 0) {
    const topicsResult = await supabase
      .from("topics")
      .select(
        "id, course_id, chapter_id, title, slug, status, order_index, created_at, removed_at",
      )
      .eq("course_id", parsedCourseId.data)
      .in("chapter_id", chapterIds)
      .is("removed_at", null)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    const topicsFailure = queryFailed("topics", topicsResult);
    if (topicsFailure) {
      console.error("[COURSE READINESS QUERY ERROR]:", topicsFailure);
      return safeReadinessError(
        "QUERY_FAILED",
        "Không thể tải dữ liệu readiness của khóa học. Vui lòng thử lại.",
      );
    }

    topics = (topicsResult.data ?? []) as unknown[];
  }

  const topicIds = topics
    .map((topic) =>
      typeof topic === "object" && topic != null && "id" in topic
        ? topic.id
        : null,
    )
    .filter((id): id is string => typeof id === "string");

  let flashcards: unknown[] = [];
  let exercises: unknown[] = [];

  if (topicIds.length > 0) {
    const [flashcardsResult, exercisesResult] = await Promise.all([
      supabase
        .from("cards")
        .select("id, topic_id, order_index, removed_at")
        .in("topic_id", topicIds)
        .is("removed_at", null)
        .order("order_index", { ascending: true }),
      supabase
        .from("exercises")
        .select("id, course_id, topic_id, title, part_type, order_index, created_at, removed_at")
        .in("topic_id", topicIds)
        .is("removed_at", null)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const contentFailure =
      queryFailed("cards", flashcardsResult) ||
      queryFailed("exercises", exercisesResult);
    if (contentFailure) {
      console.error("[COURSE READINESS QUERY ERROR]:", contentFailure);
      return safeReadinessError(
        "QUERY_FAILED",
        "Không thể tải dữ liệu readiness của khóa học. Vui lòng thử lại.",
      );
    }

    flashcards = (flashcardsResult.data ?? []) as unknown[];
    exercises = (exercisesResult.data ?? []) as unknown[];
  }

  const exerciseIds = exercises
    .map((exercise) =>
      typeof exercise === "object" && exercise != null && "id" in exercise
        ? exercise.id
        : null,
    )
    .filter((id): id is string => typeof id === "string");

  let questionGroups: unknown[] = [];
  let questions: unknown[] = [];

  if (exerciseIds.length > 0) {
    const [groupsResult, questionsResult] = await Promise.all([
      supabase
        .from("question_groups")
        .select(
          "id, exercise_id, passage_text, audio_url, image_url, order_index, created_at, removed_at",
        )
        .in("exercise_id", exerciseIds)
        .is("removed_at", null)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("questions")
        .select("id, course_id, exercise_id, group_id, content, order_index, created_at, removed_at")
        .in("exercise_id", exerciseIds)
        .is("removed_at", null)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const exerciseFailure =
      queryFailed("question_groups", groupsResult) ||
      queryFailed("questions", questionsResult);
    if (exerciseFailure) {
      console.error("[COURSE READINESS QUERY ERROR]:", exerciseFailure);
      return safeReadinessError(
        "QUERY_FAILED",
        "Không thể tải dữ liệu readiness của khóa học. Vui lòng thử lại.",
      );
    }

    questionGroups = (groupsResult.data ?? []) as unknown[];
    questions = (questionsResult.data ?? []) as unknown[];
  }

  const questionIds = questions
    .map((question) =>
      typeof question === "object" && question != null && "id" in question
        ? question.id
        : null,
    )
    .filter((id): id is string => typeof id === "string");

  let answerOptions: unknown[] = [];
  if (questionIds.length > 0) {
    const optionsResult = await supabase
      .from("question_options")
      .select("id, question_id, content, label, is_correct, order_index, removed_at")
      .in("question_id", questionIds)
      .is("removed_at", null)
      .order("order_index", { ascending: true });

    const optionsFailure = queryFailed("question_options", optionsResult);
    if (optionsFailure) {
      console.error("[COURSE READINESS QUERY ERROR]:", optionsFailure);
      return safeReadinessError(
        "QUERY_FAILED",
        "Không thể tải dữ liệu readiness của khóa học. Vui lòng thử lại.",
      );
    }

    answerOptions = (optionsResult.data ?? []) as unknown[];
  }

  const parsedGraph = courseReadinessGraphSchema.safeParse({
    role: parsedAccess.data.role,
    course,
    chapters,
    topics,
    flashcards,
    exercises,
    questionGroups,
    questions,
    answerOptions,
  });

  if (!parsedGraph.success) {
    console.error("[COURSE READINESS SHAPE ERROR]:", parsedGraph.error.issues);
    return safeReadinessError(
      "INVALID_READINESS_DATA",
      "Cấu trúc dữ liệu readiness không hợp lệ. Vui lòng thử lại.",
    );
  }

  const readiness = deriveCourseDashboardReadiness(parsedGraph.data);

  return {
    success: true,
    data: readiness,
  };
}
