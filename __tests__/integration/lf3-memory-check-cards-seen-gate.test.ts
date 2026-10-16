import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { beginLocalPostgresTransaction, waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: LF9 thay cổng LF3 bằng latest Good/Easy lần đầu, sau đó giữ tập thẻ đã đạt và khóa lại cho thẻ mới.
// - Loại: integration Data API/RLS + RPC + Server Action thật trên API 45441; không mock database.
// - Thành công: các nhánh answer INSERT/UPDATE/upsert/RPC mở đồng nhất; ghi nhận bền sau downgrade/reload, thẻ mới đạt riêng, gỡ/khôi phục thẻ.
// - Thất bại: Again/Hard lần đầu, thẻ mới chưa đạt, rating rollback, giả mạo marker và user khác đều không mở cổng.
// - Phân quyền: learner/admin chỉ dùng achievement của chính mình; private capture không callable; policy/grants LF2/L1 giữ nguyên.
// - Resilience: rating đồng thời và direct downgrade phải cùng khóa progress; sync lỗi không mất capture; thẻ mới chen giữa precheck và ghi thì hai nhánh đều từ chối.
// - Nâng cấp: chạy đúng đoạn backfill migration trên fixture legacy; chỉ trường hợp Owner chấp nhận được giữ, không sửa câu trả lời/điểm/hoàn thành.
// - Verify: kết quả LF9 hiện hành nằm trong State của progress.md; dùng focused integration command tại đó.
// - DDL lỗi sync và barrier chỉ ở runtime tách biệt, luôn khôi phục bằng finally/afterEach; không hosted.

const authenticated = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => authenticated.client }));

const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const runtimeUrl = new URL(api);
if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true"
  || process.env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" || runtimeUrl.protocol !== "http:"
  || !["127.0.0.1", "localhost"].includes(runtimeUrl.hostname) || runtimeUrl.port !== "45441") {
  throw new Error("LF3 integration requires the explicitly enabled isolated E2E runtime on port 45441");
}

const RLS_VIOLATION = "42501";
const BARRIER_KEY = 424301;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const studentId = "33333333-3333-4333-8333-333333333333";
const teacherId = "22222222-2222-4222-8222-222222222222";
const adminId = "11111111-1111-4111-8111-111111111111";

type Q = { id: string; right: string; wrong: string };
type Fixture = {
  courseId: string; courseSlug: string; chapterId: string; topicId: string; topicSlug: string; cardIds: string[];
  memoryExerciseId: string; exerciseId: string; memory: Q[]; probe: Q; exercise: Q;
};
type Status = { status: string; [key: string]: unknown };

let learner: SupabaseClient;
let teacher: SupabaseClient;
let admin: SupabaseClient;
const fixtures: Fixture[] = [];

async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const r = await service.from(table).insert(rows as never);
  if (r.error) throw new Error(`${table}: ${r.error.message}`);
}

async function addQuestion(courseId: string, exerciseId: string, order: number): Promise<Q> {
  const q: Q = { id: randomUUID(), right: randomUUID(), wrong: randomUUID() };
  await insert("questions", { id: q.id, exercise_id: exerciseId, course_id: courseId, content: `LF3 ${order}`, order_index: order });
  await insert("question_options", [
    { id: q.right, question_id: q.id, content: "đúng", label: "A", is_correct: true, order_index: 0 },
    { id: q.wrong, question_id: q.id, content: "sai", label: "B", is_correct: false, order_index: 1 },
  ]);
  return q;
}

async function addCard(f: Fixture) {
  const id = randomUUID();
  await insert("cards", { id, topic_id: f.topicId, front_content: { word: `w-${id}` }, back_content: { translation: "nghĩa" } });
  f.cardIds.push(id);
  return id;
}

