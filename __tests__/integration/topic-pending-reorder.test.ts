import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra quyết định Owner 2026-10-01 (R3) — bài `pending` được đổi chỗ, mọi pending-freeze khác giữ nguyên — và RPC kéo-thả `move_topic_to_position`.
// - Loại test: real local Supabase integration/RPC/trigger.
// - Đối tượng: move_topic_order (không còn chặn pending), move_topic_to_position, trigger d1_guard_topic_lifecycle_mutation (ngoại lệ chỉ cho order_index/updated_at), approve_topic_review sau khi đổi chỗ.
// - Case thành công: bài pending đổi chỗ lên/xuống và vẫn pending với submission còn mở; bài khác đổi chỗ qua bài pending; approve sau khi đổi chỗ vẫn publish; kéo lên/xuống/đầu/giữa/cuối và xuyên khoảng trống soft-delete; move-to-position giữ nguyên mọi cột ngoài order_index/updated_at.
// - Case thất bại: anchor đã xóa / ở chương khác / không tồn tại → TOPIC_ORDER_STALE; topic hoặc chương đã xóa; previewer, non-member và anonymous bị từ chối; thứ tự không đổi sau mỗi lỗi.
// - Bảo mật/phân quyền: authority vẫn là d1_is_active_course_author (COURSE_EDIT_FORBIDDEN); client chỉ gửi id, không gửi order_index; client không có quyền UPDATE trực tiếp trên topics.
// - Ổn định/resilience: unique index active không bị vi phạm sau mỗi case; move-to-position lặp lại cùng input là no-op.
// - Invariant cần giữ: ngoại lệ pending-order chỉ đổi order_index/updated_at; pending-freeze của rename/content/delete/hide không đổi (đã có test riêng, chạy không sửa).
// - Giới hạn: A3 nhánh "cờ order bật nhưng cột khác đổi" chỉ chạm được bằng SQL trực tiếp, nên được kiểm tra thủ công bằng psql và ghi trong plan State, không nằm trong file này.
// - Kết quả verify gần nhất: passed (10 test) bằng `npm run test:integration -- __tests__/integration/topic-pending-reorder.test.ts`; toàn bộ `npm run test:integration` passed (224 test).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";

const USERS = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
} as const;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const courseIds = new Set<string>();

let teacher: SupabaseClient;
let student: SupabaseClient;
let anonymous: SupabaseClient;

type TopicState = {
  id: string;
  title: string;
  status: string;
  order_index: number;
  removed_at: string | null;
};

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  if (!SUPABASE_URL.startsWith("http://127.0.0.1:45321")) {
    throw new Error(`Refusing non-local Supabase URL: ${SUPABASE_URL}`);
  }
}

async function signIn(email: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return client;
}

function must<T>(result: { data: T; error: { message?: string } | null }, step: string): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`Fixture step failed (${step}): ${result.error?.message ?? "no data"}`);
  }
  return result.data as NonNullable<T>;
}

function mustOk(result: { error: { message?: string } | null }, step: string) {
  if (result.error) throw new Error(`Fixture step failed (${step}): ${result.error.message}`);
}

async function createCourse(options: { studentRole?: "co_owner" | "previewer" } = {}) {
  const suffix = randomUUID();
  const course = must(
    await admin.from("courses").insert({
      title: `Pending reorder course ${suffix}`,
      slug: `pending-reorder-course-${suffix}`,
      description: "Fixture for pending-topic reorder integration test",
      status: "draft",
      price: 0,
    }).select("id").single(),
    "course",
  );
  courseIds.add(course.id);

  const collaborators: Array<Record<string, unknown>> = [
    { course_id: course.id, user_id: USERS.teacher.id, role: "owner", added_by: USERS.admin.id, can_review_topics: false },
  ];
  if (options.studentRole) {
    collaborators.push({
      course_id: course.id,
      user_id: USERS.student.id,
      role: options.studentRole,
      added_by: USERS.admin.id,
      can_review_topics: true,
    });
  }
  mustOk(await admin.from("course_collaborators").insert(collaborators), "collaborators");
  return course.id as string;
}

async function insertChapter(courseId: string, title: string, orderIndex: number, removed = false) {
  const chapter = must(
    await admin.from("chapters").insert({
      course_id: courseId,
      created_by_user_id: USERS.teacher.id,
      title,
      order_index: orderIndex,
      removed_at: removed ? new Date().toISOString() : null,
    }).select("id").single(),
    `chapter ${title}`,
  );
  return chapter.id as string;
}

