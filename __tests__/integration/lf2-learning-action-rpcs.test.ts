import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { submitCardReview } from "@/app/actions/review";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { beginLocalPostgresTransaction, waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: LF2 CP3 - hai RPC `lf2_submit_question_answer` (definer) và `lf2_submit_card_review` (invoker) giữ nguyên
//   kết quả quan sát được của hai Server Action nhưng chỉ cần một round trip ghi (AC3, AC3a, AC5, G9-G11).
// - Loại: integration Data API/RLS + Server Action thật trên runtime E2E tách biệt; không mock database.
// - Thành công: ghi/đổi đáp án, chấm đúng/sai từ dòng đã ghi, giải thích thô, progress D4; ôn thẻ insert/update có progress.
// - Thất bại: thứ tự ưu tiên unavailable -> not_enrolled -> option_unavailable -> memory_locked; anon; câu không đọc được;
//   previewer/collaborator chưa enroll; profile đã xóa; cha bị rút/draft; option lạ hoặc đã gỡ; mọi ca policy từ chối cũng bị RPC từ chối.
// - Phân quyền: actor chỉ từ auth.uid(); dòng của người khác và dòng đã mất cho thẻ trả mutation_failed, không sync.
// - Resilience: relock, mất enrollment, đổi đáp án và gỡ option xảy ra giữa lúc phân loại và lúc ghi (barrier test-only trên
//   runtime tách biệt); sync lỗi hoặc bị hủy (57014) giữ nguyên dòng đã ghi và trả progress null.
// - Invariant: contract catalog (owner, definer/invoker, volatile, search_path, grants); số round trip của action.
// - Verify: xem số pass gần nhất trong progress.md (LF2 CP3).
// - Ghi chú: chạy bằng `npm run test:integration -- __tests__/integration/lf2-learning-action-rpcs.test.ts`;
//   cần ALLOW_DB_INTEGRATION_TESTS=true, API 45441, E2E_SUPABASE_WORKDIR=.e2e-runtime và psql.
//   Override test-only (barrier và lỗi sync) được cài/gỡ bằng DDL trên chính runtime tách biệt, luôn gỡ ở afterEach/afterAll.

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

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const studentId = "33333333-3333-4333-8333-333333333333";
const teacherId = "22222222-2222-4222-8222-222222222222";
const BARRIER_KEY = 424201;

type Q = { id: string; right: string; wrong: string };
type Fixture = {
  courseId: string; chapterId: string; topicId: string; cardId: string;
  memoryExerciseId: string | null; exerciseId: string; groupId: string;
  memory: Q[]; exercise: Q; grouped: Q;
};
type Status = { status: string; [key: string]: unknown };

let learner: SupabaseClient;
let teacher: SupabaseClient;
let counting: SupabaseClient;
const sentRequests: string[] = [];
const fixtures: Fixture[] = [];
const extraUsers: string[] = [];

async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const r = await service.from(table).insert(rows as never);
  if (r.error) throw new Error(`${table}: ${r.error.message}`);
}

async function addQuestion(f: { courseId: string }, exerciseId: string, order: number, groupId: string | null = null): Promise<Q> {
  const q: Q = { id: randomUUID(), right: randomUUID(), wrong: randomUUID() };
  await insert("questions", {
    id: q.id, exercise_id: exerciseId, course_id: f.courseId, content: `LF2 ${order}`, explanation: "Giải thích gốc",
    order_index: order, ...(groupId ? { group_id: groupId } : {}),
  });
  await insert("question_options", [
    { id: q.right, question_id: q.id, content: "đúng", label: "A", is_correct: true, order_index: 0 },
    { id: q.wrong, question_id: q.id, content: "sai", label: "B", is_correct: false, order_index: 1 },
  ]);
  return q;
}