async function build(cardCount = 2, enrolled: string[] = [studentId]): Promise<Fixture> {
  const f: Fixture = {
    courseId: randomUUID(), courseSlug: "", chapterId: randomUUID(), topicId: randomUUID(), topicSlug: "", cardIds: [],
    memoryExerciseId: randomUUID(), exerciseId: randomUUID(), memory: [], probe: null as unknown as Q, exercise: null as unknown as Q,
  };
  f.courseSlug = `lf3-cards-${f.courseId}`;
  f.topicSlug = `lf3-cards-topic-${f.topicId}`;
  await insert("courses", { id: f.courseId, title: "LF3 cards gate", slug: f.courseSlug, price: 0, status: "published" });
  fixtures.push(f);
  await insert("course_collaborators", { course_id: f.courseId, user_id: teacherId, role: "owner", added_by: teacherId });
  await insert("chapters", { id: f.chapterId, course_id: f.courseId, title: "LF3", created_by_user_id: teacherId, order_index: 0 });
  await insert("topics", {
    id: f.topicId, course_id: f.courseId, chapter_id: f.chapterId, title: "LF3", slug: f.topicSlug,
    status: "published", first_approved_at: new Date().toISOString(), order_index: 0,
    original_creator_user_id: teacherId, responsible_author_user_id: teacherId,
  });
  for (let i = 0; i < cardCount; i += 1) await addCard(f);
  await insert("exercises", {
    id: f.memoryExerciseId, topic_id: f.topicId, course_id: f.courseId, title: "Memory",
    part_type: null, activity_stage: "memory_check", order_index: 0,
  });
  f.memory.push(await addQuestion(f.courseId, f.memoryExerciseId, 0), await addQuestion(f.courseId, f.memoryExerciseId, 1));
  f.probe = await addQuestion(f.courseId, f.memoryExerciseId, 2);
  await insert("exercises", {
    id: f.exerciseId, topic_id: f.topicId, course_id: f.courseId, title: "Part 5",
    part_type: "part5", activity_stage: "exercise", order_index: 1,
  });
  f.exercise = await addQuestion(f.courseId, f.exerciseId, 0);
  for (const userId of enrolled) await insert("enrollments", { course_id: f.courseId, user_id: userId });
  return f;
}

async function cleanup() {
  for (const f of fixtures.splice(0)) {
    const exerciseIds = [f.exerciseId, f.memoryExerciseId];
    const found = await service.from("questions").select("id").in("exercise_id", exerciseIds);
    const questionIds = (found.data ?? []).map((q) => q.id);
    for (const [table, column, ids] of [
      ["user_question_answers", "question_id", questionIds], ["user_flashcards", "card_id", f.cardIds],
      ["user_topic_progress", "topic_id", [f.topicId]], ["enrollments", "course_id", [f.courseId]],
      ["question_options", "question_id", questionIds], ["questions", "id", questionIds],
      ["exercises", "id", exerciseIds], ["cards", "id", f.cardIds],
      ["topics", "id", [f.topicId]], ["chapters", "id", [f.chapterId]],
      ["course_collaborators", "course_id", [f.courseId]], ["courses", "id", [f.courseId]],
    ] as const) {
      const r = await service.from(table).delete().in(column, [...ids]);
      if (r.error) throw r.error;
    }
  }
}

const row = (userId: string, q: Q, option: string) => ({ user_id: userId, question_id: q.id, selected_option_id: option, is_correct: false });
const insertAnswer = (client: SupabaseClient, userId: string, q: Q, option: string) =>
  client.from("user_question_answers").insert(row(userId, q, option)).select("id").single();
const upsertAnswer = (client: SupabaseClient, userId: string, q: Q, option: string) =>
  client.from("user_question_answers").upsert(row(userId, q, option), { onConflict: "user_id,question_id" }).select("id").single();
const updateAnswer = (client: SupabaseClient, userId: string, q: Q, option: string) =>
  client.from("user_question_answers").update({ selected_option_id: option }).eq("user_id", userId).eq("question_id", q.id)
    .select("id").single();
const storedAnswer = async (q: Q, userId = studentId) => {
  const r = await service.from("user_question_answers").select("selected_option_id").eq("user_id", userId).eq("question_id", q.id);
  if (r.error) throw r.error;
  return r.data[0]?.selected_option_id ?? null;
};
const seedAnswer = async (q: Q, option: string, userId = studentId) => {
  const r = await service.from("user_question_answers").upsert(row(userId, q, option), { onConflict: "user_id,question_id" });
  if (r.error) throw r.error;
};
const dropAnswer = async (q: Q, userId = studentId) => {
  const r = await service.from("user_question_answers").delete().eq("user_id", userId).eq("question_id", q.id);
  if (r.error) throw r.error;
};
const refused = (result: { error: { code?: string } | null }) => expect(result.error?.code).toBe(RLS_VIOLATION);

