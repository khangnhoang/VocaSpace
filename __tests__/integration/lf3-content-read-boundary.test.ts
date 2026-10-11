import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test plan:
// - Mục tiêu: LF3 AC3 - ranh giới ĐỌC nội dung học của topics, cards, exercises, question_groups, questions,
//   question_options không đổi khi policy chuyển từ join tổ tiên sang kiểm tra theo từng parent (PERF-RLS-001).
// - Loại test: integration Data API/RLS trên runtime E2E tách biệt, không mock database.
// - Đối tượng: sáu policy SELECT "credential bound" và các policy "Staff Select Deleted" của cards/exercises/questions/topics.
// - Case thành công: học viên đã enroll, previewer, owner/co_owner/editor, thành viên topic group, reviewer và admin
//   đọc đúng tập hàng mà định nghĩa `private.q7_can_read_topic` cho phép (xem hàm `readsTopic`).
// - Case thất bại: học viên chưa enroll, anonymous, học viên ở topic draft, khóa học draft, và hàng bị xóa mềm ở từng mức
//   (option, question, group, exercise, card, topic, chapter, course) không lộ cho người không có quyền.
// - Bảo mật/phân quyền: 10 actor x 11 cây nội dung x 6 bảng; policy staff-deleted giữ nguyên kết quả (owner/co_owner/editor
//   thấy hàng đã xóa của topics/cards/exercises/questions, không ai thấy option/group đã xóa).
// - Ổn định/resilience: mỗi cây có course riêng; dọn bằng service-role; user phụ được tạo và xóa trong test.
// - Invariant cần giữ: kết quả ma trận KHÔNG ĐỔI giữa policy Q7 gốc và policy per-parent của LF3.
//   Bộ kỳ vọng bên dưới được viết và chạy xanh trên policy gốc trước khi đổi policy (guardrail G1).
// - Kết quả verify gần nhất: 11/11 xanh trên runtime tách biệt 45441 ở chính sách LF2 (CP1); xem progress.md để biết các lần chạy sau.
// - Ghi chú: cần ALLOW_DB_INTEGRATION_TESTS=true, API 45441, E2E_SUPABASE_WORKDIR=.e2e-runtime;
//   chạy bằng `npm run test:integration -- __tests__/integration/lf3-content-read-boundary.test.ts`.

