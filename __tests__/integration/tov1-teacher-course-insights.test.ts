import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { teacherCourseInsightsSchema } from "@/lib/schemas/teacher-course-insights";
import { runLocalPsql } from "./helpers/local-psql";

// Test plan:
// - Mục tiêu: kiểm tra read boundary `get_teacher_course_insights(p_course_id)` của trang Tổng quan khóa học: quyền đọc, bucket ghi danh theo tháng và phân bố tiến độ học viên.
// - Loại test: real local Supabase integration/RPC; chỉ chạy trên runtime E2E cô lập (API 45441), runtime gốc 45321 bị từ chối trước khi tạo actor/fixture.
// - Đối tượng: RPC `get_teacher_course_insights` cùng grant và thuộc tính hàm trong pg_proc.
// - Case thành công:
//   - Owner, co_owner và editor nhận cùng một payload đã qua `teacherCourseInsightsSchema`.
//   - Sáu tháng tính theo tháng hiện tại Asia/Ho_Chi_Minh của database, tháng trống bằng 0, mốc đầu tháng và 00:30 giờ Việt Nam (vẫn là tháng trước theo UTC) rơi vào tháng hiện tại; ghi danh cũ hơn chỉ vào tổng.
//   - Phân bố tiến độ: hoàn thành mọi bài được tính, đang học, chưa bắt đầu (kể cả có dòng progress chưa hoàn thành, chỉ hoàn thành bài chưa publish/đã xóa/thuộc chapter đã xóa).
//   - Thêm bài được tính đưa học viên đã hoàn thành về đang học (D4).
// - Case thất bại:
//   - Anon bị từ chối bằng lỗi quyền 42501; course id không phải UUID bị PostgREST từ chối.
//   - Profile bị xóa mềm, người ngoài, học viên của khóa học, previewer, khóa học đã xóa mềm, khóa học không tồn tại và null đều nhận `TEACHER_INSIGHTS_FORBIDDEN` và không có dữ liệu.
// - Bảo mật/phân quyền:
//   - Hàm là SECURITY DEFINER, stable, search_path rỗng; anon/public không có execute, authenticated/service_role có.
//   - Payload chỉ có bốn khóa số đếm và không chứa id học viên.
// - Ổn định/resilience:
//   - Khóa học không có ghi danh: tổng 0, sáu tháng bằng 0, phân bố toàn 0; khóa học không có bài được tính: progress null.
//   - Học viên không ghi danh có progress và ghi danh ở khóa học khác không làm lệch số liệu.
// - Invariant cần giữ:
//   - Chỉ owner/co_owner/editor còn hoạt động của khóa học còn hoạt động đọc được số liệu tổng hợp, không bao giờ có dòng của học viên.
// - Kết quả verify gần nhất: passed (19 test) bằng `npm run test:integration -- __tests__/integration/tov1-teacher-course-insights.test.ts` trên runtime E2E cô lập (API 45441) sau local reset (TOV1 CP1).
// - Ghi chú: cần `ALLOW_DB_INTEGRATION_TESTS=true`; user test tạo qua service role và được xóa ở afterAll.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const RPC = "get_teacher_course_insights";

const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, authOptions);

type ActorName = "owner" | "coOwner" | "editor" | "previewer" | "outsider" | "student";
type Actor = { id: string; client: SupabaseClient };
const actors = {} as Record<ActorName, Actor>;
const learnerIds: string[] = [];
const createdUserIds: string[] = [];
const courseIds = new Set<string>();

// Suite này ghi trực tiếp bằng quyền postgres (psql, tắt trigger), nên chỉ chạy trên runtime E2E cô lập (API 45441).
const ISOLATED_API_URL = "http://127.0.0.1:45441";

function assertIsolatedRuntime(apiUrl: string | undefined, allowFlag = process.env.ALLOW_DB_INTEGRATION_TESTS) {
  if (allowFlag !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  let url: URL;
  try {
    url = new URL(apiUrl ?? "");
  } catch {
    throw new Error("Refusing to run: Supabase URL is missing or invalid.");
  }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== "45441") {
    throw new Error(`TOV1 runs only on the isolated runtime ${ISOLATED_API_URL}; refusing ${apiUrl}.`);
  }
}

