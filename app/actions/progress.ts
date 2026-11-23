"use server";

import { recordedTranslations } from "@/lib/i18n/message-ref";
import type { Translate } from "@/lib/i18n/translate";
import {
  questionAnswerInputSchema,
  questionAnswerRpcResultSchema,
  topicProgressRpcResultSchema,
  type TopicProgress,
} from "@/lib/schemas/learning-workspace";
import { createClient } from "@/utils/supabase/server";
import { MEMORY_CHECK_REQUIRED, CARDS_REQUIRED } from "@/lib/memory-check";
import { createActionTimer, type ActionTimer } from "@/lib/learning-action-timing";

// Mỗi trường kết quả có bộ dịch ghi nhận riêng (U3 H4): `error`, `explanation` (lời nhắc mặc định của câu sai) và `progressError` có
// thể cùng nằm trong một kết quả thành công của wrapper, nên thông báo này không được ghi đè lên thông báo kia. Giải thích do tác giả
// viết không đi qua bộ dịch nào nên không có bản ghi và luôn hiện đúng như đã viết.
type AnswerTranslators = { error: Translate; explanation: Translate; progress: Translate };

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
  const translators = {
    error: await recordedTranslations("learn", "error"),
    explanation: await recordedTranslations("learn", "explanation"),
    progress: await recordedTranslations("learn", "progressError"),
  };
  try {
    return await answerQuestion(rawQuestionId, rawSelectedOptionId, timer, translators);
  } finally {
    timer.end();
  }
}

async function answerQuestion(
  rawQuestionId: string,
  rawSelectedOptionId: string,
  timer: ActionTimer,
  { error: t, explanation: tExplanation, progress: tProgress }: AnswerTranslators,
): Promise<SubmitQuestionAnswerResult> {
  const parsed = questionAnswerInputSchema.safeParse({
    questionId: rawQuestionId,
    selectedOptionId: rawSelectedOptionId,
  });
  if (!parsed.success) return { error: t("actions.progress.invalidInput") };

  const supabase = await timer.step("createClient", () => createClient());
  const {
    data: { user },
    error: authError,
  } = await timer.step("auth.getUser", () => supabase.auth.getUser());
  if (authError || !user) return { error: t("actions.progress.authRequired") };

  try {
    // LF2: một RPC kiểm tra theo thứ tự unavailable -> enrollment -> option -> memory gate, ghi đáp án bằng chính
    // các điều kiện của policy và đồng bộ D4 trong cùng transaction. Actor luôn là auth.uid() phía database.
    const { data, error: rpcError } = await timer.step("rpc", () => supabase.rpc("lf2_submit_question_answer", {
      p_question_id: parsed.data.questionId,
      p_selected_option_id: parsed.data.selectedOptionId,
    }));
    if (rpcError) {
      console.error("Question answer RPC failed", rpcError);
      return { error: t("actions.progress.saveFailed") };
    }

    const result = questionAnswerRpcResultSchema.safeParse(data);
    if (!result.success) {
      console.error("Question answer RPC returned invalid data", result.error.issues);
      return { error: t("actions.progress.saveFailed") };
    }

    const outcome = result.data;
    switch (outcome.status) {
      case "auth_required":
        return { error: t("actions.progress.authRequired") };
      case "unavailable":
        return { error: t("actions.progress.questionUnavailable") };
      case "not_enrolled":
        return { error: t("actions.progress.enrollRequired") };
      case "option_unavailable":
        return { error: t("actions.progress.optionUnavailable") };
      case "memory_locked":
        return { error: t("actions.progress.memoryRequired"), errorCode: MEMORY_CHECK_REQUIRED };
      case "cards_locked":
        return { error: t("actions.progress.cardsRequired"), errorCode: CARDS_REQUIRED };
      case "save_failed":
        return { error: t("actions.progress.saveFailed") };
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
        : { explanation: outcome.explanation || tExplanation("actions.progress.defaultExplanation") }),
      // AC3a: trạng thái memory đến từ sync trong RPC (hoặc suy ra từ cùng định nghĩa khi sync hỏng); null thì bỏ qua.
      ...(outcome.is_memory_check && outcome.memory_check_passed !== null
        ? { isMemoryCheckPassed: outcome.memory_check_passed }
        : {}),
      ...(progress.success ? { topicProgress: progress.data } : { progressError: tProgress("actions.progress.progressSync") }),
    };
  } catch (error) {
    console.error("Question answer unexpected failure", error);
    return { error: t("actions.progress.saveFailed") };
  }
}
