import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

vi.mock("server-only", () => ({}));

import { getAdminCourseSummaryData, listAdminCourses } from "@/lib/admin/course-list";
import { ADMIN_COURSE_PAGE_SIZE, type AdminCourseFilter } from "@/lib/schemas/admin-course";

// Test plan:
// - Mục tiêu: kiểm tra module đọc của màn hình /admin/courses (AD3 AC2-AC4, G3, G4) chạy bằng session admin thật, không service role.
// - Loại test: integration/RLS trên PostgreSQL local thật; service role chỉ dựng fixture, mọi lần đọc dùng client đã đăng nhập.
// - Đối tượng: listAdminCourses và getAdminCourseSummaryData (`lib/admin/course-list.ts`), qua nhánh admin của can_view_course_basic.
// - Case thành công:
//   - admin thấy course draft, pending, published và đã gỡ kèm tên owner; mỗi tab và số đếm theo tab đúng, tab Đã gỡ chỉ gồm course có removed_at.
//   - thứ tự: pending theo submitted_at tăng dần, đã gỡ theo removed_at giảm dần, còn lại theo updated_at giảm dần, hòa thì theo id.
//   - phân trang 20/trang: hai trang liền nhau không trùng không sót; trang vượt quá trang cuối trả rỗng, không lỗi.
//   - cụm tìm kiếm chứa `%`, `_`, `,`, `(`, `)`, `"`, `\` khớp đúng nghĩa đen, không lỗi và không khớp course mồi; tìm không phân biệt hoa thường theo title và slug.
//   - tóm tắt: chương và bài học đang hoạt động đúng thứ tự cùng trạng thái, không gồm chương/bài đã gỡ; đếm bài published đúng.
//   - dàn bài hơn 1000 bài học (vượt max_rows của API) trả đủ, đúng thứ tự và đúng số bài published.
// - Case thất bại:
//   - course không tồn tại trả `{ data: null, error: null }` (không phải lỗi).
//   - owner đã bị gỡ hiển thị tên null thay vì làm hỏng cả danh sách.
// - Bảo mật/phân quyền:
//   - session giáo viên và học viên (không phải admin) chỉ thấy những gì can_view_course_basic cho phép: không thấy draft hay course đã gỡ của người khác;
//     không đọc được tóm tắt của course bị che. Đây là lớp phòng thủ chiều sâu; cổng chính là requireAdminPage và kiểm tra trong Server Action.
// - Ổn định/resilience: mọi fixture gắn token ngẫu nhiên của từng case và truy vấn luôn lọc theo token đó, nên dữ liệu có sẵn của runtime không ảnh hưởng kết quả.
// - Invariant cần giữ: không dùng service role để đọc; tổng của các tab khớp với số hàng thật; không hàng nào bị trùng hoặc sót giữa các trang.
// - Kết quả verify gần nhất: xem milestone AD3 CP2 trong progress.md (`npm run test:integration -- __tests__/integration/ad3-admin-course-read.test.ts` trên runtime E2E cô lập, API 45441).

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
type TestUser = { id: string; client: SupabaseClient; fullName: string };

const createdCourseIds = new Set<string>();
const createdUserIds = new Set<string>();

let admin: TestUser;
let teacher: TestUser;
let student: TestUser;
let owner: TestUser;
let removedOwner: TestUser;

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

async function profileName(id: string) {
  const { data, error } = await service.from("profiles").select("full_name").eq("id", id).single();
  if (error || !data) throw new Error(`Profile read failed: ${error?.message}`);
  return (data.full_name as string | null) ?? "";
}

async function seededUser(key: keyof typeof SEEDED): Promise<TestUser> {
  const { email, id } = SEEDED[key];
  return { id, client: await signIn(email, SEEDED_PASSWORD), fullName: await profileName(id) };
}