async function createUser(label: string, role: "teacher" | "student") {
  const email = `tov1-${label}-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `TOV1 ${label}` },
    app_metadata: { d7_server_created: true },
  });
  if (error || !data.user) throw new Error(`User ${label} failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  const profile = await service.from("profiles").update({ role }).eq("id", data.user.id);
  if (profile.error) throw new Error(`User ${label} role failed: ${profile.error.message}`);
  return { id: data.user.id, email, password };
}

async function createActor(name: ActorName, role: "teacher" | "student"): Promise<Actor> {
  const user = await createUser(name, role);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, authOptions);
  const signIn = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (signIn.error) throw new Error(`Actor ${name} sign-in failed: ${signIn.error.message}`);
  return { id: user.id, client };
}

type TopicSpec = { status: "draft" | "published"; removed?: boolean };
type ChapterSpec = { removed?: boolean; topics: TopicSpec[] };

// Khóa học có owner/co_owner/editor/previewer cố định; trả id topic theo thứ tự khai báo của từng chapter.
async function createCourse(chapters: ChapterSpec[] = [{ topics: [{ status: "published" }] }]) {
  const suffix = randomUUID();
  const course = await service.from("courses").insert({
    title: `TOV1 course ${suffix}`,
    slug: `tov1-course-${suffix}`,
    description: "TOV1 insights integration fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  if (course.error || !course.data) throw new Error(`Course fixture failed: ${course.error?.message}`);
  const courseId = course.data.id as string;
  courseIds.add(courseId);

  const members = [
    ["owner", "owner"],
    ["coOwner", "co_owner"],
    ["editor", "editor"],
    ["previewer", "previewer"],
  ] as const;
  const collaborators = await service.from("course_collaborators").insert(
    members.map(([actor, role]) => ({ course_id: courseId, user_id: actors[actor].id, role, added_by: ADMIN_ID })),
  );
  if (collaborators.error) throw new Error(`Collaborator fixture failed: ${collaborators.error.message}`);

  const topicIds: string[][] = [];
  const published: string[] = [];
  const removedTopics: string[] = [];
  const removedChapters: string[] = [];
  for (const [chapterIndex, chapterSpec] of chapters.entries()) {
    const chapter = await service.from("chapters").insert({
      course_id: courseId,
      created_by_user_id: actors.owner.id,
      title: `TOV1 chapter ${chapterIndex}`,
      order_index: chapterIndex + 1,
    }).select("id").single();
    if (chapter.error || !chapter.data) throw new Error(`Chapter fixture failed: ${chapter.error?.message}`);
    const chapterId = chapter.data.id as string;
    if (chapterSpec.removed) removedChapters.push(chapterId);

    const ids: string[] = [];
    for (const [topicIndex, topicSpec] of chapterSpec.topics.entries()) {
      const topic = await service.from("topics").insert({
        course_id: courseId,
        chapter_id: chapterId,
        title: `TOV1 topic ${chapterIndex}.${topicIndex}`,
        status: "draft",
        order_index: topicIndex + 1,
        original_creator_user_id: actors.owner.id,
        responsible_author_user_id: actors.owner.id,
      }).select("id").single();
      if (topic.error || !topic.data) throw new Error(`Topic fixture failed: ${topic.error?.message}`);
      const topicId = topic.data.id as string;
      ids.push(topicId);
      if (topicSpec.status === "published") published.push(topicId);
      if (topicSpec.removed) removedTopics.push(topicId);
    }
    topicIds.push(ids);
  }

  // Trạng thái nội dung được đặt thẳng bằng quyền postgres: suite này chỉ kiểm phép đếm, không kiểm luồng publish/xóa.
  const statements = [
    ...published.map((id) => `update public.topics set status = 'published', first_approved_at = now() where id = '${id}';`),
    ...removedTopics.map((id) => `update public.topics set removed_at = now() where id = '${id}';`),
    ...removedChapters.map((id) => `update public.chapters set removed_at = now() where id = '${id}';`),
  ];
  if (statements.length > 0) runLocalPsql(`set session_replication_role = replica;\n${statements.join("\n")}`);

  return { courseId, topicIds };
}

async function enroll(courseId: string, userId: string, enrolledAt = new Date().toISOString()) {
  const { error } = await service.from("enrollments").insert({ course_id: courseId, user_id: userId, enrolled_at: enrolledAt });
  if (error) throw new Error(`Enrollment fixture failed: ${error.message}`);
}

async function progress(userId: string, topicIds: string[], completed = true) {
  const { error } = await service.from("user_topic_progress").insert(
    topicIds.map((topicId) => ({
      user_id: userId,
      topic_id: topicId,
      is_topic_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
    })),
  );
  if (error) throw new Error(`Progress fixture failed: ${error.message}`);
}

async function insightsOf(actor: ActorName, courseId: string) {
  const result = await actors[actor].client.rpc(RPC, { p_course_id: courseId });
  expect(result.error).toBeNull();
  const parsed = teacherCourseInsightsSchema.safeParse(result.data);
  expect(parsed.success).toBe(true);
  return parsed.data!;
}

async function expectForbidden(client: SupabaseClient, courseId: string | null) {
  const result = await client.rpc(RPC, { p_course_id: courseId });
  expect(result.data).toBeNull();
  expect(result.error?.message).toContain("TEACHER_INSIGHTS_FORBIDDEN");
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Mốc 00:00 ngày 1 theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
const monthStartMs = (month: string) => Date.parse(`${month}-01T00:00:00+07:00`);
const isoAt = (ms: number) => new Date(ms).toISOString();
const DAY_MS = 24 * 60 * 60 * 1000;

// exercises/topics/chapters tham chiếu course không cascade; xóa theo thứ tự và báo lỗi để không để lại dữ liệu mồ côi.
async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length === 0) return;
  const topics = await service.from("topics").select("id").in("course_id", ids);
  if (topics.error) throw new Error(`Cleanup topic lookup failed: ${topics.error.message}`);
  const topicIds = (topics.data ?? []).map((row) => row.id as string);
  if (topicIds.length > 0) {
    const { error } = await service.from("user_topic_progress").delete().in("topic_id", topicIds);
    if (error) throw new Error(`Cleanup user_topic_progress failed: ${error.message}`);
  }
  for (const [table, column] of [
    ["enrollments", "course_id"],
    ["exercises", "course_id"],
    ["topics", "course_id"],
    ["chapters", "course_id"],
    ["courses", "id"],
  ] as const) {
    const { error } = await service.from(table).delete().in(column, ids);
    if (error) throw new Error(`Cleanup ${table} failed: ${error.message}`);
  }
}

describe.sequential("TOV1 teacher course insights read boundary", () => {
  beforeAll(async () => {
    assertIsolatedRuntime(SUPABASE_URL);
    actors.owner = await createActor("owner", "teacher");
    actors.coOwner = await createActor("coOwner", "teacher");
    actors.editor = await createActor("editor", "teacher");
    actors.previewer = await createActor("previewer", "teacher");
    actors.outsider = await createActor("outsider", "teacher");
    actors.student = await createActor("student", "student");
    for (let index = 0; index < 7; index += 1) {
      learnerIds.push((await createUser(`learner${index}`, "student")).id);
    }
  });

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    for (const id of createdUserIds) await service.auth.admin.deleteUser(id);
  });

  describe("runtime guard", () => {
    it.each([
      ["the root development runtime", "http://127.0.0.1:45321"],
      ["a hosted project", "https://example.supabase.co"],
      ["localhost instead of the isolated address", "http://localhost:45441"],
      ["a missing URL", undefined],
    ])("refuses %s before any fixture is created", (_name, url) => {
      expect(() => assertIsolatedRuntime(url, "true")).toThrow();
    });

    it("refuses to run without the explicit integration flag, and accepts only the isolated runtime", () => {
      expect(() => assertIsolatedRuntime(ISOLATED_API_URL, "false")).toThrow("ALLOW_DB_INTEGRATION_TESTS");
      expect(() => assertIsolatedRuntime(ISOLATED_API_URL, "true")).not.toThrow();
    });
  });

  describe("function definition and grants", () => {
    it("is a stable SECURITY DEFINER function with an empty search_path", () => {
      expect(runLocalPsql(`
        select prosecdef::text || '|' || provolatile::text || '|' || array_to_string(proconfig, ',')
        from pg_proc where oid = 'public.get_teacher_course_insights(uuid)'::regprocedure
      `)).toBe(`true|s|search_path=""`);
    });

    it("grants execute only to authenticated and service_role", () => {
      expect(runLocalPsql(`
        select string_agg(r || '=' || has_function_privilege(r, 'public.get_teacher_course_insights(uuid)', 'execute'), ',' order by r)
        from unnest(array['anon', 'authenticated', 'service_role']) as r
      `)).toBe("anon=false,authenticated=true,service_role=true");
      expect(runLocalPsql(`
        select count(*) from pg_proc p, aclexplode(p.proacl) a
        where p.oid = 'public.get_teacher_course_insights(uuid)'::regprocedure and a.grantee = 0
      `)).toBe("0");
    });
  });

  describe("authorization", () => {
    it("denies anon with a permission error instead of returning figures", async () => {
      const { courseId } = await createCourse();
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, authOptions);
      const result = await anon.rpc(RPC, { p_course_id: courseId });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("42501");
    });

    it("returns the same aggregate figures to owner, co_owner and editor", async () => {
      const { courseId, topicIds } = await createCourse();
      await enroll(courseId, learnerIds[0]);
      await progress(learnerIds[0], topicIds[0]);

      const owner = await insightsOf("owner", courseId);
      expect(owner).toMatchObject({ enrollment_total: 1, counted_topic_total: 1, progress: { completed: 1 } });
      expect(await insightsOf("coOwner", courseId)).toEqual(owner);
      expect(await insightsOf("editor", courseId)).toEqual(owner);
    });

    it("denies previewers, outsiders and an enrolled student of the course", async () => {
      const { courseId } = await createCourse();
      await enroll(courseId, actors.student.id);
      expect((await insightsOf("owner", courseId)).enrollment_total).toBe(1); // positive control

      await expectForbidden(actors.previewer.client, courseId);
      await expectForbidden(actors.outsider.client, courseId);
      await expectForbidden(actors.student.client, courseId);
    });

    it("denies an editor whose profile was soft-deleted while the session is still valid", async () => {
      const { courseId } = await createCourse();
      await insightsOf("editor", courseId); // positive control

      const remove = await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", actors.editor.id);
      expect(remove.error).toBeNull();
      try {
        await expectForbidden(actors.editor.client, courseId);
      } finally {
        await service.from("profiles").update({ removed_at: null }).eq("id", actors.editor.id);
      }
    });

    it("denies a soft-deleted course, a missing course and a null course id with the same code", async () => {
      const { courseId } = await createCourse();
      await insightsOf("owner", courseId); // positive control

      await service.from("courses").update({ removed_at: new Date().toISOString() }).eq("id", courseId);
      await expectForbidden(actors.owner.client, courseId);
      await expectForbidden(actors.owner.client, randomUUID());
      await expectForbidden(actors.owner.client, null);
    });

    it("rejects a non-UUID course id before the function runs", async () => {
      const result = await actors.owner.client.rpc(RPC, { p_course_id: "' or 1=1 --" });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("22P02");
    });

    it("returns only aggregate counts, never learner identities", async () => {
      const { courseId, topicIds } = await createCourse();
      await enroll(courseId, learnerIds[0]);
      await progress(learnerIds[0], topicIds[0]);

      const result = await actors.owner.client.rpc(RPC, { p_course_id: courseId });
      expect(result.error).toBeNull();
      expect(Object.keys(result.data).sort()).toEqual(
        ["counted_topic_total", "enrollment_total", "enrollments_by_month", "progress"],
      );
      expect(JSON.stringify(result.data)).not.toContain(learnerIds[0]);
    });
  });

  describe("enrollments by month (Asia/Ho_Chi_Minh)", () => {
    it("buckets six months from the database's current month, with zero months and Vietnam-time boundaries", async () => {
      const { courseId } = await createCourse();
      const current = runLocalPsql(
        "select to_char(date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh'), 'YYYY-MM')",
      );
      const start = monthStartMs(current);

      await enroll(courseId, learnerIds[0], isoAt(start)); // đúng mốc đầu tháng hiện tại
      // 00:30 ngày 1 giờ Việt Nam = 17:30 UTC ngày cuối tháng trước: bucket theo UTC sẽ sai tháng.
      await enroll(courseId, learnerIds[1], isoAt(start + 30 * 60 * 1000));
      await enroll(courseId, learnerIds[2], isoAt(start - 1000)); // một giây trước: tháng trước
      await enroll(courseId, learnerIds[3], isoAt(monthStartMs(shiftMonth(current, -3)) + DAY_MS));
      await enroll(courseId, learnerIds[4], isoAt(monthStartMs(shiftMonth(current, -5)))); // tháng cũ nhất trong cửa sổ
      await enroll(courseId, learnerIds[5], isoAt(monthStartMs(shiftMonth(current, -5)) - 1000)); // ngoài cửa sổ

      const insights = await insightsOf("owner", courseId);
      expect(insights.enrollment_total).toBe(6);
      expect(insights.enrollments_by_month).toEqual([
        { month: shiftMonth(current, -5), count: 1 },
        { month: shiftMonth(current, -4), count: 0 },
        { month: shiftMonth(current, -3), count: 1 },
        { month: shiftMonth(current, -2), count: 0 },
        { month: shiftMonth(current, -1), count: 1 },
        { month: current, count: 2 },
      ]);
    });

    it("returns six zero months, a zero total and an all-zero distribution for a course without enrollments", async () => {
      const { courseId } = await createCourse();
      const insights = await insightsOf("owner", courseId);
      expect(insights.enrollment_total).toBe(0);
      expect(insights.enrollments_by_month.map((entry) => entry.count)).toEqual([0, 0, 0, 0, 0, 0]);
      expect(insights.progress).toEqual({ not_started: 0, in_progress: 0, completed: 0 });
    });
  });

  describe("progress distribution", () => {
    it("counts only published, active topics in active chapters and puts every learner in exactly one category", async () => {
      const { courseId, topicIds } = await createCourse([
        { topics: [{ status: "published" }, { status: "published" }, { status: "draft" }, { status: "published", removed: true }] },
        { removed: true, topics: [{ status: "published" }] },
      ]);
      const [[t1, t2, draft, removedTopic], [inRemovedChapter]] = topicIds;
      const [completed, partial, startedOnly, uncountedOnly, untouched, mixed, notEnrolled] = learnerIds;

      for (const learner of [completed, partial, startedOnly, uncountedOnly, untouched, mixed]) await enroll(courseId, learner);
      await progress(completed, [t1, t2]);
      await progress(partial, [t1]);
      await progress(startedOnly, [t1, t2], false); // có dòng progress nhưng chưa hoàn thành bài nào
      await progress(uncountedOnly, [draft, removedTopic, inRemovedChapter]);
      await progress(mixed, [t1, removedTopic, inRemovedChapter]); // ba dòng hoàn thành nhưng chỉ một bài được tính
      await progress(notEnrolled, [t1, t2]);

      // Học viên ghi danh ở khóa học khác không được tính vào khóa học này.
      const other = await createCourse();
      await enroll(other.courseId, notEnrolled);

      const insights = await insightsOf("owner", courseId);
      expect(insights.enrollment_total).toBe(6);
      expect(insights.counted_topic_total).toBe(2);
      expect(insights.progress).toEqual({ not_started: 3, in_progress: 2, completed: 1 });
    });

    it("moves a learner who completed every topic back to in progress when a topic is published", async () => {
      const { courseId, topicIds } = await createCourse([{ topics: [{ status: "published" }, { status: "draft" }] }]);
      const [[t1, t2]] = topicIds;
      await enroll(courseId, learnerIds[0]);
      await progress(learnerIds[0], [t1]);
      expect((await insightsOf("owner", courseId)).progress).toEqual({ not_started: 0, in_progress: 0, completed: 1 });

      runLocalPsql(`set session_replication_role = replica;\nupdate public.topics set status = 'published', first_approved_at = now() where id = '${t2}';`);
      const insights = await insightsOf("owner", courseId);
      expect(insights.counted_topic_total).toBe(2);
      expect(insights.progress).toEqual({ not_started: 0, in_progress: 1, completed: 0 });
    });

    it("returns no distribution when the course has no counted topic, while still counting enrollments", async () => {
      const { courseId, topicIds } = await createCourse([
        { topics: [{ status: "draft" }, { status: "published", removed: true }] },
        { removed: true, topics: [{ status: "published" }] },
      ]);
      await enroll(courseId, learnerIds[0]);
      await progress(learnerIds[0], topicIds.flat());

      const insights = await insightsOf("owner", courseId);
      expect(insights).toMatchObject({ enrollment_total: 1, counted_topic_total: 0, progress: null });
    });
  });
});
