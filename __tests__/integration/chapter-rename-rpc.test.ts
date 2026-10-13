import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra RPC `rename_chapter` (LF7) cho cùng kết quả với `update chapters set title` trực tiếp mà `updateChapter` dùng trước đây, cộng các mã lỗi riêng của RPC.
// - Loại test: real local Supabase integration/RPC/RLS/trigger; service role chỉ dựng fixture, đọc hậu điều kiện và dọn dẹp.
// - Đối tượng: rename_chapter, can_manage_chapter_by_id, trigger d1_guard_chapter_mutation (TOPIC_PENDING_FROZEN), column grant `update (title)`.
// - Case thành công: owner/co_owner đổi tên chương của người khác; editor đổi tên chương mình tạo; student-role collaborator có quyền co_owner; tên 3 ký tự, 100 ký tự, 2 emoji (Zod đếm 4) và tên có khoảng trắng được lưu đúng như gửi; RPC trả đủ bảy trường chương.
// - Case thất bại: editor với chương người khác (COURSE_EDIT_FORBIDDEN), global admin không là thành viên, người ngoài, anonymous, chương đã ẩn (CHAPTER_REMOVED), chương không tồn tại (CHAPTER_NOT_FOUND), chương có topic pending (TOPIC_PENDING_FROZEN), tên null (CHAPTER_TITLE_REQUIRED).
// - Bảo mật/phân quyền: so sánh theo kết quả đã lưu (tên có đổi hay không, đọc lại bằng service role) với update trực tiếp trên chương cùng trạng thái; mã lỗi RPC và kết quả update trực tiếp (RLS có thể trả 0 dòng, không lỗi) được assert riêng.
// - Ổn định/resilience: lỗi RPC không để lại tên đã đổi; fixture cô lập theo course UUID, cleanup fail loud.
// - Invariant cần giữ: quyền ghi giống update trực tiếp dưới policy `Chapters - Staff Update` cho chương không có topic pending; độ dài tên do Server Action sở hữu nên RPC chỉ từ chối null.
// - Kết quả verify gần nhất: passed (16/16) bằng `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- __tests__/integration/chapter-rename-rpc.test.ts` trên runtime cô lập (API 45441).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";

const USERS = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
  editor: { email: "editor@gmail.com", id: "99999999-9999-4999-8999-999999999991" },
  outsider: { email: "contributor@gmail.com", id: "99999999-9999-4999-8999-999999999993" },
} as const;

type UserKey = keyof typeof USERS;
type CollaboratorRole = "owner" | "co_owner" | "editor" | "previewer";

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const courseIds = new Set<string>();
let clients: Record<UserKey, SupabaseClient>;
let anonymous: SupabaseClient;

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !["45321", "45441"].includes(url.port)) {
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

async function createCourse(members: Array<{ user: UserKey; role: CollaboratorRole }>) {
  const suffix = randomUUID();
  const course = must(
    await service.from("courses").insert({
      title: `LF7 rename course ${suffix}`,
      slug: `lf7-rename-${suffix}`,
      description: "LF7 rename_chapter integration fixture",
      status: "draft",
      price: 0,
    }).select("id").single(),
    "course",
  );
  courseIds.add(course.id);
  const collaborators = await service.from("course_collaborators").insert(
    members.map((member) => ({
      course_id: course.id,
      user_id: USERS[member.user].id,
      role: member.role,
      added_by: USERS.admin.id,
      can_review_topics: false,
    })),
  );
  if (collaborators.error) throw new Error(`Fixture step failed (collaborators): ${collaborators.error.message}`);
  return course.id as string;
}

async function insertChapter(
  courseId: string,
  options: { createdBy: UserKey; orderIndex: number; removed?: boolean },
) {
  const chapter = must(
    await service.from("chapters").insert({
      course_id: courseId,
      created_by_user_id: USERS[options.createdBy].id,
      title: `Original chapter ${options.orderIndex} ${randomUUID()}`,
      order_index: options.orderIndex,
      removed_at: options.removed ? new Date().toISOString() : null,
    }).select("id").single(),
    "chapter",
  );
  return chapter.id as string;
}

async function insertPendingTopic(courseId: string, chapterId: string) {
  const topic = must(
    await service.from("topics").insert({
      course_id: courseId,
      chapter_id: chapterId,
      title: "LF7 pending topic",
      status: "pending",
      order_index: 1,
      original_creator_user_id: USERS.teacher.id,
      responsible_author_user_id: USERS.teacher.id,
    }).select("id").single(),
    "pending topic",
  );
  const submission = await service.from("topic_review_submissions").insert({
    topic_id: topic.id,
    submitted_by_user_id: USERS.teacher.id,
    status: "pending",
    attempt_number: 1,
  });
  if (submission.error) throw new Error(`Fixture step failed (submission): ${submission.error.message}`);
}

async function storedTitle(chapterId: string) {
  const { data, error } = await service.from("chapters").select("title").eq("id", chapterId).single();
  if (error || !data) throw new Error(`Stored title read failed: ${error?.message}`);
  return data.title as string;
}

async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length === 0) return;
  const topics = await service.from("topics").delete().in("course_id", ids);
  if (topics.error) throw new Error(`Fixture topic cleanup failed: ${topics.error.message}`);
  const chapters = await service.from("chapters").delete().in("course_id", ids);
  if (chapters.error) throw new Error(`Fixture chapter cleanup failed: ${chapters.error.message}`);
  const collaborators = await service.from("course_collaborators").delete().in("course_id", ids);
  if (collaborators.error) throw new Error(`Fixture collaborator cleanup failed: ${collaborators.error.message}`);
  const courses = await service.from("courses").delete().in("id", ids);
  if (courses.error) throw new Error(`Fixture course cleanup failed: ${courses.error.message}`);
}

