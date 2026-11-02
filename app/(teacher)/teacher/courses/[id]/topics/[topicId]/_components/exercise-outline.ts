import {
  getToeicPartRule,
  validateQuestionGroupToeicContext,
  type FullExercise,
  type FullExerciseGroup,
  type FullExerciseQuestion,
} from "@/lib/schemas/exercise";
import { getOptionProblem } from "./authoring-options";
import { matchesSearch } from "./authoring-search";

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

export function getPartLabel(exercise: FullExercise) {
  return TOEIC_PART_LABELS[exercise.part_type]?.short ?? exercise.part_type;
}

// Dòng tóm tắt khi bài tập đang thu gọn, ví dụ "Part 7 · 1 nhóm · 2 câu".
export function getExerciseSummary(exercise: FullExercise) {
  const groups = exercise.groups ?? [];
  const questionCount =
    getStandaloneQuestions(exercise).length +
    groups.reduce((total, group) => total + (group.questions?.length ?? 0), 0);
  return [getPartLabel(exercise), groups.length > 0 ? `${groups.length} nhóm` : null, `${questionCount} câu`]
    .filter(Boolean)
    .join(" · ");
}

// Thu gọn không được giấu vấn đề của nhóm và câu bên trong, nên đếm để hiện ngay trên dòng bài tập.
export function countNestedProblems(exercise: FullExercise) {
  const groups = exercise.groups ?? [];
  const questions = [...getStandaloneQuestions(exercise), ...groups.flatMap((group) => group.questions ?? [])];
  return (
    groups.filter((group) => getGroupProblem(exercise, group)).length +
    questions.filter((question) => getQuestionProblem(question)).length
  );
}

// Tên bài tập khớp thì hiện cả bài; nhóm khớp ngữ liệu thì hiện cả nhóm; còn lại chỉ giữ câu khớp.
// Luôn trả kèm vị trí gốc để "Nhóm 2", "Câu 3" không đổi số khi đang lọc. `query` rỗng là hiện tất cả.
export function filterExerciseOutline(exercise: FullExercise, query: string) {
  const showExercise = matchesSearch(query, [exercise.title, getPartLabel(exercise)]);
  const withIndex = <T,>(items: T[]) => items.map((item, index) => ({ item, index }));
  const keepQuestions = (questions: FullExerciseQuestion[], showAll: boolean) =>
    withIndex(questions).filter(({ item }) => showAll || matchesSearch(query, [item.content]));

  const groups = withIndex(exercise.groups ?? [])
    .map(({ item: group, index }) => {
      const showGroup = showExercise || matchesSearch(query, [group.passage_text]);
      return { group, index, showGroup, questions: keepQuestions(group.questions ?? [], showGroup) };
    })
    .filter(({ showGroup, questions }) => showGroup || questions.length > 0);
  const standalone = keepQuestions(getStandaloneQuestions(exercise), showExercise);

  return { isVisible: showExercise || groups.length > 0 || standalone.length > 0, groups, standalone };
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
