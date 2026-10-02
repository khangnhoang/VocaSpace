import type { SupabaseClient } from "@supabase/supabase-js";

// D3 memory check: the single source of the "passed" predicate (plan H3/G3/G7).
// "Correct" is derived from the learner's selected option and the teacher-owned
// answer key; the stored `user_question_answers.is_correct` is never read here
// because learners can write that column through the Data API (Q7).

export const MEMORY_CHECK_REQUIRED = "MEMORY_CHECK_REQUIRED";
export const MEMORY_CHECK_REQUIRED_ERROR =
  "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.";

export type MemoryCheckOptionRow = {
  id: string;
  question_id: string;
  content: string;
  label: string | null;
  is_correct: boolean;
  order_index: number | null;
  removed_at: string | null;
};

export type MemoryCheckQuestionRow = {
  id: string;
  exercise_id: string;
  group_id: string | null;
  content: string;
  explanation: string | null;
  order_index: number | null;
  removed_at: string | null;
  options?: MemoryCheckOptionRow[] | null;
  answers?: Array<{ user_id: string; selected_option_id: string | null }> | null;
};

export type MemoryCheckRow = {
  id: string;
  topic_id: string;
  activity_stage: string;
  removed_at: string | null;
  questions?: MemoryCheckQuestionRow[] | null;
};

export type LoadedMemoryCheck = {
  id: string;
  questions: Array<{
    id: string;
    content: string;
    explanation: string | null;
    order_index: number;
    options: MemoryCheckOptionRow[];
    selectedOptionId: string | null;
  }>;
};

export function isOptionCurrentlyCorrect(
  questionId: string,
  options: Array<Pick<MemoryCheckOptionRow, "id" | "question_id" | "is_correct" | "removed_at">>,
  selectedOptionId: string | null | undefined,
) {
  return options.some(
    (option) =>
      option.id === selectedOptionId &&
      option.question_id === questionId &&
      option.removed_at === null &&
      option.is_correct,
  );
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

/** PostgREST select for a memory-check exercise row (also embedded by the learning workspace). */
export const MEMORY_CHECK_SELECT = `
  id, topic_id, activity_stage, removed_at,
  questions (
    id, exercise_id, group_id, content, explanation, order_index, removed_at,
    options:question_options (
      id, question_id, content, label, is_correct, order_index, removed_at
    ),
    answers:user_question_answers (user_id, selected_option_id)
  )
`;

/** Keeps the topic's active memory check with only active questions/options, or null. */
export function toLoadedMemoryCheck(
  rows: MemoryCheckRow[],
  userId: string,
  topicId: string,
): LoadedMemoryCheck | null {
  const row = rows.find(
    (candidate) =>
      candidate.topic_id === topicId &&
      candidate.activity_stage === "memory_check" &&
      candidate.removed_at === null,
  );
  if (!row) return null;

  const questions = (row.questions ?? [])
    .filter(
      (question) =>
        question.exercise_id === row.id &&
        question.group_id === null &&
        question.removed_at === null,
    )
    .sort(compareOrderedRows)
    .map((question) => ({
      id: question.id,
      content: question.content,
      explanation: question.explanation,
      order_index: question.order_index ?? 0,
      options: (question.options ?? [])
        .filter((option) => option.question_id === question.id && option.removed_at === null)
        .sort(compareOrderedRows),
      selectedOptionId:
        (question.answers ?? []).find((answer) => answer.user_id === userId)
          ?.selected_option_id ?? null,
    }));

  return questions.length > 0 ? { id: row.id, questions } : null;
}

export async function loadMemoryCheck(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
): Promise<LoadedMemoryCheck | null> {
  const { data, error } = await supabase
    .from("exercises")
    .select(MEMORY_CHECK_SELECT)
    .eq("topic_id", topicId)
    .eq("activity_stage", "memory_check")
    .is("removed_at", null)
    .eq("questions.answers.user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? toLoadedMemoryCheck([data as unknown as MemoryCheckRow], userId, topicId) : null;
}

export function correctlyAnsweredMemoryQuestionIds(memoryCheck: LoadedMemoryCheck) {
  return memoryCheck.questions
    .filter((question) =>
      isOptionCurrentlyCorrect(question.id, question.options, question.selectedOptionId),
    )
    .map((question) => question.id);
}

/** True when the topic has no active memory question, or every one is currently answered correctly. */
export function isMemoryCheckPassed(memoryCheck: LoadedMemoryCheck | null) {
  if (!memoryCheck) return true;
  return correctlyAnsweredMemoryQuestionIds(memoryCheck).length === memoryCheck.questions.length;
}