// Cùng một người gọi, cùng tên mới, trên hai chương có cùng trạng thái: một chương qua `rename_chapter`,
// chương kia qua update trực tiếp như `updateChapter` trước LF7 (có bộ lọc `removed_at is null`).
async function renameBothWays(
  caller: SupabaseClient,
  targets: { rpcChapterId: string; directChapterId: string },
  newTitle: string | null,
) {
  const [rpcBefore, directBefore] = await Promise.all([
    storedTitle(targets.rpcChapterId),
    storedTitle(targets.directChapterId),
  ]);
  const rpc = await caller.rpc("rename_chapter", { p_chapter_id: targets.rpcChapterId, p_title: newTitle });
  const direct = await caller.from("chapters")
    .update({ title: newTitle as string })
    .eq("id", targets.directChapterId)
    .is("removed_at", null)
    .select("id, title");
  const [rpcStored, directStored] = await Promise.all([
    storedTitle(targets.rpcChapterId),
    storedTitle(targets.directChapterId),
  ]);
  return {
    rpc,
    direct,
    rpcBefore,
    directBefore,
    rpcStored,
    directStored,
    rpcChanged: rpcStored === newTitle,
    directChanged: directStored === newTitle,
  };
}

async function twoChapters(courseId: string, createdBy: UserKey, options: { removed?: boolean } = {}) {
  return {
    rpcChapterId: await insertChapter(courseId, { createdBy, orderIndex: 1, removed: options.removed }),
    directChapterId: await insertChapter(courseId, { createdBy, orderIndex: 2, removed: options.removed }),
  };
}