const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const runtimeUrl = new URL(api);
if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true"
  || process.env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" || runtimeUrl.protocol !== "http:"
  || !["127.0.0.1", "localhost"].includes(runtimeUrl.hostname) || runtimeUrl.port !== "45441") {
  throw new Error("LF3 read-boundary integration requires the explicitly enabled isolated E2E runtime on port 45441");
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const PASSWORD = "123123";
const ADMIN = { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" };
const TEACHER = { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" };
const EDITOR = { email: "editor@gmail.com", id: "99999999-9999-4999-8999-999999999991" };
const PREVIEWER = { email: "previewer@gmail.com", id: "99999999-9999-4999-8999-999999999992" };

type Level = "course" | "chapter" | "topic" | "card" | "exercise" | "group" | "question" | "option";
type Table = "topics" | "cards" | "exercises" | "question_groups" | "questions" | "question_options";
type ActorKey =
  | "enrolled" | "unenrolled" | "anon" | "previewer" | "owner" | "coOwner" | "editor" | "groupMember" | "reviewer" | "admin";

type Tree = {
  name: string;
  removed: Level | null;
  topicStatus: "draft" | "published";
  courseStatus: "draft" | "published";
  courseId: string; chapterId: string; topicId: string; cardId: string;
  exerciseId: string; groupId: string; questionId: string; optionId: string;
};

type Extra = { id: string; email: string };
const createdUsers: string[] = [];
const trees: Tree[] = [];
const extra = {} as Record<"enrolled" | "unenrolled" | "coOwner" | "groupMember" | "reviewer", Extra>;
const clients = {} as Record<ActorKey, SupabaseClient>;

// Bảng ancestor chain: hàng của bảng này ẩn khi một mức trong chuỗi bị xóa mềm (chapter/course trừ admin).
const chain: Record<Table, Level[]> = {
  topics: ["topic", "chapter", "course"],
  cards: ["card", "topic", "chapter", "course"],
  exercises: ["exercise", "topic", "chapter", "course"],
  question_groups: ["group", "exercise", "topic", "chapter", "course"],
  questions: ["question", "exercise", "topic", "chapter", "course"],
  question_options: ["option", "question", "exercise", "topic", "chapter", "course"],
};
const selfLevel: Record<Table, Level> = {
  topics: "topic", cards: "card", exercises: "exercise", question_groups: "group", questions: "question", question_options: "option",
};
// Policy "Staff Select Deleted" chỉ tồn tại cho bốn bảng này; option và group đã xóa không ai đọc được.
const hasStaffDeletedPolicy = new Set<Table>(["topics", "cards", "exercises", "questions"]);

const collaboratorRole: Partial<Record<ActorKey, "owner" | "co_owner" | "editor" | "previewer">> = {
  previewer: "previewer", owner: "owner", coOwner: "co_owner", editor: "editor", groupMember: "previewer", reviewer: "previewer",
};
const isStaff = (actor: ActorKey) => ["owner", "coOwner", "editor"].includes(actor);

// Bản mô tả độc lập của private.q7_can_read_topic (nguồn: migration 20260923143029) cho các actor của ma trận.
function readsTopic(actor: ActorKey, tree: Tree): boolean {
  if (actor === "anon") return false;
  if (tree.removed === "topic") return false;
  if ((tree.removed === "course" || tree.removed === "chapter")) return actor === "admin";
  const contentAccess = actor === "admin"
    || collaboratorRole[actor] !== undefined
    || (actor === "enrolled" && tree.courseStatus === "published");
  const statusOk = tree.topicStatus === "published" || actor === "admin" || isStaff(actor)
    || actor === "groupMember" || actor === "reviewer";
  return contentAccess && statusOk;
}

function expectedVisible(actor: ActorKey, tree: Tree, table: Table): boolean {
  if (actor === "anon") return false;
  if (tree.removed === selfLevel[table]) {
    // Hàng chính nó đã bị xóa: chỉ staff-deleted (owner/co_owner/editor, course chưa xóa) đọc được.
    if (!hasStaffDeletedPolicy.has(table) || !isStaff(actor)) return false;
    // cards: policy staff còn đòi topic cha hiện ra với người gọi; ở các cây này topic cha còn active và đọc được.
    return true;
  }
  if (!readsTopic(actor, tree)) return false;
  for (const level of chain[table]) {
    if (level === selfLevel[table] || level !== tree.removed) continue;
    if ((level === "course" || level === "chapter") && actor === "admin") continue;
    return false;
  }
  return true;
}

async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const r = await service.from(table).insert(rows as never);
  if (r.error) throw new Error(`${table}: ${r.error.message}`);
}

async function createExtraUser(label: string): Promise<Extra> {
  const email = `lf3-read-${label}-${randomUUID()}@example.com`;
  const r = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `LF3 ${label}` }, app_metadata: { d7_server_created: true },
  });
  if (r.error || !r.data.user) throw new Error(`createUser ${label}: ${r.error?.message}`);
  createdUsers.push(r.data.user.id);
  return { id: r.data.user.id, email };
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  const r = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (r.error) throw new Error(`signIn ${email}: ${r.error.message}`);
  return client;
}

