import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra authority D2 cho chapter cùng ordering topic/chapter bằng Supabase local thật.
// - Loại test: integration/RPC/Supabase.
// - Đối tượng: create_chapter_ordered, move_chapter_order, hide_chapter, restore_chapter_ordered, chapter RLS và Data API column grants, cùng topic ordering RPC.
// - Case thành công: tạo order max+1 tính cả soft-deleted row; move up/down persist vào DB; boundary soft-deleted rows tạo no-op đúng.
// - Case thất bại: unauthenticated, non-member/global admin, previewer/editor reorder, creator spoofing, invalid direction, mismatch course/chapter, removed target và removed parent.
// - Bảo mật/phân quyền: service-role chỉ dựng fixture/cleanup/assert; RPC app flow dùng client đã đăng nhập.
// - Ổn định/resilience: fixture cô lập theo course UUID, cleanup fail loud, helper kiểm tra active unique invariant.
// - Invariant cần giữ: creator do create RPC gán; editor chỉ sửa/ẩn/khôi phục chương của mình; owner/co_owner reorder; restore nối vào cuối active order; active order unique.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:integration -- __tests__/integration/course-structure-ordering-rpc.test.ts`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEEDED_TEACHER_EMAIL = "teacher@gmail.com";
const SEEDED_STUDENT_EMAIL = "student@gmail.com";
const SEEDED_ADMIN_EMAIL = "admin@gmail.com";
const SEEDED_PASSWORD = "123123";
const SEEDED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const SEEDED_ADMIN_ID = "11111111-1111-4111-8111-111111111111";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let teacherClient: SupabaseClient;
let studentClient: SupabaseClient;
let adminClient: SupabaseClient;
let anonymousClient: SupabaseClient;
const createdCourseIds = new Set<string>();

type CollaboratorRole = "owner" | "co_owner" | "editor" | "previewer";
type ChapterRow = {
  id: string;
  title: string;
  order_index: number;
  removed_at: string | null;
};
type TopicRow = ChapterRow & {
  chapter_id: string;
};

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true khi dang dung test/dev DB.",
    );
  }

  const url = new URL(SUPABASE_URL);
  const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "http:" || !isLocalHost) {
    throw new Error(
      `Chan test DB integration vi Supabase URL khong phai local: ${SUPABASE_URL}`,
    );
  }
}

async function signInSeededUser(email: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password: SEEDED_PASSWORD,
  });

  if (error) {
    throw new Error(`Khong the dang nhap seeded user ${email}: ${error.message}`);
  }

  return client;
}

function throwFixtureError(step: string, error: { message?: string } | null) {
  if (!error) return;
  throw new Error(`Khong the tao fixture PR7 ordering o buoc ${step}: ${error.message}`);
}

function throwCleanupError(
  courseId: string,
  step: string,
  error: { message?: string } | null,
) {
  if (!error) return;
  throw new Error(
    `Khong the cleanup fixture PR7 ordering o buoc ${step} cho course ${courseId}: ${
      error.message ?? "loi Supabase khong ro"
    }`,
  );
}

async function createCourseFixture(role: CollaboratorRole | null = "owner") {
  const suffix = randomUUID();
  const courseId = randomUUID();

  const { error: courseError } = await supabaseAdmin.from("courses").insert({
    id: courseId,
    title: `PR7 Ordering Course ${suffix}`,
    slug: `pr7-ordering-course-${suffix}`,
    description: "Course created by PR7 ordering RPC integration test",
    price: 0,
    status: "draft",
    order_index: 1,
    removed_at: null,
  });
  throwFixtureError("courses", courseError);

  createdCourseIds.add(courseId);

  if (role) {
    const { error: collaboratorError } = await supabaseAdmin
      .from("course_collaborators")
      .insert({
        course_id: courseId,
        user_id: SEEDED_TEACHER_ID,
        role,
        added_by: SEEDED_TEACHER_ID,
      });
    throwFixtureError("course_collaborators", collaboratorError);
  }

  return courseId;
}

async function addCollaborator(
  courseId: string,
  userId: string,
  role: CollaboratorRole,
) {
  const { error } = await supabaseAdmin.from("course_collaborators").upsert(
    {
      course_id: courseId,
      user_id: userId,
      role,
      added_by: SEEDED_TEACHER_ID,
    },
    { onConflict: "course_id,user_id" },
  );
  throwFixtureError("course_collaborators upsert", error);
}

async function insertChapter(
  courseId: string,
  title: string,
  orderIndex: number,
  removedAt: string | null = null,
  createdByUserId = SEEDED_TEACHER_ID,
) {
  const id = randomUUID();
  const { error } = await supabaseAdmin.from("chapters").insert({
    id,
    course_id: courseId,
    created_by_user_id: createdByUserId,
    title,
    order_index: orderIndex,
    removed_at: removedAt,
  });
  throwFixtureError(`chapters:${title}`, error);
  return id;
}

