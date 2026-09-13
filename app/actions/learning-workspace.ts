"use server";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import {
  learningWorkspaceCourseSlugSchema,
  learningWorkspaceResultSchema,
  learningWorkspaceTopicSlugSchema,
  type LearningWorkspaceData,
  type LearningWorkspaceResult,
} from "@/lib/schemas/learning-workspace";
import { createClient } from "@/utils/supabase/server";

const QUERY_ERROR = "Không thể tải bài học lúc này. Vui lòng thử lại.";
const INVALID_DATA_ERROR = "Dữ liệu bài học không hợp lệ.";

type RawCourse = {
  id: string;
  slug: string;
  title: string;
  enrollments?: Array<{ id: string; user_id: string }> | null;
};

type RawSyllabusTopic = {
  id: string;
  slug: string;
  title: string;
  status: string | null;
  order_index: number | null;
  chapter_id: string | null;
  course_id: string;
  removed_at: string | null;
};

type RawSyllabusChapter = {
  id: string;
  title: string;
  order_index: number | null;
  course_id: string;
  removed_at: string | null;
  topics?: RawSyllabusTopic[] | null;
};

type RawAnswer = {
  selected_option_id: string;
  is_correct: boolean;
};

type RawOption = {
  id: string;
  question_id: string;
  content: string;
  label: string | null;
  is_correct: boolean;
  order_index: number | null;
  removed_at: string | null;
};

type RawQuestion = {
  id: string;
  exercise_id: string;
  course_id: string;
  content: string;
  explanation: string | null;
  order_index: number | null;
  removed_at: string | null;
  options?: RawOption[] | null;
  answers?: RawAnswer[] | null;
};

type RawGroup = {
  id: string;
  exercise_id: string;
  passage_text: string | null;
  audio_url: string | null;
  image_url: string | null;
  order_index: number | null;
  removed_at: string | null;
  questions?: RawQuestion[] | null;
};

type RawExercise = {
  id: string;
  topic_id: string;
  course_id: string;
  title: string;
  part_type: string;
  order_index: number | null;
  removed_at: string | null;
  groups?: RawGroup[] | null;
};

type RawCard = {
  id: string;
  topic_id: string;
  front_content: unknown;
  back_content: unknown;
  audio_url: string | null;
  image_url: string | null;
  order_index: number | null;
  removed_at: string | null;
};

type RawProgress = {
  topic_id: string;
  is_flashcard_completed: boolean | null;
  is_exercise_completed: boolean | null;
  is_topic_completed: boolean | null;
};

type RawTopicAggregate = {
  id: string;
  slug: string;
  title: string;
  status: string | null;
  order_index: number | null;
  chapter_id: string | null;
  course_id: string;
  removed_at: string | null;
  chapter?: {
    id: string;
    course_id: string;
    removed_at: string | null;
  } | null;
  cards?: RawCard[] | null;
  exercises?: RawExercise[] | null;
  progress?: RawProgress[] | null;
};

type LearningWorkspaceDataDraft = Omit<
  LearningWorkspaceData,
  "flashcards" | "exercises"
> & {
  flashcards: unknown[];
  exercises: unknown[];
};

const queryFailedResult = (): LearningWorkspaceResult => ({
  status: "error",
  errorCode: "QUERY_FAILED",
  error: QUERY_ERROR,
});

function parseWorkspaceResult(value: unknown): LearningWorkspaceResult {
  const parsed = learningWorkspaceResultSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  console.error("Learning workspace output validation failed", parsed.error.issues);
  return {
    status: "error",
    errorCode: "INVALID_DATA",
    error: INVALID_DATA_ERROR,
  };
}

function compareOrderedRows(
  left: { order_index: number | null; id: string },
  right: { order_index: number | null; id: string },
) {
  return (
    (left.order_index ?? 0) - (right.order_index ?? 0) ||
    left.id.localeCompare(right.id)
  );
}