async function buildTree(
  name: string,
  { removed = null, topicStatus = "published", courseStatus = "published" }:
    { removed?: Level | null; topicStatus?: "draft" | "published"; courseStatus?: "draft" | "published" } = {},
): Promise<Tree> {
  const t: Tree = {
    name, removed, topicStatus, courseStatus,
    courseId: randomUUID(), chapterId: randomUUID(), topicId: randomUUID(), cardId: randomUUID(),
    exerciseId: randomUUID(), groupId: randomUUID(), questionId: randomUUID(), optionId: randomUUID(),
  };
  trees.push(t);
  await insert("courses", { id: t.courseId, title: `LF3 read ${name}`, slug: `lf3-read-${t.courseId}`, price: 0, status: courseStatus });
  const member = (userId: string, role: string, canReview = false) =>
    ({ course_id: t.courseId, user_id: userId, role, added_by: TEACHER.id, can_review_topics: canReview });
  await insert("course_collaborators", [
    member(TEACHER.id, "owner"), member(extra.coOwner.id, "co_owner"), member(EDITOR.id, "editor"),
    member(PREVIEWER.id, "previewer"), member(extra.groupMember.id, "previewer"), member(extra.reviewer.id, "previewer", true),
  ]);
  await insert("enrollments", { course_id: t.courseId, user_id: extra.enrolled.id });
  await insert("chapters", { id: t.chapterId, course_id: t.courseId, title: "LF3", created_by_user_id: TEACHER.id, order_index: 0 });
  await insert("topics", {
    id: t.topicId, course_id: t.courseId, chapter_id: t.chapterId, title: "LF3", slug: `lf3-read-${t.topicId}`,
    status: topicStatus, first_approved_at: topicStatus === "published" ? new Date().toISOString() : null, order_index: 0,
    original_creator_user_id: TEACHER.id, responsible_author_user_id: TEACHER.id,
  });
  await insert("topic_contributors", { topic_id: t.topicId, user_id: extra.groupMember.id, added_by_user_id: TEACHER.id });
  await insert("cards", { id: t.cardId, topic_id: t.topicId, front_content: { word: "lf3" }, back_content: { translation: "lf3" } });
  await insert("exercises", {
    id: t.exerciseId, topic_id: t.topicId, course_id: t.courseId, title: "LF3", part_type: "part5", activity_stage: "exercise", order_index: 0,
  });
  await insert("question_groups", { id: t.groupId, exercise_id: t.exerciseId, passage_text: "LF3 passage", order_index: 0 });
  await insert("questions", { id: t.questionId, exercise_id: t.exerciseId, course_id: t.courseId, group_id: t.groupId, content: "LF3 q", order_index: 0 });
  await insert("question_options", { id: t.optionId, question_id: t.questionId, content: "A", label: "A", is_correct: true, order_index: 0 });

  const removedAt = new Date().toISOString();
  const target: Partial<Record<Level, [string, string]>> = {
    course: ["courses", t.courseId], chapter: ["chapters", t.chapterId], topic: ["topics", t.topicId], card: ["cards", t.cardId],
    exercise: ["exercises", t.exerciseId], group: ["question_groups", t.groupId], question: ["questions", t.questionId],
    option: ["question_options", t.optionId],
  };
  if (removed) {
    const [tbl, id] = target[removed]!;
    const r = await service.from(tbl).update({ removed_at: removedAt }).eq("id", id);
    if (r.error) throw new Error(`remove ${removed}: ${r.error.message}`);
  }
  return t;
}

async function visibleIds(client: SupabaseClient, t: Tree, table: Table): Promise<string[]> {
  const filter: Record<Table, [string, string, string]> = {
    topics: ["id", "course_id", t.courseId],
    cards: ["id", "topic_id", t.topicId],
    exercises: ["id", "topic_id", t.topicId],
    question_groups: ["id", "exercise_id", t.exerciseId],
    questions: ["id", "exercise_id", t.exerciseId],
    question_options: ["id", "question_id", t.questionId],
  };
  const [col, key, value] = filter[table];
  const r = await client.from(table).select(col).eq(key, value);
  if (r.error) throw new Error(`${table} read as client failed: ${r.error.message}`);
  return (r.data as unknown as Array<Record<string, string>>).map((row) => row[col]);
}

