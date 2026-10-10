import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Seed teacher dùng làm tác giả của cây nội dung fixture; không bị xóa hay sửa bởi test A5.
export const SEED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";

export type LearningTree = {
  courseId: string;
  chapterId: string;
  topicId: string;
  cardId: string;
  exerciseId: string;
  questionId: string;
  optionId: string;
};

async function insertOrThrow(service: SupabaseClient, table: string, value: Record<string, unknown>) {
  const { error } = await service.from(table).insert(value);
  if (error) throw new Error(`${table} fixture failed: ${error.message}`);
}

// Khóa học 1 topic published (giá 0) đủ card/exercise/question để học viên có enrollment, flashcard, progress và answer.
export async function createLearningTree(service: SupabaseClient, price = 0): Promise<LearningTree> {
  const suffix = randomUUID();
  const tree: LearningTree = {
    courseId: randomUUID(),
    chapterId: randomUUID(),
    topicId: randomUUID(),
    cardId: randomUUID(),
    exerciseId: randomUUID(),
    questionId: randomUUID(),
    optionId: randomUUID(),
  };
  await insertOrThrow(service, "courses", {
    id: tree.courseId,
    title: `A5 fixture ${suffix}`,
    slug: `a5-fixture-${suffix}`,
    price,
    status: "published",
  });
  await insertOrThrow(service, "course_collaborators", {
    course_id: tree.courseId,
    user_id: SEED_TEACHER_ID,
    role: "owner",
    added_by: SEED_TEACHER_ID,
  });
  await insertOrThrow(service, "chapters", {
    id: tree.chapterId,
    course_id: tree.courseId,
    created_by_user_id: SEED_TEACHER_ID,
    title: "A5 chapter",
    order_index: 0,
  });
  await insertOrThrow(service, "topics", {
    id: tree.topicId,
    course_id: tree.courseId,
    chapter_id: tree.chapterId,
    title: "A5 topic",
    slug: `a5-topic-${suffix}`,
    status: "published",
    first_approved_at: new Date().toISOString(),
    original_creator_user_id: SEED_TEACHER_ID,
    responsible_author_user_id: SEED_TEACHER_ID,
  });
  await insertOrThrow(service, "cards", {
    id: tree.cardId,
    topic_id: tree.topicId,
    front_content: { word: "a5" },
    back_content: { translation: "a5" },
  });
  await insertOrThrow(service, "exercises", {
    id: tree.exerciseId,
    course_id: tree.courseId,
    topic_id: tree.topicId,
    title: "A5 exercise",
    part_type: "part_5",
  });
  await insertOrThrow(service, "questions", {
    id: tree.questionId,
    course_id: tree.courseId,
    exercise_id: tree.exerciseId,
    content: "A5 question",
  });
  await insertOrThrow(service, "question_options", {
    id: tree.optionId,
    question_id: tree.questionId,
    content: "A5 option",
    label: "A",
    is_correct: true,
    order_index: 0,
  });
  return tree;
}

// Gắn đủ dữ liệu học của một học viên vào cây: enrollment, flashcard, progress, answer.
export async function seedLearnerRows(service: SupabaseClient, userId: string, tree: LearningTree) {
  await insertOrThrow(service, "enrollments", { user_id: userId, course_id: tree.courseId });
  await insertOrThrow(service, "user_flashcards", { user_id: userId, card_id: tree.cardId, last_rating: 3 });
  await insertOrThrow(service, "user_topic_progress", { user_id: userId, topic_id: tree.topicId });
  await insertOrThrow(service, "user_question_answers", {
    user_id: userId,
    question_id: tree.questionId,
    selected_option_id: tree.optionId,
    is_correct: true,
  });
}

export async function deleteLearningTree(service: SupabaseClient, tree: LearningTree) {
  await service.from("user_topic_progress").delete().eq("topic_id", tree.topicId);
  await service.from("user_question_answers").delete().eq("question_id", tree.questionId);
  await service.from("user_flashcards").delete().eq("card_id", tree.cardId);
  await service.from("enrollments").delete().eq("course_id", tree.courseId);
  await service.from("payments").delete().eq("course_id", tree.courseId);
  await service.from("question_options").delete().eq("question_id", tree.questionId);
  await service.from("questions").delete().eq("id", tree.questionId);
  await service.from("exercises").delete().eq("id", tree.exerciseId);
  await service.from("cards").delete().eq("id", tree.cardId);
  await service.from("topics").delete().eq("id", tree.topicId);
  await service.from("chapters").delete().eq("id", tree.chapterId);
  await service.from("course_collaborators").delete().eq("course_id", tree.courseId);
  await service.from("courses").delete().eq("id", tree.courseId);
}