async function insertTopic(
  courseId: string,
  chapterId: string,
  title: string,
  orderIndex: number,
  removed = false,
) {
  const topic = must(
    await admin.from("topics").insert({
      course_id: courseId,
      chapter_id: chapterId,
      title,
      status: "draft",
      order_index: orderIndex,
      original_creator_user_id: USERS.teacher.id,
      responsible_author_user_id: USERS.teacher.id,
      removed_at: removed ? new Date().toISOString() : null,
    }).select("id").single(),
    `topic ${title}`,
  );
  return topic.id as string;
}

// Cần đủ card + exercise thì request_topic_review mới qua readiness.
async function makePending(courseId: string, topicId: string) {
  mustOk(await admin.from("cards").insert({
    topic_id: topicId,
    front_content: { word: "word" },
    back_content: { translation: "nghĩa" },
    order_index: 0,
  }), "card");
  mustOk(await admin.from("exercises").insert({
    topic_id: topicId,
    course_id: courseId,
    title: "exercise",
    part_type: "part_5",
    order_index: 0,
  }), "exercise");
  const request = await teacher.rpc("request_topic_review", { p_topic_id: topicId });
  expect(request.error).toBeNull();
}

async function getTopics(chapterId: string) {
  const { data, error } = await admin
    .from("topics")
    .select("id, title, status, order_index, removed_at")
    .eq("chapter_id", chapterId)
    .order("order_index", { ascending: true });
  if (error || !data) throw new Error(`Topic state failed: ${error?.message}`);
  return data as TopicState[];
}

async function activeTitles(chapterId: string) {
  return (await getTopics(chapterId)).filter((topic) => topic.removed_at === null).map((topic) => topic.title);
}

async function expectUniqueActiveOrder(chapterId: string) {
  const orders = (await getTopics(chapterId)).filter((topic) => topic.removed_at === null).map((topic) => topic.order_index);
  expect(new Set(orders).size).toBe(orders.length);
}

async function getFullTopicRow(topicId: string) {
  const { data, error } = await admin.from("topics").select("*").eq("id", topicId).single();
  if (error || !data) throw new Error(`Topic row failed: ${error?.message}`);
  return data as Record<string, unknown>;
}

function withoutOrderColumns(row: Record<string, unknown>) {
  const rest = { ...row };
  delete rest.order_index;
  delete rest.updated_at;
  return rest;
}

async function pendingSubmission(topicId: string) {
  const { data, error } = await admin
    .from("topic_review_submissions")
    .select("id, status")
    .eq("topic_id", topicId)
    .eq("status", "pending")
    .single();
  if (error || !data) throw new Error(`Pending submission missing: ${error?.message}`);
  return data;
}

function expectRpcError(result: { error: { message?: string } | null }, code: string) {
  expect(result.error).not.toBeNull();
  expect(result.error?.message).toContain(code);
}

async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length === 0) return;
  // Service role bỏ qua guard; xóa theo thứ tự FK vì courses không cascade xuống topics/exercises.
  const steps: Array<[string, PromiseLike<{ error: { message?: string } | null }>]> = [
    ["exercises", admin.from("exercises").delete().in("course_id", ids)],
    ["topics", admin.from("topics").delete().in("course_id", ids)],
    ["chapters", admin.from("chapters").delete().in("course_id", ids)],
    ["course_collaborators", admin.from("course_collaborators").delete().in("course_id", ids)],
    ["courses", admin.from("courses").delete().in("id", ids)],
  ];
  for (const [step, pending] of steps) {
    const { error } = await pending;
    if (error) throw new Error(`Cleanup failed at ${step}: ${error.message}`);
  }
}

