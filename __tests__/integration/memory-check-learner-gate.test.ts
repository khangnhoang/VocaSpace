import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { submitQuestionAnswer, updateStageProgress } from "@/app/actions/progress";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";

// Test plan:
// - Mục tiêu: kiểm tra C3 của D3 — cổng exercise phía server và DTO memory check trên DB thật (RLS, PostgREST embed/filter).
// - Loại test: real local Supabase integration; Server Action chạy với client learner thật (mock chỉ chỗ lấy client).
// - Đối tượng: `submitQuestionAnswer`, `updateStageProgress`, `getLearningWorkspace`.
// - Case thành công:
//   - Trả lời đúng hết memory check thì ghi được đáp án exercise và exercise stage; workspace báo đã qua.
//   - Topic không có memory check giữ hành vi cũ; câu có hai option đúng thì chọn option nào trong hai đều đúng.
// - Case thất bại:
//   - Chưa qua thì đáp án exercise và exercise stage bị `MEMORY_CHECK_REQUIRED`, không có dòng mới.
//   - Thêm câu mới hoặc đổi option đúng sau khi qua thì khóa lại; chỉ sửa chữ thì vẫn qua.
// - Bảo mật/phân quyền:
//   - Learner tự ghi `is_correct = true` cho option sai qua Data API không mở được cổng; learner chưa ghi danh bị từ chối như Q7.
// - Invariant cần giữ: "đã qua" suy từ option đang chọn và đáp án hiện hành, không đọc `user_question_answers.is_correct`.
// - Kết quả verify gần nhất: passed (6 test) bằng `npm.cmd run test:integration -- __tests__/integration/memory-check-learner-gate.test.ts`.
// - Ghi chú: test chạy trên local Supabase với `ALLOW_DB_INTEGRATION_TESTS=true`.

const clientHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn(async () => clientHolder.current) }));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const REQUIRED = {
  error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.",
  errorCode: "MEMORY_CHECK_REQUIRED",
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const fixtures: Fixture[] = [];
let student: SupabaseClient;

type MemoryQuestion = { id: string; right: string; wrong: string };
type Fixture = {
  courseId: string;
  courseSlug: string;
  topicId: string;
  topicSlug: string;
  exerciseQuestionId: string;
  exerciseOptionId: string;
  memoryExerciseId: string | null;
  memory: MemoryQuestion[];
};

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  if (!SUPABASE_URL.startsWith("http://127.0.0.1:45321")) {
    throw new Error(`Refusing non-local Supabase URL: ${SUPABASE_URL}`);
  }
}

async function insertOrThrow(table: string, rows: unknown) {
  const { error } = await admin.from(table).insert(rows as never);
  if (error) throw new Error(`${table} fixture failed: ${error.message}`);
}

async function addMemoryQuestion(fixture: Fixture, order: number) {
  if (!fixture.memoryExerciseId) throw new Error("Fixture has no memory check");
  const question: MemoryQuestion = { id: randomUUID(), right: randomUUID(), wrong: randomUUID() };
  await insertOrThrow("questions", {
    id: question.id,
    exercise_id: fixture.memoryExerciseId,
    course_id: fixture.courseId,
    content: `Câu nhớ ${order}`,
    explanation: `Giải thích nhớ ${order}`,
    order_index: order,
  });
  await insertOrThrow("question_options", [
    { id: question.right, question_id: question.id, content: "đúng", label: "A", is_correct: true, order_index: 0 },
    { id: question.wrong, question_id: question.id, content: "sai", label: "B", is_correct: false, order_index: 1 },
  ]);
  fixture.memory.push(question);
  return question;
}

