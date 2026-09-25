import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: chứng minh Q7 learner-state write cần enrollment của course suy từ target.
// - Loại test: real local Supabase Data API/RLS integration.
// - Đối tượng: INSERT/UPDATE/upsert của ba learner tables và private enrollment helper.
// - Case thành công: enrolled actor ghi được cả khi topic draft bị content RLS ẩn.
// - Case thất bại: previewer-only, other-user ID, target swap, conflict-update sau revoke.
// - Bảo mật/phân quyền: old/new UPDATE target đều cần enrollment; helper không public RPC.
// - Ổn định/resilience: historical self SELECT còn hoạt động sau unenroll.
// - Invariant cần giữ: topic/question/card target -> course_id -> enrollment(user_id, course_id).
// - Kết quả verify gần nhất: 3/3 passed bằng `npm.cmd run test:integration -- __tests__/integration/q7-learning-enrollment.test.ts`.
// - Ghi chú: chỉ local URL và ALLOW_DB_INTEGRATION_TESTS=true.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const service = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let student: SupabaseClient;

type Tree = {
  courseId: string;
  chapterId: string;
  topicId: string;
  cardId: string;
  exerciseId: string;
  questionId: string;
  optionId: string;
};
const trees: Tree[] = [];

function assertLocal() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Q7 integration requires ALLOW_DB_INTEGRATION_TESTS=true");
  }
  const url = new globalThis.URL(URL);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error(`Q7 integration refuses non-local Supabase URL: ${URL}`);
  }
}

async function insertOrThrow(table: string, value: Record<string, unknown>) {
  const { error } = await service.from(table).insert(value);
  if (error) throw new Error(`${table} fixture failed: ${error.message}`);
}

async function createTree(status: "draft" | "published"): Promise<Tree> {
  const suffix = randomUUID();
  const tree: Tree = {
    courseId: randomUUID(),
    chapterId: randomUUID(),
    topicId: randomUUID(),
    cardId: randomUUID(),
    exerciseId: randomUUID(),
    questionId: randomUUID(),
    optionId: randomUUID(),
  };
  await insertOrThrow("courses", {
    id: tree.courseId,
    title: `Q7 Enrollment ${suffix}`,
    slug: `q7-enrollment-${suffix}`,
    price: 0,
    status,
  });
  trees.push(tree);
  await insertOrThrow("course_collaborators", {
    course_id: tree.courseId,
    user_id: TEACHER_ID,
    role: "owner",
    added_by: TEACHER_ID,
  });
  await insertOrThrow("chapters", {
    id: tree.chapterId,
    course_id: tree.courseId,
    created_by_user_id: TEACHER_ID,
    title: "Q7 chapter",
    order_index: 0,
  });
  await insertOrThrow("topics", {
    id: tree.topicId,
    course_id: tree.courseId,
    chapter_id: tree.chapterId,
    title: "Q7 topic",
    slug: `q7-topic-${suffix}`,
    status,
    first_approved_at: status === "published" ? new Date().toISOString() : null,
    original_creator_user_id: TEACHER_ID,
    responsible_author_user_id: TEACHER_ID,
  });
  await insertOrThrow("cards", {
    id: tree.cardId,
    topic_id: tree.topicId,
    front_content: { word: "private" },
    back_content: { translation: "riêng tư" },
  });
  await insertOrThrow("exercises", {
    id: tree.exerciseId,
    course_id: tree.courseId,
    topic_id: tree.topicId,
    title: "Q7 exercise",
    part_type: "part_5",
  });
  await insertOrThrow("questions", {
    id: tree.questionId,
    course_id: tree.courseId,
    exercise_id: tree.exerciseId,
    content: "Q7 question",
  });
  await insertOrThrow("question_options", {
    id: tree.optionId,
    question_id: tree.questionId,
    content: "Q7 option",
    label: "A",
    is_correct: true,
    order_index: 0,
  });
  return tree;
}