// Chấm một thẻ cho một người dùng (ghi bằng service để cô lập cổng khỏi đường ghi thẻ của học viên).
const rate = async (cardId: string, rating = 3, userId = studentId) => {
  const r = await service.from("user_flashcards").upsert({ user_id: userId, card_id: cardId, last_rating: rating }, { onConflict: "user_id,card_id" });
  if (r.error) throw r.error;
};
const rateAll = async (f: Fixture, rating = 3, userId = studentId) => { for (const id of f.cardIds) await rate(id, rating, userId); };

const rpcAnswer = async (client: SupabaseClient, q: Q, option: string) => {
  const r = await client.rpc("lf2_submit_question_answer", { p_question_id: q.id, p_selected_option_id: option });
  if (r.error) throw new Error(`answer rpc error: ${r.error.message}`);
  return r.data as Status;
};

// Cùng trạng thái, đối chiếu ghi SQL, RPC và tập achievement mà workspace trả về cho chính học viên.
async function gateStates(f: Fixture, client: SupabaseClient, userId: string) {
  const attempt = await upsertAnswer(client, userId, f.probe, f.probe.right);
  if (attempt.error) expect(attempt.error.code).toBe(RLS_VIOLATION);
  await dropAnswer(f.probe, userId);
  const status = (await rpcAnswer(client, f.probe, f.probe.right)).status;
  await dropAnswer(f.probe, userId);
  authenticated.client = client;
  const workspace = await getLearningWorkspace(f.courseSlug, f.topicSlug);
  authenticated.client = learner;
  if (workspace.status !== "success") throw new Error(`workspace status ${workspace.status}`);
  expect(["ok", "cards_locked"]).toContain(status);
  return { sql: attempt.error === null, rpc: status === "ok", workspace: workspace.data.flashcards.every((card) => workspace.data.memoryGateClearedCardIds?.includes(card.id)) };
}
const expectGate = async (f: Fixture, open: boolean, client = learner, userId = studentId) =>
  expect(await gateStates(f, client, userId)).toEqual({ sql: open, rpc: open, workspace: open });

