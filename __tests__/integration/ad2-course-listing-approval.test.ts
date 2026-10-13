import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  beginLocalPostgresTransaction,
  waitForLocalPostgresQuery,
  type LocalPostgresTransaction,
} from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: kiểm tra vòng duyệt niêm yết khóa học (AD2): gửi duyệt, rút lại, duyệt, từ chối và khóa ghi trực tiếp các cột status/review của `courses` (ADMIN-002).
// - Loại test: integration/RPC/RLS/column privilege/concurrency trên PostgreSQL local thật; service role chỉ dựng fixture và đọc hậu điều kiện.
// - Đối tượng: submit_course_review, withdraw_course_review, approve_course_review, reject_course_review, ad2_course_has_published_topic, quyền UPDATE của `courses`, get_public_course_catalog.
// - Case thành công:
//   - owner/co_owner gửi duyệt draft có bài published (xóa dấu vết từ chối cũ) và rút lại pending.
//   - admin hoạt động duyệt và từ chối (cả khi admin là owner); lý do 10/1000 ký tự được lưu đã trim; course chỉ vào catalog sau khi duyệt.
//   - payload cũ của updateCourse/deleteCourse và editor sửa description vẫn chạy với client của người dùng.
// - Case thất bại:
//   - editor/previewer/non-member/admin ngoài membership/hồ sơ đã removed không gửi duyệt hay rút được; course thiếu, đã xóa, sai trạng thái, chưa có bài published.
//   - giáo viên/học viên/admin đã removed không duyệt hay từ chối được; pending cũ không có submitted_at; lý do 9/1001 ký tự; duyệt lại khi bài đã bị gỡ.
//   - anon không gọi được RPC nào.
// - Bảo mật/phân quyền:
//   - 42501 khi owner, co_owner, editor, admin và giáo viên ngoài course update từng cột status/submitted_at/reviewed_at/reviewed_by/reject_message; hàng không đổi.
//   - has_function_privilege/has_column_privilege: RPC chỉ cho authenticated, helper không cho ai, UPDATE theo cột chỉ trên 6 cột của updateCourse/deleteCourse.
// - Ổn định/resilience:
//   - giữ course advisory lock từ psql: approve đang chờ khóa thấy course đã bị rút (COURSE_REVIEW_STATE_INVALID); submit đang chờ khóa thấy co_owner đã bị hạ xuống editor (COURSE_SUBMIT_FORBIDDEN); cả hai không đổi course.
// - Invariant cần giữ: chỉ bốn RPC (hoặc service role) đổi status/review; mọi kiểm tra người gọi và trạng thái chạy sau khóa course; lời gọi bị từ chối không đổi hàng nào.
// - Kết quả verify gần nhất: passed (62 test) trên runtime E2E cô lập (API 45441) bằng `npm run test:integration -- __tests__/integration/ad2-course-listing-approval.test.ts`.
// - Ghi chú: AUTH_REQUIRED không gọi được qua Data API vì anon không có quyền execute (chỉ có 42501); nhánh đó là kiểm tra auth.uid() đầu mỗi RPC.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEEDED_PASSWORD = "123123";

const SEEDED = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
} as const;

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ItemStatus = "draft" | "pending" | "published";
type MemberRole = "owner" | "co_owner" | "editor" | "previewer";
type TestUser = { id: string; client: SupabaseClient };
type RpcResult = { data: unknown; error: { message: string; code?: string } | null };
type TopicShape = "published" | "draft" | "published-removed" | "published-in-removed-chapter" | "none";

const createdCourseIds = new Set<string>();
const createdUserIds = new Set<string>();
const REJECT_REASON = "Ảnh bìa mờ, cần bổ sung ảnh rõ nét hơn.";

let anon: SupabaseClient;
let admin: TestUser;
let teacher: TestUser;
let student: TestUser;
let coOwner: TestUser;
let editor: TestUser;
let previewer: TestUser;
let outsider: TestUser;
let removedOwner: TestUser;
let removedAdmin: TestUser;

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !["45321", "45441"].includes(url.port)) {
    throw new Error(`Refusing non-local Supabase URL: ${SUPABASE_URL}`);
  }
}

