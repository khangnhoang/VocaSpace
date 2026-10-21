import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { teacherCoursePortfolioSchema } from "@/lib/schemas/teacher-course-portfolio";
import { runLocalPsql } from "./helpers/local-psql";

// Test plan:
// - Mục tiêu: kiểm tra read boundary `get_teacher_course_portfolio()` của /teacher/courses: membership, hàng chờ duyệt, hàng chờ sửa và danh tính người gọi.
// - Loại test: real local Supabase integration/RPC (runtime E2E cô lập, API 45441).
// - Đối tượng: RPC `get_teacher_course_portfolio` cùng các RPC lifecycle D1 dùng để dựng trạng thái (request/reject/approve/withdraw/delete/restore topic).
// - Case thành công:
//   - Owner/co_owner/editor/previewer thấy khóa học còn hoạt động với đúng vai trò; payload qua `teacherCoursePortfolioSchema`.
//   - Reviewer hợp lệ (co_owner, previewer có can_review_topics) nhận `topic_review`; người nộp lần lượt nhận `topic_correction` sau khi bị từ chối.
//   - Course bị từ chối hiện `course_rejection` cho owner/editor.
// - Case thất bại:
//   - Anon bị từ chối bằng lỗi quyền (không phải kết quả rỗng); RPC không nhận tham số danh tính nên đối số thừa bị PostgREST từ chối.
//   - Người ngoài khóa học, course/topic đã xóa mềm, mất cộng tác không có dữ liệu.
// - Bảo mật/phân quyền:
//   - Người nộp, original creator, responsible, contributor, exclusion lịch sử, editor không có can_review_topics không nhận `topic_review`.
//   - Previewer không có quyền sửa topic/course không nhận correction; previewer là responsible vẫn nhận `topic_correction`, không nhận `course_rejection`.
//   - Contributor thuần (không phải creator/responsible) không nhận correction; original creator đã chuyển trách nhiệm vẫn nhận (D1 canEdit gồm creator, AC9).
//   - `can_create_course` theo profile.role toàn cục, độc lập vai trò course.
// - Ổn định/resilience:
//   - Bản nộp mới nhất theo mọi người gửi (A bị từ chối rồi B nộp): không correction cho ai, review cho reviewer hợp lệ.
//   - Withdraw sau rejection rồi delete/restore, và approve sau rejection: không correction.
//   - Một người giữ nhiều vai trò trên cùng topic chỉ nhận một dòng.
// - Invariant cần giữ:
//   - Hàng chờ chỉ chứa việc người gọi được phép làm; quyền lấy từ predicate D1 hiện hành, không từ client.
// - Kết quả verify gần nhất: passed (20 test) bằng `npm run test:integration -- __tests__/integration/tport1-teacher-course-portfolio.test.ts` trên runtime E2E cô lập (API 45441) sau local reset (TPORT1 CP1).
// - Ghi chú: cần `ALLOW_DB_INTEGRATION_TESTS=true`; user test tạo qua service role và được xóa ở afterAll.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, authOptions);

type ActorName = "author" | "reviewer" | "editor" | "previewer" | "outsider" | "student";
type Actor = { id: string; client: SupabaseClient };
const actors = {} as Record<ActorName, Actor>;
const createdUserIds: string[] = [];
const courseIds = new Set<string>();

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !["45321", "45441"].includes(url.port)) {
    throw new Error(`Refusing non-local Supabase URL: ${SUPABASE_URL}`);
  }
}

async function createActor(name: ActorName, role: "teacher" | "student"): Promise<Actor> {
  const email = `tport1-${name}-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `TPORT1 ${name}` },
    app_metadata: { d7_server_created: true },
  });
  if (error || !data.user) throw new Error(`Actor ${name} failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  const profile = await service.from("profiles").update({ role }).eq("id", data.user.id);
  if (profile.error) throw new Error(`Actor ${name} role failed: ${profile.error.message}`);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, authOptions);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`Actor ${name} sign-in failed: ${signIn.error.message}`);
  return { id: data.user.id, client };
}

type Member = { actor: ActorName; role: "owner" | "co_owner" | "editor" | "previewer"; canReview?: boolean };