describe.sequential("topic reorder with pending topics and drag-and-drop position RPC", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    teacher = await signIn(USERS.teacher.email);
    student = await signIn(USERS.student.email);
    anonymous = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterEach(cleanup);

  async function pendingMiddleFixture() {
    const courseId = await createCourse({ studentRole: "co_owner" });
    const chapterId = await insertChapter(courseId, "Reorder chapter", 1);
    const a = await insertTopic(courseId, chapterId, "A", 1);
    const b = await insertTopic(courseId, chapterId, "B", 2);
    const c = await insertTopic(courseId, chapterId, "C", 3);
    await makePending(courseId, b);
    return { courseId, chapterId, a, b, c };
  }

  it("lets the up/down RPC move a pending topic and move a draft topic past it without leaving pending", async () => {
    const { chapterId, a, b, c } = await pendingMiddleFixture();
    const submissionBefore = await pendingSubmission(b);
    const pendingRowBefore = await getFullTopicRow(b);

    const pendingDown = await teacher.rpc("move_topic_order", { p_topic_id: b, p_direction: "down" });
    expect(pendingDown.error).toBeNull();
    expect(pendingDown.data).toMatchObject({ status: "moved", topic_id: b, neighbor_topic_id: c });
    expect(await activeTitles(chapterId)).toEqual(["A", "C", "B"]);

    const pendingUp = await teacher.rpc("move_topic_order", { p_topic_id: b, p_direction: "up" });
    expect(pendingUp.error).toBeNull();
    expect(await activeTitles(chapterId)).toEqual(["A", "B", "C"]);

    // Bài nháp đi qua bài pending ở cả hai chiều.
    const draftOverPendingDown = await teacher.rpc("move_topic_order", { p_topic_id: a, p_direction: "down" });
    expect(draftOverPendingDown.error).toBeNull();
    expect(await activeTitles(chapterId)).toEqual(["B", "A", "C"]);
    const draftOverPendingUp = await teacher.rpc("move_topic_order", { p_topic_id: a, p_direction: "up" });
    expect(draftOverPendingUp.error).toBeNull();
    expect(await activeTitles(chapterId)).toEqual(["A", "B", "C"]);

    const pendingRowAfter = await getFullTopicRow(b);
    expect(pendingRowAfter.status).toBe("pending");
    expect(withoutOrderColumns(pendingRowAfter)).toEqual(withoutOrderColumns(pendingRowBefore));
    expect((await pendingSubmission(b)).id).toBe(submissionBefore.id);
    await expectUniqueActiveOrder(chapterId);
  });

  it("still publishes a moved pending topic when a reviewer approves it", async () => {
    const { chapterId, b } = await pendingMiddleFixture();
    expect((await teacher.rpc("move_topic_order", { p_topic_id: b, p_direction: "down" })).error).toBeNull();

    const submission = await pendingSubmission(b);
    const approved = await student.rpc("approve_topic_review", { p_submission_id: submission.id });
    expect(approved.error).toBeNull();

    const topics = await getTopics(chapterId);
    expect(topics.find((topic) => topic.id === b)).toMatchObject({ status: "published" });
    expect(await activeTitles(chapterId)).toEqual(["A", "C", "B"]);
  });

  it("keeps every other pending freeze: a moved pending topic still rejects rename, content and direct writes", async () => {
    const { b } = await pendingMiddleFixture();
    expect((await teacher.rpc("move_topic_order", { p_topic_id: b, p_direction: "down" })).error).toBeNull();

    expectRpcError(
      await teacher.rpc("d1_update_topic", { p_topic_id: b, p_title: "renamed while pending", p_confirm_published: false }),
      "TOPIC_PENDING_FROZEN",
    );
    const directWrite = await teacher.from("topics").update({ order_index: 99 }).eq("id", b).select("id").single();
    expect(directWrite.data).toBeNull();
    expect(directWrite.error).not.toBeNull();
    const row = await getFullTopicRow(b);
    expect(row.title).toBe("B");
    expect(row.status).toBe("pending");
  });

  it("moves a topic to first, middle and last position and keeps the active order unique", async () => {
    const courseId = await createCourse();
    const chapterId = await insertChapter(courseId, "Position chapter", 1);
    const ids = {
      a: await insertTopic(courseId, chapterId, "A", 1),
      b: await insertTopic(courseId, chapterId, "B", 2),
      c: await insertTopic(courseId, chapterId, "C", 3),
      d: await insertTopic(courseId, chapterId, "D", 4),
    };

    const toFirst = await teacher.rpc("move_topic_to_position", { p_topic_id: ids.d, p_before_topic_id: ids.a });
    expect(toFirst.error).toBeNull();
    expect(toFirst.data).toMatchObject({ status: "moved", topic_id: ids.d, previous_order_index: 4, new_order_index: 1 });
    expect(await activeTitles(chapterId)).toEqual(["D", "A", "B", "C"]);
    await expectUniqueActiveOrder(chapterId);

    const toMiddle = await teacher.rpc("move_topic_to_position", { p_topic_id: ids.d, p_before_topic_id: ids.c });
    expect(toMiddle.error).toBeNull();
    expect(toMiddle.data).toMatchObject({ status: "moved", previous_order_index: 1, new_order_index: 3 });
    expect(await activeTitles(chapterId)).toEqual(["A", "B", "D", "C"]);
    await expectUniqueActiveOrder(chapterId);

    const toLast = await teacher.rpc("move_topic_to_position", { p_topic_id: ids.a, p_before_topic_id: null });
    expect(toLast.error).toBeNull();
    expect(toLast.data).toMatchObject({ status: "moved", previous_order_index: 1, new_order_index: 4 });
    expect(await activeTitles(chapterId)).toEqual(["B", "D", "C", "A"]);
    await expectUniqueActiveOrder(chapterId);

    const lastToFirst = await teacher.rpc("move_topic_to_position", { p_topic_id: ids.a, p_before_topic_id: ids.b });
    expect(lastToFirst.error).toBeNull();
    expect(await activeTitles(chapterId)).toEqual(["A", "B", "D", "C"]);
    await expectUniqueActiveOrder(chapterId);
  });

  it("returns no-op when the topic is already in the requested place", async () => {
    const courseId = await createCourse();
    const chapterId = await insertChapter(courseId, "Noop chapter", 1);
    const a = await insertTopic(courseId, chapterId, "A", 1);
    const b = await insertTopic(courseId, chapterId, "B", 2);
    const c = await insertTopic(courseId, chapterId, "C", 3);
    const before = await getTopics(chapterId);

    const beforeItsNeighbour = await teacher.rpc("move_topic_to_position", { p_topic_id: a, p_before_topic_id: b });
    const beforeItself = await teacher.rpc("move_topic_to_position", { p_topic_id: b, p_before_topic_id: b });
    const lastStaysLast = await teacher.rpc("move_topic_to_position", { p_topic_id: c, p_before_topic_id: null });

    for (const result of [beforeItsNeighbour, beforeItself, lastStaysLast]) {
      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({ status: "noop", reason: "already_in_place" });
    }
    expect(await getTopics(chapterId)).toEqual(before);
  });

  it("moves across soft-deleted gaps and lets pending topics move or be passed, leaving other columns untouched", async () => {
    const courseId = await createCourse({ studentRole: "co_owner" });
    const chapterId = await insertChapter(courseId, "Gap chapter", 1);
    const a = await insertTopic(courseId, chapterId, "A", 1);
    await insertTopic(courseId, chapterId, "Gone", 2, true);
    const c = await insertTopic(courseId, chapterId, "C", 3);
    const d = await insertTopic(courseId, chapterId, "D", 5);
    await makePending(courseId, c);
    const pendingBefore = await getFullTopicRow(c);
    const submissionBefore = await pendingSubmission(c);

    // Bài nháp kéo qua bài pending.
    expect((await teacher.rpc("move_topic_to_position", { p_topic_id: d, p_before_topic_id: c })).error).toBeNull();
    expect(await activeTitles(chapterId)).toEqual(["A", "D", "C"]);
    // Bài pending tự kéo lên đầu, rồi xuống cuối.
    expect((await teacher.rpc("move_topic_to_position", { p_topic_id: c, p_before_topic_id: a })).error).toBeNull();
    expect(await activeTitles(chapterId)).toEqual(["C", "A", "D"]);
    expect((await teacher.rpc("move_topic_to_position", { p_topic_id: c, p_before_topic_id: null })).error).toBeNull();
    expect(await activeTitles(chapterId)).toEqual(["A", "D", "C"]);

    const pendingAfter = await getFullTopicRow(c);
    expect(pendingAfter.status).toBe("pending");
    expect(withoutOrderColumns(pendingAfter)).toEqual(withoutOrderColumns(pendingBefore));
    expect((await pendingSubmission(c)).id).toBe(submissionBefore.id);
    await expectUniqueActiveOrder(chapterId);

    const approved = await student.rpc("approve_topic_review", { p_submission_id: submissionBefore.id });
    expect(approved.error).toBeNull();
    expect((await getTopics(chapterId)).find((topic) => topic.id === c)).toMatchObject({ status: "published" });
  });

  it("rejects a stale anchor without changing the persisted order", async () => {
    const courseId = await createCourse();
    const chapterId = await insertChapter(courseId, "Stale chapter", 1);
    const otherChapterId = await insertChapter(courseId, "Other chapter", 2);
    const a = await insertTopic(courseId, chapterId, "A", 1);
    const b = await insertTopic(courseId, chapterId, "B", 2);
    const removedAnchor = await insertTopic(courseId, chapterId, "Removed", 3, true);
    const foreignAnchor = await insertTopic(courseId, otherChapterId, "Foreign", 1);
    const before = await getTopics(chapterId);

    for (const anchor of [removedAnchor, foreignAnchor, randomUUID()]) {
      const result = await teacher.rpc("move_topic_to_position", { p_topic_id: a, p_before_topic_id: anchor });
      expectRpcError(result, "TOPIC_ORDER_STALE");
    }
    expect(await getTopics(chapterId)).toEqual(before);
    expect(b).toBeTruthy();
  });

  it("rejects removed topics, removed chapters and unknown topics", async () => {
    const courseId = await createCourse();
    const chapterId = await insertChapter(courseId, "Live chapter", 1);
    const removedChapterId = await insertChapter(courseId, "Removed chapter", 2, true);
    const live = await insertTopic(courseId, chapterId, "Live", 1);
    const removedTopic = await insertTopic(courseId, chapterId, "Removed", 2, true);
    const inRemovedChapter = await insertTopic(courseId, removedChapterId, "In removed chapter", 1);

    expectRpcError(
      await teacher.rpc("move_topic_to_position", { p_topic_id: removedTopic, p_before_topic_id: live }),
      "TOPIC_REMOVED",
    );
    expectRpcError(
      await teacher.rpc("move_topic_to_position", { p_topic_id: inRemovedChapter, p_before_topic_id: null }),
      "CHAPTER_REMOVED",
    );
    expectRpcError(
      await teacher.rpc("move_topic_to_position", { p_topic_id: randomUUID(), p_before_topic_id: null }),
      "TOPIC_NOT_FOUND",
    );
    expect(await activeTitles(chapterId)).toEqual(["Live"]);
  });

  it("denies previewer, non-member and anonymous callers without changing order", async () => {
    // Student là previewer có quyền review: đủ để topic pending có reviewer,
    // nhưng d1_is_active_course_author (D37/D40) không cho previewer đổi cấu trúc.
    const courseId = await createCourse({ studentRole: "previewer" });
    const chapterId = await insertChapter(courseId, "Denied chapter", 1);
    const a = await insertTopic(courseId, chapterId, "A", 1);
    const b = await insertTopic(courseId, chapterId, "B", 2);
    await makePending(courseId, b);
    const before = await getTopics(chapterId);

    expectRpcError(
      await student.rpc("move_topic_to_position", { p_topic_id: b, p_before_topic_id: a }),
      "COURSE_EDIT_FORBIDDEN",
    );
    expectRpcError(await student.rpc("move_topic_order", { p_topic_id: b, p_direction: "up" }), "COURSE_EDIT_FORBIDDEN");

    // Hạ chính teacher xuống previewer: cùng kết quả, không phải ngoại lệ của riêng student.
    mustOk(
      await admin.from("course_collaborators").update({ role: "previewer" })
        .eq("course_id", courseId).eq("user_id", USERS.teacher.id),
      "downgrade teacher to previewer",
    );
    expectRpcError(
      await teacher.rpc("move_topic_to_position", { p_topic_id: b, p_before_topic_id: a }),
      "COURSE_EDIT_FORBIDDEN",
    );
    expectRpcError(await teacher.rpc("move_topic_order", { p_topic_id: b, p_direction: "up" }), "COURSE_EDIT_FORBIDDEN");

    const anonymousResult = await anonymous.rpc("move_topic_to_position", { p_topic_id: a, p_before_topic_id: null });
    expect(anonymousResult.error).not.toBeNull();
    expect(await getTopics(chapterId)).toEqual(before);
  });

  it("denies a caller who is not a member of the course", async () => {
    const courseId = await createCourse();
    const chapterId = await insertChapter(courseId, "Private chapter", 1);
    const a = await insertTopic(courseId, chapterId, "A", 1);
    await insertTopic(courseId, chapterId, "B", 2);
    const before = await getTopics(chapterId);

    expectRpcError(
      await student.rpc("move_topic_to_position", { p_topic_id: a, p_before_topic_id: null }),
      "COURSE_EDIT_FORBIDDEN",
    );
    expectRpcError(await student.rpc("move_topic_order", { p_topic_id: a, p_direction: "down" }), "COURSE_EDIT_FORBIDDEN");
    expect(await getTopics(chapterId)).toEqual(before);
  });
});
