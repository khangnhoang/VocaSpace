import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { isMemoryCheckPassed, loadMemoryCheck } from "@/lib/memory-check";
import { waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: LF2 AC4/AC5 - cổng memory check của câu exercise do database ép trên Data API, không chỉ Server Action.
// - Loại: integration Data API/RLS + Server Action thật trên runtime E2E tách biệt; không mock database.
// - Thành công: INSERT, UPDATE và upsert (nhánh insert, nhánh conflict) của câu exercise được ghi khi memory check đã qua;
//   câu memory check luôn ghi được; topic không có câu memory active không chặn.
// - Thất bại: cùng các đường ghi bị từ chối (42501) và không để lại dòng mới/đổi dòng cũ khi memory check chưa qua.
// - Phân quyền: anon bị từ chối; policy L1 giữ nguyên USING, không có policy permissive mới; helper chỉ authenticated.
// - Resilience: sai lại một câu memory khóa lại việc ghi nhưng đáp án exercise cũ vẫn đọc được; đổi đáp án hoặc thêm
//   câu memory mới khóa lại; action trả `MEMORY_CHECK_REQUIRED` khi cổng khóa và không lộ lỗi DB.
// - Invariant: cổng SQL, cổng TS (`loadMemoryCheck`/`isMemoryCheckPassed`) và `is_memory_check_passed` của D4 luôn cùng đáp án.
// - Verify: xem số pass gần nhất trong progress.md (LF2 CP4).
// - Ghi chú: chạy bằng `npm run test:integration -- __tests__/integration/lf2-memory-check-answer-gate.test.ts`;
//   cần ALLOW_DB_INTEGRATION_TESTS=true, API 45441, E2E_SUPABASE_WORKDIR=.e2e-runtime và psql.

const authenticated = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => authenticated.client }));

const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const runtimeUrl = new URL(api);
if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true"
  || process.env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" || runtimeUrl.protocol !== "http:"
  || !["127.0.0.1", "localhost"].includes(runtimeUrl.hostname) || runtimeUrl.port !== "45441") {
  throw new Error("LF2 integration requires the explicitly enabled isolated E2E runtime on port 45441");
}

const RLS_VIOLATION = "42501";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const studentId = "33333333-3333-4333-8333-333333333333";
const teacherId = "22222222-2222-4222-8222-222222222222";

type Q = { id: string; right: string; wrong: string };
type Fixture = {
  courseId: string; chapterId: string; topicId: string; cardId: string;
  memoryExerciseId: string | null; exerciseId: string;
  memory: Q[]; exercise: Q; probe: Q;
};

let learner: SupabaseClient;
const fixtures: Fixture[] = [];

async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const r = await service.from(table).insert(rows as never);
  if (r.error) throw new Error(`${table}: ${r.error.message}`);
}

async function addQuestion(courseId: string, exerciseId: string, order: number): Promise<Q> {
  const q: Q = { id: randomUUID(), right: randomUUID(), wrong: randomUUID() };
  await insert("questions", { id: q.id, exercise_id: exerciseId, course_id: courseId, content: `LF2 ${order}`, order_index: order });
  await insert("question_options", [
    { id: q.right, question_id: q.id, content: "đúng", label: "A", is_correct: true, order_index: 0 },
    { id: q.wrong, question_id: q.id, content: "sai", label: "B", is_correct: false, order_index: 1 },
  ]);
  return q;
}

async function build(memoryCount = 2): Promise<Fixture> {
  const f: Fixture = {
    courseId: randomUUID(), chapterId: randomUUID(), topicId: randomUUID(), cardId: randomUUID(),
    memoryExerciseId: memoryCount > 0 ? randomUUID() : null, exerciseId: randomUUID(),
    memory: [], exercise: null as unknown as Q, probe: null as unknown as Q,
  };
  await insert("courses", { id: f.courseId, title: "LF2 gate", slug: `lf2-gate-${f.courseId}`, price: 0, status: "published" });
  fixtures.push(f);
  await insert("course_collaborators", { course_id: f.courseId, user_id: teacherId, role: "owner", added_by: teacherId });
  await insert("chapters", { id: f.chapterId, course_id: f.courseId, title: "LF2", created_by_user_id: teacherId, order_index: 0 });
  await insert("topics", {
    id: f.topicId, course_id: f.courseId, chapter_id: f.chapterId, title: "LF2", slug: `lf2-gate-${f.topicId}`,
    status: "published", first_approved_at: new Date().toISOString(), order_index: 0,
    original_creator_user_id: teacherId, responsible_author_user_id: teacherId,
  });
  await insert("cards", { id: f.cardId, topic_id: f.topicId, front_content: { word: "gate" }, back_content: { translation: "cổng" } });
  if (f.memoryExerciseId) {
    await insert("exercises", {
      id: f.memoryExerciseId, topic_id: f.topicId, course_id: f.courseId, title: "Memory",
      part_type: null, activity_stage: "memory_check", order_index: 0,
    });
    for (let order = 0; order < memoryCount; order += 1) f.memory.push(await addQuestion(f.courseId, f.memoryExerciseId, order));
  }
  await insert("exercises", {
    id: f.exerciseId, topic_id: f.topicId, course_id: f.courseId, title: "Part 5",
    part_type: "part5", activity_stage: "exercise", order_index: 1,
  });
  f.exercise = await addQuestion(f.courseId, f.exerciseId, 0);
  f.probe = await addQuestion(f.courseId, f.exerciseId, 1);
  await insert("enrollments", { course_id: f.courseId, user_id: studentId });
  return f;
}