async function signIn(email: string) {
  const client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
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

async function removeOverrides() {
  await psql(`
    do $f$ begin
      if to_regprocedure('private.lf2_answer_precheck_real(uuid,uuid)') is not null then
        drop function private.lf2_answer_precheck(uuid, uuid);
        alter function private.lf2_answer_precheck_real(uuid, uuid) rename to lf2_answer_precheck;
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

describe.sequential("LF3/LF9 memory-check card gate", { timeout: 40_000 }, () => {
  beforeAll(async () => {
    await removeOverrides();
    learner = await signIn("student@gmail.com");
    teacher = await signIn("teacher@gmail.com");
    admin = await signIn("admin@gmail.com");
    authenticated.client = learner;
  });
  afterEach(async () => {
    await removeOverrides();
    authenticated.client = learner;
    vi.restoreAllMocks();
    await cleanup();
  });
  afterAll(async () => {
    await removeOverrides();
    await cleanup();
    await Promise.all([learner, teacher, admin].map((c) => c?.auth.signOut()));
  });

  describe("direct Data API writes (AC4)", () => {
    it("refuses INSERT, UPDATE and both upsert branches until all active cards have latest Good/Easy, then allows them", async () => {
      const f = await build(2);
      const [first, second] = f.cardIds;
      const [a, b] = f.memory;

      // Không có dòng nào: INSERT và upsert (nhánh insert) bị từ chối, không để lại dòng.
      refused(await insertAnswer(learner, studentId, a, a.right));
      refused(await upsertAnswer(learner, studentId, a, a.right));
      expect(await storedAnswer(a)).toBeNull();

      // Có một trong hai thẻ: vẫn khóa.
      await rate(first);
      refused(await insertAnswer(learner, studentId, a, a.right));
      expect(await storedAnswer(a)).toBeNull();

      // Một đáp án đã lưu trước đó: UPDATE và upsert (nhánh conflict) bị từ chối và đáp án giữ nguyên.
      await seedAnswer(b, b.wrong);
      refused(await updateAnswer(learner, studentId, b, b.right));
      refused(await upsertAnswer(learner, studentId, b, b.right));
      expect(await storedAnswer(b)).toBe(b.wrong);

      // Đủ dòng cho cả hai thẻ: mọi đường ghi mở.
      await rate(second);
      expect((await insertAnswer(learner, studentId, a, a.right)).error).toBeNull();
      expect((await updateAnswer(learner, studentId, b, b.right)).error).toBeNull();
      expect((await upsertAnswer(learner, studentId, b, b.wrong)).error).toBeNull();
      expect((await upsertAnswer(learner, studentId, a, a.wrong)).error).toBeNull();
      expect(await storedAnswer(a)).toBe(a.wrong);
      expect(await storedAnswer(b)).toBe(b.wrong);
    });

    it("requires all latest ratings to be Good/Easy together, then retains the gate after Lại/Khó", async () => {
      const f = await build(2);
      const [a] = f.memory;
      await rate(f.cardIds[0], 1);
      await rate(f.cardIds[1], 2);
      refused(await insertAnswer(learner, studentId, a, a.right));
      await rateAll(f, 3);
      expect((await insertAnswer(learner, studentId, a, a.right)).error).toBeNull();
      await rate(f.cardIds[0], 1);
      await rate(f.cardIds[1], 1);
      expect((await updateAnswer(learner, studentId, a, a.wrong)).error).toBeNull();
      expect((await upsertAnswer(learner, studentId, a, a.right)).error).toBeNull();
    });

    it("does not block a topic without an active card, nor one whose only unrated card was removed", async () => {
      const none = await build(0);
      const [noneQuestion] = none.memory;
      expect((await insertAnswer(learner, studentId, noneQuestion, noneQuestion.right)).error).toBeNull();
      await expectGate(none, true);

      const removed = await build(2);
      await rate(removed.cardIds[0]);
      await expectGate(removed, false);
      const gone = await service.from("cards").update({ removed_at: new Date().toISOString() }).eq("id", removed.cardIds[1]);
      expect(gone.error).toBeNull();
      await rate(removed.cardIds[0], 1);
      // Gỡ thẻ phải ghi nhận ngay, trước downgrade và trước loader/progress sync.
      await expectGate(removed, true);
      const [question] = removed.memory;
      expect((await upsertAnswer(learner, studentId, question, question.right)).error).toBeNull();
    });

    it("closes again when a card is added later, keeps the stored answer, and reopens once the new card is rated", async () => {
      const f = await build(2);
      const [a] = f.memory;
      await rateAll(f);
      expect((await insertAnswer(learner, studentId, a, a.right)).error).toBeNull();
      await expectGate(f, true);

      const added = await addCard(f);
      await expectGate(f, false);
      refused(await updateAnswer(learner, studentId, a, a.wrong));
      refused(await upsertAnswer(learner, studentId, a, a.wrong));
      expect(await storedAnswer(a)).toBe(a.right);
      // Đáp án đã lưu vẫn đọc được qua Data API.
      const read = await learner.from("user_question_answers").select("selected_option_id").eq("question_id", a.id);
      expect(read.data).toEqual([{ selected_option_id: a.right }]);

      await rate(added, 1);
      await expectGate(f, false);
      await rate(added, 3);
      await expectGate(f, true);
      expect((await updateAnswer(learner, studentId, a, a.wrong)).error).toBeNull();
    });
  });

  describe("whose rows count (G4/G5)", () => {
    it("ignores other learners' rows, including the admin's read-all policy, for the same cards", async () => {
      const f = await build(2, [studentId, adminId]);
      // Học viên khác (teacher) và admin có dòng cho cả hai thẻ; học viên chưa có dòng nào.
      await rateAll(f, 4, teacherId);
      await rateAll(f, 4, adminId);
      await expectGate(f, false);

      // Chỉ có một thẻ của chính mình + dòng của người khác cho thẻ còn lại vẫn khóa.
      await rate(f.cardIds[0], 3, studentId);
      await expectGate(f, false);
      await rate(f.cardIds[1], 1, studentId);
      await expectGate(f, false);
      await rate(f.cardIds[1], 3, studentId);
      await expectGate(f, true);
    });

    it("treats an admin learner by the admin's own rows, never the rows they can read from others", async () => {
      const f = await build(2, [studentId, adminId]);
      await rateAll(f, 4, studentId);
      // Admin đọc được dòng của học viên (policy Active Admin Select) nhưng chưa có dòng của chính mình.
      const visible = await admin.from("user_flashcards").select("user_id").in("card_id", f.cardIds);
      expect(visible.data?.some((r) => r.user_id === studentId)).toBe(true);
      await expectGate(f, false, admin, adminId);
      expect((await upsertAnswer(admin, adminId, f.memory[0], f.memory[0].right)).error?.code).toBe(RLS_VIOLATION);

      await rate(f.cardIds[0], 3, adminId);
      await expectGate(f, false, admin, adminId);
      await rate(f.cardIds[1], 1, adminId);
      await expectGate(f, false, admin, adminId);
      await rate(f.cardIds[1], 3, adminId);
      await expectGate(f, true, admin, adminId);
      expect((await upsertAnswer(admin, adminId, f.memory[0], f.memory[0].right)).error).toBeNull();
    });

    it("reports the unseen and the not-yet-Ổn/Dễ cards from the learner's own rows only", async () => {
      const f = await build(3);
      const [c0, c1, c2] = f.cardIds;
      const load = async () => {
        const result = await getLearningWorkspace(f.courseSlug, f.topicSlug);
        if (result.status !== "success") throw new Error(`workspace status ${result.status}`);
        return { unseen: [...result.data.unseenCardIds].sort(), unrated: [...result.data.unratedCardIds].sort() };
      };
      const all = [...f.cardIds].sort();
      expect(await load()).toEqual({ unseen: all, unrated: all });
      await rate(c0, 3);
      await rate(c1, 1);
      await rateAll(f, 4, teacherId); // dòng của người khác không đổi kết quả
      expect(await load()).toEqual({ unseen: [c2], unrated: [c1, c2].sort() });
      await rate(c2, 2);
      expect(await load()).toEqual({ unseen: [], unrated: [c1, c2].sort() });
      await rate(c1, 4);
      await rate(c2, 3);
      expect(await load()).toEqual({ unseen: [], unrated: [] });
      // Chấm Lại sau đó đưa thẻ về "chưa Ổn/Dễ" nhưng vẫn là đã xem (LF1 dùng lần chấm gần nhất).
      await rate(c0, 1);
      expect(await load()).toEqual({ unseen: [], unrated: [c0] });
    });
  });

  describe("answer RPC and action (AC5)", () => {
    it("returns cards_locked for a memory question, keeps the LF2 precedence, and never changes exercise answers", async () => {
      const f = await build(2);
      const [a] = f.memory;
      const foreignOption = f.exercise.right;

      // Thứ tự ưu tiên: option lạ thắng cards_locked; chưa enroll thắng option lạ.
      expect((await rpcAnswer(teacher, a, a.right)).status).toBe("not_enrolled");
      expect((await rpcAnswer(learner, a, foreignOption)).status).toBe("option_unavailable");
      expect((await rpcAnswer(learner, a, a.right)).status).toBe("cards_locked");
      expect(await storedAnswer(a)).toBeNull();

      // Câu bài tập vẫn theo cổng LF2 (memory_locked), không bao giờ cards_locked.
      expect((await rpcAnswer(learner, f.exercise, f.exercise.right)).status).toBe("memory_locked");

      // Memory check đã được trả lời đúng từ trước (đáp án cũ), rồi thêm thẻ: bài tập vẫn mở theo LF2, memory thì cards_locked.
      for (const q of [...f.memory, f.probe]) await seedAnswer(q, q.right);
      expect((await rpcAnswer(learner, f.exercise, f.exercise.right)).status).toBe("ok");
      expect((await rpcAnswer(learner, a, a.wrong)).status).toBe("cards_locked");
      expect(await storedAnswer(a)).toBe(a.right);

      await rateAll(f, 1);
      expect((await rpcAnswer(learner, a, a.wrong)).status).toBe("cards_locked");
      await rateAll(f, 3);
      expect((await rpcAnswer(learner, a, a.wrong)).status).toBe("ok");
    });

    it("maps the locked state to CARDS_REQUIRED in the action without writing, and saves after the cards are rated", async () => {
      const f = await build(1);
      const [a] = f.memory;
      const locked = await submitQuestionAnswer(a.id, a.right);
      expect(locked).toEqual({
        error: "Bạn cần học hết flashcard của bài này trước khi làm memory check.",
        errorCode: "CARDS_REQUIRED",
      });
      expect(await storedAnswer(a)).toBeNull();

      await rate(f.cardIds[0], 1);
      await expect(submitQuestionAnswer(a.id, a.right)).resolves.toMatchObject({ errorCode: "CARDS_REQUIRED" });
      await rate(f.cardIds[0], 3);
      await expect(submitQuestionAnswer(a.id, a.right)).resolves.toMatchObject({ success: true, isCorrect: true });
      expect(await storedAnswer(a)).toBe(a.right);

      // Thẻ thêm sau: lần đổi đáp án bị từ chối, đáp án cũ giữ nguyên; chấm thẻ mới thì lưu được.
      const added = await addCard(f);
      const relocked = await submitQuestionAnswer(a.id, a.wrong);
      expect(relocked).toMatchObject({ errorCode: "CARDS_REQUIRED" });
      expect(await storedAnswer(a)).toBe(a.right);
      await rate(added, 3);
      await expect(submitQuestionAnswer(a.id, a.wrong)).resolves.toMatchObject({ success: true, isCorrect: false });
      expect(await storedAnswer(a)).toBe(a.wrong);
    });

    it("reclassifies as cards_locked when a new card appears between classification and the write", async () => {
      const f = await build(1);
      const [a, b] = f.memory;
      await rateAll(f);

      // Nhánh insert: chưa có đáp án, thẻ mới thêm giữa lúc phân loại và lúc ghi.
      const insertRace = await raceAnswer(a, a.right, async () => {
        await addCard(f);
      });
      expect(insertRace).toEqual({ status: "cards_locked" });
      expect(await storedAnswer(a)).toBeNull();

      // Nhánh conflict: đã có đáp án, thẻ mới thêm giữa chừng; đáp án cũ giữ nguyên.
      await rateAll(f);
      await seedAnswer(b, b.wrong);
      const conflictRace = await raceAnswer(b, b.right, async () => {
        await addCard(f);
      });
      expect(conflictRace).toEqual({ status: "cards_locked" });
      expect(await storedAnswer(b)).toBe(b.wrong);
    });
  });

  describe("LF9 transactional gate achievement", () => {
    it("does not treat separate historical Good ratings as all latest Good together", async () => {
      const f = await build(2);
      await rate(f.cardIds[0], 3);
      await rate(f.cardIds[0], 1);
      await rate(f.cardIds[1], 4);
      await expectGate(f, false);
      await rate(f.cardIds[0], 3);
      await expectGate(f, true);
      await rateAll(f, 1);
      await expectGate(f, true);
    });

    it("retains each new card independently and keeps removed/restored cleared cards open", async () => {
      const f = await build(1);
      await rateAll(f);
      const first = await addCard(f), second = await addCard(f);
      await rate(first, 3);
      await rate(first, 1);
      await expectGate(f, false);
      await rate(second, 4);
      await expectGate(f, true);
      expect((await service.from("cards").update({ removed_at: new Date().toISOString() }).eq("id", first)).error).toBeNull();
      expect((await service.from("cards").update({ removed_at: null }).eq("id", first)).error).toBeNull();
      await expectGate(f, true);
    });

    it("serializes a direct downgrade with the transaction capturing the first opening", async () => {
      const f = await build(2);
      await rate(f.cardIds[1], 3);
      const opening = await beginLocalPostgresTransaction(`begin;
        insert into public.user_flashcards(user_id,card_id,last_rating)
        values ('${studentId}','${f.cardIds[0]}',3);
        select 'LF9_OPENING_READY:' || pg_backend_pid();`, "LF9_OPENING_READY:");
      const downgrade = Promise.resolve(learner.from("user_flashcards").update({ last_rating: 1 })
        .eq("user_id", studentId).eq("card_id", f.cardIds[1]));
      try {
        await waitForLocalPostgresQuery(
          `select 'LF9_DOWNGRADE_BLOCKED' from pg_stat_activity a
           where ${opening.pid} = any(pg_blocking_pids(a.pid)) limit 1`,
          "direct downgrade waiting for the first-opening transaction",
        );
        await opening.finish("COMMIT");
        expect((await downgrade).error).toBeNull();
        // Khi opening commit, downgrade vẫn chưa commit: có một mốc all-Good thật trước khi hạ điểm.
        await expectGate(f, true);
      } finally {
        await opening.finish("ROLLBACK");
        await downgrade;
      }
    });

    it("serializes a cross-topic card move with the transaction capturing the first opening", async () => {
      const source = await build(2), target = await build(1);
      await rate(source.cardIds[0], 3);
      const opening = await beginLocalPostgresTransaction(`begin;
        insert into public.user_flashcards(user_id,card_id,last_rating)
        values ('${studentId}','${source.cardIds[1]}',3);
        select 'LF9_MOVE_READY:' || pg_backend_pid();`, "LF9_MOVE_READY:");
      const move = Promise.resolve(learner.from("user_flashcards").update({ card_id: target.cardIds[0] })
        .eq("user_id", studentId).eq("card_id", source.cardIds[0]));
      try {
        await waitForLocalPostgresQuery(
          `select 'LF9_MOVE_BLOCKED' from pg_stat_activity a
           where ${opening.pid} = any(pg_blocking_pids(a.pid)) limit 1`,
          "cross-topic card move waiting for the source opening transaction",
        );
        await opening.finish("COMMIT");
        expect((await move).error).toBeNull();
        await expectGate(source, true);
        await expectGate(target, true);
      } finally {
        await opening.finish("ROLLBACK");
        expect((await move).error).toBeNull();
      }
    });

    it("captures concurrent direct learner ratings without losing achievement after downgrade and reload", async () => {
      const f = await build(2);
      const results = await Promise.all(f.cardIds.map((id) => learner.from("user_flashcards")
        .insert({ user_id: studentId, card_id: id, last_rating: 3 })));
      expect(results.map((r) => r.error)).toEqual([null, null]);
      await rateAll(f, 1);
      await expectGate(f, true);
      const progress = await service.from("user_topic_progress").select("memory_gate_card_ids")
        .eq("user_id", studentId).eq("topic_id", f.topicId).single();
      expect(progress.data?.memory_gate_card_ids.sort()).toEqual([...f.cardIds].sort());
    });

    it("keeps successful rating capture when progress sync fails", async () => {
      const f = await build(1);
      const original = await waitForLocalPostgresQuery(
        "select pg_get_functiondef('public.d4_sync_topic_progress(uuid)'::regprocedure)", "original progress sync",
      );
      try {
        await psql(`create or replace function public.d4_sync_topic_progress(p_topic_id uuid)
          returns jsonb language plpgsql security definer set search_path = '' as $$
          begin raise exception 'LF9_TEST_SYNC_FAILURE'; end; $$`);
        const saved = await learner.rpc("lf2_submit_card_review", {
          p_card_id: f.cardIds[0], p_user_flashcard_id: null,
          p_next_review_date: "2099-01-01T00:00:00Z", p_fsrs_meta: null,
          p_last_rating: 3, p_updated_at: new Date().toISOString(),
        });
        expect(saved.error).toBeNull();
        expect(saved.data).toEqual({ status: "ok", progress: null });
      } finally {
        await psql(original.replace(/--[^\r\n]*/g, ""));
      }
      await rate(f.cardIds[0], 1);
      await expectGate(f, true);
    });

    it("does not capture a rolled-back rating or a forged learner marker", async () => {
      const f = await build(1);
      const tx = await beginLocalPostgresTransaction(`begin;
        insert into public.user_flashcards(user_id,card_id,last_rating)
        values ('${studentId}','${f.cardIds[0]}',3);
        select 'LF9_ROLLBACK_READY:' || pg_backend_pid();`, "LF9_ROLLBACK_READY:");
      await tx.finish("ROLLBACK");
      await expectGate(f, false);
      const forged = await learner.from("user_topic_progress").update({ memory_gate_card_ids: f.cardIds })
        .eq("user_id", studentId).eq("topic_id", f.topicId).select("memory_gate_card_ids");
      expect(forged.data).toEqual([]);
      await expectGate(f, false);
      const deniedRating = await learner.from("user_flashcards").insert({ user_id: adminId, card_id: f.cardIds[0], last_rating: 3 });
      refused(deniedRating);
      const other = await service.from("user_topic_progress").select("id").eq("user_id", adminId).eq("topic_id", f.topicId);
      expect(other.data).toEqual([]);
    });

    it("backfills only completed, passed-memory or currently Good legacy topics without changing their results", async () => {
      const completed = await build(1), memoryPassed = await build(1), partial = await build(1), good = await build(1);
      for (const f of [completed, memoryPassed, partial]) {
        await rateAll(f, 1);
        await learner.rpc("d4_sync_topic_progress", { p_topic_id: f.topicId });
      }
      await rateAll(good, 3);
      for (const q of [...memoryPassed.memory, memoryPassed.probe]) await seedAnswer(q, q.right);
      await seedAnswer(partial.memory[0], partial.memory[0].wrong);
      expect((await service.from("user_topic_progress").update({ is_topic_completed: true })
        .eq("user_id", studentId).eq("topic_id", completed.topicId)).error).toBeNull();
      const ids = [completed, memoryPassed, partial, good].map((f) => f.topicId);
      expect((await service.from("user_topic_progress").update({ memory_gate_card_ids: null })
        .eq("user_id", studentId).in("topic_id", ids)).error).toBeNull();
      const before = await service.from("user_topic_progress").select("topic_id,is_topic_completed,is_flashcard_completed,completed_at")
        .eq("user_id", studentId).in("topic_id", ids).order("topic_id");
      const sql = readFileSync("supabase/migrations/20261016173554_lf9_memory_card_gate.sql", "utf8");
      const start = sql.indexOf("-- Dữ liệu cũ không có mốc mở:");
      const end = sql.indexOf("-- Giữ identity", start);
      if (start < 0 || end < start) throw new Error("Missing migration backfill section");
      await psql(sql.slice(start, end).replace(/--[^\r\n]*/g, ""));
      const after = await service.from("user_topic_progress").select("topic_id,is_topic_completed,is_flashcard_completed,completed_at")
        .eq("user_id", studentId).in("topic_id", ids).order("topic_id");
      expect(after.data).toEqual(before.data);
      for (const f of [completed, memoryPassed, good]) {
        const stored = await service.from("user_topic_progress").select("memory_gate_card_ids")
          .eq("user_id", studentId).eq("topic_id", f.topicId).single();
        expect(stored.data?.memory_gate_card_ids).toEqual(f.cardIds);
      }
      const locked = await service.from("user_topic_progress").select("memory_gate_card_ids")
        .eq("user_id", studentId).eq("topic_id", partial.topicId).single();
      expect(locked.data?.memory_gate_card_ids).toBeNull();
      expect(await storedAnswer(partial.memory[0])).toBe(partial.memory[0].wrong);
      expect(await storedAnswer(memoryPassed.memory[0])).toBe(memoryPassed.memory[0].right);
    });
  });

  describe("catalog and policies (G2, G6)", () => {
    it("keeps the helper definer-only for authenticated and adds no permissive policy", async () => {
      const f = await build(1);
      const anon = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
      const denied = await anon.rpc("lf2_submit_question_answer", { p_question_id: f.memory[0].id, p_selected_option_id: f.memory[0].right });
      expect(denied.error?.code).toBe(RLS_VIOLATION);

      const helper = await waitForLocalPostgresQuery(
        `select p.prosecdef::text || ',' || p.provolatile::text || ',' || coalesce(array_to_string(p.proconfig, ';'), '') || ',' ||
                has_function_privilege('anon', p.oid, 'execute')::text || ',' || has_function_privilege('authenticated', p.oid, 'execute')::text
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'private' and p.proname = 'lf3_cards_seen_gate_open'`,
        "the cards-seen helper catalog row",
      );
      expect(helper).toBe('true,s,search_path="",false,true');
      const captureAcl = await waitForLocalPostgresQuery(
        `select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='private' and p.proname in ('lf9_capture_memory_gate','lf9_capture_card_rating','lf9_capture_card_content_change')
         and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
         and not has_function_privilege('anon',p.oid,'execute')
         and not has_function_privilege('authenticated',p.oid,'execute')
         and not has_function_privilege('service_role',p.oid,'execute')`, "LF9 capture function ACLs",
      );
      expect(captureAcl).toBe("3");
      const policies = await waitForLocalPostgresQuery(
        `select string_agg(polname || ':' || polcmd::text || ':' || polpermissive::text, ',' order by polname)
         from pg_policy where polrelid = 'public.user_question_answers'::regclass and polcmd in ('a', 'w')`,
        "the user_question_answers write policies",
      );
      expect(policies).toBe("User_answers - Auth Insert:a:true,User_answers - Auth Update:w:true");
    });
  });
});