async function insertTopic(
  courseId: string,
  chapterId: string,
  title: string,
  orderIndex: number,
  removedAt: string | null = null,
) {
  const id = randomUUID();
  const { error } = await supabaseAdmin.from("topics").insert({
    id,
    course_id: courseId,
    chapter_id: chapterId,
    title,
    slug: `pr7-ordering-topic-${randomUUID()}`,
    status: "draft",
    order_index: orderIndex,
    original_creator_user_id: SEEDED_TEACHER_ID,
    responsible_author_user_id: SEEDED_TEACHER_ID,
    removed_at: removedAt,
  });
  throwFixtureError(`topics:${title}`, error);
  return id;
}

async function getChapters(courseId: string) {
  const { data, error } = await supabaseAdmin
    .from("chapters")
    .select("id, title, order_index, removed_at")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  if (error) throw new Error(`Khong the doc chapters test: ${error.message}`);
  return (data ?? []) as ChapterRow[];
}

async function getTopics(chapterId: string) {
  const { data, error } = await supabaseAdmin
    .from("topics")
    .select("id, chapter_id, title, order_index, removed_at")
    .eq("chapter_id", chapterId)
    .order("order_index", { ascending: true });

  if (error) throw new Error(`Khong the doc topics test: ${error.message}`);
  return (data ?? []) as TopicRow[];
}

async function cleanupCourse(courseId: string) {
  const { error: deleteTopicsError } = await supabaseAdmin
    .from("topics")
    .delete()
    .eq("course_id", courseId);
  throwCleanupError(courseId, "xoa topics", deleteTopicsError);

  const { error: deleteChaptersError } = await supabaseAdmin
    .from("chapters")
    .delete()
    .eq("course_id", courseId);
  throwCleanupError(courseId, "xoa chapters", deleteChaptersError);

  const { error: deleteCollaboratorsError } = await supabaseAdmin
    .from("course_collaborators")
    .delete()
    .eq("course_id", courseId);
  throwCleanupError(courseId, "xoa course_collaborators", deleteCollaboratorsError);

  const { error: deleteCourseError } = await supabaseAdmin
    .from("courses")
    .delete()
    .eq("id", courseId);
  throwCleanupError(courseId, "xoa courses", deleteCourseError);
}

async function cleanupCreatedData() {
  for (const courseId of Array.from(createdCourseIds)) {
    await cleanupCourse(courseId);
    createdCourseIds.delete(courseId);
  }
}

function expectUniqueActiveOrder(rows: ChapterRow[] | TopicRow[]) {
  const activeOrders = rows
    .filter((row) => row.removed_at === null)
    .map((row) => row.order_index);
  expect(new Set(activeOrders).size).toBe(activeOrders.length);
}

async function expectNoActiveChapterDuplicate(courseId: string) {
  expectUniqueActiveOrder(await getChapters(courseId));
}

async function expectNoActiveTopicDuplicate(chapterId: string) {
  expectUniqueActiveOrder(await getTopics(chapterId));
}

function expectRpcError(error: { message?: string } | null, code: string) {
  expect(error?.message).toContain(code);
}