async function build(memoryCount = 2): Promise<Fixture> {
  const f: Fixture = {
    courseId: randomUUID(), chapterId: randomUUID(), topicId: randomUUID(), cardId: randomUUID(),
    memoryExerciseId: memoryCount > 0 ? randomUUID() : null, exerciseId: randomUUID(), groupId: randomUUID(),
    memory: [], exercise: null as unknown as Q, grouped: null as unknown as Q,
  };
  await insert("courses", { id: f.courseId, title: "LF2 rpc", slug: `lf2-rpc-${f.courseId}`, price: 0, status: "published" });
  fixtures.push(f);
  await insert("course_collaborators", { course_id: f.courseId, user_id: teacherId, role: "owner", added_by: teacherId });
  await insert("chapters", { id: f.chapterId, course_id: f.courseId, title: "LF2", created_by_user_id: teacherId, order_index: 0 });
  await insert("topics", {
    id: f.topicId, course_id: f.courseId, chapter_id: f.chapterId, title: "LF2", slug: `lf2-rpc-${f.topicId}`,
    status: "published", first_approved_at: new Date().toISOString(), order_index: 0,
    original_creator_user_id: teacherId, responsible_author_user_id: teacherId,
  });
  await insert("cards", { id: f.cardId, topic_id: f.topicId, front_content: { word: "rpc" }, back_content: { translation: "rpc" } });
  if (f.memoryExerciseId) {
    await insert("exercises", {
      id: f.memoryExerciseId, topic_id: f.topicId, course_id: f.courseId, title: "Memory",
      part_type: null, activity_stage: "memory_check", order_index: 0,
    });
    for (let order = 0; order < memoryCount; order += 1) f.memory.push(await addQuestion(f, f.memoryExerciseId, order));
  }
  await insert("exercises", {
    id: f.exerciseId, topic_id: f.topicId, course_id: f.courseId, title: "Part 6",
    part_type: "part6", activity_stage: "exercise", order_index: 1,
  });
  await insert("question_groups", { id: f.groupId, exercise_id: f.exerciseId, passage_text: "Passage", order_index: 0 });
  f.exercise = await addQuestion(f, f.exerciseId, 0);
  f.grouped = await addQuestion(f, f.exerciseId, 1, f.groupId);
  await insert("enrollments", { course_id: f.courseId, user_id: studentId });
  return f;
}

async function cleanup() {
  for (const f of fixtures.splice(0)) {
    const exerciseIds = [f.exerciseId, ...(f.memoryExerciseId ? [f.memoryExerciseId] : [])];
    const found = await service.from("questions").select("id").in("exercise_id", exerciseIds);
    const questionIds = (found.data ?? []).map((q) => q.id);
    for (const [table, column, ids] of [
      ["user_question_answers", "question_id", questionIds], ["user_flashcards", "card_id", [f.cardId]],
      ["user_topic_progress", "topic_id", [f.topicId]], ["enrollments", "course_id", [f.courseId]],
      ["question_options", "question_id", questionIds], ["questions", "id", questionIds],
      ["question_groups", "id", [f.groupId]], ["exercises", "id", exerciseIds], ["cards", "id", [f.cardId]],
      ["topics", "id", [f.topicId]], ["chapters", "id", [f.chapterId]],
      ["course_collaborators", "course_id", [f.courseId]], ["courses", "id", [f.courseId]],
    ] as const) {
      const r = await service.from(table).delete().in(column, [...ids]);
      if (r.error) throw r.error;
    }
  }
}

const rpcAnswer = async (client: SupabaseClient, q: Q, option: string) => {
  const r = await client.rpc("lf2_submit_question_answer", { p_question_id: q.id, p_selected_option_id: option });
  if (r.error) throw new Error(`answer rpc error: ${r.error.message}`);
  return r.data as Status;
};
const statusOf = async (q: Q, option: string, client = learner) => (await rpcAnswer(client, q, option)).status;
const storedAnswer = async (q: Q, user = studentId) => {
  const r = await service.from("user_question_answers").select("id, selected_option_id, is_correct, updated_at")
    .eq("user_id", user).eq("question_id", q.id);
  if (r.error) throw r.error;
  return r.data[0] ?? null;
};
const passMemory = async (f: Fixture) => {
  for (const q of f.memory) expect((await rpcAnswer(learner, q, q.right)).status).toBe("ok");
};
const setMemoryWrong = async (f: Fixture) => {
  const r = await service.from("user_question_answers").update({ selected_option_id: f.memory[0].wrong })
    .eq("user_id", studentId).eq("question_id", f.memory[0].id);
  if (r.error) throw r.error;
};
const patch = async (table: string, id: string, values: Record<string, unknown>) => {
  const r = await service.from(table).update(values).eq("id", id);
  if (r.error) throw r.error;
};
const gone = () => new Date().toISOString();