function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string, password: string) {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function createUser(role: "teacher" | "admin", options: { removed?: boolean } = {}): Promise<TestUser> {
  const email = `ad2-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Người Dùng AD2" },
    app_metadata: { d7_server_created: true },
  });
  if (error || !data.user) throw new Error(`User fixture failed: ${error?.message}`);
  createdUserIds.add(data.user.id);
  const profile = await service.from("profiles").update({ role }).eq("id", data.user.id);
  if (profile.error) throw new Error(`Profile role fixture failed: ${profile.error.message}`);
  const client = await signIn(email, password);
  if (options.removed) {
    // Đánh dấu removed sau khi đăng nhập: phiên vẫn hợp lệ, chỉ hồ sơ là removed.
    const removal = await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", data.user.id);
    if (removal.error) throw new Error(`Profile removal fixture failed: ${removal.error.message}`);
  }
  return { id: data.user.id, client };
}

async function createCourse(options: {
  status?: ItemStatus;
  submittedAt?: string | null;
  rejected?: boolean;
  removed?: boolean;
  topics?: TopicShape;
  // Mặc định: owner là giáo viên seed cùng co_owner, editor, previewer.
  members?: Array<[TestUser, MemberRole]>;
} = {}) {
  const status = options.status ?? "draft";
  const suffix = randomUUID();
  const { data: course, error: courseError } = await service.from("courses").insert({
    title: `AD2 course ${suffix}`,
    slug: `ad2-${suffix}`,
    description: "AD2 listing approval integration fixture",
    status,
    price: 0,
    submitted_at: options.submittedAt !== undefined
      ? options.submittedAt
      : status === "pending" ? new Date().toISOString() : null,
    ...(options.rejected
      ? { reviewed_at: new Date().toISOString(), reviewed_by: SEEDED.admin.id, reject_message: "Lý do từ chối cũ của admin." }
      : {}),
    removed_at: options.removed ? new Date().toISOString() : null,
  }).select("id").single();
  if (courseError || !course) throw new Error(`Course fixture failed: ${courseError?.message}`);
  createdCourseIds.add(course.id);

  const members = options.members ?? [
    [teacher, "owner"],
    [coOwner, "co_owner"],
    [editor, "editor"],
    [previewer, "previewer"],
  ];
  const { error: memberError } = await service.from("course_collaborators").insert(
    members.map(([user, role]) => ({
      course_id: course.id,
      user_id: user.id,
      role,
      added_by: SEEDED.admin.id,
    })),
  );
  if (memberError) throw new Error(`Collaborator fixture failed: ${memberError.message}`);

  const topics = options.topics ?? "published";
  const removedChapter = topics === "published-in-removed-chapter";
  const { data: chapter, error: chapterError } = await service.from("chapters").insert({
    course_id: course.id,
    created_by_user_id: SEEDED.teacher.id,
    title: "AD2 chapter",
    order_index: 1,
    removed_at: removedChapter ? new Date().toISOString() : null,
  }).select("id").single();
  if (chapterError || !chapter) throw new Error(`Chapter fixture failed: ${chapterError?.message}`);

  let topicId: string | null = null;
  if (topics !== "none") {
    const published = topics !== "draft";
    const { data: topic, error: topicError } = await service.from("topics").insert({
      course_id: course.id,
      chapter_id: chapter.id,
      title: "AD2 topic",
      status: published ? "published" : "draft",
      order_index: 1,
      original_creator_user_id: SEEDED.teacher.id,
      responsible_author_user_id: SEEDED.teacher.id,
      ...(published ? { first_approved_at: new Date().toISOString() } : {}),
      removed_at: topics === "published-removed" ? new Date().toISOString() : null,
    }).select("id").single();
    if (topicError || !topic) throw new Error(`Topic fixture failed: ${topicError?.message}`);
    topicId = topic.id;
  }
  return { courseId: course.id as string, chapterId: chapter.id as string, topicId };
}

async function readCourse(courseId: string) {
  const { data, error } = await service.from("courses").select("*").eq("id", courseId).single();
  if (error || !data) throw new Error(`Course read failed: ${error?.message}`);
  return data as Record<string, unknown>;
}

async function cleanup() {
  const ids = [...createdCourseIds];
  createdCourseIds.clear();
  if (ids.length === 0) return;
  for (const table of ["topics", "chapters", "course_collaborators"] as const) {
    const { error } = await service.from(table).delete().in("course_id", ids);
    if (error) throw new Error(`Fixture ${table} cleanup failed: ${error.message}`);
  }
  const { error } = await service.from("courses").delete().in("id", ids);
  if (error) throw new Error(`Fixture course cleanup failed: ${error.message}`);
}

// Gọi RPC bị từ chối: đúng mã lỗi, không có data và hàng course không đổi một byte (kể cả updated_at).
async function expectRefused(call: () => PromiseLike<RpcResult>, code: string, courseId: string) {
  const before = await readCourse(courseId);
  const result = await call();
  expect(result.error?.message ?? "").toContain(code);
  expect(result.data).toBeNull();
  expect(await readCourse(courseId)).toEqual(before);
}

const submit = (user: TestUser, courseId: string) =>
  user.client.rpc("submit_course_review", { p_course_id: courseId });
const withdraw = (user: TestUser, courseId: string) =>
  user.client.rpc("withdraw_course_review", { p_course_id: courseId });
const approve = (user: TestUser, courseId: string) =>
  user.client.rpc("approve_course_review", { p_course_id: courseId });
const reject = (user: TestUser, courseId: string, reason: string) =>
  user.client.rpc("reject_course_review", { p_course_id: courseId, p_reason: reason });

beforeAll(async () => {
  assertSafeEnvironment();
  anon = newClient();
  admin = { id: SEEDED.admin.id, client: await signIn(SEEDED.admin.email, SEEDED_PASSWORD) };
  teacher = { id: SEEDED.teacher.id, client: await signIn(SEEDED.teacher.email, SEEDED_PASSWORD) };
  student = { id: SEEDED.student.id, client: await signIn(SEEDED.student.email, SEEDED_PASSWORD) };
  coOwner = await createUser("teacher");
  editor = await createUser("teacher");
  previewer = await createUser("teacher");
  outsider = await createUser("teacher");
  removedOwner = await createUser("teacher", { removed: true });
  removedAdmin = await createUser("admin", { removed: true });
}, 60_000);

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) throw new Error(`User fixture cleanup failed: ${error.message}`);
  }
});

describe("AD2 submit_course_review", () => {
  it.each([
    ["owner", () => teacher],
    ["co_owner", () => coOwner],
  ] as const)("lets the %s submit a draft course with a published topic and clears the old rejection", async (_label, who) => {
    const { courseId } = await createCourse({ rejected: true });
    const result = await submit(who(), courseId);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ course_id: courseId, status: "pending" });
    expect(await readCourse(courseId)).toMatchObject({
      status: "pending",
      reviewed_at: null,
      reviewed_by: null,
      reject_message: null,
      removed_at: null,
    });
    expect((await readCourse(courseId)).submitted_at).not.toBeNull();
  });

  it.each([
    ["editor", () => editor],
    ["previewer", () => previewer],
    ["non-member teacher", () => outsider],
    ["non-member admin", () => admin],
    ["non-member student", () => student],
  ] as const)("refuses the %s with COURSE_SUBMIT_FORBIDDEN and changes nothing", async (_label, who) => {
    const { courseId } = await createCourse();
    await expectRefused(() => submit(who(), courseId), "COURSE_SUBMIT_FORBIDDEN", courseId);
  });

  it("refuses an owner whose profile is removed", async () => {
    const { courseId } = await createCourse({ members: [[removedOwner, "owner"]] });
    await expectRefused(() => submit(removedOwner, courseId), "COURSE_SUBMIT_FORBIDDEN", courseId);
  });

  it("refuses a missing course and a removed course with COURSE_NOT_FOUND", async () => {
    const missing = await submit(teacher, randomUUID());
    expect(missing.error?.message ?? "").toContain("COURSE_NOT_FOUND");
    const { courseId } = await createCourse({ removed: true });
    await expectRefused(() => submit(teacher, courseId), "COURSE_NOT_FOUND", courseId);
  });

  it.each(["pending", "published"] as const)("refuses a %s course with COURSE_REVIEW_STATE_INVALID", async (status) => {
    const { courseId } = await createCourse({ status });
    await expectRefused(() => submit(teacher, courseId), "COURSE_REVIEW_STATE_INVALID", courseId);
  });

  it.each([
    "none",
    "draft",
    "published-removed",
    "published-in-removed-chapter",
  ] as const)("refuses a course whose topics are %s with COURSE_SUBMIT_NOT_READY", async (topics) => {
    const { courseId } = await createCourse({ topics });
    await expectRefused(() => submit(teacher, courseId), "COURSE_SUBMIT_NOT_READY", courseId);
  });

  it("refuses an anonymous caller at the function privilege", async () => {
    const { courseId } = await createCourse();
    const result = await anon.rpc("submit_course_review", { p_course_id: courseId });
    expect(result.error?.code).toBe("42501");
    expect((await readCourse(courseId)).status).toBe("draft");
  });
});

describe("AD2 withdraw_course_review", () => {
  it.each([
    ["owner", () => teacher],
    ["co_owner", () => coOwner],
  ] as const)("lets the %s withdraw a pending course back to draft", async (_label, who) => {
    const { courseId } = await createCourse({ status: "pending" });
    const result = await withdraw(who(), courseId);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ course_id: courseId, status: "draft" });
    expect(await readCourse(courseId)).toMatchObject({
      status: "draft",
      submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      reject_message: null,
    });
  });

  it.each([
    ["editor", () => editor],
    ["previewer", () => previewer],
    ["non-member teacher", () => outsider],
    ["non-member admin", () => admin],
  ] as const)("refuses the %s with COURSE_SUBMIT_FORBIDDEN and changes nothing", async (_label, who) => {
    const { courseId } = await createCourse({ status: "pending" });
    await expectRefused(() => withdraw(who(), courseId), "COURSE_SUBMIT_FORBIDDEN", courseId);
  });

  it("refuses an owner whose profile is removed", async () => {
    const { courseId } = await createCourse({ status: "pending", members: [[removedOwner, "owner"]] });
    await expectRefused(() => withdraw(removedOwner, courseId), "COURSE_SUBMIT_FORBIDDEN", courseId);
  });

  it.each(["draft", "published"] as const)("refuses a %s course with COURSE_REVIEW_STATE_INVALID", async (status) => {
    const { courseId } = await createCourse({ status });
    await expectRefused(() => withdraw(teacher, courseId), "COURSE_REVIEW_STATE_INVALID", courseId);
  });

  it("refuses a missing course and a removed course with COURSE_NOT_FOUND", async () => {
    expect((await withdraw(teacher, randomUUID())).error?.message ?? "").toContain("COURSE_NOT_FOUND");
    const { courseId } = await createCourse({ status: "pending", removed: true });
    await expectRefused(() => withdraw(teacher, courseId), "COURSE_NOT_FOUND", courseId);
  });

  it("refuses an anonymous caller at the function privilege", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    expect((await anon.rpc("withdraw_course_review", { p_course_id: courseId })).error?.code).toBe("42501");
  });
});

describe("AD2 approve_course_review", () => {
  it("publishes a pending course for an active admin and lists it in the public catalog only afterwards", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    const beforeCatalog = await anon.rpc("get_public_course_catalog");
    expect(beforeCatalog.error).toBeNull();
    expect((beforeCatalog.data as Array<{ id: string }>).some((row) => row.id === courseId)).toBe(false);

    const result = await approve(admin, courseId);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ course_id: courseId, status: "published" });
    const row = await readCourse(courseId);
    expect(row).toMatchObject({ status: "published", reviewed_by: SEEDED.admin.id, reject_message: null });
    expect(row.reviewed_at).not.toBeNull();
    expect(row.submitted_at).not.toBeNull();

    const afterCatalog = await anon.rpc("get_public_course_catalog");
    expect((afterCatalog.data as Array<{ id: string }>).some((entry) => entry.id === courseId)).toBe(true);
  });

  it("lets an active admin who is also the course owner approve it", async () => {
    const { courseId } = await createCourse({ status: "pending", members: [[admin, "owner"]] });
    expect((await approve(admin, courseId)).error).toBeNull();
    expect((await readCourse(courseId)).status).toBe("published");
  });

  it.each([
    ["course owner teacher", () => teacher],
    ["student", () => student],
    ["removed admin", () => removedAdmin],
  ] as const)("refuses the %s with ADMIN_COURSE_REVIEW_FORBIDDEN and changes nothing", async (_label, who) => {
    const { courseId } = await createCourse({ status: "pending" });
    await expectRefused(() => approve(who(), courseId), "ADMIN_COURSE_REVIEW_FORBIDDEN", courseId);
  });

  it.each([
    ["draft", { status: "draft" as const }],
    ["published", { status: "published" as const }],
    ["legacy pending without submitted_at", { status: "pending" as const, submittedAt: null }],
  ])("refuses a %s course with COURSE_REVIEW_STATE_INVALID", async (_label, options) => {
    const { courseId } = await createCourse(options);
    await expectRefused(() => approve(admin, courseId), "COURSE_REVIEW_STATE_INVALID", courseId);
  });

  it("refuses a missing course and a removed course with COURSE_NOT_FOUND", async () => {
    expect((await approve(admin, randomUUID())).error?.message ?? "").toContain("COURSE_NOT_FOUND");
    const { courseId } = await createCourse({ status: "pending", removed: true });
    await expectRefused(() => approve(admin, courseId), "COURSE_NOT_FOUND", courseId);
  });

  it("keeps the course pending with COURSE_SUBMIT_NOT_READY when its only published topic was unpublished after submit", async () => {
    const { courseId, topicId } = await createCourse();
    expect((await submit(teacher, courseId)).error).toBeNull();
    expect((await service.from("topics").update({ status: "draft" }).eq("id", topicId!)).error).toBeNull();
    await expectRefused(() => approve(admin, courseId), "COURSE_SUBMIT_NOT_READY", courseId);
    expect((await readCourse(courseId)).status).toBe("pending");
  });

  it("refuses an anonymous caller at the function privilege", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    expect((await anon.rpc("approve_course_review", { p_course_id: courseId })).error?.code).toBe("42501");
  });
});

describe("AD2 reject_course_review", () => {
  it("returns a pending course to draft with the trimmed reason and the reviewer recorded", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    const result = await reject(admin, courseId, `  \t${REJECT_REASON}\n `);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ course_id: courseId, status: "draft" });
    const row = await readCourse(courseId);
    expect(row).toMatchObject({
      status: "draft",
      submitted_at: null,
      reject_message: REJECT_REASON,
      reviewed_by: SEEDED.admin.id,
    });
    expect(row.reviewed_at).not.toBeNull();
  });

  it("accepts reasons of exactly 10 and 1000 trimmed characters and stores them trimmed", async () => {
    for (const reason of ["a".repeat(10), "b".repeat(1000)]) {
      const { courseId } = await createCourse({ status: "pending" });
      expect((await reject(admin, courseId, ` ${reason} `)).error).toBeNull();
      expect((await readCourse(courseId)).reject_message).toBe(reason);
    }
  });

  it.each([
    ["9 trimmed characters", ` ${"a".repeat(9)} `],
    ["1001 trimmed characters", "a".repeat(1001)],
    ["only whitespace", " ".repeat(20)],
    ["an empty string", ""],
  ])("refuses a reason of %s with COURSE_REJECT_REASON_INVALID and changes nothing", async (_label, reason) => {
    const { courseId } = await createCourse({ status: "pending" });
    await expectRefused(() => reject(admin, courseId, reason), "COURSE_REJECT_REASON_INVALID", courseId);
  });

  it("refuses a missing reason with COURSE_REJECT_REASON_INVALID", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    await expectRefused(
      () => admin.client.rpc("reject_course_review", { p_course_id: courseId, p_reason: null }),
      "COURSE_REJECT_REASON_INVALID",
      courseId,
    );
  });

  it("does not re-check topic readiness when rejecting", async () => {
    const { courseId } = await createCourse({ status: "pending", topics: "none" });
    expect((await reject(admin, courseId, REJECT_REASON)).error).toBeNull();
    expect((await readCourse(courseId)).status).toBe("draft");
  });

  it.each([
    ["course owner teacher", () => teacher],
    ["student", () => student],
    ["removed admin", () => removedAdmin],
  ] as const)("refuses the %s with ADMIN_COURSE_REVIEW_FORBIDDEN and changes nothing", async (_label, who) => {
    const { courseId } = await createCourse({ status: "pending" });
    await expectRefused(() => reject(who(), courseId, REJECT_REASON), "ADMIN_COURSE_REVIEW_FORBIDDEN", courseId);
  });

  it.each([
    ["draft", { status: "draft" as const }],
    ["published", { status: "published" as const }],
    ["legacy pending without submitted_at", { status: "pending" as const, submittedAt: null }],
  ])("refuses a %s course with COURSE_REVIEW_STATE_INVALID", async (_label, options) => {
    const { courseId } = await createCourse(options);
    await expectRefused(() => reject(admin, courseId, REJECT_REASON), "COURSE_REVIEW_STATE_INVALID", courseId);
  });

  it("refuses a missing course and a removed course with COURSE_NOT_FOUND", async () => {
    expect((await reject(admin, randomUUID(), REJECT_REASON)).error?.message ?? "").toContain("COURSE_NOT_FOUND");
    const { courseId } = await createCourse({ status: "pending", removed: true });
    await expectRefused(() => reject(admin, courseId, REJECT_REASON), "COURSE_NOT_FOUND", courseId);
  });

  it("refuses an anonymous caller at the function privilege", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    const result = await anon.rpc("reject_course_review", { p_course_id: courseId, p_reason: REJECT_REASON });
    expect(result.error?.code).toBe("42501");
  });
});

describe("AD2 course column lock-down (ADMIN-002)", () => {
  const lockedColumns: Array<[string, () => unknown]> = [
    ["status", () => "published"],
    ["submitted_at", () => new Date().toISOString()],
    ["reviewed_at", () => new Date().toISOString()],
    ["reviewed_by", () => SEEDED.admin.id],
    ["reject_message", () => "Tự ghi lý do từ client."],
  ];

  it("refuses every signed-in role a direct update of each lifecycle column with 42501 and leaves the row unchanged", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    const before = await readCourse(courseId);
    const actors: Array<[string, TestUser]> = [
      ["owner", teacher],
      ["co_owner", coOwner],
      ["editor", editor],
      ["admin", admin],
      ["non-member teacher", outsider],
    ];
    for (const [actor, user] of actors) {
      for (const [column, value] of lockedColumns) {
        const result = await user.client.from("courses").update({ [column]: value() }).eq("id", courseId).select("id");
        expect(result.error?.code, `${actor} updating ${column}`).toBe("42501");
      }
    }
    expect(await readCourse(courseId)).toEqual(before);
  }, 30_000);

  it("keeps the table privileges to column UPDATE on exactly the six columns the app writes", async () => {
    const privileges = JSON.parse(
      await waitForLocalPostgresQuery(
        `select json_build_object(
           'authenticatedTable', has_table_privilege('authenticated', 'public.courses', 'UPDATE'),
           'anonTable', has_table_privilege('anon', 'public.courses', 'UPDATE'),
           'authenticatedColumns', (
             select coalesce(json_agg(a.attname order by a.attname), '[]'::json)
             from pg_attribute a
             where a.attrelid = 'public.courses'::regclass and a.attnum > 0 and not a.attisdropped
               and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')),
           'anonColumns', (
             select coalesce(json_agg(a.attname order by a.attname), '[]'::json)
             from pg_attribute a
             where a.attrelid = 'public.courses'::regclass and a.attnum > 0 and not a.attisdropped
               and has_column_privilege('anon', a.attrelid, a.attnum, 'UPDATE')),
           'serviceRoleTable', has_table_privilege('service_role', 'public.courses', 'UPDATE')
         )`,
        "the courses update privileges",
      ),
    );
    expect(privileges).toEqual({
      authenticatedTable: false,
      anonTable: false,
      authenticatedColumns: ["description", "price", "removed_at", "slug", "thumbnail_url", "title"],
      anonColumns: [],
      serviceRoleTable: true,
    });
  });

  it.each(["pending", "published"] as const)("keeps the exact updateCourse and deleteCourse writes working for the owner on a %s course", async (status) => {
    const { courseId } = await createCourse({ status, submittedAt: status === "pending" ? new Date().toISOString() : null });
    const before = await readCourse(courseId);

    const suffix = randomUUID();
    const edit = await teacher.client.from("courses").update({
      title: `AD2 edited ${suffix}`,
      slug: `ad2-edited-${suffix}`,
      description: "Mô tả sau khi sửa",
      price: 120000,
      thumbnail_url: `https://example.com/${suffix}.png`,
    }).eq("id", courseId).is("removed_at", null).select("id").single();
    expect(edit.error).toBeNull();
    expect(edit.data).toEqual({ id: courseId });

    const removal = await teacher.client.from("courses").update({ removed_at: new Date().toISOString() })
      .eq("id", courseId).is("removed_at", null).select("id");
    expect(removal.error).toBeNull();
    expect(removal.data).toEqual([{ id: courseId }]);

    const after = await readCourse(courseId);
    expect(after).toMatchObject({
      title: `AD2 edited ${suffix}`,
      price: 120000,
      status: before.status,
      submitted_at: before.submitted_at,
      reviewed_at: before.reviewed_at,
      reviewed_by: before.reviewed_by,
      reject_message: before.reject_message,
    });
    expect(after.removed_at).not.toBeNull();
  });

  it("still lets a course-local editor update the description", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    const result = await editor.client.from("courses").update({ description: "Cập nhật bởi editor" })
      .eq("id", courseId).select("id").single();
    expect(result.error).toBeNull();
    expect((await readCourse(courseId)).description).toBe("Cập nhật bởi editor");
  });
});