describe.sequential("course structure ordering RPC integration", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();

    teacherClient = await signInSeededUser(SEEDED_TEACHER_EMAIL);
    studentClient = await signInSeededUser(SEEDED_STUDENT_EMAIL);
    adminClient = await signInSeededUser(SEEDED_ADMIN_EMAIL);
    anonymousClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterEach(async () => {
    await cleanupCreatedData();
  });

  afterAll(async () => {
    await cleanupCreatedData();
    await teacherClient?.auth.signOut();
    await studentClient?.auth.signOut();
    await adminClient?.auth.signOut();
  });

  it("create_chapter_ordered appends after soft-deleted chapter slots and enforces auth", async () => {
    const courseId = await createCourseFixture("owner");
    await insertChapter(courseId, "Active Chapter A", 1);
    await insertChapter(courseId, "Deleted Chapter B", 2, new Date().toISOString());

    const { data, error } = await teacherClient.rpc("create_chapter_ordered", {
      p_course_id: courseId,
      p_title: "Created Chapter C",
    });

    expect(error).toBeNull();
    const result = data as { status: string; chapter: { id: string; order_index: number } };
    expect(result.status).toBe("created");
    expect(result.chapter.order_index).toBe(3);
    const createdChapter = await supabaseAdmin
      .from("chapters")
      .select("created_by_user_id")
      .eq("id", result.chapter.id)
      .single();
    expect(createdChapter.data?.created_by_user_id).toBe(SEEDED_TEACHER_ID);

    const chapters = await getChapters(courseId);
    expect(chapters.map((chapter) => [chapter.title, chapter.order_index])).toEqual([
      ["Active Chapter A", 1],
      ["Deleted Chapter B", 2],
      ["Created Chapter C", 3],
    ]);
    await expectNoActiveChapterDuplicate(courseId);

    const unauthenticated = await anonymousClient.rpc("create_chapter_ordered", {
      p_course_id: courseId,
      p_title: "Anonymous Chapter",
    });
    expectRpcError(unauthenticated.error, "AUTH_REQUIRED");

    const unauthorized = await studentClient.rpc("create_chapter_ordered", {
      p_course_id: courseId,
      p_title: "Student Chapter",
    });
    expectRpcError(unauthorized.error, "COURSE_EDIT_FORBIDDEN");
  });

  it("create_topic_ordered appends after soft-deleted topic slots and rejects invalid parent context", async () => {
    const courseId = await createCourseFixture("owner");
    const chapterId = await insertChapter(courseId, "Topic Parent Chapter", 1);
    await insertTopic(courseId, chapterId, "Active Topic A", 1);
    await insertTopic(courseId, chapterId, "Deleted Topic B", 2, new Date().toISOString());

    const { data, error } = await teacherClient.rpc("create_topic_ordered", {
      p_course_id: courseId,
      p_chapter_id: chapterId,
      p_title: "Created Topic C",
    });

    expect(error).toBeNull();
    const result = data as { status: string; topic: { id: string; order_index: number } };
    expect(result.status).toBe("created");
    expect(result.topic.order_index).toBe(3);

    const topics = await getTopics(chapterId);
    expect(topics.map((topic) => [topic.title, topic.order_index])).toEqual([
      ["Active Topic A", 1],
      ["Deleted Topic B", 2],
      ["Created Topic C", 3],
    ]);
    await expectNoActiveTopicDuplicate(chapterId);

    const otherCourseId = await createCourseFixture("owner");
    const mismatch = await teacherClient.rpc("create_topic_ordered", {
      p_course_id: otherCourseId,
      p_chapter_id: chapterId,
      p_title: "Mismatch Topic",
    });
    expectRpcError(mismatch.error, "TOPIC_COURSE_MISMATCH");

    const removedChapterId = await insertChapter(
      courseId,
      "Removed Topic Parent",
      10,
      new Date().toISOString(),
    );
    const removedParent = await teacherClient.rpc("create_topic_ordered", {
      p_course_id: courseId,
      p_chapter_id: removedChapterId,
      p_title: "Removed Parent Topic",
    });
    expectRpcError(removedParent.error, "CHAPTER_REMOVED");
  });

  it("move_chapter_order moves active middle chapters up and down while preserving the unique invariant", async () => {
    const courseId = await createCourseFixture("owner");
    const chapterAId = await insertChapter(courseId, "Chapter A", 1);
    const chapterBId = await insertChapter(courseId, "Chapter B", 2);
    const chapterCId = await insertChapter(courseId, "Chapter C", 3);

    const moveUp = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: chapterBId,
      p_direction: "up",
    });
    expect(moveUp.error).toBeNull();
    expect(moveUp.data).toMatchObject({
      status: "moved",
      chapter_id: chapterBId,
      neighbor_chapter_id: chapterAId,
      previous_order_index: 2,
      new_order_index: 1,
    });
    expect((await getChapters(courseId)).map((chapter) => chapter.title)).toEqual([
      "Chapter B",
      "Chapter A",
      "Chapter C",
    ]);

    const moveDown = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: chapterAId,
      p_direction: "down",
    });
    expect(moveDown.error).toBeNull();
    expect(moveDown.data).toMatchObject({
      status: "moved",
      chapter_id: chapterAId,
      neighbor_chapter_id: chapterCId,
      previous_order_index: 2,
      new_order_index: 3,
    });
    expect((await getChapters(courseId)).map((chapter) => chapter.title)).toEqual([
      "Chapter B",
      "Chapter C",
      "Chapter A",
    ]);
    await expectNoActiveChapterDuplicate(courseId);
  });

  it("move_topic_order moves active middle topics up and down while preserving the unique invariant", async () => {
    const courseId = await createCourseFixture("owner");
    const chapterId = await insertChapter(courseId, "Topic Move Parent", 1);
    const topicAId = await insertTopic(courseId, chapterId, "Topic A", 1);
    const topicBId = await insertTopic(courseId, chapterId, "Topic B", 2);
    const topicCId = await insertTopic(courseId, chapterId, "Topic C", 3);

    const moveUp = await teacherClient.rpc("move_topic_order", {
      p_topic_id: topicBId,
      p_direction: "up",
    });
    expect(moveUp.error).toBeNull();
    expect(moveUp.data).toMatchObject({
      status: "moved",
      topic_id: topicBId,
      neighbor_topic_id: topicAId,
      previous_order_index: 2,
      new_order_index: 1,
    });
    expect((await getTopics(chapterId)).map((topic) => topic.title)).toEqual([
      "Topic B",
      "Topic A",
      "Topic C",
    ]);

    const moveDown = await teacherClient.rpc("move_topic_order", {
      p_topic_id: topicAId,
      p_direction: "down",
    });
    expect(moveDown.error).toBeNull();
    expect(moveDown.data).toMatchObject({
      status: "moved",
      topic_id: topicAId,
      neighbor_topic_id: topicCId,
      previous_order_index: 2,
      new_order_index: 3,
    });
    expect((await getTopics(chapterId)).map((topic) => topic.title)).toEqual([
      "Topic B",
      "Topic C",
      "Topic A",
    ]);
    await expectNoActiveTopicDuplicate(chapterId);
  });

  it("returns no-op for first and last active chapter/topic moves without mutating order", async () => {
    const courseId = await createCourseFixture("owner");
    const chapterAId = await insertChapter(courseId, "Noop Chapter A", 1);
    const chapterBId = await insertChapter(courseId, "Noop Chapter B", 2);
    const topicAId = await insertTopic(courseId, chapterAId, "Noop Topic A", 1);
    const topicBId = await insertTopic(courseId, chapterAId, "Noop Topic B", 2);

    const firstChapter = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: chapterAId,
      p_direction: "up",
    });
    const lastChapter = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: chapterBId,
      p_direction: "down",
    });
    const firstTopic = await teacherClient.rpc("move_topic_order", {
      p_topic_id: topicAId,
      p_direction: "up",
    });
    const lastTopic = await teacherClient.rpc("move_topic_order", {
      p_topic_id: topicBId,
      p_direction: "down",
    });

    expect(firstChapter.data).toMatchObject({ status: "noop", reason: "already_first" });
    expect(lastChapter.data).toMatchObject({ status: "noop", reason: "already_last" });
    expect(firstTopic.data).toMatchObject({ status: "noop", reason: "already_first" });
    expect(lastTopic.data).toMatchObject({ status: "noop", reason: "already_last" });
    expect((await getChapters(courseId)).map((chapter) => [chapter.title, chapter.order_index])).toEqual([
      ["Noop Chapter A", 1],
      ["Noop Chapter B", 2],
    ]);
    expect((await getTopics(chapterAId)).map((topic) => [topic.title, topic.order_index])).toEqual([
      ["Noop Topic A", 1],
      ["Noop Topic B", 2],
    ]);
  });

  it("rejects invalid move directions for chapters and topics without mutating order", async () => {
    const courseId = await createCourseFixture("owner");
    const chapterAId = await insertChapter(courseId, "Invalid Direction Chapter A", 1);
    const chapterBId = await insertChapter(courseId, "Invalid Direction Chapter B", 2);
    await insertTopic(courseId, chapterAId, "Invalid Direction Topic A", 1);
    const topicBId = await insertTopic(courseId, chapterAId, "Invalid Direction Topic B", 2);

    const chapterResult = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: chapterBId,
      p_direction: "sideways",
    });
    const topicResult = await teacherClient.rpc("move_topic_order", {
      p_topic_id: topicBId,
      p_direction: "sideways",
    });

    expectRpcError(chapterResult.error, "INVALID_DIRECTION");
    expectRpcError(topicResult.error, "INVALID_DIRECTION");
    expect((await getChapters(courseId)).map((chapter) => [chapter.title, chapter.order_index])).toEqual([
      ["Invalid Direction Chapter A", 1],
      ["Invalid Direction Chapter B", 2],
    ]);
    expect((await getTopics(chapterAId)).map((topic) => [topic.title, topic.order_index])).toEqual([
      ["Invalid Direction Topic A", 1],
      ["Invalid Direction Topic B", 2],
    ]);
  });

  it("moves across soft-deleted gaps by selecting the nearest active chapter and topic neighbor", async () => {
    const removedAt = new Date().toISOString();
    const courseId = await createCourseFixture("owner");
    const chapterAId = await insertChapter(courseId, "Gap Chapter A", 1);
    const chapterBId = await insertChapter(courseId, "Gap Chapter B", 2, removedAt);
    const chapterCId = await insertChapter(courseId, "Gap Chapter C", 3);
    const topicAId = await insertTopic(courseId, chapterAId, "Gap Topic A", 1);
    const topicBId = await insertTopic(courseId, chapterAId, "Gap Topic B", 2, removedAt);
    const topicCId = await insertTopic(courseId, chapterAId, "Gap Topic C", 3);

    const chapterMove = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: chapterCId,
      p_direction: "up",
    });
    expect(chapterMove.error).toBeNull();
    expect(chapterMove.data).toMatchObject({
      status: "moved",
      neighbor_chapter_id: chapterAId,
      new_order_index: 1,
    });

    const topicMove = await teacherClient.rpc("move_topic_order", {
      p_topic_id: topicCId,
      p_direction: "up",
    });
    expect(topicMove.error).toBeNull();
    expect(topicMove.data).toMatchObject({
      status: "moved",
      neighbor_topic_id: topicAId,
      new_order_index: 1,
    });

    const chapters = await getChapters(courseId);
    expect(chapters.map((chapter) => [chapter.title, chapter.order_index, chapter.removed_at === null])).toEqual([
      ["Gap Chapter C", 1, true],
      ["Gap Chapter B", 2, false],
      ["Gap Chapter A", 3, true],
    ]);
    expect(chapters.find((chapter) => chapter.id === chapterBId)?.order_index).toBe(2);

    const topics = await getTopics(chapterAId);
    expect(topics.map((topic) => [topic.title, topic.order_index, topic.removed_at === null])).toEqual([
      ["Gap Topic C", 1, true],
      ["Gap Topic B", 2, false],
      ["Gap Topic A", 3, true],
    ]);
    expect(topics.find((topic) => topic.id === topicBId)?.order_index).toBe(2);
    await expectNoActiveChapterDuplicate(courseId);
    await expectNoActiveTopicDuplicate(chapterAId);
  });

  it("keeps leading and trailing soft-deleted rows out of chapter and topic move neighbor selection", async () => {
    const removedAt = new Date().toISOString();
    const trailingCourseId = await createCourseFixture("owner");
    const trailingChapterAId = await insertChapter(
      trailingCourseId,
      "Trailing Boundary Chapter A",
      1,
    );
    const trailingChapterBId = await insertChapter(
      trailingCourseId,
      "Trailing Boundary Chapter B",
      5,
    );
    const trailingChapterCId = await insertChapter(
      trailingCourseId,
      "Trailing Boundary Chapter C",
      6,
      removedAt,
    );
    await insertTopic(trailingCourseId, trailingChapterAId, "Trailing Boundary Topic A", 1);
    const trailingTopicBId = await insertTopic(
      trailingCourseId,
      trailingChapterAId,
      "Trailing Boundary Topic B",
      5,
    );
    const trailingTopicCId = await insertTopic(
      trailingCourseId,
      trailingChapterAId,
      "Trailing Boundary Topic C",
      6,
      removedAt,
    );

    const trailingChapterMove = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: trailingChapterBId,
      p_direction: "down",
    });
    const trailingTopicMove = await teacherClient.rpc("move_topic_order", {
      p_topic_id: trailingTopicBId,
      p_direction: "down",
    });

    expect(trailingChapterMove.data).toMatchObject({
      status: "noop",
      reason: "already_last",
    });
    expect(trailingTopicMove.data).toMatchObject({
      status: "noop",
      reason: "already_last",
    });

    const trailingChapters = await getChapters(trailingCourseId);
    expect(
      trailingChapters.map((chapter) => [
        chapter.title,
        chapter.order_index,
        chapter.removed_at === null,
      ]),
    ).toEqual([
      ["Trailing Boundary Chapter A", 1, true],
      ["Trailing Boundary Chapter B", 5, true],
      ["Trailing Boundary Chapter C", 6, false],
    ]);
    expect(trailingChapters.find((chapter) => chapter.id === trailingChapterBId)?.order_index).toBe(5);
    expect(trailingChapters.find((chapter) => chapter.id === trailingChapterCId)?.order_index).toBe(6);

    const trailingTopics = await getTopics(trailingChapterAId);
    expect(
      trailingTopics.map((topic) => [
        topic.title,
        topic.order_index,
        topic.removed_at === null,
      ]),
    ).toEqual([
      ["Trailing Boundary Topic A", 1, true],
      ["Trailing Boundary Topic B", 5, true],
      ["Trailing Boundary Topic C", 6, false],
    ]);
    expect(trailingTopics.find((topic) => topic.id === trailingTopicBId)?.order_index).toBe(5);
    expect(trailingTopics.find((topic) => topic.id === trailingTopicCId)?.order_index).toBe(6);
    await expectNoActiveChapterDuplicate(trailingCourseId);
    await expectNoActiveTopicDuplicate(trailingChapterAId);

    const leadingCourseId = await createCourseFixture("owner");
    const leadingChapterAId = await insertChapter(
      leadingCourseId,
      "Leading Boundary Chapter A",
      1,
      removedAt,
    );
    const leadingChapterBId = await insertChapter(
      leadingCourseId,
      "Leading Boundary Chapter B",
      2,
    );
    await insertChapter(leadingCourseId, "Leading Boundary Chapter C", 5);
    const leadingTopicAId = await insertTopic(
      leadingCourseId,
      leadingChapterBId,
      "Leading Boundary Topic A",
      1,
      removedAt,
    );
    const leadingTopicBId = await insertTopic(
      leadingCourseId,
      leadingChapterBId,
      "Leading Boundary Topic B",
      2,
    );
    await insertTopic(leadingCourseId, leadingChapterBId, "Leading Boundary Topic C", 5);

    const leadingChapterMove = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: leadingChapterBId,
      p_direction: "up",
    });
    const leadingTopicMove = await teacherClient.rpc("move_topic_order", {
      p_topic_id: leadingTopicBId,
      p_direction: "up",
    });

    expect(leadingChapterMove.data).toMatchObject({
      status: "noop",
      reason: "already_first",
    });
    expect(leadingTopicMove.data).toMatchObject({
      status: "noop",
      reason: "already_first",
    });

    const leadingChapters = await getChapters(leadingCourseId);
    expect(
      leadingChapters.map((chapter) => [
        chapter.title,
        chapter.order_index,
        chapter.removed_at === null,
      ]),
    ).toEqual([
      ["Leading Boundary Chapter A", 1, false],
      ["Leading Boundary Chapter B", 2, true],
      ["Leading Boundary Chapter C", 5, true],
    ]);
    expect(leadingChapters.find((chapter) => chapter.id === leadingChapterAId)?.order_index).toBe(1);
    expect(leadingChapters.find((chapter) => chapter.id === leadingChapterBId)?.order_index).toBe(2);

    const leadingTopics = await getTopics(leadingChapterBId);
    expect(
      leadingTopics.map((topic) => [
        topic.title,
        topic.order_index,
        topic.removed_at === null,
      ]),
    ).toEqual([
      ["Leading Boundary Topic A", 1, false],
      ["Leading Boundary Topic B", 2, true],
      ["Leading Boundary Topic C", 5, true],
    ]);
    expect(leadingTopics.find((topic) => topic.id === leadingTopicAId)?.order_index).toBe(1);
    expect(leadingTopics.find((topic) => topic.id === leadingTopicBId)?.order_index).toBe(2);
    await expectNoActiveChapterDuplicate(leadingCourseId);
    await expectNoActiveTopicDuplicate(leadingChapterBId);
  });

  it("rejects removed move targets and removed topic parents without mutating surrounding rows", async () => {
    const removedAt = new Date().toISOString();
    const courseId = await createCourseFixture("owner");
    const activeChapterId = await insertChapter(courseId, "Removed Guard Active Chapter", 1);
    const removedChapterId = await insertChapter(
      courseId,
      "Removed Guard Deleted Chapter",
      2,
      removedAt,
    );
    const activeTopicId = await insertTopic(
      courseId,
      activeChapterId,
      "Removed Guard Active Topic",
      1,
    );
    const removedTopicId = await insertTopic(
      courseId,
      activeChapterId,
      "Removed Guard Deleted Topic",
      2,
      removedAt,
    );
    const activeTopicUnderRemovedChapterId = await insertTopic(
      courseId,
      removedChapterId,
      "Removed Parent Active Topic",
      1,
    );

    const removedChapterMove = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: removedChapterId,
      p_direction: "up",
    });
    const removedTopicMove = await teacherClient.rpc("move_topic_order", {
      p_topic_id: removedTopicId,
      p_direction: "up",
    });
    const removedParentMove = await teacherClient.rpc("move_topic_order", {
      p_topic_id: activeTopicUnderRemovedChapterId,
      p_direction: "up",
    });

    expectRpcError(removedChapterMove.error, "CHAPTER_REMOVED");
    expectRpcError(removedTopicMove.error, "TOPIC_REMOVED");
    expectRpcError(removedParentMove.error, "CHAPTER_REMOVED");

    const chapters = await getChapters(courseId);
    expect(chapters.find((chapter) => chapter.id === activeChapterId)?.order_index).toBe(1);
    expect(chapters.find((chapter) => chapter.id === removedChapterId)?.order_index).toBe(2);

    const topics = await getTopics(activeChapterId);
    expect(topics.find((topic) => topic.id === activeTopicId)?.order_index).toBe(1);
    expect(topics.find((topic) => topic.id === removedTopicId)?.order_index).toBe(2);
  });

  it("denies previewer collaborators for create and move RPCs without mutating order", async () => {
    const courseId = await createCourseFixture("previewer");
    const chapterAId = await insertChapter(courseId, "Previewer Denied Chapter A", 1);
    const chapterBId = await insertChapter(courseId, "Previewer Denied Chapter B", 2);
    await insertTopic(courseId, chapterAId, "Previewer Denied Topic A", 1);
    const topicBId = await insertTopic(courseId, chapterAId, "Previewer Denied Topic B", 2);

    const createChapter = await teacherClient.rpc("create_chapter_ordered", {
      p_course_id: courseId,
      p_title: "Previewer Created Chapter",
    });
    const createTopic = await teacherClient.rpc("create_topic_ordered", {
      p_course_id: courseId,
      p_chapter_id: chapterAId,
      p_title: "Previewer Created Topic",
    });
    const moveChapter = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: chapterBId,
      p_direction: "up",
    });
    const moveTopic = await teacherClient.rpc("move_topic_order", {
      p_topic_id: topicBId,
      p_direction: "up",
    });

    expectRpcError(createChapter.error, "COURSE_EDIT_FORBIDDEN");
    expectRpcError(createTopic.error, "COURSE_EDIT_FORBIDDEN");
    expectRpcError(moveChapter.error, "COURSE_EDIT_FORBIDDEN");
    expectRpcError(moveTopic.error, "COURSE_EDIT_FORBIDDEN");
    expect((await getChapters(courseId)).map((chapter) => [chapter.title, chapter.order_index])).toEqual([
      ["Previewer Denied Chapter A", 1],
      ["Previewer Denied Chapter B", 2],
    ]);
    expect((await getTopics(chapterAId)).map((topic) => [topic.title, topic.order_index])).toEqual([
      ["Previewer Denied Topic A", 1],
      ["Previewer Denied Topic B", 2],
    ]);
  });

  it("denies non-collaborators for create and move RPCs without mutating order", async () => {
    const courseId = await createCourseFixture("owner");
    const chapterAId = await insertChapter(courseId, "Denied Chapter A", 1);
    const chapterBId = await insertChapter(courseId, "Denied Chapter B", 2);
    await insertTopic(courseId, chapterAId, "Denied Topic A", 1);
    const topicBId = await insertTopic(courseId, chapterAId, "Denied Topic B", 2);

    const createChapter = await studentClient.rpc("create_chapter_ordered", {
      p_course_id: courseId,
      p_title: "Denied Created Chapter",
    });
    const createTopic = await studentClient.rpc("create_topic_ordered", {
      p_course_id: courseId,
      p_chapter_id: chapterAId,
      p_title: "Denied Created Topic",
    });
    const moveChapter = await studentClient.rpc("move_chapter_order", {
      p_chapter_id: chapterBId,
      p_direction: "up",
    });
    const moveTopic = await studentClient.rpc("move_topic_order", {
      p_topic_id: topicBId,
      p_direction: "up",
    });

    expectRpcError(createChapter.error, "COURSE_EDIT_FORBIDDEN");
    expectRpcError(createTopic.error, "COURSE_EDIT_FORBIDDEN");
    expectRpcError(moveChapter.error, "COURSE_EDIT_FORBIDDEN");
    expectRpcError(moveTopic.error, "COURSE_EDIT_FORBIDDEN");
    expect((await getChapters(courseId)).map((chapter) => [chapter.title, chapter.order_index])).toEqual([
      ["Denied Chapter A", 1],
      ["Denied Chapter B", 2],
    ]);
    expect((await getTopics(chapterAId)).map((topic) => [topic.title, topic.order_index])).toEqual([
      ["Denied Topic A", 1],
      ["Denied Topic B", 2],
    ]);

    const adminCreateChapter = await adminClient.rpc("create_chapter_ordered", {
      p_course_id: courseId,
      p_title: "Global Admin Without Membership",
    });
    expectRpcError(adminCreateChapter.error, "COURSE_EDIT_FORBIDDEN");
  });

  it("allows chapter reorder only for current owner and co_owner memberships", async () => {
    const courseId = await createCourseFixture("owner");
    await addCollaborator(courseId, SEEDED_ADMIN_ID, "co_owner");
    const chapterAId = await insertChapter(courseId, "Role Matrix Chapter A", 1);
    const chapterBId = await insertChapter(
      courseId,
      "Role Matrix Chapter B",
      2,
      null,
      SEEDED_ADMIN_ID,
    );

    const ownerMove = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: chapterBId,
      p_direction: "up",
    });
    expect(ownerMove.error).toBeNull();
    expect((ownerMove.data as { status: string }).status).toBe("moved");

    const coOwnerMove = await adminClient.rpc("move_chapter_order", {
      p_chapter_id: chapterAId,
      p_direction: "up",
    });
    expect(coOwnerMove.error).toBeNull();
    expect((coOwnerMove.data as { status: string }).status).toBe("moved");
    await expectNoActiveChapterDuplicate(courseId);
  });

  it("limits editor chapter mutations to their immutable creator identity and restores at the active end", async () => {
    const courseId = await createCourseFixture("editor");
    await addCollaborator(courseId, SEEDED_ADMIN_ID, "owner");
    const ownChapterId = await insertChapter(courseId, "Editor Own Chapter", 1);
    const otherChapterId = await insertChapter(
      courseId,
      "Owner Chapter",
      2,
      null,
      SEEDED_ADMIN_ID,
    );

    const ownRename = await teacherClient
      .from("chapters")
      .update({ title: "Editor Renamed Chapter" })
      .eq("id", ownChapterId)
      .select("id")
      .single();
    expect(ownRename.error).toBeNull();

    const otherRename = await teacherClient
      .from("chapters")
      .update({ title: "Unauthorized Rename" })
      .eq("id", otherChapterId)
      .select("id");
    expect(otherRename.error).toBeNull();
    expect(otherRename.data).toEqual([]);

    const creatorSpoof = await teacherClient
      .from("chapters")
      .update({ created_by_user_id: SEEDED_ADMIN_ID })
      .eq("id", ownChapterId);
    expect(creatorSpoof.error?.code).toBe("42501");

    const directInsert = await teacherClient.from("chapters").insert({
      course_id: courseId,
      created_by_user_id: SEEDED_ADMIN_ID,
      title: "Spoofed Data API Chapter",
      order_index: 10,
    });
    expect(directInsert.error?.code).toBe("42501");

    const protectedUpdates = await Promise.all([
      teacherClient.from("chapters").update({ course_id: randomUUID() }).eq("id", ownChapterId),
      teacherClient.from("chapters").update({ order_index: 10 }).eq("id", ownChapterId),
      teacherClient.from("chapters").update({ removed_at: new Date().toISOString() }).eq("id", ownChapterId),
      teacherClient.from("chapters").delete().eq("id", ownChapterId),
    ]);
    expect(protectedUpdates.map((result) => result.error?.code)).toEqual([
      "42501",
      "42501",
      "42501",
      "42501",
    ]);

    const editorMove = await teacherClient.rpc("move_chapter_order", {
      p_chapter_id: ownChapterId,
      p_direction: "down",
    });
    expectRpcError(editorMove.error, "COURSE_EDIT_FORBIDDEN");

    const hidden = await teacherClient.rpc("hide_chapter", {
      p_chapter_id: ownChapterId,
    });
    expect(hidden.error).toBeNull();
    expect((hidden.data as { status: string }).status).toBe("hidden");

    const restored = await teacherClient.rpc("restore_chapter_ordered", {
      p_chapter_id: ownChapterId,
    });
    expect(restored.error).toBeNull();
    expect(
      (restored.data as { chapter: { title: string; order_index: number } }).chapter,
    ).toMatchObject({ title: "Editor Renamed Chapter", order_index: 3 });
    await expectNoActiveChapterDuplicate(courseId);

    const otherChapterHide = await adminClient.rpc("hide_chapter", {
      p_chapter_id: otherChapterId,
    });
    expect(otherChapterHide.error).toBeNull();
    const editorOtherRestore = await teacherClient.rpc("restore_chapter_ordered", {
      p_chapter_id: otherChapterId,
    });
    expectRpcError(editorOtherRestore.error, "COURSE_EDIT_FORBIDDEN");
    const ownerOtherRestore = await adminClient.rpc("restore_chapter_ordered", {
      p_chapter_id: otherChapterId,
    });
    expect(ownerOtherRestore.error).toBeNull();
    expect(
      (ownerOtherRestore.data as { chapter: { order_index: number } }).chapter.order_index,
    ).toBe(4);

    const seededStudentId = "33333333-3333-4333-8333-333333333333";
    await addCollaborator(courseId, seededStudentId, "editor");
    const studentCreated = await studentClient.rpc("create_chapter_ordered", {
      p_course_id: courseId,
      p_title: "Student Role Editor Chapter",
    });
    expect(studentCreated.error).toBeNull();
    const studentChapterId = (studentCreated.data as { chapter: { id: string } }).chapter.id;
    const studentCreator = await supabaseAdmin
      .from("chapters")
      .select("created_by_user_id")
      .eq("id", studentChapterId)
      .single();
    expect(studentCreator.data?.created_by_user_id).toBe(seededStudentId);
    const studentRename = await studentClient
      .from("chapters")
      .update({ title: "Student Role Editor Renamed" })
      .eq("id", studentChapterId)
      .select("id")
      .single();
    expect(studentRename.error).toBeNull();
    const studentMove = await studentClient.rpc("move_chapter_order", {
        p_chapter_id: studentChapterId,
        p_direction: "up",
      });
    expectRpcError(studentMove.error, "COURSE_EDIT_FORBIDDEN");
  });
});
