"use server";

import {
  questionAnswerInputSchema,
  questionAnswerRpcResultSchema,
  topicProgressRpcResultSchema,
  type TopicProgress,
} from "@/lib/schemas/learning-workspace";
import { createClient } from "@/utils/supabase/server";
import {
  MEMORY_CHECK_REQUIRED,
  MEMORY_CHECK_REQUIRED_ERROR,
} from "@/lib/memory-check";
import { createActionTimer, type ActionTimer } from "@/lib/learning-action-timing";

const AUTH_ERROR = "Vui lòng đăng nhập";
const ANSWER_INPUT_ERROR = "Dữ liệu câu trả lời không hợp lệ.";
const QUESTION_UNAVAILABLE_ERROR = "Câu hỏi không khả dụng.";
const SAVE_ERROR = "Không thể lưu câu trả lời lúc này.";
const PROGRESS_SYNC_ERROR = "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.";

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
  // LF2: đo thời gian server khi LEARNING_ACTION_TIMING=1; mặc định tắt, không đổi hành vi action.
  const timer = createActionTimer("submitQuestionAnswer");
  try {
    return await answerQuestion(rawQuestionId, rawSelectedOptionId, timer);
  } finally {
    timer.end();
  }
}

async function answerQuestion(
  rawQuestionId: string,
  rawSelectedOptionId: string,
  timer: ActionTimer,
): Promise<SubmitQuestionAnswerResult> {
  const parsed = questionAnswerInputSchema.safeParse({
    questionId: rawQuestionId,
    selectedOptionId: rawSelectedOptionId,
  });
  if (!parsed.success) return { error: ANSWER_INPUT_ERROR };

  const supabase = await timer.step("createClient", () => createClient());
  const {
    data: { user },
    error: authError,
  } = await timer.step("auth.getUser", () => supabase.auth.getUser());
  if (authError || !user) return { error: AUTH_ERROR };

  try {
    // LF2: một RPC kiểm tra theo thứ tự unavailable -> enrollment -> option -> memory gate, ghi đáp án bằng chính
    // các điều kiện của policy và đồng bộ D4 trong cùng transaction. Actor luôn là auth.uid() phía database.
    const { data, error: rpcError } = await timer.step("rpc", () => supabase.rpc("lf2_submit_question_answer", {
      p_question_id: parsed.data.questionId,
      p_selected_option_id: parsed.data.selectedOptionId,
    }));
    if (rpcError) {
      console.error("Question answer RPC failed", rpcError);
      return { error: SAVE_ERROR };
    }

    const result = questionAnswerRpcResultSchema.safeParse(data);
    if (!result.success) {
      console.error("Question answer RPC returned invalid data", result.error.issues);
      return { error: SAVE_ERROR };
    }

    const outcome = result.data;
    switch (outcome.status) {
      case "auth_required":
        return { error: AUTH_ERROR };
      case "unavailable":
        return { error: QUESTION_UNAVAILABLE_ERROR };
      case "not_enrolled":
        return { error: "Bạn cần ghi danh khóa học để lưu câu trả lời." };
      case "option_unavailable":
        return { error: "Đáp án không khả dụng." };
      case "memory_locked":
        return { error: MEMORY_CHECK_REQUIRED_ERROR, errorCode: MEMORY_CHECK_REQUIRED };
      case "save_failed":
        return { error: SAVE_ERROR };
    }

    timer.label(outcome.is_memory_check ? "question-answer:memory_check" : "question-answer:exercise");

    // D4 H4: the answer is already saved, so progress that is missing or malformed must not turn the result
    // into an error; unverified values stay undefined and `progressError` marks the missing progress.
    const progress = topicProgressRpcResultSchema.safeParse(outcome.progress);
    if (!progress.success && outcome.progress != null) {
      console.error("Question answer progress is invalid", progress.error.issues);
    }

    return {
      success: true,
      isCorrect: outcome.is_correct,
      // LF1: câu đúng chỉ trả lời giải thích khi tác giả có viết; câu sai giữ nguyên lời nhắc mặc định.
      ...(outcome.is_correct
        ? outcome.explanation
          ? { explanation: outcome.explanation }
          : {}
        : { explanation: outcome.explanation || "Đáp án chưa chính xác. Bạn hãy thử lại nhé!" }),
      // AC3a: trạng thái memory đến từ sync trong RPC (hoặc suy ra từ cùng định nghĩa khi sync hỏng); null thì bỏ qua.
      ...(outcome.is_memory_check && outcome.memory_check_passed !== null
        ? { isMemoryCheckPassed: outcome.memory_check_passed }
        : {}),
      ...(progress.success ? { topicProgress: progress.data } : { progressError: PROGRESS_SYNC_ERROR }),
    };
  } catch (error) {
    console.error("Question answer unexpected failure", error);
    return { error: SAVE_ERROR };
  }
}