describe("AD2 function privileges", () => {
  it("grants execute on the four RPCs to authenticated only and on the readiness helper to nobody", async () => {
    const rows = JSON.parse(
      await waitForLocalPostgresQuery(
        `select json_agg(json_build_object(
           'name', p.proname,
           'anon', has_function_privilege('anon', p.oid, 'execute'),
           'authenticated', has_function_privilege('authenticated', p.oid, 'execute'),
           'serviceRole', has_function_privilege('service_role', p.oid, 'execute'),
           'public', has_function_privilege('public', p.oid, 'execute')
         ) order by p.proname)
         from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname in ('submit_course_review', 'withdraw_course_review', 'approve_course_review',
                             'reject_course_review', 'ad2_course_has_published_topic')`,
        "the AD2 function privileges",
      ),
    ) as Array<{ name: string; anon: boolean; authenticated: boolean; serviceRole: boolean; public: boolean }>;
    const byName = rows
      .map((row) => [row.name, row.anon, row.authenticated, row.serviceRole, row.public] as const)
      .sort(([left], [right]) => (left < right ? -1 : 1));
    expect(byName).toEqual([
      ["ad2_course_has_published_topic", false, false, false, false],
      ["approve_course_review", false, true, false, false],
      ["reject_course_review", false, true, false, false],
      ["submit_course_review", false, true, false, false],
      ["withdraw_course_review", false, true, false, false],
    ]);
  });
});

