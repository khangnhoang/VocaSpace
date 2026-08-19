"use server";

import {
  questionAnswerInputSchema,
  stageProgressInputSchema,
} from "@/lib/schemas/learning-workspace";
import { createClient } from "@/utils/supabase/server";

const AUTH_ERROR = "Vui lòng đăng nhập";
const PROGRESS_INPUT_ERROR = "Dữ liệu tiến độ không hợp lệ.";
const ANSWER_INPUT_ERROR = "Dữ liệu câu trả lời không hợp lệ.";
const TOPIC_UNAVAILABLE_ERROR = "Bài học không khả dụng.";
const QUESTION_UNAVAILABLE_ERROR = "Câu hỏi không khả dụng.";

type RawTopicProgress = {
  topic_id: string;
  is_flashcard_completed: boolean | null;
  is_exercise_completed: boolean | null;
  is_topic_completed: boolean | null;
};

type RawProgressTopic = {
  id: string;
  course_id: string;
  status: string | null;
  removed_at: string | null;
  chapter?: {
    id: string;
    course_id: string;
    removed_at: string | null;
  } | null;
  progress?: RawTopicProgress[] | null;
};

type RawQuestionOption = {
  id: string;
  question_id: string;
  is_correct: boolean;
  removed_at: string | null;
};

type RawQuestion = {
  id: string;
  exercise_id: string;
  course_id: string;
  explanation: string | null;
  removed_at: string | null;
  options?: RawQuestionOption[] | null;
  exercise?: {
    id: string;
    topic_id: string;
    course_id: string;
    removed_at: string | null;
    topic?: {
      id: string;
      chapter_id: string | null;
      course_id: string;
      status: string | null;
      removed_at: string | null;
      chapter?: {
        id: string;
        course_id: string;
        removed_at: string | null;
      } | null;
    } | null;
  } | null;
};

export async function getTopicLearningHistory(topicId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { answers: {}, progress: null };

  const { data: answers } = await supabase
    .from("user_question_answers")
    .select("question_id, selected_option_id, is_correct")
    .eq("user_id", user.id);

  const { data: progress } = await supabase
    .from("user_topic_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("topic_id", topicId)
    .maybeSingle();

  const answerMap: Record<string, string> = {};
  answers?.forEach((answer) => {
    if (answer.is_correct) {
      answerMap[answer.question_id] = answer.selected_option_id;
    }
  });

  return { answers: answerMap, progress };
}

export async function updateStageProgress(
  rawTopicId: string,
  rawStage: "flashcard" | "exercise",
) {
  const parsed = stageProgressInputSchema.safeParse({
    topicId: rawTopicId,
    stage: rawStage,
  });
  if (!parsed.success) return { error: PROGRESS_INPUT_ERROR };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: AUTH_ERROR };

  try {
    const { data: rawTopic, error: topicError } = await supabase
      .from("topics")
      .select(
        `
        id, course_id, status, removed_at,
        chapter:chapters!inner (id, course_id, removed_at),
        progress:user_topic_progress (
          topic_id, is_flashcard_completed, is_exercise_completed, is_topic_completed
        )
      `,
      )
      .eq("id", parsed.data.topicId)
      .eq("status", "published")
      .is("removed_at", null)
      .maybeSingle();

    if (topicError) {
      console.error("Stage progress topic query failed", topicError);
      return { error: "Không thể kiểm tra bài học lúc này." };
    }
    if (!rawTopic) return { error: TOPIC_UNAVAILABLE_ERROR };

    const topic = rawTopic as unknown as RawProgressTopic;
    if (
      topic.status !== "published" ||
      topic.removed_at !== null ||
      !topic.chapter ||
      topic.chapter.removed_at !== null ||
      topic.chapter.course_id !== topic.course_id
    ) {
      return { error: TOPIC_UNAVAILABLE_ERROR };
    }

    const current = (topic.progress ?? []).find(
      (progress) => progress.topic_id === topic.id,
    );
    const isFlashcardCompleted =
      parsed.data.stage === "flashcard"
        ? true
        : current?.is_flashcard_completed === true;
    const isExerciseCompleted =
      parsed.data.stage === "exercise"
        ? true
        : current?.is_exercise_completed === true;
    const isTopicCompleted = isFlashcardCompleted && isExerciseCompleted;
    const now = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from("user_topic_progress")
      .upsert(
        {
          user_id: user.id,
          topic_id: topic.id,
          is_flashcard_completed: isFlashcardCompleted,
          is_exercise_completed: isExerciseCompleted,
          is_topic_completed: isTopicCompleted,
          completed_at: isTopicCompleted ? now : null,
          updated_at: now,
        },
        { onConflict: "user_id,topic_id" },
      )
      .select("id")
      .single();

    if (upsertError) {
      console.error("Stage progress upsert failed", upsertError);
      return { error: "Không thể lưu tiến độ bài học lúc này." };
    }

    return { success: true };
  } catch (error) {
    console.error("Stage progress unexpected failure", error);
    return { error: "Không thể lưu tiến độ bài học lúc này." };
  }
}