const row = (q: Q, option: string) => ({ user_id: studentId, question_id: q.id, selected_option_id: option, is_correct: false });
const insertAnswer = (q: Q, option: string) => learner.from("user_question_answers").insert(row(q, option)).select("id").single();
const upsertAnswer = (q: Q, option: string) =>
  learner.from("user_question_answers").upsert(row(q, option), { onConflict: "user_id,question_id" }).select("id").single();
const updateAnswer = (q: Q, option: string) =>
  learner.from("user_question_answers").update({ selected_option_id: option }).eq("user_id", studentId).eq("question_id", q.id)
    .select("id").single();
const storedAnswer = async (q: Q) => {
  const r = await service.from("user_question_answers").select("selected_option_id").eq("user_id", studentId).eq("question_id", q.id);
  if (r.error) throw r.error;
  return r.data[0]?.selected_option_id ?? null;
};
const seedAnswer = async (q: Q, option: string) => {
  const r = await service.from("user_question_answers").upsert(row(q, option), { onConflict: "user_id,question_id" });
  if (r.error) throw r.error;
};
const passMemory = async (f: Fixture) => { for (const q of f.memory) expect((await upsertAnswer(q, q.right)).error).toBeNull(); };
const failMemory = async (f: Fixture) => { expect((await upsertAnswer(f.memory[0], f.memory[0].wrong)).error).toBeNull(); };
const refused = (result: { error: { code?: string } | null }) => expect(result.error?.code).toBe(RLS_VIOLATION);

// Cùng một trạng thái, ba câu trả lời: cổng SQL (thử ghi một câu probe rồi dọn), cổng TS và cờ D4 từ RPC.
async function gateStates(f: Fixture) {
  const attempt = await upsertAnswer(f.probe, f.probe.right);
  if (attempt.error) expect(attempt.error.code).toBe(RLS_VIOLATION);
  await service.from("user_question_answers").delete().eq("user_id", studentId).eq("question_id", f.probe.id);
  const sync = await learner.rpc("d4_sync_topic_progress", { p_topic_id: f.topicId });
  if (sync.error) throw sync.error;
  const progress = (Array.isArray(sync.data) ? sync.data[0] : sync.data) as { is_memory_check_passed: boolean };
  return {
    sql: attempt.error === null,
    ts: isMemoryCheckPassed(await loadMemoryCheck(learner, studentId, f.topicId)),
    d4: progress.is_memory_check_passed,
  };
}
const expectGate = async (f: Fixture, open: boolean) => expect(await gateStates(f)).toEqual({ sql: open, ts: open, d4: open });

async function signIn(email: string, fetchHook?: typeof fetch) {
  const client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { ...opts, ...(fetchHook ? { global: { fetch: fetchHook } } : {}) });
  const r = await client.auth.signInWithPassword({ email, password: "123123" });
  if (r.error) throw r.error;
  return client;
}

async function cleanup() {
  for (const f of fixtures.splice(0)) {
    const questionIds = [...f.memory.map((q) => q.id), f.exercise.id, f.probe.id];
    const extra = await service.from("questions").select("id").in("exercise_id", [f.exerciseId, ...(f.memoryExerciseId ? [f.memoryExerciseId] : [])]);
    const allQuestionIds = [...new Set([...questionIds, ...(extra.data ?? []).map((q) => q.id)])];
    const exerciseIds = [f.exerciseId, ...(f.memoryExerciseId ? [f.memoryExerciseId] : [])];
    for (const [table, column, ids] of [
      ["user_question_answers", "question_id", allQuestionIds], ["user_flashcards", "card_id", [f.cardId]],
      ["user_topic_progress", "topic_id", [f.topicId]], ["enrollments", "course_id", [f.courseId]],
      ["question_options", "question_id", allQuestionIds], ["questions", "id", allQuestionIds],
      ["exercises", "id", exerciseIds], ["cards", "id", [f.cardId]], ["topics", "id", [f.topicId]],
      ["chapters", "id", [f.chapterId]], ["course_collaborators", "course_id", [f.courseId]], ["courses", "id", [f.courseId]],
    ] as const) {
      const r = await service.from(table).delete().in(column, [...ids]);
      if (r.error) throw r.error;
    }
  }
}

