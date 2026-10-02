"use server";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { parseQuestionGroupManagedMediaReference, type QuestionGroupMediaType } from "@/lib/schemas/exercise";
import {
  learningWorkspaceCourseSlugSchema,
  learningWorkspaceResultSchema,
  learningWorkspaceTopicSlugSchema,
  type LearningWorkspaceData,
  type LearningWorkspaceResult,
} from "@/lib/schemas/learning-workspace";
import {
  MEMORY_CHECK_SELECT,
  correctlyAnsweredMemoryQuestionIds,
  isMemoryCheckPassed,
  isOptionCurrentlyCorrect,
  toLoadedMemoryCheck,
  type MemoryCheckRow,
} from "@/lib/memory-check";
import { syncTopicProgress } from "@/lib/topic-progress";
import { createClient } from "@/utils/supabase/server";

const QUERY_ERROR = "Không thể tải bài học lúc này. Vui lòng thử lại.";
const INVALID_DATA_ERROR = "Dữ liệu bài học không hợp lệ.";

function questionGroupMediaDeliveryUrl(
  type: QuestionGroupMediaType,
  groupId: string,
  value: string | null,
) {
  if (!value) return value;
  return parseQuestionGroupManagedMediaReference(
    type,
    value,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  )
    ? `/api/question-group-media/${groupId}/${type}`
    : value;
}

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
  progress?: Array<{ user_id: string; is_topic_completed: boolean | null }> | null;
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
  group_id: string | null;
  course_id: string;
  content: string;
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
  activity_stage: string;
  part_type: string | null;
  order_index: number | null;
  removed_at: string | null;
  questions?: RawQuestion[] | null;
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
  memory_checks?: MemoryCheckRow[] | null;
  progress?: RawProgress[] | null;
};

type LearningWorkspaceDataDraft = Omit<
  LearningWorkspaceData,
  "flashcards" | "exercises" | "memoryCheck"