const rowIdOf = (t: Tree, table: Table) => ({
  topics: t.topicId, cards: t.cardId, exercises: t.exerciseId,
  question_groups: t.groupId, questions: t.questionId, question_options: t.optionId,
}[table]);

const tables: Table[] = ["topics", "cards", "exercises", "question_groups", "questions", "question_options"];
const actors: ActorKey[] = [
  "enrolled", "unenrolled", "anon", "previewer", "owner", "coOwner", "editor", "groupMember", "reviewer", "admin",
];

async function cleanup() {
  for (const t of trees.splice(0)) {
    await service.from("question_options").delete().eq("question_id", t.questionId);
    await service.from("questions").delete().eq("id", t.questionId);
    await service.from("question_groups").delete().eq("id", t.groupId);
    await service.from("exercises").delete().eq("id", t.exerciseId);
    await service.from("cards").delete().eq("id", t.cardId);
    await service.from("topic_contributors").delete().eq("topic_id", t.topicId);
    await service.from("topics").delete().eq("id", t.topicId);
    await service.from("chapters").delete().eq("id", t.chapterId);
    await service.from("enrollments").delete().eq("course_id", t.courseId);
    await service.from("course_collaborators").delete().eq("course_id", t.courseId);
    await service.from("courses").delete().eq("id", t.courseId);
  }
  for (const id of createdUsers.splice(0)) await service.auth.admin.deleteUser(id);
}

describe.sequential("LF3 content read boundary matrix (AC3)", () => {
  beforeAll(async () => {
    for (const label of ["enrolled", "unenrolled", "coOwner", "groupMember", "reviewer"] as const) {
      extra[label] = await createExtraUser(label);
    }
    clients.anon = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
    clients.admin = await signIn(ADMIN.email);
    clients.owner = await signIn(TEACHER.email);
    clients.editor = await signIn(EDITOR.email);
    clients.previewer = await signIn(PREVIEWER.email);
    for (const label of ["enrolled", "unenrolled", "coOwner", "groupMember", "reviewer"] as const) {
      clients[label] = await signIn(extra[label].email);
    }
    await buildTree("published");
    await buildTree("draft topic", { topicStatus: "draft" });
    await buildTree("draft course", { courseStatus: "draft" });
    for (const level of ["option", "question", "group", "exercise", "card", "topic", "chapter", "course"] as const) {
      await buildTree(`removed ${level}`, { removed: level });
    }
  }, 120_000);
  afterAll(cleanup, 60_000);

  for (const actor of actors) {
    it(`gives ${actor} exactly the rows the baseline policies allow at every level and tree state`, async () => {
      const mismatches: string[] = [];
      for (const tree of trees) {
        for (const table of tables) {
          const ids = await visibleIds(clients[actor], tree, table);
          const expected = expectedVisible(actor, tree, table);
          const actual = ids.includes(rowIdOf(tree, table));
          if (actual !== expected) mismatches.push(`${tree.name} / ${table}: expected ${expected}, got ${actual}`);
          // Không bao giờ trả hàng ngoài bộ lọc cha đã yêu cầu.
          expect(ids.length).toBeLessThanOrEqual(1);
        }
      }
      expect(mismatches).toEqual([]);
    }, 120_000);
  }

  it("covers both allowed and denied cells so the matrix cannot pass vacuously", () => {
    const published = trees.find((t) => t.name === "published")!;
    expect(expectedVisible("enrolled", published, "question_options")).toBe(true);
    expect(expectedVisible("unenrolled", published, "topics")).toBe(false);
    expect(expectedVisible("anon", published, "cards")).toBe(false);
    const cells = trees.flatMap((tree) => actors.flatMap((actor) => tables.map((table) => expectedVisible(actor, tree, table))));
    expect(cells).toHaveLength(trees.length * actors.length * tables.length);
    expect(cells.filter(Boolean).length).toBeGreaterThan(100);
    expect(cells.filter((visible) => !visible).length).toBeGreaterThan(100);
  });
});