describe.sequential("LF2 memory-check answer gate", () => {
  beforeAll(async () => {
    learner = await signIn("student@gmail.com");
    authenticated.client = learner;
  });
  afterEach(async () => {
    authenticated.client = learner;
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await learner?.auth.signOut();
  });

  it("refuses direct INSERT, UPDATE and upsert of an exercise answer while the memory check is not passed, then allows them", async () => {
    const f = await build();
    const { exercise } = f;
    await expectGate(f, false);

    refused(await insertAnswer(exercise, exercise.right));
    refused(await upsertAnswer(exercise, exercise.right));
    expect(await storedAnswer(exercise)).toBeNull();

    // Wrong memory answer vẫn khóa; câu memory luôn ghi được, kể cả khi đang khóa.
    expect((await insertAnswer(f.memory[0], f.memory[0].wrong)).error).toBeNull();
    await expectGate(f, false);
    refused(await insertAnswer(exercise, exercise.right));

    await passMemory(f);
    await expectGate(f, true);

    // Nhánh insert của upsert, rồi nhánh conflict và UPDATE trực tiếp khi dòng đã tồn tại.
    expect((await upsertAnswer(exercise, exercise.wrong)).error).toBeNull();
    expect(await storedAnswer(exercise)).toBe(exercise.wrong);
    expect((await upsertAnswer(exercise, exercise.right)).error).toBeNull();
    expect((await updateAnswer(exercise, exercise.wrong)).error).toBeNull();
    expect(await storedAnswer(exercise)).toBe(exercise.wrong);
    expect((await service.from("user_question_answers").delete().eq("user_id", studentId).eq("question_id", exercise.id)).error).toBeNull();
    expect((await insertAnswer(exercise, exercise.right)).error).toBeNull();
  });

  it("refuses UPDATE and the upsert conflict branch on an existing answer while locked and keeps the stored answer", async () => {
    const f = await build();
    await seedAnswer(f.exercise, f.exercise.right);
    await seedAnswer(f.memory[0], f.memory[0].wrong);
    await expectGate(f, false);

    refused(await updateAnswer(f.exercise, f.exercise.wrong));
    refused(await upsertAnswer(f.exercise, f.exercise.wrong));
    expect(await storedAnswer(f.exercise)).toBe(f.exercise.right);
  });

  it("does not block exercise answers in a topic without an active memory check question", async () => {
    const f = await build(0);
    await expectGate(f, true);
    expect((await insertAnswer(f.exercise, f.exercise.right)).error).toBeNull();
    expect((await updateAnswer(f.exercise, f.exercise.wrong)).error).toBeNull();
    expect((await upsertAnswer(f.exercise, f.exercise.right)).error).toBeNull();
  });

  it("relocks after a wrong memory answer, keeps the existing exercise answer readable and refuses new writes", async () => {
    const f = await build();
    await passMemory(f);
    expect((await upsertAnswer(f.exercise, f.exercise.right)).error).toBeNull();

    await failMemory(f);
    await expectGate(f, false);
    refused(await updateAnswer(f.exercise, f.exercise.wrong));
    refused(await upsertAnswer(f.exercise, f.exercise.wrong));
    const read = await learner.from("user_question_answers").select("selected_option_id").eq("question_id", f.exercise.id).single();
    expect(read.error).toBeNull();
    expect(read.data?.selected_option_id).toBe(f.exercise.right);

    await passMemory(f);
    await expectGate(f, true);
    expect((await updateAnswer(f.exercise, f.exercise.wrong)).error).toBeNull();
  });

  it("closes the gate after an answer-key change and reopens it after the learner re-answers", async () => {
    const f = await build();
    await passMemory(f);
    await expectGate(f, true);

    const [first] = f.memory;
    expect((await service.from("question_options").update({ is_correct: false }).eq("id", first.right)).error).toBeNull();
    expect((await service.from("question_options").update({ is_correct: true }).eq("id", first.wrong)).error).toBeNull();
    await expectGate(f, false);
    refused(await upsertAnswer(f.exercise, f.exercise.right));

    expect((await upsertAnswer(first, first.wrong)).error).toBeNull();
    await expectGate(f, true);
    expect((await upsertAnswer(f.exercise, f.exercise.right)).error).toBeNull();
  });

  it("closes the gate when a new memory check question is added", async () => {
    const f = await build();
    await passMemory(f);
    await expectGate(f, true);

    f.memory.push(await addQuestion(f.courseId, f.memoryExerciseId!, 9));
    await expectGate(f, false);
    refused(await upsertAnswer(f.exercise, f.exercise.right));

    expect((await upsertAnswer(f.memory[2], f.memory[2].right)).error).toBeNull();
    await expectGate(f, true);
  });

  it("stops requiring a memory question once it is removed, with the same result as D4", async () => {
    const f = await build();
    await passMemory(f);
    expect((await upsertAnswer(f.memory[1], f.memory[1].wrong)).error).toBeNull();
    await expectGate(f, false);

    expect((await service.from("questions").update({ removed_at: new Date().toISOString() }).eq("id", f.memory[1].id)).error).toBeNull();
    await expectGate(f, true);
    expect((await upsertAnswer(f.exercise, f.exercise.right)).error).toBeNull();
  });

  it("denies anon, other learners and unenrolled writes, and does not widen L1 or read access", async () => {
    const f = await build();
    await passMemory(f);
    const anon = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
    const anonWrite = await anon.from("user_question_answers").insert(row(f.exercise, f.exercise.right));
    expect(anonWrite.error).not.toBeNull();
    expect(await storedAnswer(f.exercise)).toBeNull();

    const forged = await learner.from("user_question_answers").insert({ ...row(f.exercise, f.exercise.right), user_id: teacherId });
    refused(forged);

    // Thu hồi enrollment: L1 từ chối dù cổng memory đang mở (FK/RLS của L1, không phải cổng LF2).
    expect((await service.from("enrollments").delete().eq("course_id", f.courseId).eq("user_id", studentId)).error).toBeNull();
    const unenrolled = await insertAnswer(f.exercise, f.exercise.right);
    expect(["23503", RLS_VIOLATION]).toContain(unenrolled.error?.code);
    expect(await storedAnswer(f.exercise)).toBeNull();
  });

  it("keeps the catalog contract: definer helper with empty search_path, no PUBLIC/anon grant, gate ANDed into L1 WITH CHECK", async () => {
    const helper = await waitForLocalPostgresQuery(
      `select p.prosecdef || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|' || pg_get_userbyid(p.proowner)
              || '|' || has_function_privilege('anon', p.oid, 'execute') || '|' || has_function_privilege('authenticated', p.oid, 'execute')
              || '|' || has_function_privilege('public', p.oid, 'execute')
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private' and p.proname = 'lf2_memory_gate_open'`,
      "LF2 helper catalog row",
    );
    expect(helper).toBe("true|search_path=\"\"|postgres|false|true|false");

    const policies = await waitForLocalPostgresQuery(
      `select string_agg(policyname || ':' || cmd || ':' || permissive || ':' || (with_check like '%lf2_memory_gate_open(question_id)%')::text
                         || ':' || coalesce(qual like '%lf2_memory_gate_open%', false)::text, ';' order by policyname)
         from pg_policies
        where schemaname = 'public' and tablename = 'user_question_answers' and cmd in ('INSERT', 'UPDATE', 'ALL')`,
      "answer policy catalog rows",
    );
    // Hai policy L1 cũ, vẫn PERMISSIVE, cổng chỉ nằm trong WITH CHECK; không có policy INSERT/UPDATE/ALL nào khác.
    expect(policies).toBe([
      "User_answers - Auth Insert:INSERT:PERMISSIVE:true:false",
      "User_answers - Auth Update:UPDATE:PERMISSIVE:true:false",
    ].join(";"));
  });

  // LF2 CP3: đường ghi của action đi qua RPC (xem lf2-learning-action-rpcs.test.ts cho race và thứ tự trạng thái);
  // ở đây chỉ khóa kết quả quan sát được của action với cổng MEMORY-002.
  describe("submitQuestionAnswer (AC5)", () => {
    it("returns MEMORY_CHECK_REQUIRED without writing while locked, and saves once the memory check is passed", async () => {
      const f = await build();

      const locked = await submitQuestionAnswer(f.exercise.id, f.exercise.right);
      expect(locked).toEqual({ error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.", errorCode: "MEMORY_CHECK_REQUIRED" });
      expect(JSON.stringify(locked)).not.toMatch(/row-level security|42501/);
      expect(await storedAnswer(f.exercise)).toBeNull();

      await passMemory(f);
      expect(await submitQuestionAnswer(f.exercise.id, f.exercise.right)).toMatchObject({ success: true, isCorrect: true });
      expect(await storedAnswer(f.exercise)).toBe(f.exercise.right);
    });

    it("lets a memory-check answer through while the topic is locked", async () => {
      const f = await build();

      const result = await submitQuestionAnswer(f.memory[0].id, f.memory[0].right);

      expect(result).toMatchObject({ success: true, isCorrect: true, isMemoryCheckPassed: false });
    });
  });
});
