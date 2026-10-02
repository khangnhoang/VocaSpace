"use server";

import {
  questionAnswerInputSchema,
  type TopicProgress,
} from "@/lib/schemas/learning-workspace";
import { createClient } from "@/utils/supabase/server";
import { hasLearningEnrollment } from "@/lib/learning-enrollment";
import {
  MEMORY_CHECK_REQUIRED,
  MEMORY_CHECK_REQUIRED_ERROR,
  isMemoryCheckPassed,
  isOptionCurrentlyCorrect,
  loadMemoryCheck,
} from "@/lib/memory-check";
import { syncTopicProgress } from "@/lib/topic-progress";

const AUTH_ERROR = "Vui lòng đăng nhập";
const ANSWER_INPUT_ERROR = "Dữ liệu câu trả lời không hợp lệ.";
const QUESTION_UNAVAILABLE_ERROR = "Câu hỏi không khả dụng.";
const PROGRESS_SYNC_ERROR = "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.";

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
    activity_stage: string;
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

// Failure and success share optional keys so callers can read fields after `if (result.error)`.
type SubmitQuestionAnswerResult =
  | {
      error: string;
      errorCode?: string;
      success?: never;
      isCorrect?: never;
      explanation?: never;
      isMemoryCheckPassed?: never;
      topicProgress?: never;
      progressError?: never;
    }
  | {
      error?: never;
      errorCode?: never;
      success: true;
      isCorrect: boolean;
      explanation?: string;
      isMemoryCheckPassed?: boolean;
      topicProgress?: TopicProgress;
      progressError?: string;
    };

export async function submitQuestionAnswer(
  rawQuestionId: string,
  rawSelectedOptionId: string,
): Promise<SubmitQuestionAnswerResult> {
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
          id, topic_id, course_id, activity_stage, removed_at,
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

    if (!await hasLearningEnrollment(supabase, user.id, question.course_id)) {
      return { error: "Bạn cần ghi danh khóa học để lưu câu trả lời." };
    }

    const options = (question.options ?? []).filter(
      (option) =>
        option.question_id === question.id && option.removed_at === null,
    );
    const selectedOption = options.find(
      (option) => option.id === parsed.data.selectedOptionId,
    );
    if (!selectedOption) return { error: "Đáp án không khả dụng." };

    const isMemoryCheckQuestion = exercise.activity_stage === "memory_check";
    if (
      !isMemoryCheckQuestion &&
      !isMemoryCheckPassed(await loadMemoryCheck(supabase, user.id, exercise.topic_id))
    ) {
      return { error: MEMORY_CHECK_REQUIRED_ERROR, errorCode: MEMORY_CHECK_REQUIRED };
    }

    // D4 G3: both stages grade the selected option against the current answer key.
    const isCorrect = isOptionCurrentlyCorrect(question.id, options, selectedOption.id);
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

    // D4 H4: the answer is already saved, so follow-up reads below must not turn
    // the result into an error; unverified values stay undefined.
    let memoryCheckPassed: boolean | undefined;
    let followUpFailed = false;
    if (isMemoryCheckQuestion) {
      try {
        // Unlocks exercises in the workspace without a reload; derived after the write.
        memoryCheckPassed = isMemoryCheckPassed(
          await loadMemoryCheck(supabase, user.id, exercise.topic_id),
        );
      } catch (error) {
        console.error("Question answer memory check reload failed", error);
        followUpFailed = true;
      }
    }

    let topicProgress: TopicProgress | null = null;
    try {
      topicProgress = await syncTopicProgress(supabase, exercise.topic_id);
    } catch (error) {
      console.error("Question answer progress sync failed", error);
    }

    return {
      success: true,
      isCorrect,
      ...(isCorrect
        ? {}
        : { explanation: question.explanation || "Đáp án chưa chính xác. Bạn hãy thử lại nhé!" }),
      ...(memoryCheckPassed === undefined ? {} : { isMemoryCheckPassed: memoryCheckPassed }),
      ...(topicProgress ? { topicProgress } : {}),
      ...(followUpFailed || !topicProgress ? { progressError: PROGRESS_SYNC_ERROR } : {}),
    };
  } catch (error) {
    console.error("Question answer unexpected failure", error);
    return { error: "Không thể lưu câu trả lời lúc này." };
  }
}