// Mặc định `author` là owner, creator và responsible của topic; test ghi đè bằng `creator`/`responsible`.
async function createFixture(options: {
  members: Member[];
  creator?: ActorName;
  responsible?: ActorName;
}) {
  const suffix = randomUUID();
  const course = await service.from("courses").insert({
    title: `TPORT1 course ${suffix}`,
    slug: `tport1-course-${suffix}`,
    description: "TPORT1 portfolio integration fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  if (course.error || !course.data) throw new Error(`Course fixture failed: ${course.error?.message}`);
  const courseId = course.data.id as string;
  courseIds.add(courseId);

  const collaborators = await service.from("course_collaborators").insert(
    options.members.map((member) => ({
      course_id: courseId,
      user_id: actors[member.actor].id,
      role: member.role,
      added_by: ADMIN_ID,
      can_review_topics: member.canReview ?? false,
    })),
  );
  if (collaborators.error) throw new Error(`Collaborator fixture failed: ${collaborators.error.message}`);

  const creator = actors[options.creator ?? "author"].id;
  const responsible = actors[options.responsible ?? options.creator ?? "author"].id;
  const chapter = await service.from("chapters").insert({
    course_id: courseId,
    created_by_user_id: creator,
    title: "TPORT1 chapter",
    order_index: 1,
  }).select("id").single();
  if (chapter.error || !chapter.data) throw new Error(`Chapter fixture failed: ${chapter.error?.message}`);

  const topic = await service.from("topics").insert({
    course_id: courseId,
    chapter_id: chapter.data.id,
    title: "TPORT1 topic",
    status: "draft",
    order_index: 1,
    original_creator_user_id: creator,
    responsible_author_user_id: responsible,
  }).select("id").single();
  if (topic.error || !topic.data) throw new Error(`Topic fixture failed: ${topic.error?.message}`);
  const topicId = topic.data.id as string;

  const card = await service.from("cards").insert({
    topic_id: topicId,
    front_content: { word: "tport1" },
    back_content: { translation: "tport1" },
    order_index: 0,
  });
  if (card.error) throw new Error(`Card fixture failed: ${card.error.message}`);
  const exercise = await service.from("exercises").insert({
    topic_id: topicId,
    course_id: courseId,
    title: "tport1 exercise",
    part_type: "part_5",
    order_index: 0,
  });
  if (exercise.error) throw new Error(`Exercise fixture failed: ${exercise.error.message}`);

  return { courseId, chapterId: chapter.data.id as string, topicId };
}

async function portfolioOf(actor: Actor) {
  const result = await actor.client.rpc("get_teacher_course_portfolio");
  expect(result.error).toBeNull();
  const parsed = teacherCoursePortfolioSchema.safeParse(result.data);
  expect(parsed.success).toBe(true);
  return parsed.data!;
}

async function attentionFor(actor: ActorName, scope: { courseId: string }) {
  const portfolio = await portfolioOf(actors[actor]);
  return portfolio.attention.filter((item) => item.course_id === scope.courseId);
}

async function pendingSubmissionId(topicId: string) {
  const { data, error } = await service.from("topic_review_submissions")
    .select("id").eq("topic_id", topicId).eq("status", "pending").single();
  if (error || !data) throw new Error(`Pending submission missing: ${error?.message}`);
  return data.id as string;
}

async function submit(actor: ActorName, topicId: string) {
  const result = await actors[actor].client.rpc("request_topic_review", { p_topic_id: topicId });
  expect(result.error).toBeNull();
}

async function reject(actor: ActorName, topicId: string, reason: string) {
  const result = await actors[actor].client.rpc("reject_topic_review", {
    p_submission_id: await pendingSubmissionId(topicId),
    p_reason: reason,
  });
  expect(result.error).toBeNull();
}

// exercises/topics/chapters tham chiếu course không cascade; xóa theo thứ tự và báo lỗi để không để lại dữ liệu mồ côi.
async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length === 0) return;
  for (const [table, column] of [
    ["exercises", "course_id"],
    ["topics", "course_id"],
    ["chapters", "course_id"],
    ["courses", "id"],
  ] as const) {
    const { error } = await service.from(table).delete().in(column, ids);
    if (error) throw new Error(`Cleanup ${table} failed: ${error.message}`);
  }
}