export async function submitQuestionAnswer(
  rawQuestionId: string,
  rawSelectedOptionId: string,
) {
  const parsed = questionAnswerInputSchema.safeParse({
    questionId: rawQuestionId,
    selectedOptionId: rawSelectedOptionId,
  });
  if (!parsed.success) return { error: ANSWER_INPUT_ERROR };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: AUTH_ERROR };

  try {
    const { data: rawQuestion, error: questionError } = await supabase
      .from("questions")
      .select(
        `
        id, exercise_id, course_id, explanation, removed_at,
        options:question_options (id, question_id, is_correct, removed_at),
        exercise:exercises!inner (
          id, topic_id, course_id, removed_at,
          topic:topics!inner (
            id, chapter_id, course_id, status, removed_at,
            chapter:chapters!inner (id, course_id, removed_at)
          )
        )
      `,
      )
      .eq("id", parsed.data.questionId)
      .is("removed_at", null)
      .maybeSingle();

    if (questionError) {
      console.error("Question answer context query failed", questionError);
      return { error: "Không thể kiểm tra câu hỏi lúc này." };
    }
    if (!rawQuestion) return { error: QUESTION_UNAVAILABLE_ERROR };

    const question = rawQuestion as unknown as RawQuestion;
    const exercise = question.exercise;
    const topic = exercise?.topic;
    const chapter = topic?.chapter;
    const hasTrustedParentChain =
      question.removed_at === null &&
      exercise?.id === question.exercise_id &&
      exercise.removed_at === null &&
      exercise.course_id === question.course_id &&
      topic?.id === exercise.topic_id &&
      topic.status === "published" &&
      topic.removed_at === null &&
      topic.course_id === question.course_id &&
      chapter?.id === topic.chapter_id &&
      chapter.removed_at === null &&
      chapter.course_id === question.course_id;
    if (!hasTrustedParentChain) return { error: QUESTION_UNAVAILABLE_ERROR };

    const options = (question.options ?? []).filter(
      (option) =>
        option.question_id === question.id && option.removed_at === null,
    );
    const selectedOption = options.find(
      (option) => option.id === parsed.data.selectedOptionId,
    );
    if (!selectedOption) return { error: "Đáp án không khả dụng." };

    const correctOption = options.find((option) => option.is_correct);
    const isCorrect = correctOption?.id === selectedOption.id;
    const { error: upsertError } = await supabase
      .from("user_question_answers")
      .upsert(
        {
          user_id: user.id,
          question_id: question.id,
          selected_option_id: selectedOption.id,
          is_correct: isCorrect,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,question_id" },
      )
      .select("id")
      .single();

    if (upsertError) {
      console.error("Question answer upsert failed", upsertError);
      return { error: "Không thể lưu câu trả lời lúc này." };
    }

    if (!isCorrect) {
      return {
        success: true,
        isCorrect: false,
        explanation:
          question.explanation ||
          "Đáp án chưa chính xác. Bạn hãy thử lại nhé!",
      };
    }

    return { success: true, isCorrect: true };
  } catch (error) {
    console.error("Question answer unexpected failure", error);
    return { error: "Không thể lưu câu trả lời lúc này." };
  }
}