async function createFixture({ memoryQuestions = 2, enrolled = true } = {}) {
  const suffix = randomUUID().slice(0, 8);
  const fixture: Fixture = {
    courseId: randomUUID(),
    courseSlug: `d3-gate-${suffix}`,
    topicId: randomUUID(),
    topicSlug: `d3-gate-topic-${suffix}`,
    exerciseQuestionId: randomUUID(),
    exerciseOptionId: randomUUID(),
    memoryExerciseId: memoryQuestions > 0 ? randomUUID() : null,
    memory: [],
  };
  const chapterId = randomUUID();
  const exerciseId = randomUUID();
  const groupId = randomUUID();

  await insertOrThrow("courses", {
    id: fixture.courseId,
    title: `D3 gate ${suffix}`,
    slug: fixture.courseSlug,
    price: 0,
    status: "published",
  });
  fixtures.push(fixture);
  await insertOrThrow("course_collaborators", {
    course_id: fixture.courseId, user_id: TEACHER_ID, role: "owner", added_by: TEACHER_ID,
  });
  await insertOrThrow("chapters", {
    id: chapterId, course_id: fixture.courseId, created_by_user_id: TEACHER_ID, title: "D3 gate chapter", order_index: 0,
  });
  await insertOrThrow("topics", {
    id: fixture.topicId,
    course_id: fixture.courseId,
    chapter_id: chapterId,
    title: "D3 gate topic",
    slug: fixture.topicSlug,
    status: "published",
    first_approved_at: new Date().toISOString(),
    original_creator_user_id: TEACHER_ID,
    responsible_author_user_id: TEACHER_ID,
  });
  await insertOrThrow("cards", {
    topic_id: fixture.topicId, front_content: { word: "due" }, back_content: { translation: "đến hạn" },
  });
  await insertOrThrow("exercises", {
    id: exerciseId, topic_id: fixture.topicId, course_id: fixture.courseId, title: "Part 6", part_type: "part6", order_index: 1,
  });
  await insertOrThrow("question_groups", { id: groupId, exercise_id: exerciseId, passage_text: "Passage", order_index: 1 });
  await insertOrThrow("questions", {
    id: fixture.exerciseQuestionId, group_id: groupId, exercise_id: exerciseId, course_id: fixture.courseId,
    content: "Blank", order_index: 1,
  });
  await insertOrThrow("question_options", [
    { id: fixture.exerciseOptionId, question_id: fixture.exerciseQuestionId, content: "due", label: "A", is_correct: true, order_index: 0 },
    { id: randomUUID(), question_id: fixture.exerciseQuestionId, content: "dew", label: "B", is_correct: false, order_index: 1 },
  ]);
  if (fixture.memoryExerciseId) {
    await insertOrThrow("exercises", {
      id: fixture.memoryExerciseId, topic_id: fixture.topicId, course_id: fixture.courseId,
      title: "Memory check", part_type: null, activity_stage: "memory_check", order_index: 0,
    });
    for (let order = 1; order <= memoryQuestions; order += 1) await addMemoryQuestion(fixture, order);
  }
  if (enrolled) await insertOrThrow("enrollments", { course_id: fixture.courseId, user_id: STUDENT_ID });
  return fixture;
}

async function cleanup() {
  for (const fixture of fixtures.splice(0)) {
    const questionIds = [fixture.exerciseQuestionId, ...fixture.memory.map((question) => question.id)];
    await admin.from("user_question_answers").delete().in("question_id", questionIds);
    await admin.from("user_topic_progress").delete().eq("topic_id", fixture.topicId);
    await admin.from("enrollments").delete().eq("course_id", fixture.courseId);
    await admin.from("courses").delete().eq("id", fixture.courseId);
  }
}