// Chờ đến khi lời gọi RPC `rpcName` được thấy đang chờ đúng course advisory lock mà `holderPid` giữ.
// Nếu lời gọi trả về trước khi thấy lần chờ thì test thất bại, tránh trường hợp "không chờ nên không chứng minh gì".
async function expectCallWaitingOnCourseLock(
  call: Promise<RpcResult>,
  holderPid: number,
  courseId: string,
  rpcName: string,
) {
  const state = await Promise.race([
    waitForLocalPostgresQuery(
      `select activity.pid::text
       from pg_stat_activity as activity
       join pg_locks as waiting_lock
         on waiting_lock.pid = activity.pid
        and waiting_lock.locktype = 'advisory'
        and not waiting_lock.granted
       join pg_locks as holder_lock
         on holder_lock.pid = ${holderPid}
        and holder_lock.locktype = 'advisory'
        and holder_lock.granted
        and holder_lock.database is not distinct from waiting_lock.database
        and holder_lock.classid = waiting_lock.classid
        and holder_lock.objid = waiting_lock.objid
        and holder_lock.objsubid = waiting_lock.objsubid
       where activity.wait_event_type = 'Lock'
         and activity.wait_event = 'advisory'
         and ${holderPid} = any(pg_blocking_pids(activity.pid))
         and activity.query ilike '%${rpcName}%'
         and waiting_lock.classid = ((hashtext('${courseId}'::text)::bigint >> 32) & 4294967295)::oid
         and waiting_lock.objid = (hashtext('${courseId}'::text)::bigint & 4294967295)::oid
       limit 1`,
      `${rpcName} to wait on the course advisory lock held by the test transaction`,
    ).then(() => ({ type: "waiting" as const }), (error: unknown) => ({ type: "observer-error" as const, error })),
    call.then((result) => ({ type: "returned" as const, result })),
  ]);
  if (state.type === "observer-error") throw state.error;
  if (state.type === "returned") {
    throw new Error(`${rpcName} returned before its course advisory-lock wait was observed: ${state.result.error?.message ?? JSON.stringify(state.result.data)}`);
  }
}

