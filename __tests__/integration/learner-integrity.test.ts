import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDeckReviewCards } from "@/app/actions/profile";
import { beginLocalPostgresTransaction, waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: L1 bảo vệ chuỗi nội dung, quyền ghi và snapshot correctness tại database thật.
// - Loại: integration Data API/RLS; không mock database.
// - Thành công: enrolled learner ghi/đổi đáp án/upsert trên chuỗi active, published; giữ lịch sử sau thu hồi.
// - Thất bại: mọi tầng bị rút/draft/pending, target cũ/mới không đủ quyền, khác user và quan hệ lệch.
// - Phân quyền: anon/admin/collaborator không tự có quyền learner; service cũng bị FK ràng buộc.
// - Resilience: ghi sai rollback, author đổi đáp án không rewrite snapshot cũ; counts đọc đủ hơn 1.000 rows.
// - Invariant: option thuộc question, các parent cùng course/exercise; SELECT lịch sử không phụ thuộc quyền ghi.
// - Verify: 24/24 passed (2026-10-08), bộ compatibility L1 87/87 trên E2E tách biệt.
// - Ghi chú: chạy bằng `npm run test:integration -- __tests__/integration/learner-integrity.test.ts`;
//   cần ALLOW_DB_INTEGRATION_TESTS=true, API 45441, E2E_SUPABASE_WORKDIR=.e2e-runtime và psql.

const authenticated = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => authenticated.client }));