async function answerRows(questionId: string) {
  const { data, error } = await admin.from("user_question_answers")
    .select("selected_option_id").eq("user_id", STUDENT_ID).eq("question_id", questionId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function exerciseStageCompleted(topicId: string) {
  const { data } = await admin.from("user_topic_progress")
    .select("is_exercise_completed").eq("user_id", STUDENT_ID).eq("topic_id", topicId).maybeSingle();
  return data?.is_exercise_completed === true;
}

async function passMemoryCheck(fixture: Fixture) {
  for (const question of fixture.memory) {
    const result = await submitQuestionAnswer(question.id, question.right);
    expect(result).toMatchObject({ success: true, isCorrect: true });
  }
}

// Each case chains many Server Action round trips; CI runners exceed the 5s default.
describe.sequential("D3 memory check learner gate", { timeout: 20_000 }, () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    student = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await student.auth.signInWithPassword({ email: "student@gmail.com", password: PASSWORD });
    if (error) throw new Error(`Sign-in failed: ${error.message}`);
    clientHolder.current = student;
  });

  afterEach(cleanup);

  it("locks exercise writes until every memory question is answered correctly, then unlocks them", async () => {
    const fixture = await createFixture();

    await expect(submitQuestionAnswer(fixture.exerciseQuestionId, fixture.exerciseOptionId)).resolves.toEqual(REQUIRED);
    await expect(updateStageProgress(fixture.topicId, "exercise")).resolves.toEqual(REQUIRED);
    expect(await answerRows(fixture.exerciseQuestionId)).toEqual([]);
    expect(await exerciseStageCompleted(fixture.topicId)).toBe(false);

    const [first, second] = fixture.memory;
    await expect(submitQuestionAnswer(first.id, first.wrong)).resolves.toMatchObject({
      success: true, isCorrect: false, isMemoryCheckPassed: false,
    });
    await expect(submitQuestionAnswer(first.id, first.right)).resolves.toMatchObject({ isCorrect: true, isMemoryCheckPassed: false });
    await expect(submitQuestionAnswer(second.id, second.right)).resolves.toMatchObject({ isCorrect: true, isMemoryCheckPassed: true });

    const workspace = await getLearningWorkspace(fixture.courseSlug, fixture.topicSlug);
    expect(workspace.status).toBe("success");
    if (workspace.status === "success") {
      expect(workspace.data.isMemoryCheckPassed).toBe(true);
      expect(workspace.data.memoryCheck?.questions.map((question) => question.id)).toEqual([first.id, second.id]);
      expect(JSON.stringify(workspace.data.memoryCheck)).not.toContain("is_correct");
      expect(JSON.stringify(workspace.data.memoryCheck)).not.toContain("Giải thích nhớ");
      expect(workspace.data.exercises.map((exercise) => exercise.part_type)).toEqual(["part6"]);
      expect(workspace.data.answers).toMatchObject({ [first.id]: first.right, [second.id]: second.right });
    }

    await expect(submitQuestionAnswer(fixture.exerciseQuestionId, fixture.exerciseOptionId)).resolves.toMatchObject({ success: true });
    await expect(updateStageProgress(fixture.topicId, "exercise")).resolves.toEqual({ success: true });
    expect(await answerRows(fixture.exerciseQuestionId)).toHaveLength(1);
    expect(await exerciseStageCompleted(fixture.topicId)).toBe(true);
  });

  it("keeps the old behaviour for a topic without a memory check", async () => {
    const fixture = await createFixture({ memoryQuestions: 0 });

    await expect(submitQuestionAnswer(fixture.exerciseQuestionId, fixture.exerciseOptionId)).resolves.toEqual({
      success: true, isCorrect: true,
    });
    const workspace = await getLearningWorkspace(fixture.courseSlug, fixture.topicSlug);
    expect(workspace.status === "success" && workspace.data).toMatchObject({ memoryCheck: null, isMemoryCheckPassed: true });
  });

  it("does not trust a learner-written is_correct flag", async () => {
    const fixture = await createFixture({ memoryQuestions: 1 });
    const [only] = fixture.memory;

    const forged = await student.from("user_question_answers").upsert({
      user_id: STUDENT_ID, question_id: only.id, selected_option_id: only.wrong, is_correct: true,
    }, { onConflict: "user_id,question_id" });
    expect(forged.error).toBeNull();

    await expect(submitQuestionAnswer(fixture.exerciseQuestionId, fixture.exerciseOptionId)).resolves.toEqual(REQUIRED);
    const workspace = await getLearningWorkspace(fixture.courseSlug, fixture.topicSlug);
    expect(workspace.status === "success" && workspace.data.isMemoryCheckPassed).toBe(false);
    expect(workspace.status === "success" && workspace.data.answers).not.toHaveProperty(only.id);
  });

  it("re-locks after a new question or a changed answer key, but not after a text-only edit", async () => {
    const fixture = await createFixture();
    await passMemoryCheck(fixture);
    const [first] = fixture.memory;

    await admin.from("questions").update({ content: "Câu nhớ 1 (sửa chữ)" }).eq("id", first.id);
    await admin.from("question_options").update({ content: "đúng (sửa chữ)" }).eq("id", first.right);
    await expect(updateStageProgress(fixture.topicId, "exercise")).resolves.toEqual({ success: true });

    await admin.from("question_options").update({ is_correct: false }).eq("id", first.right);
    await admin.from("question_options").update({ is_correct: true }).eq("id", first.wrong);
    await expect(updateStageProgress(fixture.topicId, "exercise")).resolves.toEqual(REQUIRED);
    await expect(submitQuestionAnswer(first.id, first.wrong)).resolves.toMatchObject({ isCorrect: true, isMemoryCheckPassed: true });

    const added = await addMemoryQuestion(fixture, 3);
    await expect(submitQuestionAnswer(fixture.exerciseQuestionId, fixture.exerciseOptionId)).resolves.toEqual(REQUIRED);
    await expect(submitQuestionAnswer(added.id, added.right)).resolves.toMatchObject({ isMemoryCheckPassed: true });
    await expect(submitQuestionAnswer(fixture.exerciseQuestionId, fixture.exerciseOptionId)).resolves.toMatchObject({ success: true });
  });

  it("accepts either of two correct options for a memory question", async () => {
    const fixture = await createFixture({ memoryQuestions: 1 });
    const [only] = fixture.memory;
    await admin.from("question_options").update({ is_correct: true }).eq("id", only.wrong);

    await expect(submitQuestionAnswer(only.id, only.wrong)).resolves.toMatchObject({ isCorrect: true, isMemoryCheckPassed: true });
    await expect(submitQuestionAnswer(only.id, only.right)).resolves.toMatchObject({ isCorrect: true, isMemoryCheckPassed: true });
  });

  it("denies an unenrolled learner like Q7", async () => {
    const fixture = await createFixture({ enrolled: false });
    const [first] = fixture.memory;

    // Q7 RLS already hides the question and topic from an unenrolled learner.
    await expect(submitQuestionAnswer(first.id, first.right)).resolves.toEqual({
      error: "Câu hỏi không khả dụng.",
    });
    await expect(updateStageProgress(fixture.topicId, "exercise")).resolves.toEqual({
      error: "Bài học không khả dụng.",
    });
    expect(await answerRows(first.id)).toEqual([]);
    expect(await exerciseStageCompleted(fixture.topicId)).toBe(false);
  });
});