async function createOwner(fullName: string, options: { removed?: boolean } = {}): Promise<TestUser> {
  const email = `ad3-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { d7_server_created: true },
  });
  if (error || !data.user) throw new Error(`User fixture failed: ${error?.message}`);
  createdUserIds.add(data.user.id);
  const profile = await service.from("profiles").update({ role: "teacher", full_name: fullName }).eq("id", data.user.id);
  if (profile.error) throw new Error(`Profile fixture failed: ${profile.error.message}`);
  const client = await signIn(email, password);
  if (options.removed) {
    const removal = await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", data.user.id);
    if (removal.error) throw new Error(`Profile removal fixture failed: ${removal.error.message}`);
  }
  return { id: data.user.id, client, fullName };
}

// Token ngẫu nhiên cho từng case: mọi truy vấn lọc theo token nên dữ liệu có sẵn của runtime không ảnh hưởng.
const newToken = () => `ad3${randomUUID().replace(/-/g, "").slice(0, 12)}`;

type CourseSpec = {
  title: string;
  slug?: string;
  status?: ItemStatus;
  submittedAt?: string | null;
  removedAt?: string | null;
  updatedAt?: string;
  owner?: TestUser;
};

async function createCourses(specs: CourseSpec[]) {
  const rows = specs.map((spec) => ({
    title: spec.title,
    slug: spec.slug ?? `ad3-${randomUUID()}`,
    description: "AD3 admin course read integration fixture",
    status: spec.status ?? "draft",
    price: 0,
    submitted_at: spec.submittedAt !== undefined ? spec.submittedAt : spec.status === "pending" ? new Date().toISOString() : null,
    removed_at: spec.removedAt ?? null,
    // Insert nhiều dòng gửi cùng tập cột, nên luôn truyền updated_at (cột not null).
    updated_at: spec.updatedAt ?? new Date().toISOString(),
  }));
  const { data, error } = await service.from("courses").insert(rows).select("id, title");
  if (error || !data) throw new Error(`Course fixture failed: ${error?.message}`);
  // PostgREST không đảm bảo thứ tự trả về của insert nhiều dòng, nên ghép lại theo title.
  const idByTitle = new Map(data.map((row) => [row.title as string, row.id as string]));
  const ids = specs.map((spec) => {
    const id = idByTitle.get(spec.title);
    if (!id) throw new Error(`Course fixture missing for ${spec.title}`);
    createdCourseIds.add(id);
    return id;
  });
  const { error: memberError } = await service.from("course_collaborators").insert(
    ids.map((courseId, index) => ({
      course_id: courseId,
      user_id: (specs[index].owner ?? owner).id,
      role: "owner",
      added_by: SEEDED.admin.id,
    })),
  );
  if (memberError) throw new Error(`Collaborator fixture failed: ${memberError.message}`);
  return ids;
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

async function readList(user: TestUser, filter: Partial<AdminCourseFilter> & { q: string }) {
  const result = await listAdminCourses(user.client, { status: "all", page: 1, ...filter });
  if (result.error !== null) throw new Error(`List failed: ${result.error}`);
  return result.data;
}

beforeAll(async () => {
  assertSafeEnvironment();
  admin = await seededUser("admin");
  teacher = await seededUser("teacher");
  student = await seededUser("student");
  owner = await createOwner("Chủ Khóa Học AD3");
  removedOwner = await createOwner("Chủ Đã Gỡ AD3", { removed: true });
}, 60_000);

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) throw new Error(`User fixture cleanup failed: ${error.message}`);
  }
});

describe("AD3 listAdminCourses with an admin session", () => {
  it("returns every state with owner names, per-tab filters and per-tab counts", async () => {
    const token = newToken();
    const removedAt = new Date().toISOString();
    const [draftId, pendingId, publishedId, removedId] = await createCourses([
      { title: `${token} nháp`, status: "draft" },
      { title: `${token} chờ duyệt`, status: "pending" },
      { title: `${token} đã xuất bản`, status: "published" },
      { title: `${token} đã gỡ`, status: "published", removedAt },
    ]);

    const all = await readList(admin, { q: token, status: "all" });
    expect(all.counts).toEqual({ pending: 1, published: 1, draft: 1, all: 3, removed: 1 });
    expect(all.total).toBe(3);
    expect(all.rows.map((row) => row.id).sort()).toEqual([draftId, pendingId, publishedId].sort());
    for (const row of all.rows) expect(row.ownerName).toBe(owner.fullName);

    const idsOf = async (status: AdminCourseFilter["status"]) =>
      (await readList(admin, { q: token, status })).rows.map((row) => row.id);
    expect(await idsOf("pending")).toEqual([pendingId]);
    expect(await idsOf("published")).toEqual([publishedId]);
    expect(await idsOf("draft")).toEqual([draftId]);
    expect(await idsOf("removed")).toEqual([removedId]);

    const removedRow = (await readList(admin, { q: token, status: "removed" })).rows[0];
    expect(removedRow).toMatchObject({ id: removedId, status: "published", ownerName: owner.fullName });
    expect(removedRow.removedAt).not.toBeNull();
  });

  it("orders pending by submitted_at, removed by removed_at descending, and others by updated_at descending", async () => {
    const token = newToken();
    const t = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 0, minutes)).toISOString();
    const ids = await createCourses([
      { title: `${token} p2`, status: "pending", submittedAt: t(20) },
      { title: `${token} p1`, status: "pending", submittedAt: t(10) },
      { title: `${token} p3`, status: "pending", submittedAt: t(30) },
      { title: `${token} r1`, status: "published", removedAt: t(10) },
      { title: `${token} r2`, status: "published", removedAt: t(30) },
      { title: `${token} u1`, status: "published", updatedAt: t(40) },
      { title: `${token} u2`, status: "published", updatedAt: t(50) },
    ]);
    const [p2, p1, p3, r1, r2, u1, u2] = ids;

    expect((await readList(admin, { q: token, status: "pending" })).rows.map((row) => row.id)).toEqual([p1, p2, p3]);
    expect((await readList(admin, { q: token, status: "removed" })).rows.map((row) => row.id)).toEqual([r2, r1]);
    expect((await readList(admin, { q: token, status: "published" })).rows.map((row) => row.id)).toEqual([u2, u1]);
  });

  it("pages server-side without duplicates or gaps and returns an empty page beyond the last", async () => {
    const token = newToken();
    const sameTime = new Date(Date.UTC(2026, 0, 1)).toISOString();
    const total = ADMIN_COURSE_PAGE_SIZE + 1;
    const ids = await createCourses(
      Array.from({ length: total }, (_, index) => ({
        title: `${token} khóa ${index}`,
        status: "pending" as const,
        submittedAt: sameTime,
      })),
    );

    const first = await readList(admin, { q: token, status: "pending", page: 1 });
    const second = await readList(admin, { q: token, status: "pending", page: 2 });
    expect(first).toMatchObject({ total, totalPages: 2, page: 1, pageSize: ADMIN_COURSE_PAGE_SIZE });
    expect(first.rows).toHaveLength(ADMIN_COURSE_PAGE_SIZE);
    expect(second.rows).toHaveLength(1);
    // Cùng submitted_at nên thứ tự phụ theo id: nối hai trang phải bằng danh sách id đã sắp xếp.
    expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual([...ids].sort());

    const beyond = await readList(admin, { q: token, status: "pending", page: 9 });
    expect(beyond.rows).toEqual([]);
    expect(beyond).toMatchObject({ total, totalPages: 2, page: 9 });
    expect(beyond.counts.pending).toBe(total);
  });

  it("returns an empty first page with zero counts when nothing matches", async () => {
    const data = await readList(admin, { q: newToken(), status: "pending" });
    expect(data.rows).toEqual([]);
    expect(data.counts).toEqual({ pending: 0, published: 0, draft: 0, all: 0, removed: 0 });
    expect(data.totalPages).toBe(1);
  });

  it("matches title and slug case-insensitively", async () => {
    const token = newToken();
    const [byTitle, bySlug] = await createCourses([
      { title: `${token} Tiêu Đề` },
      { title: "Khóa không có token", slug: `slug-${token}` },
    ]);

    const upper = await readList(admin, { q: token.toUpperCase() });
    expect(upper.rows.map((row) => row.id).sort()).toEqual([byTitle, bySlug].sort());
  });

  it.each(["%", "_", ",", "(", ")", '"', "\\"])(
    "matches the character %j literally without error or decoy matches",
    async (char) => {
      const token = newToken();
      const [exact] = await createCourses([
        { title: `${token} a${char}b` },
        { title: `${token} aXb` },
        { title: `${token} ab` },
      ]);

      const data = await readList(admin, { q: `${token} a${char}b` });
      expect(data.rows.map((row) => row.id)).toEqual([exact]);
    },
  );

  it("treats the star as a single-character wildcard, never a multi-character one", async () => {
    const token = newToken();
    const [literal, farAway] = await createCourses([
      { title: `${token} a*b` },
      { title: `${token} aXXXb` },
    ]);

    const data = await readList(admin, { q: `${token} a*b` });
    expect(data.rows.map((row) => row.id)).toContain(literal);
    expect(data.rows.map((row) => row.id)).not.toContain(farAway);
  });

  it("shows a null owner name when the owner profile is removed instead of failing the list", async () => {
    const token = newToken();
    const [withOwner, withRemovedOwner] = await createCourses([
      { title: `${token} có owner` },
      { title: `${token} owner đã gỡ`, owner: removedOwner },
    ]);

    const data = await readList(admin, { q: token });
    const byId = new Map(data.rows.map((row) => [row.id, row]));
    expect(byId.get(withOwner)?.ownerName).toBe(owner.fullName);
    expect(byId.has(withRemovedOwner)).toBe(true);
    expect(byId.get(withRemovedOwner)?.ownerName).toBeNull();
  });
});

describe("AD3 listAdminCourses with a non-admin session (defense in depth)", () => {
  it.each([
    ["a teacher outside the course", () => teacher],
    ["a student", () => student],
  ])("shows %s only the published, active courses and nothing else", async (_label, who) => {
    const token = newToken();
    const [published] = await createCourses([
      { title: `${token} đã xuất bản`, status: "published" },
      { title: `${token} nháp`, status: "draft" },
      { title: `${token} chờ duyệt`, status: "pending" },
      { title: `${token} đã gỡ`, status: "published", removedAt: new Date().toISOString() },
    ]);

    const data = await readList(who(), { q: token, status: "all" });
    expect(data.rows.map((row) => row.id)).toEqual([published]);
    expect(data.counts).toMatchObject({ pending: 0, draft: 0, removed: 0 });
  });

  it("lets the owner see their own draft but never a foreign one", async () => {
    const token = newToken();
    const [own, foreign] = await createCourses([
      { title: `${token} của owner`, owner },
      { title: `${token} của người khác`, owner: removedOwner },
    ]);

    const data = await readList(owner, { q: token, status: "draft" });
    expect(data.rows.map((row) => row.id)).toEqual([own]);
    expect(data.rows.map((row) => row.id)).not.toContain(foreign);
  });

  it("cannot read the summary of a hidden course", async () => {
    const [draftId] = await createCourses([{ title: `${newToken()} nháp` }]);

    for (const who of [teacher, student]) {
      expect(await getAdminCourseSummaryData(who.client, draftId)).toEqual({ data: null, error: null });
    }
  });
});

describe("AD3 getAdminCourseSummaryData", () => {
  async function addChapter(courseId: string, title: string, orderIndex: number, removed = false) {
    const { data, error } = await service
      .from("chapters")
      .insert({
        course_id: courseId,
        created_by_user_id: SEEDED.teacher.id,
        title,
        order_index: orderIndex,
        removed_at: removed ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Chapter fixture failed: ${error?.message}`);
    return data.id as string;
  }

  const topicRow = (
    courseId: string,
    chapterId: string,
    title: string,
    orderIndex: number,
    status: "draft" | "published",
    removed = false,
  ) => ({
    course_id: courseId,
    chapter_id: chapterId,
    title,
    status,
    order_index: orderIndex,
    original_creator_user_id: SEEDED.teacher.id,
    responsible_author_user_id: SEEDED.teacher.id,
    ...(status === "published" ? { first_approved_at: new Date().toISOString() } : {}),
    removed_at: removed ? new Date().toISOString() : null,
  });

  it("lists active chapters and topics in order with statuses and skips removed ones", async () => {
    const token = newToken();
    const [courseId] = await createCourses([{ title: `${token} dàn bài`, status: "pending" }]);
    const second = await addChapter(courseId, "Chương 2", 2);
    const first = await addChapter(courseId, "Chương 1", 1);
    const gone = await addChapter(courseId, "Chương đã gỡ", 3, true);
    const { error } = await service.from("topics").insert([
      topicRow(courseId, first, "Bài 1.2", 2, "draft"),
      topicRow(courseId, first, "Bài 1.1", 1, "published"),
      topicRow(courseId, first, "Bài 1.3 đã gỡ", 3, "published", true),
      topicRow(courseId, second, "Bài 2.1", 1, "published"),
      topicRow(courseId, gone, "Bài của chương đã gỡ", 1, "published"),
    ]);
    if (error) throw new Error(`Topic fixture failed: ${error.message}`);

    const result = await getAdminCourseSummaryData(admin.client, courseId);

    expect(result.error).toBeNull();
    expect(result.data?.course).toMatchObject({
      id: courseId,
      status: "pending",
      ownerName: owner.fullName,
      description: "AD3 admin course read integration fixture",
    });
    expect(result.data?.chapters.map((chapter) => chapter.title)).toEqual(["Chương 1", "Chương 2"]);
    expect(result.data?.chapters[0].topics.map((topic) => [topic.title, topic.status])).toEqual([
      ["Bài 1.1", "published"],
      ["Bài 1.2", "draft"],
    ]);
    expect(result.data?.chapters[1].topics.map((topic) => topic.title)).toEqual(["Bài 2.1"]);
    expect(result.data?.publishedTopicCount).toBe(2);
  });

  it("returns the complete outline of a course with more than 1000 active topics", async () => {
    const token = newToken();
    const [courseId] = await createCourses([{ title: `${token} khóa lớn`, status: "pending" }]);
    const chapterId = await addChapter(courseId, "Chương lớn", 1);
    const total = 1105;
    const draftEvery = 10;
    const rows = Array.from({ length: total }, (_, index) =>
      topicRow(
        courseId,
        chapterId,
        `Bài ${String(index + 1).padStart(4, "0")}`,
        index + 1,
        (index + 1) % draftEvery === 0 ? "draft" : "published",
      ),
    );
    for (let start = 0; start < rows.length; start += 500) {
      const { error } = await service.from("topics").insert(rows.slice(start, start + 500));
      if (error) throw new Error(`Bulk topic fixture failed: ${error.message}`);
    }

    const result = await getAdminCourseSummaryData(admin.client, courseId);

    const topics = result.data?.chapters[0].topics ?? [];
    expect(topics).toHaveLength(total);
    expect(topics[0].title).toBe("Bài 0001");
    expect(topics[total - 1].title).toBe(`Bài ${total}`);
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(total);
    expect(topics.map((topic) => topic.title)).toEqual(rows.map((row) => row.title));
    expect(result.data?.publishedTopicCount).toBe(total - Math.floor(total / draftEvery));
  }, 60_000);

  it("returns no data and no error for a course that does not exist", async () => {
    expect(await getAdminCourseSummaryData(admin.client, randomUUID())).toEqual({ data: null, error: null });
  });
});
