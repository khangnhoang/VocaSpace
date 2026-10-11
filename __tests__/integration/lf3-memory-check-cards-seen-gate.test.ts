import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import { submitQuestionAnswer } from "@/app/actions/progress";
import { beginLocalPostgresTransaction, waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: LF3 CP3 - memory check chỉ ghi được sau khi học viên có dòng user_flashcards của CHÍNH MÌNH cho mọi thẻ active
//   của topic (AC4, AC5, G4-G6), do database ép trên Data API và trong RPC `lf2_submit_question_answer`.
// - Loại: integration Data API/RLS + RPC + Server Action thật trên runtime E2E tách biệt; không mock database.
// - Thành công: INSERT, UPDATE, upsert (nhánh insert, nhánh conflict) và RPC ghi được khi mọi thẻ active đã có dòng; Lại/Khó vẫn mở;
//   topic không có thẻ active hoặc chỉ còn thẻ đã gỡ không bị chặn; thẻ mới được chấm thì mở lại.
// - Thất bại: cùng các đường ghi bị từ chối (42501 / `cards_locked`) khi còn thẻ chưa có dòng; thẻ thêm sau khóa lại và đáp án đã lưu giữ nguyên.
// - Phân quyền: dòng của học viên khác (kể cả admin đọc được mọi dòng) không làm thẻ thành "đã xem"; admin đang học dùng dòng của chính admin.
// - Resilience: thẻ bị mất dòng giữa lúc phân loại và lúc ghi (barrier test-only) cho `cards_locked` ở cả nhánh insert lẫn nhánh conflict.
// - Invariant: cổng SQL, RPC và danh sách thẻ chưa xem (`unseenCardIds`) của workspace luôn cùng đáp án ở mọi trạng thái; cổng bài tập LF2 và thứ tự ưu tiên giữ nguyên;
//   catalog (definer, search_path, grants) và policy L1 không có policy permissive mới.
// - Preview công khai không ghi user_question_answers nên không bị ảnh hưởng (memory-check-preview.test.ts giữ nguyên).
// - Verify: xem số pass gần nhất trong progress.md (LF3 CP3).
// - Ghi chú: chạy bằng `npm run test:integration -- __tests__/integration/lf3-memory-check-cards-seen-gate.test.ts`;
//   cần ALLOW_DB_INTEGRATION_TESTS=true, API 45441, E2E_SUPABASE_WORKDIR=.e2e-runtime và psql.
//   Override test-only (barrier) được cài/gỡ bằng DDL trên chính runtime tách biệt, luôn gỡ ở afterEach/afterAll.

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

// Cùng một trạng thái, ba câu trả lời: cổng SQL (thử upsert một câu probe rồi dọn), RPC (cũng ghi probe rồi dọn) và danh sách `unseenCardIds`
// mà workspace trả về cho đúng người đó (G4: parity ở mọi trạng thái).
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
  return { sql: attempt.error === null, rpc: status === "ok", workspace: workspace.data.unseenCardIds.length === 0 };
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

describe.sequential("LF3 memory-check cards-seen gate", { timeout: 40_000 }, () => {
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
    it("refuses INSERT, UPDATE and both upsert branches until every active card has the learner's own row, then allows them", async () => {
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

    it("keeps the gate open after any rating including Lại and Khó, and when a rating changes later (Owner decision)", async () => {
      const f = await build(2);
      const [a] = f.memory;
      await rate(f.cardIds[0], 1);
      await rate(f.cardIds[1], 2);
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

    it("reclassifies as cards_locked when the learner's card row disappears between the classification and the write", async () => {
      const f = await build(1);
      const [a, b] = f.memory;
      await rateAll(f);

      // Nhánh insert: chưa có đáp án, dòng thẻ mất giữa lúc phân loại và lúc ghi.
      const insertRace = await raceAnswer(a, a.right, async () => {
        const r = await service.from("user_flashcards").delete().eq("user_id", studentId).eq("card_id", f.cardIds[0]);
        if (r.error) throw r.error;
      });
      expect(insertRace).toEqual({ status: "cards_locked" });
      expect(await storedAnswer(a)).toBeNull();

      // Nhánh conflict: đã có đáp án, dòng thẻ mất giữa chừng; đáp án cũ giữ nguyên.
      await rateAll(f);
      await seedAnswer(b, b.wrong);
      const conflictRace = await raceAnswer(b, b.right, async () => {
        const r = await service.from("user_flashcards").delete().eq("user_id", studentId).eq("card_id", f.cardIds[0]);
        if (r.error) throw r.error;
      });
      expect(conflictRace).toEqual({ status: "cards_locked" });
      expect(await storedAnswer(b)).toBe(b.wrong);
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
      const policies = await waitForLocalPostgresQuery(
        `select string_agg(polname || ':' || polcmd::text || ':' || polpermissive::text, ',' order by polname)
         from pg_policy where polrelid = 'public.user_question_answers'::regclass and polcmd in ('a', 'w')`,
        "the user_question_answers write policies",
      );
      expect(policies).toBe("User_answers - Auth Insert:a:true,User_answers - Auth Update:w:true");
    });
  });
});