function buildSyllabus(
  courseId: string,
  chapters: RawSyllabusChapter[],
): LearningWorkspaceData["syllabus"] {
  return chapters
    .filter(
      (chapter) =>
        chapter.course_id === courseId && chapter.removed_at === null,
    )
    .sort(compareOrderedRows)
    .flatMap((chapter) => {
      const topics = (chapter.topics ?? [])
        .filter(
          (topic) =>
            topic.course_id === courseId &&
            topic.chapter_id === chapter.id &&
            topic.status === "published" &&
            topic.removed_at === null,
        )
        .sort(compareOrderedRows)
        .map((topic) => ({
          id: topic.id,
          slug: topic.slug,
          title: topic.title,
          orderIndex: topic.order_index ?? 0,
          chapterId: chapter.id,
        }));

      if (topics.length === 0) return [];
      return [
        {
          id: chapter.id,
          title: chapter.title,
          orderIndex: chapter.order_index ?? 0,
          topics,
        },
      ];
    });
}

function buildTopicData(
  course: RawCourse,
  syllabus: LearningWorkspaceData["syllabus"],
  topic: RawTopicAggregate,
): LearningWorkspaceDataDraft | null {
  if (
    topic.course_id !== course.id ||
    topic.status !== "published" ||
    topic.removed_at !== null ||
    !topic.chapter ||
    topic.chapter.removed_at !== null ||
    topic.chapter.course_id !== course.id ||
    topic.chapter_id !== topic.chapter.id
  ) {
    return null;
  }

  const syllabusTopic = syllabus
    .flatMap((chapter) => chapter.topics)
    .find((item) => item.id === topic.id && item.slug === topic.slug);
  if (!syllabusTopic) return null;

  const flashcards = (topic.cards ?? [])
    .filter(
      (card) => card.topic_id === topic.id && card.removed_at === null,
    )
    .sort(compareOrderedRows)
    .map((card) => ({
      id: card.id,
      front_content: card.front_content,
      back_content: card.back_content,
      audio_url: card.audio_url,
      image_url: card.image_url,
    }));

  const answers: Record<string, string> = {};
  const exercises = (topic.exercises ?? [])
    .filter(
      (exercise) =>
        exercise.topic_id === topic.id &&
        exercise.course_id === course.id &&
        exercise.removed_at === null,
    )
    .sort(compareOrderedRows)
    .map((exercise) => ({
      id: exercise.id,
      title: exercise.title,
      part_type: exercise.part_type,
      order_index: exercise.order_index ?? 0,
      groups: (exercise.groups ?? [])
        .filter(
          (group) =>
            group.exercise_id === exercise.id && group.removed_at === null,
        )
        .sort(compareOrderedRows)
        .map((group) => ({
          id: group.id,
          passage_text: group.passage_text,
          audio_url: group.audio_url,
          image_url: group.image_url,
          order_index: group.order_index ?? 0,
          questions: (group.questions ?? [])
            .filter(
              (question) =>
                question.exercise_id === exercise.id &&
                question.course_id === course.id &&
                question.removed_at === null,
            )
            .sort(compareOrderedRows)
            .map((question) => {
              const correctAnswer = (question.answers ?? []).find(
                (answer) => answer.is_correct,
              );
              if (correctAnswer) {
                answers[question.id] = correctAnswer.selected_option_id;
              }

              return {
                id: question.id,
                content: question.content,
                explanation: question.explanation,
                order_index: question.order_index ?? 0,
                options: (question.options ?? [])
                  .filter(
                    (option) =>
                      option.question_id === question.id &&
                      option.removed_at === null,
                  )
                  .sort(compareOrderedRows)
                  .map((option) => ({
                    id: option.id,
                    content: option.content,
                    label: option.label,
                    order_index: option.order_index,
                  })),
              };
            }),
        })),
    }));

  const rawProgress = (topic.progress ?? []).find(
    (progress) => progress.topic_id === topic.id,
  );

  return {
    courseSlug: course.slug,
    courseTitle: course.title,
    syllabus,
    currentTopic: syllabusTopic,
    flashcards,
    exercises,
    answers,
    progress: rawProgress
      ? {
          isFlashcardCompleted: rawProgress.is_flashcard_completed === true,
          isExerciseCompleted: rawProgress.is_exercise_completed === true,
          isTopicCompleted: rawProgress.is_topic_completed === true,
        }
      : null,
  };
}