const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const runtimeUrl = new URL(api);
if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true"
  || process.env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" || runtimeUrl.protocol !== "http:"
  || !["127.0.0.1", "localhost"].includes(runtimeUrl.hostname) || runtimeUrl.port !== "45441") {
  throw new Error("L1 integration requires the explicitly enabled isolated E2E runtime on port 45441");
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const uid = "33333333-3333-4333-8333-333333333333";
const teacherId = "22222222-2222-4222-8222-222222222222";
let learner: SupabaseClient;
let teacher: SupabaseClient;
let admin: SupabaseClient;
type Tree = Record<"course" | "chapter" | "topic" | "card" | "exercise" | "group" | "question" | "right" | "wrong", string>;
const trees: Tree[] = [];
let fixtureOrder = 0;

async function insert(table: string, row: Record<string, unknown>) {
  const r = await service.from(table).insert(row);
  if (r.error) throw r.error;
}
async function change(table: string, id: string, value: Record<string, unknown>) {
  const r = await service.from(table).update(value).eq("id", id);
  if (r.error) throw r.error;
}
async function tree(enrolled = true): Promise<Tree> {
  const order_index = ++fixtureOrder;
  const t = Object.fromEntries(["course", "chapter", "topic", "card", "exercise", "group", "question", "right", "wrong"]
    .map((key) => [key, randomUUID()])) as Tree;
  await insert("courses", { id: t.course, title: "L1", slug: `l1-${t.course}`, price: 0, status: "published" });
  trees.push(t);
  await insert("course_collaborators", { course_id: t.course, user_id: teacherId, role: "owner", added_by: teacherId });
  await insert("chapters", { id: t.chapter, course_id: t.course, title: "L1", created_by_user_id: teacherId, order_index });
  await insert("topics", { id: t.topic, course_id: t.course, chapter_id: t.chapter, title: "L1", slug: `l1-${t.topic}`,
    status: "published", first_approved_at: new Date().toISOString(), order_index,
    original_creator_user_id: teacherId, responsible_author_user_id: teacherId });
  await insert("cards", { id: t.card, topic_id: t.topic, front_content: { word: "integrity" }, back_content: { translation: "toàn vẹn" } });
  await insert("exercises", { id: t.exercise, topic_id: t.topic, course_id: t.course, title: "L1", part_type: "part5", order_index });
  await insert("question_groups", { id: t.group, exercise_id: t.exercise, passage_text: "L1", order_index });
  await insert("questions", { id: t.question, course_id: t.course, exercise_id: t.exercise, group_id: t.group, content: "L1", order_index });
  for (const [id, correct] of [[t.right, true], [t.wrong, false]] as const) {
    await insert("question_options", { id, question_id: t.question, content: "L1", label: correct ? "A" : "B", is_correct: correct, order_index: correct ? 0 : 1 });
  }
  if (enrolled) await insert("enrollments", { course_id: t.course, user_id: uid });
  return t;
}
const payload = (t: Tree, option = t.right, user = uid, correct = false) => ({
  user_id: user, question_id: t.question, selected_option_id: option, is_correct: correct,
});
const card = (t: Tree, user = uid) => ({ user_id: user, card_id: t.card });
async function signIn(email: string) {
  const client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  const r = await client.auth.signInWithPassword({ email, password: "123123" });
  if (r.error) throw r.error;
  return client;
}
async function cleanup() {
  for (const t of trees.splice(0)) {
    for (const [table, column, ids] of [
      ["user_question_answers", "question_id", [t.question]], ["user_flashcards", "card_id", [t.card]],
      ["user_topic_progress", "topic_id", [t.topic]], ["enrollments", "course_id", [t.course]],
      ["question_options", "id", [t.right, t.wrong]], ["questions", "id", [t.question]],
      ["question_groups", "id", [t.group]], ["exercises", "id", [t.exercise]], ["cards", "id", [t.card]],
      ["topics", "id", [t.topic]], ["chapters", "id", [t.chapter]],
      ["course_collaborators", "course_id", [t.course]], ["courses", "id", [t.course]],
    ] as const) {
      const r = await service.from(table).delete().in(column, [...ids]);
      if (r.error) throw r.error;
    }
  }
}

describe.sequential("L1 learner integrity", () => {
  beforeAll(async () => {
    learner = await signIn("student@gmail.com");
    authenticated.client = learner;
    teacher = await signIn("teacher@gmail.com");
    admin = await signIn("admin@gmail.com");
  });
  afterEach(cleanup);
  afterAll(async () => { await cleanup(); await Promise.all([learner, teacher, admin].map((c) => c?.auth.signOut())); });

  it("counts and loads a due review beyond 1,000 future rows through the real Data API", async () => {
    const t = await tree();
    const cardIds = Array.from({ length: 1001 }, (_, index) => `fa100000-0000-4000-8000-${String(index).padStart(12, "0")}`);
    const reviewIds = cardIds.map((_, index) => `fa110000-0000-4000-8000-${String(index).padStart(12, "0")}`);
    const before = await getDeckReviewCards();
    expect(before.success).toBe(true);
    try {
      for (let offset = 0; offset < cardIds.length; offset += 500) {
        const cards = cardIds.slice(offset, offset + 500).map((id) => ({
          id, topic_id: t.topic, front_content: { word: "large-queue" }, back_content: { translation: "hàng đợi lớn" },
        }));
        const created = await service.from("cards").insert(cards);
        expect(created.error).toBeNull();
        const reviews = cards.map(({ id }, index) => {
          const position = offset + index;
          return { id: reviewIds[position], user_id: uid, card_id: id,
            next_review_date: position === 1000 ? "2026-01-01T00:00:00.000Z" : "2099-01-01T00:00:00.000Z",
            fsrs_meta: { state: position === 1000 ? 1 : 2 } };
        });
        expect((await service.from("user_flashcards").insert(reviews)).error).toBeNull();
      }
      const result = await getDeckReviewCards();
      expect(result.success).toBe(true);
      expect(result.counts).toEqual({ dueLeft: before.counts!.dueLeft + 1, learningLeft: before.counts!.learningLeft + 1 });
      expect(result.cards?.some((row) => row.id === cardIds[1000])).toBe(true);
    } finally {
      for (let offset = 0; offset < cardIds.length; offset += 100) {
        expect((await service.from("user_flashcards").delete().in("id", reviewIds.slice(offset, offset + 100))).error).toBeNull();
        expect((await service.from("cards").delete().in("id", cardIds.slice(offset, offset + 100))).error).toBeNull();
      }
    }
  });

  it("derives correctness for INSERT, UPDATE and upsert; retains attempt snapshot after author edits", async () => {
    const t = await tree();
    const first = await learner.from("user_question_answers").insert(payload(t)).select("id,is_correct").single();
    expect(first.error).toBeNull();
    expect(first.data?.is_correct).toBe(true);
    const wrong = await learner.from("user_question_answers").update({ selected_option_id: t.wrong, is_correct: true })
      .eq("id", first.data!.id).select("is_correct").single();
    expect(wrong.error).toBeNull(); expect(wrong.data?.is_correct).toBe(false);
    const upsert = await learner.from("user_question_answers").upsert(payload(t), { onConflict: "user_id,question_id" })
      .select("is_correct").single();
    expect(upsert.error).toBeNull(); expect(upsert.data?.is_correct).toBe(true);
    await change("question_options", t.right, { is_correct: false });
    expect((await learner.from("user_question_answers").select("is_correct").eq("id", first.data!.id).single()).data?.is_correct).toBe(true);
    const retry = await learner.from("user_question_answers").upsert(payload(t, t.right, uid, true), { onConflict: "user_id,question_id" })
      .select("is_correct").single();
    expect(retry.error).toBeNull(); expect(retry.data?.is_correct).toBe(false);
  });

  for (const level of ["course", "chapter", "topic", "card", "exercise", "group", "question", "right"] as const) {
    it(`denies new and existing learner writes after ${level} withdrawal, preserves history`, async () => {
      const t = await tree();
      const a = await learner.from("user_question_answers").insert(payload(t)).select("id").single();
      const f = await learner.from("user_flashcards").insert(card(t)).select("id").single();
      expect(a.error).toBeNull(); expect(f.error).toBeNull();
      const table = { course: "courses", chapter: "chapters", topic: "topics", card: "cards", exercise: "exercises",
        group: "question_groups", question: "questions", right: "question_options" }[level];
      await change(table, t[level], { removed_at: new Date().toISOString() });
      const answersDenied = level !== "card";
      const cardsDenied = ["course", "chapter", "topic", "card"].includes(level);
      if (answersDenied) {
        expect((await learner.from("user_question_answers").upsert(payload(t), { onConflict: "user_id,question_id" })).error).not.toBeNull();
        await learner.from("user_question_answers").update({ is_correct: false }).eq("id", a.data!.id);
        expect((await service.from("user_question_answers").select("is_correct").eq("id", a.data!.id).single()).data?.is_correct).toBe(true);
      }
      if (cardsDenied) {
        expect((await learner.from("user_flashcards").upsert(card(t), { onConflict: "user_id,card_id" })).error).not.toBeNull();
        await learner.from("user_flashcards").update({ interval_days: 9 }).eq("id", f.data!.id);
        expect((await service.from("user_flashcards").select("interval_days").eq("id", f.data!.id).single()).data?.interval_days).toBe(0);
      }
      expect((await learner.from("user_question_answers").select("id").eq("id", a.data!.id)).data).toEqual([{ id: a.data!.id }]);
      expect((await learner.from("user_flashcards").select("id").eq("id", f.data!.id)).data).toEqual([{ id: f.data!.id }]);
      if (answersDenied) {
        expect((await service.from("user_question_answers").delete().eq("id", a.data!.id)).error).toBeNull();
        expect((await learner.from("user_question_answers").insert(payload(t))).error).not.toBeNull();
      }
      if (cardsDenied) {
        expect((await service.from("user_flashcards").delete().eq("id", f.data!.id)).error).toBeNull();
        expect((await learner.from("user_flashcards").insert(card(t))).error).not.toBeNull();
      }
    });
  }

  for (const level of ["course", "topic"] as const) for (const status of ["draft", "pending"] as const) {
    it(`denies enrolled writes to ${level} ${status}`, async () => {
      const t = await tree();
      await change(level === "course" ? "courses" : "topics", t[level], { status });
      expect((await learner.from("user_question_answers").insert(payload(t))).error).not.toBeNull();
      expect((await learner.from("user_flashcards").insert(card(t))).error).not.toBeNull();
    });
  }

  it("requires enrollment even for collaborators/admin; denies anon and other-user ownership", async () => {
    const t = await tree(false);
    const anon = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
    for (const [client, user] of [[learner, uid], [teacher, teacherId], [admin, "11111111-1111-4111-8111-111111111111"], [anon, uid]] as const) {
      expect((await client.from("user_question_answers").insert(payload(t, t.right, user))).error).not.toBeNull();
      expect((await client.from("user_flashcards").insert(card(t, user))).error).not.toBeNull();
    }
    await insert("enrollments", { course_id: t.course, user_id: uid });
    expect((await learner.from("user_question_answers").insert(payload(t, t.right, teacherId))).error).not.toBeNull();
    expect((await learner.from("user_flashcards").insert(card(t, teacherId))).error).not.toBeNull();
    expect((await learner.rpc("l1_can_write_learning_target", { p_target_kind: "card", p_target_id: t.card })).error).not.toBeNull();
    expect((await learner.rpc("l1_derive_answer_correctness")).error).not.toBeNull();
  });

  it("checks both UPDATE targets and prevents moving withdrawn history into an eligible target", async () => {
    const a = await tree(); const b = await tree(false);
    const answer = await learner.from("user_question_answers").insert(payload(a)).select("id").single();
    const flash = await learner.from("user_flashcards").insert(card(a)).select("id").single();
    expect(answer.error).toBeNull(); expect(flash.error).toBeNull();
    expect((await learner.from("user_question_answers").update(payload(b)).eq("id", answer.data!.id)).error).not.toBeNull();
    expect((await learner.from("user_flashcards").update(card(b)).eq("id", flash.data!.id)).error).not.toBeNull();
    await insert("enrollments", { course_id: b.course, user_id: uid });
    await change("topics", a.topic, { status: "draft" });
    expect((await learner.from("user_question_answers").update(payload(b)).eq("id", answer.data!.id).select("id")).data).toEqual([]);
    expect((await learner.from("user_flashcards").update(card(b)).eq("id", flash.data!.id).select("id")).data).toEqual([]);
    expect((await service.from("user_question_answers").select("question_id").eq("id", answer.data!.id).single()).data?.question_id).toBe(a.question);
    expect((await service.from("user_flashcards").select("card_id").eq("id", flash.data!.id).single()).data?.card_id).toBe(a.card);
  });

  it("rejects privileged cross-graph child and parent substitutions, including removed rows", async () => {
    const a = await tree(); const b = await tree();
    await change("questions", a.question, { removed_at: new Date().toISOString() });
    for (const [table, id, values] of [
      ["topics", a.topic, { chapter_id: b.chapter }], ["exercises", a.exercise, { topic_id: b.topic }],
      ["questions", a.question, { course_id: b.course }], ["questions", a.question, { group_id: b.group }],
      ["chapters", a.chapter, { course_id: b.course }], ["topics", a.topic, { course_id: b.course }],
      ["exercises", a.exercise, { course_id: b.course }], ["question_groups", a.group, { exercise_id: b.exercise }],
    ] as const) {
      const r = await service.from(table).update(values).eq("id", id);
      expect(r.error?.code, `${table} ${JSON.stringify(values)}`).toBe("23503");
    }
    expect((await service.from("user_question_answers").insert(payload(a, b.right))).error?.code).toBe("23503");
    const stored = await service.from("user_question_answers").insert(payload(a)).select("id").single();
    expect(stored.error).toBeNull();
    expect((await service.from("user_question_answers").update({ selected_option_id: b.right }).eq("id", stored.data!.id)).error?.code).toBe("23503");
    expect((await service.from("question_options").update({ question_id: b.question, order_index: 9 }).eq("id", a.right)).error?.code).toBe("23503");
    expect((await service.from("user_question_answers").select("selected_option_id").eq("id", stored.data!.id).single()).data?.selected_option_id).toBe(a.right);
  });

  it("preserves nullable parents while a missing chapter never permits learner writes", async () => {
    const t = await tree();
    await change("questions", t.question, { group_id: null });
    expect((await learner.from("user_question_answers").insert(payload(t))).error).toBeNull();
    await change("topics", t.topic, { chapter_id: null });
    expect((await learner.from("user_question_answers").upsert(payload(t), { onConflict: "user_id,question_id" })).error).not.toBeNull();
    expect((await learner.from("user_flashcards").insert(card(t))).error).not.toBeNull();
  });

  it("rejects cross-graph INSERTs for every composite relation, even with service privileges", async () => {
    const a = await tree(); const b = await tree();
    const mutations = [
      ["topics", { id: randomUUID(), title: "invalid", slug: `invalid-${randomUUID()}`, course_id: a.course, chapter_id: b.chapter,
        original_creator_user_id: teacherId, responsible_author_user_id: teacherId, order_index: 999 }],
      ["exercises", { id: randomUUID(), title: "invalid", course_id: a.course, topic_id: b.topic, part_type: "part5", order_index: 999 }],
      ["questions", { id: randomUUID(), content: "invalid", course_id: a.course, exercise_id: b.exercise, order_index: 999 }],
      ["questions", { id: randomUUID(), content: "invalid", course_id: a.course, exercise_id: a.exercise, group_id: b.group, order_index: 999 }],
      ["user_question_answers", payload(a, b.right)],
    ] as const;
    for (const [table, row] of mutations) expect((await service.from(table).insert(row)).error?.code, table).toBe("23503");
  });

  it("permits eligible target changes and card conflict updates", async () => {
    const a = await tree(); const b = await tree();
    const answer = await learner.from("user_question_answers").insert(payload(a)).select("id").single();
    const flash = await learner.from("user_flashcards").insert(card(a)).select("id").single();
    expect(answer.error).toBeNull(); expect(flash.error).toBeNull();
    const changed = await learner.from("user_question_answers").update(payload(b, b.wrong, uid, true))
      .eq("id", answer.data!.id).select("question_id,is_correct").single();
    expect(changed.error).toBeNull(); expect(changed.data).toEqual({ question_id: b.question, is_correct: false });
    expect((await learner.from("user_flashcards").update(card(b)).eq("id", flash.data!.id)).error).toBeNull();
    const saved = await learner.from("user_flashcards").upsert({ ...card(b), interval_days: 2 }, { onConflict: "user_id,card_id" })
      .select("card_id,interval_days").single();
    expect(saved.error).toBeNull(); expect(saved.data).toEqual({ card_id: b.card, interval_days: 2 });
  });

  it("serializes a concurrent parent change against a newly inserted child's FK", async () => {
    const a = await tree(); const b = await tree();
    const chapter = randomUUID(); const topic = randomUUID();
    await insert("chapters", { id: chapter, course_id: a.course, title: "race", created_by_user_id: teacherId, order_index: 999 });
    const held = await beginLocalPostgresTransaction(`
      begin;
      insert into public.topics (id,course_id,chapter_id,title,slug,original_creator_user_id,responsible_author_user_id,order_index)
      values ('${topic}','${a.course}','${chapter}','race','race-${topic}','${teacherId}','${teacherId}',999);
      select 'L1_CHILD_READY:' || pg_backend_pid();
    `, "L1_CHILD_READY:");
    let mutation: PromiseLike<unknown> | undefined;
    try {
      const pending = service.from("chapters").update({ course_id: b.course }).eq("id", chapter).then((r) => r);
      mutation = pending;
      await waitForLocalPostgresQuery(`
        select 'blocked' from pg_stat_activity
        where ${held.pid} = any(pg_blocking_pids(pid)) and wait_event_type = 'Lock' limit 1;
      `, "parent update waiting for the child FK key lock");
      await held.finish("COMMIT");
      expect((await pending).error?.code).toBe("23503");
      expect((await service.from("chapters").select("course_id").eq("id", chapter).single()).data?.course_id).toBe(a.course);
      expect((await service.from("topics").select("chapter_id,course_id").eq("id", topic).single()).data)
        .toEqual({ chapter_id: chapter, course_id: a.course });
    } finally {
      await held.finish("ROLLBACK");
      await mutation;
      const topicDelete = await service.from("topics").delete().eq("id", topic);
      const chapterDelete = await service.from("chapters").delete().eq("id", chapter);
      if (topicDelete.error) throw topicDelete.error;
      if (chapterDelete.error) throw chapterDelete.error;
    }
  });

  it("preserves cascade deletion and prevents deleting an option referenced by history", async () => {
    const t = await tree();
    expect((await learner.from("user_question_answers").insert(payload(t))).error).toBeNull();
    expect((await service.from("question_options").delete().eq("id", t.right)).error?.code).toBe("23503");
    expect((await service.from("user_question_answers").delete().eq("question_id", t.question)).error).toBeNull();
    expect((await service.from("chapters").delete().eq("id", t.chapter)).error).toBeNull();
    for (const [table, id] of [["topics", t.topic], ["exercises", t.exercise], ["question_groups", t.group],
      ["questions", t.question], ["question_options", t.right], ["cards", t.card]] as const) {
      const r = await service.from(table).select("id").eq("id", id);
      expect(r.error).toBeNull(); expect(r.data, table).toEqual([]);
    }
  });

  it("denies writes by a removed learner profile and retains their history", async () => {
    const t = await tree();
    expect((await learner.from("user_question_answers").insert(payload(t))).error).toBeNull();
    expect((await learner.from("user_flashcards").insert(card(t))).error).toBeNull();
    try {
      await change("profiles", uid, { removed_at: new Date().toISOString() });
      expect((await learner.from("user_question_answers").upsert(payload(t), { onConflict: "user_id,question_id" })).error).not.toBeNull();
      expect((await learner.from("user_flashcards").upsert(card(t), { onConflict: "user_id,card_id" })).error).not.toBeNull();
      expect((await learner.from("user_question_answers").select("question_id").eq("question_id", t.question)).data)
        .toEqual([{ question_id: t.question }]);
    } finally { await change("profiles", uid, { removed_at: null }); }
  });

  it("allows replacing a withdrawn selected option while the question remains eligible", async () => {
    const t = await tree();
    expect((await learner.from("user_question_answers").insert(payload(t))).error).toBeNull();
    await change("question_options", t.right, { removed_at: new Date().toISOString() });
    const fixed = await learner.from("user_question_answers").update({ selected_option_id: t.wrong, is_correct: true })
      .eq("question_id", t.question).eq("user_id", uid).select("selected_option_id,is_correct").single();
    expect(fixed.error).toBeNull(); expect(fixed.data).toEqual({ selected_option_id: t.wrong, is_correct: false });
    expect((await learner.from("user_question_answers").update({ user_id: teacherId }).eq("question_id", t.question)).error).not.toBeNull();
  });
});