async function enroll(courseId: string) {
  await insertOrThrow("enrollments", { course_id: courseId, user_id: STUDENT_ID });
}

async function cleanup() {
  for (const tree of trees.splice(0)) {
    await service.from("user_topic_progress").delete().eq("topic_id", tree.topicId);
    await service.from("user_question_answers").delete().eq("question_id", tree.questionId);
    await service.from("user_flashcards").delete().eq("card_id", tree.cardId);
    await service.from("enrollments").delete().eq("course_id", tree.courseId);
    await service.from("question_options").delete().eq("question_id", tree.questionId);
    await service.from("questions").delete().eq("id", tree.questionId);
    await service.from("exercises").delete().eq("id", tree.exerciseId);
    await service.from("cards").delete().eq("id", tree.cardId);
    await service.from("topics").delete().eq("id", tree.topicId);
    await service.from("chapters").delete().eq("id", tree.chapterId);
    await service.from("course_collaborators").delete().eq("course_id", tree.courseId);
    await service.from("courses").delete().eq("id", tree.courseId);
  }
}

describe.sequential("Q7 learning enrollment RLS", () => {
  beforeAll(async () => {
    assertLocal();
    student = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await student.auth.signInWithPassword({
      email: "student@gmail.com",
      password: "123123",
    });
    if (error) throw error;
  });
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await student?.auth.signOut();
  });

  it("denies previewer-only writes and permits enrolled writes despite hidden draft content", async () => {
    const enrolled = await createTree("draft");
    const preview = await createTree("published");
    await enroll(enrolled.courseId);
    await insertOrThrow("course_collaborators", {
      course_id: preview.courseId,
      user_id: STUDENT_ID,
      role: "previewer",
      added_by: TEACHER_ID,
    });

    expect((await student.from("topics").select("id").eq("id", enrolled.topicId)).data)
      .toEqual([]);
    expect((await student.from("topics").select("id").eq("id", preview.topicId)).data)
      .toEqual([{ id: preview.topicId }]);

    expect((await student.from("user_topic_progress").insert({
      user_id: STUDENT_ID, topic_id: preview.topicId,
    })).error).not.toBeNull();
    expect((await student.from("user_question_answers").insert({
      user_id: STUDENT_ID, question_id: preview.questionId,
      selected_option_id: preview.optionId, is_correct: true,
    })).error).not.toBeNull();
    expect((await student.from("user_flashcards").insert({
      user_id: STUDENT_ID, card_id: preview.cardId,
    })).error).not.toBeNull();

    await enroll(preview.courseId);
    expect((await student.from("user_topic_progress").insert({
      user_id: STUDENT_ID, topic_id: preview.topicId,
    })).error).toBeNull();
    expect((await student.from("user_question_answers").insert({
      user_id: STUDENT_ID, question_id: preview.questionId,
      selected_option_id: preview.optionId, is_correct: true,
    })).error).toBeNull();
    expect((await student.from("user_flashcards").insert({
      user_id: STUDENT_ID, card_id: preview.cardId,
    })).error).toBeNull();

    expect((await student.from("user_topic_progress").insert({
      user_id: STUDENT_ID, topic_id: enrolled.topicId,
    })).error).toBeNull();
    expect((await student.from("user_question_answers").insert({
      user_id: STUDENT_ID, question_id: enrolled.questionId,
      selected_option_id: enrolled.optionId, is_correct: true,
    })).error).toBeNull();
    expect((await student.from("user_flashcards").insert({
      user_id: STUDENT_ID, card_id: enrolled.cardId,
    })).error).toBeNull();
    expect((await student.from("user_topic_progress").insert({
      user_id: TEACHER_ID, topic_id: enrolled.topicId,
    })).error).not.toBeNull();
    expect((await student.from("user_question_answers").insert({
      user_id: TEACHER_ID, question_id: enrolled.questionId,
      selected_option_id: enrolled.optionId, is_correct: true,
    })).error).not.toBeNull();
    expect((await student.from("user_flashcards").insert({
      user_id: TEACHER_ID, card_id: enrolled.cardId,
    })).error).not.toBeNull();
  });

  it("checks both UPDATE target sides and denies conflict upserts after enrollment revoke", async () => {
    const target = await createTree("published");
    const foreign = await createTree("draft");
    await enroll(target.courseId);
    const progress = await student.from("user_topic_progress").insert({
      user_id: STUDENT_ID, topic_id: target.topicId,
    }).select("id").single();
    const answer = await student.from("user_question_answers").insert({
      user_id: STUDENT_ID, question_id: target.questionId,
      selected_option_id: target.optionId, is_correct: true,
    }).select("id").single();
    const flashcard = await student.from("user_flashcards").insert({
      user_id: STUDENT_ID, card_id: target.cardId,
    }).select("id").single();
    expect(progress.error).toBeNull();
    expect(answer.error).toBeNull();
    expect(flashcard.error).toBeNull();

    expect((await student.from("user_topic_progress").update({ topic_id: foreign.topicId })
      .eq("id", progress.data!.id)).error).not.toBeNull();
    expect((await student.from("user_question_answers").update({ question_id: foreign.questionId })
      .eq("id", answer.data!.id)).error).not.toBeNull();
    expect((await student.from("user_flashcards").update({ card_id: foreign.cardId })
      .eq("id", flashcard.data!.id)).error).not.toBeNull();

    const revoked = await service.from("enrollments").delete()
      .eq("course_id", target.courseId).eq("user_id", STUDENT_ID);
    expect(revoked.error).toBeNull();
    expect((await student.from("user_topic_progress").select("id")
      .eq("id", progress.data!.id)).data).toEqual([{ id: progress.data!.id }]);
    expect((await student.from("user_question_answers").select("id")
      .eq("id", answer.data!.id)).data).toEqual([{ id: answer.data!.id }]);
    expect((await student.from("user_flashcards").select("id")
      .eq("id", flashcard.data!.id)).data).toEqual([{ id: flashcard.data!.id }]);

    await student.from("user_topic_progress").update({ is_flashcard_completed: true })
      .eq("id", progress.data!.id);
    await student.from("user_question_answers").update({ is_correct: false })
      .eq("id", answer.data!.id);
    await student.from("user_flashcards").update({ interval_days: 1 })
      .eq("id", flashcard.data!.id);
    const oldProgress = await service.from("user_topic_progress")
      .select("is_flashcard_completed").eq("id", progress.data!.id).single();
    const oldAnswer = await service.from("user_question_answers")
      .select("is_correct").eq("id", answer.data!.id).single();
    const oldFlashcard = await service.from("user_flashcards")
      .select("interval_days").eq("id", flashcard.data!.id).single();
    expect(oldProgress.data?.is_flashcard_completed).toBe(false);
    expect(oldAnswer.data?.is_correct).toBe(true);
    expect(oldFlashcard.data?.interval_days).toBe(0);

    expect((await student.from("user_topic_progress").upsert({
      user_id: STUDENT_ID, topic_id: target.topicId, is_flashcard_completed: true,
    }, { onConflict: "user_id,topic_id" })).error).not.toBeNull();
    expect((await student.from("user_question_answers").upsert({
      user_id: STUDENT_ID, question_id: target.questionId,
      selected_option_id: target.optionId, is_correct: false,
    }, { onConflict: "user_id,question_id" })).error).not.toBeNull();
    expect((await student.from("user_flashcards").upsert({
      user_id: STUDENT_ID, card_id: target.cardId, interval_days: 1,
    }, { onConflict: "user_id,card_id" })).error).not.toBeNull();
  });

  it("does not expose the private enrollment predicate through public RPC", async () => {
    const result = await student.rpc("q7_has_learning_target_enrollment", {
      p_target_kind: "topic",
      p_target_id: randomUUID(),
    });
    expect(result.error).not.toBeNull();
  });
});