export async function getLearningWorkspace(
  rawCourseSlug: string,
  rawTopicSlug: string,
): Promise<LearningWorkspaceResult> {
  const courseSlugResult = learningWorkspaceCourseSlugSchema.safeParse(
    rawCourseSlug,
  );
  if (!courseSlugResult.success) return { status: "not_found" };

  const topicSlugResult = learningWorkspaceTopicSlugSchema.safeParse(
    rawTopicSlug,
  );

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError && !isAuthSessionMissingError(authError)) {
      console.error("Learning workspace auth query failed", authError);
      return queryFailedResult();
    }
    if (authError || !user) return { status: "auth_required" };

    const { data: rawCourse, error: courseError } = await supabase
      .from("courses")
      .select("id, slug, title, enrollments(id, user_id)")
      .eq("slug", courseSlugResult.data)
      .eq("status", "published")
      .is("removed_at", null)
      .eq("enrollments.user_id", user.id)
      .maybeSingle();

    if (courseError) {
      console.error("Learning workspace course query failed", courseError);
      return queryFailedResult();
    }
    if (!rawCourse) return { status: "not_found" };

    const course = rawCourse as unknown as RawCourse;
    const isEnrolled = (course.enrollments ?? []).some(
      (enrollment) => enrollment.user_id === user.id,
    );
    if (!isEnrolled) {
      return parseWorkspaceResult({
        status: "unenrolled",
        course: { slug: course.slug, title: course.title },
      });
    }

    if (!topicSlugResult.success) {
      return parseWorkspaceResult({
        status: "topic_unavailable",
        course: { slug: course.slug, title: course.title },
      });
    }

    const [syllabusResult, topicResult] = await Promise.all([
      supabase
        .from("chapters")
        .select(
          `
          id, title, order_index, course_id, removed_at,
          topics (
            id, slug, title, status, order_index, chapter_id, course_id, removed_at
          )
        `,
        )
        .eq("course_id", course.id)
        .is("removed_at", null),
      supabase
        .from("topics")
        .select(
          `
          id, slug, title, status, order_index, chapter_id, course_id, removed_at,
          chapter:chapters!inner (id, course_id, removed_at),
          cards (id, topic_id, front_content, back_content, audio_url, image_url, order_index, removed_at),
          progress:user_topic_progress (
            topic_id, is_flashcard_completed, is_exercise_completed, is_topic_completed
          ),
          exercises (
            id, topic_id, course_id, title, part_type, order_index, removed_at,
            groups:question_groups (
              id, exercise_id, passage_text, audio_url, image_url, order_index, removed_at,
              questions (
                id, exercise_id, course_id, content, explanation, order_index, removed_at,
                options:question_options (
                  id, question_id, content, label, is_correct, order_index, removed_at
                ),
                answers:user_question_answers (selected_option_id, is_correct)
              )
            )
          )
        `,
        )
        .eq("slug", topicSlugResult.data)
        .eq("course_id", course.id)
        .eq("status", "published")
        .is("removed_at", null)
        .maybeSingle(),
    ]);

    if (syllabusResult.error) {
      console.error(
        "Learning workspace syllabus query failed",
        syllabusResult.error,
      );
      return queryFailedResult();
    }
    if (topicResult.error) {
      console.error("Learning workspace topic query failed", topicResult.error);
      return queryFailedResult();
    }
    if (!topicResult.data) {
      return parseWorkspaceResult({
        status: "topic_unavailable",
        course: { slug: course.slug, title: course.title },
      });
    }

    const syllabus = buildSyllabus(
      course.id,
      (syllabusResult.data ?? []) as unknown as RawSyllabusChapter[],
    );
    const data = buildTopicData(
      course,
      syllabus,
      topicResult.data as unknown as RawTopicAggregate,
    );
    if (!data) {
      return parseWorkspaceResult({
        status: "topic_unavailable",
        course: { slug: course.slug, title: course.title },
      });
    }

    return parseWorkspaceResult({ status: "success", data });
  } catch (error) {
    console.error("Learning workspace unexpected failure", error);
    return queryFailedResult();
  }
}