async function signIn(email: string, global?: { fetch: typeof fetch }) {
  const client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { ...opts, ...(global ? { global } : {}) });
  const r = await client.auth.signInWithPassword({ email, password: "123123" });
  if (r.error) throw r.error;
  return client;
}

async function psql(sql: string) {
  await waitForLocalPostgresQuery(`${sql}; select 'done'`, "test-only database override");
}

// Barrier test-only: bọc hàm phân loại để RPC dừng NGAY SAU lần phân loại đầu, trước câu ghi, tới khi test nhả khóa.
async function installBarrier() {
  await psql(`
    alter function private.lf2_answer_precheck(uuid, uuid) rename to lf2_answer_precheck_real;
    create function private.lf2_answer_precheck(p_question_id uuid, p_option_id uuid)
    returns table (o_status text, o_topic_id uuid, o_explanation text, o_is_memory boolean)
    language plpgsql volatile security definer set search_path = ''
    as $f$ begin
      return query select * from private.lf2_answer_precheck_real(p_question_id, p_option_id);
      perform pg_advisory_xact_lock(${BARRIER_KEY});
    end $f$`);
}

// Thay đồng bộ D4 bằng bản lỗi hoặc bị hủy (SQLSTATE 57014) để thử G11 trên chính RPC.
async function installFailingSync(mode: "error" | "cancel" | "invalid") {
  const body = mode === "error"
    ? "raise exception 'LF2_TEST_SYNC_FAILURE'"
    : mode === "cancel"
      ? "raise exception 'canceling statement due to statement timeout' using errcode = '57014'"
      : "return '{\"unexpected\": true}'::jsonb";
  await psql(`
    alter function public.d4_sync_topic_progress(uuid) rename to d4_sync_topic_progress_real;
    create function public.d4_sync_topic_progress(p_topic_id uuid) returns jsonb
    language plpgsql volatile security definer set search_path = ''
    as $f$ begin ${body}; end $f$;
    revoke all on function public.d4_sync_topic_progress(uuid) from public, anon;
    grant execute on function public.d4_sync_topic_progress(uuid) to authenticated`);
}

async function removeOverrides() {
  await psql(`
    do $f$ begin
      if to_regprocedure('private.lf2_answer_precheck_real(uuid,uuid)') is not null then
        drop function private.lf2_answer_precheck(uuid, uuid);
        alter function private.lf2_answer_precheck_real(uuid, uuid) rename to lf2_answer_precheck;
      end if;
      if to_regprocedure('public.d4_sync_topic_progress_real(uuid)') is not null then
        drop function public.d4_sync_topic_progress(uuid);
        alter function public.d4_sync_topic_progress_real(uuid) rename to d4_sync_topic_progress;
      end if;
    end $f$`);
}