> & {
  flashcards: unknown[];
  exercises: unknown[];
  memoryCheck: unknown;
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
  userId: string,
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
          isCompleted: (topic.progress ?? []).some(
            (progress) =>
              progress.user_id === userId && progress.is_topic_completed === true,
          ),
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
  userId: string,
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
  // D4 G3: a question counts as done only when its selected option is currently correct.
  const toQuestionDto = (question: RawQuestion) => {
    const selectedOptionId = question.answers?.[0]?.selected_option_id;
    if (
      selectedOptionId &&
      isOptionCurrentlyCorrect(question.id, question.options ?? [], selectedOptionId)
    ) {
      answers[question.id] = selectedOptionId;
    }

    // No `explanation`: it can reveal the answer, so learners only get it from
    // `submitQuestionAnswer` after grading.
    return {
      id: question.id,
      content: question.content,
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
  };
  const isActiveQuestion = (
    question: RawQuestion,
    exerciseId: string,
    groupId: string | null,
  ) =>
    question.exercise_id === exerciseId &&
    question.group_id === groupId &&
    question.course_id === course.id &&
    question.removed_at === null;

  const exercises = (topic.exercises ?? [])
    .filter(
      (exercise) =>
        exercise.topic_id === topic.id &&
        exercise.course_id === course.id &&
        exercise.activity_stage === "exercise" &&
        exercise.removed_at === null,
    )
    .sort(compareOrderedRows)
    .map((exercise) => ({
      id: exercise.id,
      title: exercise.title,
      part_type: exercise.part_type,
      order_index: exercise.order_index ?? 0,
      questions: (exercise.questions ?? [])
        .filter((question) => isActiveQuestion(question, exercise.id, null))
        .sort(compareOrderedRows)
        .map(toQuestionDto),
      groups: (exercise.groups ?? [])
        .filter(
          (group) =>
            group.exercise_id === exercise.id && group.removed_at === null,
        )
        .sort(compareOrderedRows)
        .map((group) => ({
          id: group.id,
          passage_text: group.passage_text,
          audio_url: questionGroupMediaDeliveryUrl("audio", group.id, group.audio_url),
          image_url: questionGroupMediaDeliveryUrl("image", group.id, group.image_url),
          order_index: group.order_index ?? 0,
          questions: (group.questions ?? [])
            .filter((question) => isActiveQuestion(question, exercise.id, group.id))
            .sort(compareOrderedRows)
            .map(toQuestionDto),
        })),
    }));

  // Memory answers count as done only by the H3 predicate, never by stored is_correct.
  const memoryCheck = toLoadedMemoryCheck(topic.memory_checks ?? [], userId, topic.id);
  const memoryAnswers = memoryCheck
    ? new Set(correctlyAnsweredMemoryQuestionIds(memoryCheck))
    : new Set<string>();
  for (const question of memoryCheck?.questions ?? []) {
    if (memoryAnswers.has(question.id) && question.selectedOptionId) {
      answers[question.id] = question.selectedOptionId;
    }
  }

  const rawProgress = (topic.progress ?? []).find(
    (progress) => progress.topic_id === topic.id,
  );

  return {
    courseSlug: course.slug,
    courseTitle: course.title,
    syllabus,
    currentTopic: {
      id: syllabusTopic.id,
      slug: syllabusTopic.slug,
      title: syllabusTopic.title,
      orderIndex: syllabusTopic.orderIndex,
      chapterId: syllabusTopic.chapterId,
    },
    flashcards,
    exercises,
    memoryCheck: memoryCheck
      ? {
          id: memoryCheck.id,
          questions: memoryCheck.questions.map((question) => ({
            id: question.id,
            content: question.content,
            order_index: question.order_index,
            options: question.options.map((option) => ({
              id: option.id,
              content: option.content,
              label: option.label,
              order_index: option.order_index,
            })),
          })),
        }
      : null,
    isMemoryCheckPassed: isMemoryCheckPassed(memoryCheck),
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
            id, slug, title, status, order_index, chapter_id, course_id, removed_at,
            progress:user_topic_progress (user_id, is_topic_completed)
          )
        `,
        )
        .eq("course_id", course.id)
        .is("removed_at", null)
        .eq("topics.progress.user_id", user.id),
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
            id, topic_id, course_id, title, activity_stage, part_type, order_index, removed_at,
            questions (
              id, exercise_id, group_id, course_id, content, order_index, removed_at,
              options:question_options (
                id, question_id, content, label, is_correct, order_index, removed_at
              ),
              answers:user_question_answers (selected_option_id)
            ),
            groups:question_groups (
              id, exercise_id, passage_text, audio_url, image_url, order_index, removed_at,
              questions (
                id, exercise_id, group_id, course_id, content, order_index, removed_at,
                options:question_options (
                  id, question_id, content, label, is_correct, order_index, removed_at
                ),
                answers:user_question_answers (selected_option_id)
              )
            )
          ),
          memory_checks:exercises (${MEMORY_CHECK_SELECT})
        `,
        )
        .eq("memory_checks.activity_stage", "memory_check")
        .is("memory_checks.removed_at", null)
        .eq("memory_checks.questions.answers.user_id", user.id)
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
      user.id,
    );
    const data = buildTopicData(
      course,
      syllabus,
      topicResult.data as unknown as RawTopicAggregate,
      user.id,
    );
    if (!data) {
      return parseWorkspaceResult({
        status: "topic_unavailable",
        course: { slug: course.slug, title: course.title },
      });
    }

    // D4 H5: a learner who became eligible without a new write (e.g. a teacher
    // removed the last missing question) is recorded when opening the topic.
    // A sync failure must not break the page; the stored progress is kept.
    if (!data.progress?.isTopicCompleted) {
      const synced = await syncTopicProgress(supabase, data.currentTopic.id);
      if (synced) {
        data.progress = {
          isFlashcardCompleted: synced.isFlashcardCompleted,
          isExerciseCompleted: synced.isExerciseCompleted,
          isTopicCompleted: synced.isTopicCompleted,
        };
      }
    }

    return parseWorkspaceResult({ status: "success", data });
  } catch (error) {
    console.error("Learning workspace unexpected failure", error);
    return queryFailedResult();
  }
}