describe("rename_chapter RPC", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    clients = {
      admin: await signIn(USERS.admin.email),
      teacher: await signIn(USERS.teacher.email),
      student: await signIn(USERS.student.email),
      editor: await signIn(USERS.editor.email),
      outsider: await signIn(USERS.outsider.email),
    };
    anonymous = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("lets the course owner rename a chapter created by an editor, like the direct update, and returns the seven chapter fields", async () => {
    const courseId = await createCourse([
      { user: "teacher", role: "owner" },
      { user: "editor", role: "editor" },
    ]);
    const targets = await twoChapters(courseId, "editor");

    const outcome = await renameBothWays(clients.teacher, targets, "Owner renamed chapter");

    expect(outcome.rpc.error).toBeNull();
    expect(outcome.rpc.data).toMatchObject({
      status: "renamed",
      course_id: courseId,
      chapter: { id: targets.rpcChapterId, course_id: courseId, title: "Owner renamed chapter", removed_at: null },
    });
    expect(Object.keys(outcome.rpc.data.chapter).sort()).toEqual(
      ["course_id", "created_at", "id", "order_index", "removed_at", "title", "updated_at"],
    );
    expect(outcome.direct.error).toBeNull();
    expect(outcome.direct.data).toHaveLength(1);
    expect(outcome.rpcChanged).toBe(true);
    expect(outcome.directChanged).toBe(true);
  });

  it("lets a co_owner rename a chapter created by someone else, like the direct update", async () => {
    const courseId = await createCourse([
      { user: "teacher", role: "owner" },
      { user: "outsider", role: "co_owner" },
    ]);
    const targets = await twoChapters(courseId, "teacher");

    const outcome = await renameBothWays(clients.outsider, targets, "Co-owner renamed chapter");

    expect(outcome.rpc.error).toBeNull();
    expect(outcome.rpc.data).toMatchObject({ status: "renamed" });
    expect(outcome.direct.data).toHaveLength(1);
    expect(outcome.rpcChanged).toBe(true);
    expect(outcome.directChanged).toBe(true);
  });

  it("lets an editor rename a chapter they created, like the direct update", async () => {
    const courseId = await createCourse([
      { user: "teacher", role: "owner" },
      { user: "editor", role: "editor" },
    ]);
    const targets = await twoChapters(courseId, "editor");

    const outcome = await renameBothWays(clients.editor, targets, "Editor renamed own chapter");

    expect(outcome.rpc.error).toBeNull();
    expect(outcome.direct.data).toHaveLength(1);
    expect(outcome.rpcChanged).toBe(true);
    expect(outcome.directChanged).toBe(true);
  });

  it("refuses an editor on a chapter someone else created with COURSE_EDIT_FORBIDDEN, and the direct update changes nothing either", async () => {
    const courseId = await createCourse([
      { user: "teacher", role: "owner" },
      { user: "editor", role: "editor" },
    ]);
    const targets = await twoChapters(courseId, "teacher");

    const outcome = await renameBothWays(clients.editor, targets, "Editor must not rename this");

    expect(outcome.rpc.error?.message).toContain("COURSE_EDIT_FORBIDDEN");
    // RLS từ chối update trực tiếp bằng 0 dòng, không có lỗi.
    expect(outcome.direct.error).toBeNull();
    expect(outcome.direct.data).toHaveLength(0);
    expect(outcome.rpcStored).toBe(outcome.rpcBefore);
    expect(outcome.directStored).toBe(outcome.directBefore);
  });

  it("gives a global admin without membership the same result as the direct update", async () => {
    const courseId = await createCourse([{ user: "teacher", role: "owner" }]);
    const targets = await twoChapters(courseId, "teacher");

    const outcome = await renameBothWays(clients.admin, targets, "Admin renamed chapter");

    expect(outcome.rpc.error?.message).toContain("COURSE_EDIT_FORBIDDEN");
    expect(outcome.direct.error).toBeNull();
    expect(outcome.direct.data).toHaveLength(0);
    expect(outcome.rpcChanged).toBe(outcome.directChanged);
    expect(outcome.rpcStored).toBe(outcome.rpcBefore);
    expect(outcome.directStored).toBe(outcome.directBefore);
  });

  it("gives a student-role collaborator with co_owner rights the same result as the direct update", async () => {
    const courseId = await createCourse([
      { user: "teacher", role: "owner" },
      { user: "student", role: "co_owner" },
    ]);
    const targets = await twoChapters(courseId, "teacher");

    const outcome = await renameBothWays(clients.student, targets, "Student collaborator renamed chapter");

    expect(outcome.rpc.error).toBeNull();
    expect(outcome.direct.error).toBeNull();
    expect(outcome.rpcChanged).toBe(outcome.directChanged);
    expect(outcome.rpcChanged).toBe(true);
  });

  it("refuses a user outside the course, like the direct update", async () => {
    const courseId = await createCourse([{ user: "teacher", role: "owner" }]);
    const targets = await twoChapters(courseId, "teacher");

    const outcome = await renameBothWays(clients.outsider, targets, "Outsider renamed chapter");

    expect(outcome.rpc.error?.message).toContain("COURSE_EDIT_FORBIDDEN");
    expect(outcome.direct.data).toHaveLength(0);
    expect(outcome.rpcStored).toBe(outcome.rpcBefore);
    expect(outcome.directStored).toBe(outcome.directBefore);
  });

  it("refuses an anonymous caller without changing the chapter", async () => {
    const courseId = await createCourse([{ user: "teacher", role: "owner" }]);
    const chapterId = await insertChapter(courseId, { createdBy: "teacher", orderIndex: 1 });
    const before = await storedTitle(chapterId);

    const result = await anonymous.rpc("rename_chapter", { p_chapter_id: chapterId, p_title: "Anonymous rename" });

    expect(result.error).not.toBeNull();
    expect(await storedTitle(chapterId)).toBe(before);
  });

  it("gives CHAPTER_REMOVED for a hidden chapter, where the direct update with the app filter changes nothing", async () => {
    const courseId = await createCourse([{ user: "teacher", role: "owner" }]);
    const targets = await twoChapters(courseId, "teacher", { removed: true });

    const outcome = await renameBothWays(clients.teacher, targets, "Renamed hidden chapter");

    expect(outcome.rpc.error?.message).toContain("CHAPTER_REMOVED");
    expect(outcome.direct.data).toHaveLength(0);
    expect(outcome.rpcStored).toBe(outcome.rpcBefore);
    expect(outcome.directStored).toBe(outcome.directBefore);
  });

  it("gives CHAPTER_NOT_FOUND for a chapter that does not exist", async () => {
    const result = await clients.teacher.rpc("rename_chapter", { p_chapter_id: randomUUID(), p_title: "Nobody home" });

    expect(result.error?.message).toContain("CHAPTER_NOT_FOUND");
  });

  it("gives TOPIC_PENDING_FROZEN for a chapter with a pending topic, where the direct update is refused by RLS", async () => {
    const courseId = await createCourse([{ user: "teacher", role: "owner" }]);
    const targets = await twoChapters(courseId, "teacher");
    await insertPendingTopic(courseId, targets.rpcChapterId);
    await insertPendingTopic(courseId, targets.directChapterId);

    const outcome = await renameBothWays(clients.teacher, targets, "Renamed pending chapter");

    expect(outcome.rpc.error?.message).toContain("TOPIC_PENDING_FROZEN");
    expect(outcome.direct.error).toBeNull();
    expect(outcome.direct.data).toHaveLength(0);
    expect(outcome.rpcStored).toBe(outcome.rpcBefore);
    expect(outcome.directStored).toBe(outcome.directBefore);
  });

  it("gives CHAPTER_TITLE_REQUIRED for a null title, where the direct update violates not null", async () => {
    const courseId = await createCourse([{ user: "teacher", role: "owner" }]);
    const targets = await twoChapters(courseId, "teacher");

    const outcome = await renameBothWays(clients.teacher, targets, null);

    expect(outcome.rpc.error?.message).toContain("CHAPTER_TITLE_REQUIRED");
    expect(outcome.direct.error?.code).toBe("23502");
    expect(outcome.rpcStored).toBe(outcome.rpcBefore);
    expect(outcome.directStored).toBe(outcome.directBefore);
  });

  // Độ dài do Server Action sở hữu (Zod đếm theo UTF-16, sau trim): RPC phải lưu mọi tên app đã chấp nhận.
  it.each([
    ["a 3-character title", "abc"],
    ["a 100-character title", "x".repeat(100)],
    ["two emoji (2 code points, 4 UTF-16 units)", "\u{1F600}\u{1F600}"],
    ["a title with surrounding whitespace", "  padded title  "],
  ])("stores %s exactly as sent, like the direct update", async (_label, title) => {
    const courseId = await createCourse([{ user: "teacher", role: "owner" }]);
    const targets = await twoChapters(courseId, "teacher");

    const outcome = await renameBothWays(clients.teacher, targets, title);

    expect(outcome.rpc.error).toBeNull();
    expect(outcome.rpc.data.chapter.title).toBe(title);
    expect(await storedTitle(targets.rpcChapterId)).toBe(title);
    expect(outcome.directChanged).toBe(true);
  });
});