// Chạy RPC trả lời, giữ nó tại barrier, áp dụng thay đổi đã commit rồi nhả barrier.
async function raceAnswer(q: Q, option: string, commitBetween: () => Promise<void>) {
  await installBarrier();
  const holder = await beginLocalPostgresTransaction(
    `begin; select pg_advisory_xact_lock(${BARRIER_KEY}); select 'ready' || pg_backend_pid();`, "ready",
  );
  try {
    const pending = rpcAnswer(learner, q, option);
    await waitForLocalPostgresQuery(
      `select 'blocked' from pg_locks where locktype = 'advisory' and objid = ${BARRIER_KEY} and not granted limit 1`,
      "answer RPC waiting at the barrier",
    );
    await commitBetween();
    await holder.finish("ROLLBACK");
    return await pending;
  } catch (error) {
    await holder.finish("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await removeOverrides();
  }
}

const cardArgs = (f: Fixture, existingId: string | null = null, rating = 3) => ({
  p_card_id: f.cardId, p_user_flashcard_id: existingId, p_next_review_date: new Date(Date.now() + 86_400_000).toISOString(),
  p_fsrs_meta: { reps: 1, state: 2 }, p_last_rating: rating, p_updated_at: new Date().toISOString(),
});
const rpcCard = async (client: SupabaseClient, args: ReturnType<typeof cardArgs>) => client.rpc("lf2_submit_card_review", args);
const storedCard = async (f: Fixture, user = studentId) => {
  const r = await service.from("user_flashcards").select("id, last_rating, fsrs_meta").eq("user_id", user).eq("card_id", f.cardId);
  if (r.error) throw r.error;
  return r.data[0] ?? null;
};
const storedProgress = async (f: Fixture, user = studentId) => {
  const r = await service.from("user_topic_progress").select("id").eq("user_id", user).eq("topic_id", f.topicId);
  if (r.error) throw r.error;
  return r.data;
};

describe.sequential("LF2 learning action RPCs", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    await removeOverrides();
    learner = await signIn("student@gmail.com");
    teacher = await signIn("teacher@gmail.com");
    counting = await signIn("student@gmail.com", {
      fetch: (input, init) => {
        const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        sentRequests.push(`${init?.method ?? "GET"} ${new URL(href).pathname}`);
        return fetch(input, init);
      },
    });
    authenticated.client = learner;
  });
  afterEach(async () => {
    await removeOverrides();
    authenticated.client = learner;
    sentRequests.length = 0;
    vi.restoreAllMocks();
    await cleanup();
  });
  afterAll(async () => {
    await removeOverrides();
    await cleanup();
    for (const id of extraUsers.splice(0)) await service.auth.admin.deleteUser(id);
    await Promise.all([learner, teacher, counting].map((c) => c?.auth.signOut()));
  });

  describe("answer RPC statuses", () => {
    it("returns the status of the first failing check in the action precedence order", async () => {
      const f = await build();
      const foreignOption = f.grouped.right;

      // Mọi điều kiện cùng hỏng: unavailable thắng, rồi lần lượt not_enrolled, option, memory gate.
      await patch("questions", f.exercise.id, { removed_at: gone() });
      expect(await statusOf(f.exercise, foreignOption)).toBe("unavailable");
      await patch("questions", f.exercise.id, { removed_at: null });

      // Người đọc được nhưng chưa enroll (collaborator): not_enrolled thắng option sai và memory gate khóa.
      expect(await statusOf(f.exercise, foreignOption, teacher)).toBe("not_enrolled");

      // Option lạ thắng memory gate khóa.
      expect(await statusOf(f.exercise, foreignOption)).toBe("option_unavailable");
      expect(await statusOf(f.exercise, f.exercise.right)).toBe("memory_locked");

      // Câu memory check luôn ghi được dù cổng khóa; qua cổng thì exercise ghi được.
      expect(await statusOf(f.memory[0], f.memory[0].right)).toBe("ok");
      expect(await statusOf(f.exercise, f.exercise.right)).toBe("memory_locked");
      expect(await statusOf(f.memory[1], f.memory[1].right)).toBe("ok");
      expect(await statusOf(f.exercise, f.exercise.right)).toBe("ok");
    });

    it("denies anon and a null actor, and never writes", async () => {
      const f = await build();
      const anon = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
      const denied = await anon.rpc("lf2_submit_question_answer", { p_question_id: f.memory[0].id, p_selected_option_id: f.memory[0].right });
      expect(denied.error?.code).toBe("42501");
      expect(await storedAnswer(f.memory[0])).toBeNull();
    });

    it("reports unavailable to a learner who cannot read the question, as the action does today", async () => {
      const f = await build();
      expect((await service.from("enrollments").delete().eq("course_id", f.courseId).eq("user_id", studentId)).error).toBeNull();
      expect(await statusOf(f.memory[0], f.memory[0].right)).toBe("unavailable");

      await insert("enrollments", { course_id: f.courseId, user_id: studentId });
      await patch("topics", f.topicId, { status: "draft" });
      expect(await statusOf(f.memory[0], f.memory[0].right)).toBe("unavailable");
      await patch("topics", f.topicId, { status: "published" });
      expect(await statusOf(f.memory[0], f.memory[0].right)).toBe("ok");
    });

    it.each([
      ["a removed chapter", (f: Fixture) => patch("chapters", f.chapterId, { removed_at: gone() })],
      ["a removed topic", (f: Fixture) => patch("topics", f.topicId, { removed_at: gone() })],
      ["a removed exercise", (f: Fixture) => patch("exercises", f.exerciseId, { removed_at: gone() })],
      ["a removed question", (f: Fixture) => patch("questions", f.exercise.id, { removed_at: gone() })],
    ])("reports unavailable for %s", async (_name, change) => {
      const f = await build(0);
      await change(f);
      expect(await statusOf(f.exercise, f.exercise.right)).toBe("unavailable");
      expect(await storedAnswer(f.exercise)).toBeNull();
    });

    it("reports unavailable for a learner whose profile was removed", async () => {
      const f = await build(0);
      const userId = randomUUID();
      const email = `lf2-removed-${userId}@example.com`;
      extraUsers.push(userId);
      expect((await service.auth.admin.createUser({ id: userId, email, password: "123123", email_confirm: true })).error).toBeNull();
      expect((await service.from("profiles").upsert({
        id: userId, email, full_name: "LF2 Removed", username: `lf2_${userId.slice(0, 8)}`, role: "student", removed_at: null,
      })).error).toBeNull();
      await insert("enrollments", { course_id: f.courseId, user_id: userId });
      const client = await signIn(email);
      expect(await statusOf(f.exercise, f.exercise.right, client)).toBe("ok");

      expect((await service.from("profiles").update({ removed_at: gone() }).eq("id", userId)).error).toBeNull();
      expect(await statusOf(f.exercise, f.exercise.wrong, client)).toBe("unavailable");
      expect((await storedAnswer(f.exercise, userId))?.selected_option_id).toBe(f.exercise.right);
      await client.auth.signOut();
    });

    it("reports option_unavailable for a foreign or removed option and writes nothing", async () => {
      const f = await build(0);
      expect(await statusOf(f.exercise, f.grouped.right)).toBe("option_unavailable");
      await patch("question_options", f.exercise.wrong, { removed_at: gone() });
      expect(await statusOf(f.exercise, f.exercise.wrong)).toBe("option_unavailable");
      expect(await storedAnswer(f.exercise)).toBeNull();
    });

    it("reports save_failed, never success, when only the write conditions refuse (removed question group)", async () => {
      const f = await build(0);
      expect(await statusOf(f.grouped, f.grouped.right)).toBe("ok");
      await patch("question_groups", f.groupId, { removed_at: gone() });
      const result = await rpcAnswer(learner, f.grouped, f.grouped.wrong);
      expect(result).toEqual({ status: "save_failed" });
      expect((await storedAnswer(f.grouped))?.selected_option_id).toBe(f.grouped.right);
    });
  });

  describe("answer RPC parity with the L1 and MEMORY-002 policies", () => {
    it.each([
      ["a locked memory check", async (f: Fixture) => { await setMemoryWrongOrAnswer(f); }, "memory_locked"],
      ["a draft topic", async (f: Fixture) => { await patch("topics", f.topicId, { status: "draft" }); }, "unavailable"],
      ["a removed question group", async (f: Fixture) => { await patch("question_groups", f.groupId, { removed_at: gone() }); }, "save_failed"],
      ["a lost enrollment", async (f: Fixture) => { await service.from("enrollments").delete().eq("course_id", f.courseId); }, "unavailable"],
    ])("refuses through the RPC exactly when the Data API refuses (%s)", async (_name, close, expected) => {
      const f = await build();
      const target = expected === "save_failed" ? f.grouped : f.exercise;
      if (expected !== "memory_locked") await passMemory(f);
      await close(f);

      const direct = await learner.from("user_question_answers").upsert(
        { user_id: studentId, question_id: target.id, selected_option_id: target.right, is_correct: false },
        { onConflict: "user_id,question_id" },
      ).select("id").single();
      expect(["42501", "23503"]).toContain(direct.error?.code);
      expect(await statusOf(target, target.right)).toBe(expected);
      expect(await storedAnswer(target)).toBeNull();
    });

    it("writes only what the policies allow once everything is open, and keeps one row per user and question", async () => {
      const f = await build();
      await passMemory(f);
      const first = await rpcAnswer(learner, f.exercise, f.exercise.wrong);
      const firstRow = await storedAnswer(f.exercise);
      const second = await rpcAnswer(learner, f.exercise, f.exercise.right);
      const secondRow = await storedAnswer(f.exercise);

      expect(first).toMatchObject({ status: "ok", is_correct: false, explanation: "Giải thích gốc", is_memory_check: false });
      expect(second).toMatchObject({ status: "ok", is_correct: true });
      expect(firstRow?.is_correct).toBe(false);
      expect(secondRow).toMatchObject({ id: firstRow?.id, selected_option_id: f.exercise.right, is_correct: true });
      expect(new Date(secondRow!.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(firstRow!.updated_at).getTime());
    });
  });

  describe("answer RPC grading and progress", () => {
    it("grades from the written row, follows the current answer key and returns the raw explanation and progress", async () => {
      const f = await build();
      await passMemory(f);

      const wrong = await rpcAnswer(learner, f.exercise, f.exercise.wrong);
      expect(wrong).toMatchObject({ status: "ok", is_correct: false, memory_check_passed: null });
      expect(wrong.progress).toMatchObject({ is_memory_check_passed: true, is_exercise_completed: false });

      expect((await service.from("question_options").update({ is_correct: true }).eq("id", f.exercise.wrong)).error).toBeNull();
      const flipped = await rpcAnswer(learner, f.exercise, f.exercise.wrong);
      expect(flipped).toMatchObject({ status: "ok", is_correct: true });
      expect((await storedAnswer(f.exercise))?.is_correct).toBe(true);
    });

    it("returns the memory status from the sync for a memory answer, and null for an exercise answer", async () => {
      const f = await build();
      const wrong = await rpcAnswer(learner, f.memory[0], f.memory[0].wrong);
      expect(wrong).toMatchObject({ status: "ok", is_correct: false, is_memory_check: true, memory_check_passed: false });
      const right = await rpcAnswer(learner, f.memory[0], f.memory[0].right);
      expect(right).toMatchObject({ is_correct: true, memory_check_passed: false });
      const last = await rpcAnswer(learner, f.memory[1], f.memory[1].right);
      expect(last).toMatchObject({ is_correct: true, memory_check_passed: true });
      expect(last.progress).toMatchObject({ is_memory_check_passed: true });
    });
  });

  describe("answer RPC races between the classification and the write", () => {
    it("refuses when the memory check relocks in between and leaves no exercise answer", async () => {
      const f = await build();
      await passMemory(f);
      const result = await raceAnswer(f.exercise, f.exercise.right, () => setMemoryWrong(f));
      expect(result).toEqual({ status: "memory_locked" });
      expect(await storedAnswer(f.exercise)).toBeNull();
    });

    it("keeps the existing exercise answer when a relock lands before the conflict branch", async () => {
      const f = await build();
      await passMemory(f);
      expect((await rpcAnswer(learner, f.exercise, f.exercise.right)).status).toBe("ok");
      const result = await raceAnswer(f.exercise, f.exercise.wrong, () => setMemoryWrong(f));
      expect(result).toEqual({ status: "memory_locked" });
      expect((await storedAnswer(f.exercise))?.selected_option_id).toBe(f.exercise.right);
    });

    it("refuses when the enrollment is deleted in between", async () => {
      const f = await build(0);
      const result = await raceAnswer(f.exercise, f.exercise.right, async () => {
        expect((await service.from("enrollments").delete().eq("course_id", f.courseId).eq("user_id", studentId)).error).toBeNull();
      });
      expect(["not_enrolled", "unavailable"]).toContain(result.status);
      expect(await storedAnswer(f.exercise)).toBeNull();
    });

    it("refuses when the selected option is removed in between", async () => {
      const f = await build(0);
      const result = await raceAnswer(f.exercise, f.exercise.right, () => patch("question_options", f.exercise.right, { removed_at: gone() }));
      expect(result).toEqual({ status: "option_unavailable" });
      expect(await storedAnswer(f.exercise)).toBeNull();
    });

    it("grades against the answer key that is current at the write when the key changes in between", async () => {
      const f = await build(0);
      const result = await raceAnswer(f.exercise, f.exercise.right, async () => {
        expect((await service.from("question_options").update({ is_correct: false }).eq("id", f.exercise.right)).error).toBeNull();
        expect((await service.from("question_options").update({ is_correct: true }).eq("id", f.exercise.wrong)).error).toBeNull();
      });
      expect(result).toMatchObject({ status: "ok", is_correct: false });
      expect((await storedAnswer(f.exercise))?.is_correct).toBe(false);
    });
  });

  describe("answer RPC sync failures keep the saved write (G11)", () => {
    it.each([["error"], ["cancel"]] as const)("keeps the answer and returns null progress when the sync %s", async (mode) => {
      const f = await build(0);
      await installFailingSync(mode);
      const result = await rpcAnswer(learner, f.exercise, f.exercise.right);
      expect(result).toMatchObject({ status: "ok", is_correct: true, progress: null, memory_check_passed: null });
      expect((await storedAnswer(f.exercise))?.selected_option_id).toBe(f.exercise.right);
    });

    it("derives the memory status from the same definition when the sync fails for a memory answer", async () => {
      const f = await build();
      await installFailingSync("cancel");
      const first = await rpcAnswer(learner, f.memory[0], f.memory[0].right);
      const last = await rpcAnswer(learner, f.memory[1], f.memory[1].right);
      expect(first).toMatchObject({ status: "ok", progress: null, memory_check_passed: false });
      expect(last).toMatchObject({ status: "ok", progress: null, memory_check_passed: true });
    });

    it("lets the action report success with progressError and the derived memory status", async () => {
      const f = await build();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await installFailingSync("error");
      await submitQuestionAnswer(f.memory[0].id, f.memory[0].right);
      const result = await submitQuestionAnswer(f.memory[1].id, f.memory[1].right);
      expect(result).toMatchObject({
        success: true, isCorrect: true, isMemoryCheckPassed: true,
        progressError: "Đáp án đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
      });
      expect(result).not.toHaveProperty("topicProgress");
    });

    it("treats a malformed sync payload as missing progress while keeping the answer", async () => {
      const f = await build();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await installFailingSync("invalid");
      const result = await submitQuestionAnswer(f.memory[0].id, f.memory[0].right);
      expect(result).toMatchObject({ success: true, isCorrect: true, isMemoryCheckPassed: false });
      expect(result).toHaveProperty("progressError");
      expect(result).not.toHaveProperty("topicProgress");
    });
  });

  describe("card RPC under RLS", () => {
    it("inserts then updates the learner's own row and returns the D4 progress", async () => {
      const f = await build(0);
      const created = await rpcCard(learner, cardArgs(f, null, 3));
      expect(created.error).toBeNull();
      expect(created.data).toMatchObject({ status: "ok", progress: { is_flashcard_completed: true } });
      const row = await storedCard(f);
      expect(row).toMatchObject({ last_rating: 3 });

      const updated = await rpcCard(learner, cardArgs(f, row!.id, 1));
      expect(updated.data).toMatchObject({ status: "ok", progress: { is_flashcard_completed: false } });
      expect(await storedCard(f)).toMatchObject({ id: row!.id, last_rating: 1 });
    });

    it("reports mutation_failed without a sync for another user's row and leaves that row untouched", async () => {
      const f = await build(0);
      const foreign = await service.from("user_flashcards").insert({
        user_id: teacherId, card_id: f.cardId, next_review_date: gone(), fsrs_meta: { reps: 9 }, last_rating: 4,
      }).select("id").single();
      expect(foreign.error).toBeNull();

      const result = await rpcCard(learner, cardArgs(f, foreign.data!.id, 1));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "mutation_failed" });
      expect(await storedCard(f, teacherId)).toMatchObject({ last_rating: 4, fsrs_meta: { reps: 9 } });
      expect(await storedCard(f)).toBeNull();
      expect(await storedProgress(f)).toEqual([]);
    });

    it("reports mutation_failed without a sync when the row was deleted before the update", async () => {
      const f = await build(0);
      expect((await rpcCard(learner, cardArgs(f, null))).error).toBeNull();
      const row = await storedCard(f);
      expect((await service.from("user_flashcards").delete().eq("id", row!.id)).error).toBeNull();
      expect((await service.from("user_topic_progress").delete().eq("topic_id", f.topicId)).error).toBeNull();

      const result = await rpcCard(learner, cardArgs(f, row!.id, 2));
      expect(result.data).toEqual({ status: "mutation_failed" });
      expect(await storedCard(f)).toBeNull();
      expect(await storedProgress(f)).toEqual([]);
    });

    it("keeps RLS authoritative: unenrolled and anon callers are refused and write nothing", async () => {
      const f = await build(0);
      expect((await service.from("enrollments").delete().eq("course_id", f.courseId).eq("user_id", studentId)).error).toBeNull();
      const refused = await rpcCard(learner, cardArgs(f));
      expect(refused.error?.code).toBe("42501");
      const anon = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
      expect((await rpcCard(anon, cardArgs(f))).error?.code).toBe("42501");
      expect(await storedCard(f)).toBeNull();
    });

    it.each([["error"], ["cancel"]] as const)("keeps the review and returns null progress when the sync %s", async (mode) => {
      const f = await build(0);
      await installFailingSync(mode);
      const result = await rpcCard(learner, cardArgs(f, null, 4));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "ok", progress: null });
      expect(await storedCard(f)).toMatchObject({ last_rating: 4 });
    });

    it("lets the action keep a saved review successful when the sync fails", async () => {
      const f = await build(0);
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await installFailingSync("cancel");
      const result = await submitCardReview(f.cardId, 3);
      expect(result).toEqual({ success: true, progressError: "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học." });
      expect(await storedCard(f)).toMatchObject({ last_rating: 3 });
    });
  });

  describe("actions", () => {
    it("takes three sequential round trips for a card rating and two for an answer", async () => {
      const f = await build(0);
      authenticated.client = counting;

      sentRequests.length = 0;
      expect(await submitCardReview(f.cardId, 3)).toMatchObject({ success: true });
      expect(sentRequests).toEqual(["GET /auth/v1/user", "GET /rest/v1/cards", "POST /rest/v1/rpc/lf2_submit_card_review"]);

      sentRequests.length = 0;
      expect(await submitCardReview(f.cardId, 4)).toMatchObject({ success: true });
      expect(sentRequests).toEqual(["GET /auth/v1/user", "GET /rest/v1/cards", "POST /rest/v1/rpc/lf2_submit_card_review"]);

      sentRequests.length = 0;
      expect(await submitQuestionAnswer(f.exercise.id, f.exercise.right)).toMatchObject({ success: true, isCorrect: true });
      expect(sentRequests).toEqual(["GET /auth/v1/user", "POST /rest/v1/rpc/lf2_submit_question_answer"]);
    });

    it("maps every answer status to today's message and error code", async () => {
      const f = await build();
      expect(await submitQuestionAnswer(f.exercise.id, f.exercise.right)).toEqual({
        error: "Bạn cần trả lời đúng hết memory check trước khi làm bài tập.", errorCode: "MEMORY_CHECK_REQUIRED",
      });
      expect(await submitQuestionAnswer(f.exercise.id, f.grouped.right)).toEqual({ error: "Đáp án không khả dụng." });
      expect(await submitQuestionAnswer(randomUUID(), f.exercise.right)).toEqual({ error: "Câu hỏi không khả dụng." });
      authenticated.client = teacher;
      expect(await submitQuestionAnswer(f.exercise.id, f.exercise.right)).toEqual({ error: "Bạn cần ghi danh khóa học để lưu câu trả lời." });
    });

    it("tells a collaborator who is not enrolled to enroll, without writing, through the enrollment fallback", async () => {
      const f = await build(0);
      authenticated.client = teacher;
      expect(await submitCardReview(f.cardId, 3)).toEqual({ error: "Bạn cần ghi danh khóa học để lưu ôn tập." });
      expect(await storedCard(f, teacherId)).toBeNull();
    });
  });

  it("keeps the catalog contract: owner, security mode, volatility, search_path and grants", async () => {
    const row = (name: string, schema: string) => waitForLocalPostgresQuery(
      `select pg_get_userbyid(p.proowner) || '|' || p.prosecdef::text || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '')
              || '|' || has_function_privilege('anon', p.oid, 'execute')::text || '|' || has_function_privilege('authenticated', p.oid, 'execute')::text
              || '|' || has_function_privilege('public', p.oid, 'execute')::text
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = '${schema}' and p.proname = '${name}'`,
      `${schema}.${name} catalog row`,
    );
    expect(await row("lf2_submit_question_answer", "public")).toBe('postgres|true|v|search_path=""|false|true|false');
    expect(await row("lf2_submit_card_review", "public")).toBe('postgres|false|v|search_path=""|false|true|false');
    expect(await row("lf2_answer_precheck", "private")).toBe('postgres|true|v|search_path=""|false|false|false');
  });
});

// Nhánh "memory_locked" của bảng parity: ghi một câu memory sai để khóa cổng (chưa có câu nào đúng).
async function setMemoryWrongOrAnswer(f: Fixture) {
  const r = await learner.from("user_question_answers").upsert(
    { user_id: studentId, question_id: f.memory[0].id, selected_option_id: f.memory[0].wrong, is_correct: false },
    { onConflict: "user_id,question_id" },
  );
  if (r.error) throw r.error;
}
