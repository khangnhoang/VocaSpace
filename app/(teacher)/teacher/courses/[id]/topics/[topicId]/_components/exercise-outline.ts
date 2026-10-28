import {
  getToeicPartRule,
  validateQuestionGroupToeicContext,
  type FullExercise,
  type FullExerciseGroup,
  type FullExerciseQuestion,
} from "@/lib/schemas/exercise";
import { getOptionProblem } from "./authoring-options";

export const TOEIC_PART_LABELS: Record<string, { short: string; title: string; needs: string }> = {
  part1: {
    short: "Part 1",
    title: "Part 1 · Photographs (Listening)",
    needs: "Mỗi nhóm cần 1 hình ảnh và 1 audio.",
  },
  part2: {
    short: "Part 2",
    title: "Part 2 · Question-Response (Listening)",
    needs: "Mỗi nhóm cần 1 audio.",
  },
  part3: {
    short: "Part 3",
    title: "Part 3 · Conversations (Listening)",
    needs: "Mỗi nhóm cần 1 audio; hình ảnh tùy chọn.",
  },
  part4: {
    short: "Part 4",
    title: "Part 4 · Talks (Listening)",
    needs: "Mỗi nhóm cần 1 audio; hình ảnh tùy chọn.",
  },
  part5: {
    short: "Part 5",
    title: "Part 5 · Incomplete Sentences (Reading)",
    needs: "Câu hỏi độc lập, không cần ngữ liệu.",
  },
  part6: {
    short: "Part 6",
    title: "Part 6 · Text Completion (Reading)",
    needs: "Mỗi nhóm cần 1 đoạn văn.",
  },
  part7: {
    short: "Part 7",
    title: "Part 7 · Reading Comprehension (Reading)",
    needs: "Mỗi nhóm cần 1 đoạn văn; hình ảnh tùy chọn.",
  },
};

// Câu standalone (Part 5) nằm ở mảng `questions` gốc; dữ liệu đọc từ server có đủ ID.
export function getStandaloneQuestions(exercise: FullExercise) {
  return (exercise.questions ?? []) as unknown as FullExerciseQuestion[];
}

// Cùng các điều kiện mà readiness của dashboard dùng (TOEIC rule, ≥ 2 đáp án, 1 đáp án đúng),
// tính lại ở client chỉ để đánh dấu trong outline; không thêm rule mới.
export function getExerciseProblem(exercise: FullExercise) {
  const rule = getToeicPartRule(exercise.part_type);
  if (rule?.mode === "standalone") {
    return getStandaloneQuestions(exercise).length === 0 ? "Cần ít nhất 1 câu hỏi độc lập" : null;
  }
  return (exercise.groups?.length ?? 0) === 0 ? "Cần ít nhất 1 nhóm câu hỏi" : null;
}

export function getGroupProblem(exercise: FullExercise, group: FullExerciseGroup) {
  const context = validateQuestionGroupToeicContext(exercise.part_type, group);
  if (!context.success) return "Thiếu ngữ liệu bắt buộc";
  return (group.questions?.length ?? 0) === 0 ? "Nhóm chưa có câu hỏi" : null;
}

export function getQuestionProblem(question: FullExerciseQuestion) {
  if (!question.content?.trim()) return "Thiếu nội dung câu hỏi";
  return getOptionProblem(question.options ?? []);
}

export type ExerciseNode =
  | { kind: "exercise"; exerciseId: string }
  | { kind: "group"; exerciseId: string; groupId: string }
  | { kind: "question"; exerciseId: string; groupId: string | null; questionId: string };

export function nodeKey(node: ExerciseNode) {
  if (node.kind === "exercise") return `exercise:${node.exerciseId}`;
  if (node.kind === "group") return `group:${node.groupId}`;
  return `question:${node.questionId}`;
}

export function resolveNode(exercises: FullExercise[], node: ExerciseNode) {
  const exercise = exercises.find((item) => item.id === node.exerciseId);
  if (!exercise) return null;
  if (node.kind === "exercise") return { exercise, group: null, question: null, index: 0 };
  if (node.kind === "group") {
    const index = exercise.groups?.findIndex((group) => group.id === node.groupId) ?? -1;
    if (index < 0) return null;
    return { exercise, group: exercise.groups[index], question: null, index };
  }
  if (node.groupId) {
    const group = exercise.groups?.find((item) => item.id === node.groupId);
    const index = group?.questions?.findIndex((question) => question.id === node.questionId) ?? -1;
    if (!group || index < 0) return null;
    return { exercise, group, question: group.questions[index], index };
  }
  const standalone = getStandaloneQuestions(exercise);
  const index = standalone.findIndex((question) => question.id === node.questionId);
  if (index < 0) return null;
  return { exercise, group: null, question: standalone[index], index };
}