describe("AD2 lock order and checks after the lock", () => {
  async function holdCourseLock(courseId: string) {
    return beginLocalPostgresTransaction(
      `begin;
       select pg_advisory_xact_lock(hashtext('${courseId}'::text));
       select 'AD2_COURSE_LOCK_HELD|' || pg_backend_pid();`,
      "AD2_COURSE_LOCK_HELD|",
    );
  }

  it("makes an approve that waited on the course lock see the withdraw that held it", async () => {
    const { courseId } = await createCourse({ status: "pending" });
    let holder: LocalPostgresTransaction | undefined;
    const pending: Promise<unknown>[] = [];
    try {
      holder = await holdCourseLock(courseId);
      const call = Promise.resolve(approve(admin, courseId)) as Promise<RpcResult>;
      pending.push(call);
      await expectCallWaitingOnCourseLock(call, holder.pid, courseId, "approve_course_review");

      // Đúng thay đổi mà withdraw_course_review làm, nhưng giữ khóa đủ lâu để approve phải chờ.
      const update = await holder.run(`update public.courses set status = 'draft', submitted_at = null where id = '${courseId}'`);
      expect(update.sqlstate).toBeNull();
      await holder.finish("COMMIT");

      const result = await call;
      expect(result.error?.message ?? "").toContain("COURSE_REVIEW_STATE_INVALID");
      expect(await readCourse(courseId)).toMatchObject({ status: "draft", submitted_at: null, reviewed_by: null });
    } finally {
      await holder?.finish("ROLLBACK");
      await Promise.allSettled(pending);
    }
  }, 30_000);

  it("makes a co-owner's submit that waited on the course lock see the demotion to editor", async () => {
    const { courseId } = await createCourse();
    let holder: LocalPostgresTransaction | undefined;
    const pending: Promise<unknown>[] = [];
    try {
      holder = await holdCourseLock(courseId);
      const call = Promise.resolve(submit(coOwner, courseId)) as Promise<RpcResult>;
      pending.push(call);
      await expectCallWaitingOnCourseLock(call, holder.pid, courseId, "submit_course_review");

      const demotion = await holder.run(
        `update public.course_collaborators set role = 'editor' where course_id = '${courseId}' and user_id = '${coOwner.id}'`,
      );
      expect(demotion.sqlstate).toBeNull();
      await holder.finish("COMMIT");

      const result = await call;
      expect(result.error?.message ?? "").toContain("COURSE_SUBMIT_FORBIDDEN");
      expect(await readCourse(courseId)).toMatchObject({ status: "draft", submitted_at: null });
    } finally {
      await holder?.finish("ROLLBACK");
      await Promise.allSettled(pending);
    }
  }, 30_000);
});
