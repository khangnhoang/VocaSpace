import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { Rating } from "ts-fsrs";
import { isMemoryCheckPassed, loadMemoryCheck } from "@/lib/memory-check";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { submitCardReview } from "@/app/actions/review";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";

// Test plan:
// - Mục tiêu: chứng minh hoàn thành topic là sự thật do server suy ra (D4 G1–G6) trên DB thật.
// - Loại test: real local Supabase integration (RPC `d4_sync_topic_progress` + RLS `user_topic_progress`).
// - Đối tượng: `public.d4_sync_topic_progress`, `private.d4_topic_completion_state`, policy progress;
//   chuỗi Server Action `submitCardReview` + `submitQuestionAnswer` và `getLearningWorkspace` chạy với client learner thật.
// - Case thành công:
//   - Chỉ hoàn thành khi mọi thẻ active đã ôn, memory check đã qua và mọi câu bắt buộc đúng
//     (nhiều exercise, câu standalone, sai rồi sửa, câu có hai option đúng).
//   - Câu trong group đã xóa, thẻ đã xóa và câu lệch course không bắt buộc; topic không có memory check bỏ qua stage đó.
// - Case thất bại:
//   - Learner tự ghi `is_correct = true` cho option sai không làm câu thành đúng.
// - Bảo mật/phân quyền:
//   - Learner đã enroll không INSERT/UPDATE thẳng `user_topic_progress`; SELECT vẫn được.
//   - Anon, chưa enroll, topic draft/đã xóa, chapter/course đã xóa, course draft, profile đã xóa,
//     admin/collaborator trên topic draft đều bị từ chối và không có dòng mới.
// - Ổn định/resilience:
//   - Nhiều lần sync đồng thời chỉ một lần báo `newly_completed`; gọi lại không đổi `completed_at`.
//   - Chuỗi action qua nhiều exercise chỉ báo `newlyCompleted` ở lần ghi cuối, không báo ở cuối exercise 1.
//   - Workspace trả câu standalone và map `answers` theo đáp án hiện hành; learner đủ điều kiện mà không có lần ghi mới
//     (teacher xóa câu còn thiếu) được ghi nhận hoàn thành khi mở topic.
// - Invariant cần giữ:
//   - Hoàn thành không bị hạ (G4) nhưng cờ stage luôn là snapshot; `is_memory_check_passed` khớp cổng TS (parity H3).
// - Kết quả verify gần nhất: 12/12 passed (2026-10-02) bằng `npm run test:integration -- __tests__/integration/topic-completion.test.ts`.
// - Ghi chú: chỉ chạy trên local Supabase với `ALLOW_DB_INTEGRATION_TESTS=true`.

const clientHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn(async () => clientHolder.current) }));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } };

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLIENT_OPTIONS);
const courseIds: string[] = [];
let learner: SupabaseClient;
let learnerId = "";

type Question = { id: string; right: string; wrong: string; extraRight?: string };
type Fixture = {
  courseId: string;
  chapterId: string;
  topicId: string;
  cardIds: string[];
  groupId: string;
  groupedQuestions: Question[];
  standaloneExerciseId: string;
  standaloneQuestion: Question;
  memoryExerciseId: string | null;
  memoryQuestions: Question[];
};