describe.sequential("TPORT1 teacher course portfolio read boundary", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    actors.author = await createActor("author", "teacher");
    actors.reviewer = await createActor("reviewer", "teacher");
    actors.editor = await createActor("editor", "teacher");
    actors.previewer = await createActor("previewer", "teacher");
    actors.outsider = await createActor("outsider", "teacher");
    actors.student = await createActor("student", "student");
  });

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    for (const id of createdUserIds) await service.auth.admin.deleteUser(id);
  });

  describe("caller identity and grants", () => {
    it("denies anon with a permission error instead of an empty portfolio", async () => {
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, authOptions);
      const result = await anon.rpc("get_teacher_course_portfolio");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("42501");
    });

    it("exposes a zero-argument signature, so a client cannot supply another caller's id", async () => {
      expect(runLocalPsql(
        "select pronargs from pg_proc where oid = 'public.get_teacher_course_portfolio()'::regprocedure",
      )).toBe("0");

      const result = await actors.author.client.rpc("get_teacher_course_portfolio", {
        p_user_id: actors.reviewer.id,
      });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("PGRST202");
    });

    it("scopes every result to the authenticated caller", async () => {
      const fixture = await createFixture({ members: [{ actor: "author", role: "owner" }] });
      expect((await portfolioOf(actors.author)).courses.map((c) => c.id)).toContain(fixture.courseId);
      expect((await portfolioOf(actors.outsider)).courses.map((c) => c.id)).not.toContain(fixture.courseId);
    });
  });

  describe("courses", () => {
    it("lists active collaborations with the caller's real role and excludes removed courses or lost membership", async () => {
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "editor", role: "editor" },
          { actor: "previewer", role: "previewer" },
        ],
      });

      for (const [name, role] of [["author", "owner"], ["editor", "editor"], ["previewer", "previewer"]] as const) {
        const course = (await portfolioOf(actors[name])).courses.find((c) => c.id === fixture.courseId);
        expect(course?.my_role).toBe(role);
      }
      expect((await portfolioOf(actors.outsider)).courses.map((c) => c.id)).not.toContain(fixture.courseId);

      await service.from("course_collaborators").delete()
        .eq("course_id", fixture.courseId).eq("user_id", actors.editor.id);
      expect((await portfolioOf(actors.editor)).courses.map((c) => c.id)).not.toContain(fixture.courseId);

      await service.from("courses").update({ removed_at: new Date().toISOString() }).eq("id", fixture.courseId);
      expect((await portfolioOf(actors.author)).courses.map((c) => c.id)).not.toContain(fixture.courseId);
    });

    it("derives course creation from the global profile role, independent of course role", async () => {
      await createFixture({ members: [{ actor: "previewer", role: "previewer" }, { actor: "student", role: "previewer" }] });
      expect((await portfolioOf(actors.previewer)).can_create_course).toBe(true);
      expect((await portfolioOf(actors.student)).can_create_course).toBe(false);
    });

    it("returns an empty portfolio for a caller with no collaborations", async () => {
      expect(await portfolioOf(actors.outsider)).toMatchObject({ courses: [], attention: [] });
    });
  });

  describe("review queue (Chờ duyệt)", () => {
    it("shows a pending topic only to reviewers D1 allows to review it", async () => {
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "reviewer", role: "co_owner" },
          { actor: "editor", role: "editor", canReview: false },
          { actor: "previewer", role: "previewer", canReview: true },
        ],
      });
      await submit("author", fixture.topicId);

      for (const name of ["reviewer", "previewer"] as const) {
        const items = await attentionFor(name, fixture);
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
          kind: "topic_review",
          topic_id: fixture.topicId,
          reason: null,
        });
      }
      for (const name of ["author", "editor"] as const) {
        expect(await attentionFor(name, fixture)).toEqual([]);
      }
      expect(await attentionFor("outsider", fixture)).toEqual([]);
    });

    it("never offers review to the submitter, original creator, responsible author, contributor or historically excluded user", async () => {
      // creator = editor(can review), responsible = author, contributor = previewer(can review).
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "editor", role: "co_owner" },
          { actor: "previewer", role: "co_owner" },
          { actor: "reviewer", role: "co_owner" },
        ],
        creator: "editor",
        responsible: "author",
      });
      const contributor = await actors.author.client.rpc("add_topic_contributor", {
        p_topic_id: fixture.topicId,
        p_user_id: actors.previewer.id,
      });
      expect(contributor.error).toBeNull();
      await submit("author", fixture.topicId);

      expect(await attentionFor("author", fixture)).toEqual([]); // submitter + responsible
      expect(await attentionFor("editor", fixture)).toEqual([]); // original creator
      expect(await attentionFor("previewer", fixture)).toEqual([]); // contributor
      expect(await attentionFor("reviewer", fixture)).toHaveLength(1);

      const exclusion = await service.from("topic_author_review_exclusions").insert({
        topic_id: fixture.topicId,
        user_id: actors.reviewer.id,
        exclusion_type: "initial_contributor",
      });
      expect(exclusion.error).toBeNull();
      expect(await attentionFor("reviewer", fixture)).toEqual([]); // historical exclusion
    });

    it("lists a topic once when the caller holds several qualifying roles", async () => {
      // reviewer qualifies through both the co_owner role and the explicit review flag.
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "reviewer", role: "co_owner", canReview: true },
        ],
      });
      await submit("author", fixture.topicId);
      const items = await attentionFor("reviewer", fixture);
      expect(items.filter((item) => item.topic_id === fixture.topicId)).toHaveLength(1);
    });

    it("hides the review item once the topic is no longer pending, active, or in an active chapter", async () => {
      const fixture = await createFixture({
        members: [{ actor: "author", role: "owner" }, { actor: "reviewer", role: "co_owner" }],
      });
      await submit("author", fixture.topicId);
      expect(await attentionFor("reviewer", fixture)).toHaveLength(1);

      await service.from("chapters").update({ removed_at: new Date().toISOString() }).eq("id", fixture.chapterId);
      expect(await attentionFor("reviewer", fixture)).toEqual([]);
    });
  });

  describe("correction queue (Cần sửa)", () => {
    it("gives the rejected topic's author a correction item with the latest reason, and nobody else", async () => {
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "reviewer", role: "co_owner" },
          { actor: "editor", role: "editor" },
        ],
      });
      await submit("author", fixture.topicId);
      await reject("reviewer", fixture.topicId, "Thiếu ví dụ cho từ vựng");

      const items = await attentionFor("author", fixture);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        kind: "topic_correction",
        topic_id: fixture.topicId,
        reason: "Thiếu ví dụ cho từ vựng",
      });
      expect(await attentionFor("reviewer", fixture)).toEqual([]);
      expect(await attentionFor("editor", fixture)).toEqual([]);
    });

    it("keeps correction entry for a previewer who is the responsible author, without course edit actions", async () => {
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "reviewer", role: "co_owner" },
          { actor: "previewer", role: "previewer" },
        ],
        creator: "previewer",
        responsible: "previewer",
      });
      await submit("previewer", fixture.topicId);
      await reject("reviewer", fixture.topicId, "Cần sửa phần giải thích");

      const items = await attentionFor("previewer", fixture);
      expect(items.map((item) => item.kind)).toEqual(["topic_correction"]);
      const course = (await portfolioOf(actors.previewer)).courses.find((c) => c.id === fixture.courseId);
      expect(course?.my_role).toBe("previewer");
    });

    it("keeps correction for the original creator after responsibility moves, but not for a plain contributor", async () => {
      // D1 canEdit gồm original creator; AC9 chỉ yêu cầu creator hoặc responsible hiện tại.
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "reviewer", role: "co_owner" },
          { actor: "editor", role: "editor" },
          { actor: "outsider", role: "editor" },
        ],
        creator: "editor",
        responsible: "author",
      });
      const contributor = await actors.author.client.rpc("add_topic_contributor", {
        p_topic_id: fixture.topicId,
        p_user_id: actors.outsider.id,
      });
      expect(contributor.error).toBeNull();
      await submit("author", fixture.topicId);
      await reject("reviewer", fixture.topicId, "Sai nghĩa");

      expect((await attentionFor("editor", fixture)).map((item) => item.kind)).toEqual(["topic_correction"]);
      expect((await attentionFor("author", fixture)).map((item) => item.kind)).toEqual(["topic_correction"]);
      expect(await attentionFor("outsider", fixture)).toEqual([]);
    });

    it("selects the latest submission across submitters: A rejected, then B pending leaves no correction for anyone", async () => {
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "reviewer", role: "co_owner" },
          { actor: "editor", role: "editor" },
        ],
      });
      await submit("author", fixture.topicId);
      await reject("reviewer", fixture.topicId, "Lần một bị từ chối");
      expect(await attentionFor("author", fixture)).toHaveLength(1);

      // Editor chỉ nhận trách nhiệm khi đã là contributor của topic.
      const contributor = await actors.author.client.rpc("add_topic_contributor", {
        p_topic_id: fixture.topicId,
        p_user_id: actors.editor.id,
      });
      expect(contributor.error).toBeNull();
      const transfer = await actors.author.client.rpc("transfer_topic_responsibility", {
        p_topic_id: fixture.topicId,
        p_recipient_user_id: actors.editor.id,
      });
      expect(transfer.error).toBeNull();
      await submit("editor", fixture.topicId);

      for (const name of ["author", "editor"] as const) {
        expect(await attentionFor(name, fixture)).toEqual([]);
      }
      const reviewItems = await attentionFor("reviewer", fixture);
      expect(reviewItems.map((item) => item.kind)).toEqual(["topic_review"]);
    });

    it("clears a correction when a newer submission is approved", async () => {
      const fixture = await createFixture({
        members: [{ actor: "author", role: "owner" }, { actor: "reviewer", role: "co_owner" }],
      });
      await submit("author", fixture.topicId);
      await reject("reviewer", fixture.topicId, "Chưa đạt");
      await submit("author", fixture.topicId);
      const approve = await actors.reviewer.client.rpc("approve_topic_review", {
        p_submission_id: await pendingSubmissionId(fixture.topicId),
      });
      expect(approve.error).toBeNull();

      expect(await attentionFor("author", fixture)).toEqual([]);
      expect(await attentionFor("reviewer", fixture)).toEqual([]);
    });

    it("does not revive an older rejection after withdraw, delete and restore", async () => {
      const fixture = await createFixture({
        members: [{ actor: "author", role: "owner" }, { actor: "reviewer", role: "co_owner" }],
      });
      await submit("author", fixture.topicId);
      await reject("reviewer", fixture.topicId, "Lần một");
      await submit("author", fixture.topicId);
      expect(await attentionFor("author", fixture)).toEqual([]);

      const withdraw = await actors.author.client.rpc("withdraw_review_to_draft", { p_topic_id: fixture.topicId });
      expect(withdraw.error).toBeNull();
      expect(await attentionFor("author", fixture)).toEqual([]);

      const removed = await actors.author.client.rpc("d1_delete_topic", { p_topic_id: fixture.topicId });
      expect(removed.error).toBeNull();
      const restored = await actors.author.client.rpc("d1_restore_topic", { p_topic_id: fixture.topicId });
      expect(restored.error).toBeNull();
      expect(await attentionFor("author", fixture)).toEqual([]);
    });

    it("keeps one correction row when the caller is creator, responsible and contributor at once", async () => {
      const fixture = await createFixture({
        members: [{ actor: "author", role: "owner" }, { actor: "reviewer", role: "co_owner" }],
      });
      await service.from("topic_contributors").insert({ topic_id: fixture.topicId, user_id: actors.author.id });
      await submit("author", fixture.topicId);
      await reject("reviewer", fixture.topicId, "Một dòng thôi");

      expect(await attentionFor("author", fixture)).toHaveLength(1);
    });

    it("drops the correction when the author loses collaboration", async () => {
      const fixture = await createFixture({
        members: [{ actor: "author", role: "owner" }, { actor: "reviewer", role: "co_owner" }, { actor: "editor", role: "editor" }],
        creator: "editor",
      });
      await submit("editor", fixture.topicId);
      await reject("reviewer", fixture.topicId, "Sửa lại");
      expect(await attentionFor("editor", fixture)).toHaveLength(1);

      await service.from("course_collaborators").delete()
        .eq("course_id", fixture.courseId).eq("user_id", actors.editor.id);
      expect((await portfolioOf(actors.editor)).attention).toEqual([]);
    });
  });

  describe("course listing rejection", () => {
    async function rejectCourse(courseId: string, message: string | null, status = "draft") {
      const update = await service.from("courses").update({
        status,
        reject_message: message,
        reviewed_at: new Date().toISOString(),
      }).eq("id", courseId);
      expect(update.error).toBeNull();
    }

    it("shows the rejection to collaborators who can edit the course, not to previewers", async () => {
      const fixture = await createFixture({
        members: [
          { actor: "author", role: "owner" },
          { actor: "editor", role: "editor" },
          { actor: "previewer", role: "previewer" },
        ],
      });
      await rejectCourse(fixture.courseId, "  Ảnh bìa chưa phù hợp  ");

      for (const name of ["author", "editor"] as const) {
        const items = await attentionFor(name, fixture);
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
          kind: "course_rejection",
          topic_id: null,
          topic_title: null,
          reason: "Ảnh bìa chưa phù hợp",
        });
      }
      expect(await attentionFor("previewer", fixture)).toEqual([]);
    });

    it("ignores blank messages and courses that are no longer draft", async () => {
      const blank = await createFixture({ members: [{ actor: "author", role: "owner" }] });
      await rejectCourse(blank.courseId, "   ");
      expect(await attentionFor("author", blank)).toEqual([]);

      const resubmitted = await createFixture({ members: [{ actor: "author", role: "owner" }] });
      await rejectCourse(resubmitted.courseId, "Đã gửi lại", "pending");
      expect(await attentionFor("author", resubmitted)).toEqual([]);
    });
  });
});