type Progress = {
  is_flashcard_completed: boolean;
  is_memory_check_passed: boolean;
  is_exercise_completed: boolean;
  is_topic_completed: boolean;
  newly_completed: boolean;
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

async function updateOrThrow(table: string, values: Record<string, unknown>, id: string) {
  const { error } = await admin.from(table).update(values).eq("id", id);
  if (error) throw new Error(`${table} update failed: ${error.message}`);
}

async function signIn(email: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, CLIENT_OPTIONS);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function addQuestion(
  fixture: Pick<Fixture, "courseId">,
  exerciseId: string,
  groupId: string | null,
  order: number,
  { twoCorrect = false, courseId = fixture.courseId } = {},
): Promise<Question> {
  const question: Question = {
    id: randomUUID(),
    right: randomUUID(),
    wrong: randomUUID(),
    extraRight: twoCorrect ? randomUUID() : undefined,
  };
  await insertOrThrow("questions", {
    id: question.id, group_id: groupId, exercise_id: exerciseId, course_id: courseId,
    content: `Câu ${order}`, order_index: order,
  });
  await insertOrThrow("question_options", [
    { id: question.right, question_id: question.id, content: "đúng", label: "A", is_correct: true, order_index: 0 },
    { id: question.wrong, question_id: question.id, content: "sai", label: "B", is_correct: false, order_index: 1 },
    ...(question.extraRight
      ? [{ id: question.extraRight, question_id: question.id, content: "cũng đúng", label: "C", is_correct: true, order_index: 2 }]
      : []),
  ]);
  return question;
}

async function createFixture({ memory = true, enrolled = true } = {}): Promise<Fixture> {
  const suffix = randomUUID().slice(0, 8);
  const courseId = randomUUID();
  const chapterId = randomUUID();
  const topicId = randomUUID();
  const groupedExerciseId = randomUUID();
  const groupId = randomUUID();
  const standaloneExerciseId = randomUUID();
  const memoryExerciseId = memory ? randomUUID() : null;
  const cardIds = [randomUUID(), randomUUID()];

  await insertOrThrow("courses", {
    id: courseId, title: `D4 completion ${suffix}`, slug: `d4-completion-${suffix}`, price: 0, status: "published",
  });
  courseIds.push(courseId);
  await insertOrThrow("course_collaborators", {
    course_id: courseId, user_id: TEACHER_ID, role: "owner", added_by: TEACHER_ID,
  });
  await insertOrThrow("chapters", {
    id: chapterId, course_id: courseId, created_by_user_id: TEACHER_ID, title: "D4 chapter", order_index: 0,
  });
  await insertOrThrow("topics", {
    id: topicId, course_id: courseId, chapter_id: chapterId, title: "D4 topic", slug: `d4-topic-${suffix}`,
    status: "published", first_approved_at: new Date().toISOString(),
    original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID,
  });
  await insertOrThrow("cards", cardIds.map((id, index) => ({
    id, topic_id: topicId, front_content: { word: `word-${index}` }, back_content: { translation: "nghĩa" },
    order_index: index,
  })));
  await insertOrThrow("exercises", [
    { id: groupedExerciseId, topic_id: topicId, course_id: courseId, title: "Part 6", part_type: "part6", order_index: 1 },
    { id: standaloneExerciseId, topic_id: topicId, course_id: courseId, title: "Part 5", part_type: "part5", order_index: 2 },
  ]);
  await insertOrThrow("question_groups", { id: groupId, exercise_id: groupedExerciseId, passage_text: "Passage", order_index: 1 });

  const fixture: Fixture = {
    courseId, chapterId, topicId, cardIds, groupId,
    groupedQuestions: [],
    standaloneExerciseId,
    standaloneQuestion: undefined as unknown as Question,
    memoryExerciseId,
    memoryQuestions: [],
  };
  fixture.groupedQuestions.push(
    await addQuestion(fixture, groupedExerciseId, groupId, 1),
    await addQuestion(fixture, groupedExerciseId, groupId, 2),
  );
  fixture.standaloneQuestion = await addQuestion(fixture, standaloneExerciseId, null, 1, { twoCorrect: true });
  if (memoryExerciseId) {
    await insertOrThrow("exercises", {
      id: memoryExerciseId, topic_id: topicId, course_id: courseId, title: "Memory check",
      part_type: null, activity_stage: "memory_check", order_index: 0,
    });
    fixture.memoryQuestions.push(await addQuestion(fixture, memoryExerciseId, null, 1));
  }
  if (enrolled) await insertOrThrow("enrollments", { course_id: courseId, user_id: learnerId });
  return fixture;
}

async function cleanup() {
  for (const courseId of courseIds.splice(0)) {
    const { data: topics } = await admin.from("topics").select("id").eq("course_id", courseId);
    const topicIds = (topics ?? []).map((topic) => topic.id);
    const { data: questions } = await admin.from("questions").select("id").eq("course_id", courseId);
    await admin.from("user_question_answers").delete().in("question_id", (questions ?? []).map((row) => row.id));
    await admin.from("user_topic_progress").delete().in("topic_id", topicIds);
    await admin.from("enrollments").delete().eq("course_id", courseId);
    await admin.from("courses").delete().eq("id", courseId);
  }
}

async function answer(question: Question, optionId: string, forgedIsCorrect?: boolean) {
  const { error } = await learner.from("user_question_answers").upsert({
    user_id: learnerId,
    question_id: question.id,
    selected_option_id: optionId,
    is_correct: forgedIsCorrect ?? optionId !== question.wrong,
  }, { onConflict: "user_id,question_id" });
  if (error) throw new Error(`answer failed: ${error.message}`);
}

async function review(cardId: string) {
  const { error } = await learner.from("user_flashcards").insert({ user_id: learnerId, card_id: cardId });
  if (error) throw new Error(`review failed: ${error.message}`);
}

async function sync(client: SupabaseClient, topicId: string) {
  return client.rpc("d4_sync_topic_progress", { p_topic_id: topicId });
}

async function syncOk(topicId: string): Promise<Progress> {
  const { data, error } = await sync(learner, topicId);
  if (error) throw new Error(`sync failed: ${error.message}`);
  return data as Progress;
}

async function storedProgress(topicId: string, userId = learnerId) {
  const { data, error } = await admin.from("user_topic_progress")
    .select("is_flashcard_completed, is_exercise_completed, is_topic_completed, completed_at")
    .eq("user_id", userId).eq("topic_id", topicId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function finishEverything(fixture: Fixture) {
  for (const cardId of fixture.cardIds) await review(cardId);
  for (const question of fixture.memoryQuestions) await answer(question, question.right);
  for (const question of fixture.groupedQuestions) await answer(question, question.right);
  await answer(fixture.standaloneQuestion, fixture.standaloneQuestion.right);
}

async function expectMemoryParity(fixture: Fixture, progress: Progress) {
  const passed = isMemoryCheckPassed(await loadMemoryCheck(learner, learnerId, fixture.topicId));
  expect(progress.is_memory_check_passed).toBe(passed);
}

describe.sequential("D4 topic completion server truth", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    learnerId = randomUUID();
    const email = `d4-learner-${learnerId}@example.com`;
    const { error: authError } = await admin.auth.admin.createUser({
      id: learnerId, email, password: PASSWORD, email_confirm: true,
    });
    if (authError) throw new Error(`Learner fixture failed: ${authError.message}`);
    const { error: profileError } = await admin.from("profiles").upsert({
      id: learnerId, email, full_name: "D4 Learner", username: `d4_${learnerId.slice(0, 8)}`,
      role: "student", removed_at: null,
    });
    if (profileError) throw new Error(`Learner profile failed: ${profileError.message}`);
    learner = await signIn(email);
    clientHolder.current = learner;
  });

  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await learner?.auth.signOut();
    if (learnerId) await admin.auth.admin.deleteUser(learnerId);
  });

  it("completes only after every card, the memory check and every required question across exercises", async () => {
    const fixture = await createFixture();
    const [first, second] = fixture.groupedQuestions;
    const standalone = fixture.standaloneQuestion;

    let progress = await syncOk(fixture.topicId);
    expect(progress).toEqual({
      is_flashcard_completed: false, is_memory_check_passed: false, is_exercise_completed: false,
      is_topic_completed: false, newly_completed: false,
    });
    await expectMemoryParity(fixture, progress);

    await review(fixture.cardIds[0]);
    await answer(fixture.memoryQuestions[0], fixture.memoryQuestions[0].wrong);
    await answer(first, first.right);
    await answer(second, second.wrong);
    progress = await syncOk(fixture.topicId);
    expect(progress).toMatchObject({
      is_flashcard_completed: false, is_memory_check_passed: false, is_exercise_completed: false, is_topic_completed: false,
    });
    await expectMemoryParity(fixture, progress);

    // Exercise 1 xong hết nhưng câu standalone của exercise 2 chưa làm.
    await review(fixture.cardIds[1]);
    await answer(fixture.memoryQuestions[0], fixture.memoryQuestions[0].right);
    await answer(second, second.right);
    progress = await syncOk(fixture.topicId);
    expect(progress).toMatchObject({
      is_flashcard_completed: true, is_memory_check_passed: true, is_exercise_completed: false, is_topic_completed: false,
    });
    await expectMemoryParity(fixture, progress);

    // Option đúng thứ hai của câu có hai đáp án cũng tính là đúng.
    await answer(standalone, standalone.extraRight!);
    progress = await syncOk(fixture.topicId);
    expect(progress).toEqual({
      is_flashcard_completed: true, is_memory_check_passed: true, is_exercise_completed: true,
      is_topic_completed: true, newly_completed: true,
    });
    const [stored] = await storedProgress(fixture.topicId);
    expect(stored).toMatchObject({ is_flashcard_completed: true, is_exercise_completed: true, is_topic_completed: true });
    expect(stored.completed_at).not.toBeNull();

    const again = await syncOk(fixture.topicId);
    expect(again).toMatchObject({ is_topic_completed: true, newly_completed: false });
    expect((await storedProgress(fixture.topicId))[0].completed_at).toBe(stored.completed_at);
  });

  it("does not count a learner-forged is_correct flag on a wrong option", async () => {
    const fixture = await createFixture({ memory: false });
    await finishEverything(fixture);
    await answer(fixture.standaloneQuestion, fixture.standaloneQuestion.wrong, true);

    const progress = await syncOk(fixture.topicId);
    expect(progress).toMatchObject({ is_exercise_completed: false, is_topic_completed: false });
  });

  it("ignores removed groups, removed cards, course-mismatched questions and an absent memory check", async () => {
    const fixture = await createFixture({ memory: false });
    const removedCardId = fixture.cardIds[1];
    await review(fixture.cardIds[0]);
    await answer(fixture.standaloneQuestion, fixture.standaloneQuestion.right);
    await updateOrThrow("cards", { removed_at: new Date().toISOString() }, removedCardId);
    await updateOrThrow("question_groups", { removed_at: new Date().toISOString() }, fixture.groupId);

    // Câu có course_id khác course của topic không hiện trong workspace nên không bắt buộc.
    const otherCourseId = randomUUID();
    await insertOrThrow("courses", {
      id: otherCourseId, title: "D4 other", slug: `d4-other-${otherCourseId.slice(0, 8)}`, price: 0, status: "published",
    });
    courseIds.push(otherCourseId);
    await addQuestion(fixture, fixture.standaloneExerciseId, null, 9, { courseId: otherCourseId });

    const progress = await syncOk(fixture.topicId);
    expect(progress).toEqual({
      is_flashcard_completed: true, is_memory_check_passed: true, is_exercise_completed: true,
      is_topic_completed: true, newly_completed: true,
    });
  });

  it("keeps completion sticky while stage flags and the memory check follow new content", async () => {
    const fixture = await createFixture();
    await finishEverything(fixture);
    expect(await syncOk(fixture.topicId)).toMatchObject({ is_topic_completed: true, newly_completed: true });
    const [completed] = await storedProgress(fixture.topicId);

    await addQuestion(fixture, fixture.standaloneExerciseId, null, 2);
    let progress = await syncOk(fixture.topicId);
    expect(progress).toMatchObject({
      is_exercise_completed: false, is_topic_completed: true, newly_completed: false,
    });

    await addQuestion(fixture, fixture.memoryExerciseId!, null, 2);
    progress = await syncOk(fixture.topicId);
    expect(progress).toMatchObject({
      is_memory_check_passed: false, is_topic_completed: true, newly_completed: false,
    });
    await expectMemoryParity(fixture, progress);

    const [after] = await storedProgress(fixture.topicId);
    expect(after).toMatchObject({ is_exercise_completed: false, is_topic_completed: true });
    expect(after.completed_at).toBe(completed.completed_at);
  });

  it("drops the exercise flag when a question is added before completion", async () => {
    const fixture = await createFixture({ memory: false });
    for (const question of fixture.groupedQuestions) await answer(question, question.right);
    await answer(fixture.standaloneQuestion, fixture.standaloneQuestion.right);
    expect(await syncOk(fixture.topicId)).toMatchObject({ is_exercise_completed: true, is_topic_completed: false });

    await addQuestion(fixture, fixture.standaloneExerciseId, null, 2);
    expect(await syncOk(fixture.topicId)).toMatchObject({ is_exercise_completed: false, is_topic_completed: false });
  });

  it("reports newly_completed exactly once for concurrent syncs", async () => {
    const fixture = await createFixture();
    await finishEverything(fixture);

    const results = await Promise.all(Array.from({ length: 5 }, () => sync(learner, fixture.topicId)));
    for (const result of results) expect(result.error).toBeNull();
    const progress = results.map((result) => result.data as Progress);
    expect(progress.filter((item) => item.newly_completed)).toHaveLength(1);
    expect(progress.every((item) => item.is_topic_completed)).toBe(true);
    expect(await storedProgress(fixture.topicId)).toHaveLength(1);
  });

  it("denies direct learner writes to user_topic_progress but keeps self SELECT", async () => {
    const fixture = await createFixture();
    const insert = await learner.from("user_topic_progress").insert({
      user_id: learnerId, topic_id: fixture.topicId, is_topic_completed: true,
    });
    expect(insert.error).not.toBeNull();
    expect(await storedProgress(fixture.topicId)).toEqual([]);

    await syncOk(fixture.topicId);
    await learner.from("user_topic_progress").update({ is_topic_completed: true }).eq("topic_id", fixture.topicId);
    const upsert = await learner.from("user_topic_progress").upsert({
      user_id: learnerId, topic_id: fixture.topicId, is_topic_completed: true,
    }, { onConflict: "user_id,topic_id" });
    expect(upsert.error).not.toBeNull();
    expect((await storedProgress(fixture.topicId))[0].is_topic_completed).toBe(false);

    const own = await learner.from("user_topic_progress").select("topic_id, is_topic_completed").eq("topic_id", fixture.topicId);
    expect(own.data).toEqual([{ topic_id: fixture.topicId, is_topic_completed: false }]);
  });

  it("rejects anon, unenrolled and unavailable targets without writing progress", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, CLIENT_OPTIONS);
    const unenrolled = await createFixture({ enrolled: false });
    expect((await sync(anon, unenrolled.topicId)).error).not.toBeNull();
    // Q7 ẩn topic của course chưa enroll khỏi learner, nên RPC báo topic không khả dụng.
    expect((await sync(learner, unenrolled.topicId)).error?.message).toMatch(/TOPIC_UNAVAILABLE|ENROLLMENT_REQUIRED/);
    expect(await storedProgress(unenrolled.topicId)).toEqual([]);

    const cases: Array<[string, (fixture: Fixture) => Promise<void>]> = [
      ["topic draft", (f) => updateOrThrow("topics", { status: "draft" }, f.topicId)],
      ["topic removed", (f) => updateOrThrow("topics", { removed_at: new Date().toISOString() }, f.topicId)],
      ["chapter removed", (f) => updateOrThrow("chapters", { removed_at: new Date().toISOString() }, f.chapterId)],
      ["course removed", (f) => updateOrThrow("courses", { removed_at: new Date().toISOString() }, f.courseId)],
      ["course draft", (f) => updateOrThrow("courses", { status: "draft" }, f.courseId)],
    ];
    for (const [label, makeUnavailable] of cases) {
      const fixture = await createFixture();
      await makeUnavailable(fixture);
      const { error } = await sync(learner, fixture.topicId);
      expect(error?.message, label).toBe("TOPIC_UNAVAILABLE");
      expect(await storedProgress(fixture.topicId), label).toEqual([]);
    }
  });

  it("rejects a removed learner profile", async () => {
    const fixture = await createFixture();
    await updateOrThrow("profiles", { removed_at: new Date().toISOString() }, learnerId);
    try {
      const { error } = await sync(learner, fixture.topicId);
      expect(error?.message).toBe("TOPIC_UNAVAILABLE");
      expect(await storedProgress(fixture.topicId)).toEqual([]);
    } finally {
      await updateOrThrow("profiles", { removed_at: null }, learnerId);
    }
  });

  it("rejects admin and collaborator syncs on a draft topic even when enrolled", async () => {
    const fixture = await createFixture();
    await updateOrThrow("topics", { status: "draft" }, fixture.topicId);

    for (const email of ["admin@gmail.com", "teacher@gmail.com"]) {
      const client = await signIn(email);
      const { data: { user } } = await client.auth.getUser();
      await insertOrThrow("enrollments", { course_id: fixture.courseId, user_id: user!.id });
      const { error } = await sync(client, fixture.topicId);
      expect(error?.message, email).toBe("TOPIC_UNAVAILABLE");
      expect(await storedProgress(fixture.topicId, user!.id), email).toEqual([]);
      await client.auth.signOut();
    }
  });

  it("reports newlyCompleted once across a learner's action chain, only on the final required write", async () => {
    const fixture = await createFixture();
    const flags: boolean[] = [];
    const record = (result: { topicProgress?: { newlyCompleted: boolean }; progressError?: string }) => {
      expect(result.progressError).toBeUndefined();
      flags.push(result.topicProgress!.newlyCompleted);
      return result.topicProgress!;
    };

    for (const cardId of fixture.cardIds) record(await submitCardReview(cardId, Rating.Good));
    const [memory] = fixture.memoryQuestions;
    expect(record(await submitQuestionAnswer(memory.id, memory.right))).toMatchObject({ isMemoryCheckPassed: true });
    for (const question of fixture.groupedQuestions) {
      record(await submitQuestionAnswer(question.id, question.right));
    }
    // Hết exercise 1 nhưng câu standalone của exercise 2 còn thiếu: chưa hoàn thành.
    expect(await syncOk(fixture.topicId)).toMatchObject({ is_topic_completed: false });

    const last = record(await submitQuestionAnswer(fixture.standaloneQuestion.id, fixture.standaloneQuestion.right));
    expect(last).toMatchObject({ isTopicCompleted: true, newlyCompleted: true });
    expect(flags.filter(Boolean)).toHaveLength(1);
    expect(flags.at(-1)).toBe(true);

    const again = await submitQuestionAnswer(fixture.standaloneQuestion.id, fixture.standaloneQuestion.wrong);
    expect(again).toMatchObject({ isCorrect: false, topicProgress: { isTopicCompleted: true, newlyCompleted: false } });
  });

  it("returns standalone questions in the workspace and records completion when the learner opens the topic", async () => {
    const fixture = await createFixture();
    const { data: slugs } = await admin.from("topics").select("slug, course:courses(slug)")
      .eq("id", fixture.topicId).single();
    const courseSlug = (slugs!.course as unknown as { slug: string }).slug;
    const open = async () => {
      const result = await getLearningWorkspace(courseSlug, slugs!.slug);
      if (result.status !== "success") throw new Error(`workspace failed: ${result.status}`);
      return result.data;
    };

    for (const cardId of fixture.cardIds) await review(cardId);
    for (const question of fixture.memoryQuestions) await answer(question, question.right);
    const [first, second] = fixture.groupedQuestions;
    await answer(first, first.right);
    await answer(second, second.wrong, true);

    const before = await open();
    const [grouped, standalone] = before.exercises;
    expect(grouped.questions).toEqual([]);
    expect(grouped.groups[0].questions.map((question) => question.id)).toEqual([first.id, second.id]);
    expect(standalone.questions.map((question) => question.id)).toEqual([fixture.standaloneQuestion.id]);
    expect(standalone.groups).toEqual([]);
    // Câu 2 learner tự ghi is_correct cho option sai: không tính là đúng (G3).
    expect(before.answers[first.id]).toBe(first.right);
    expect(before.answers).not.toHaveProperty(second.id);
    expect(before.progress).toMatchObject({ isFlashcardCompleted: true, isTopicCompleted: false });

    // Teacher gỡ hai câu learner còn thiếu: không có lần ghi mới nhưng mở topic vẫn ghi nhận hoàn thành.
    await updateOrThrow("questions", { removed_at: new Date().toISOString() }, second.id);
    await updateOrThrow("questions", { removed_at: new Date().toISOString() }, fixture.standaloneQuestion.id);
    const after = await open();
    expect(after.progress).toEqual({ isFlashcardCompleted: true, isExerciseCompleted: true, isTopicCompleted: true });
    expect(await storedProgress(fixture.topicId)).toMatchObject([{ is_topic_completed: true }]);
  });
});
