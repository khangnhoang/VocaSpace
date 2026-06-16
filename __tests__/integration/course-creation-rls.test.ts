import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra RPC tạo course kèm owner và RLS đọc course sau khi bỏ luồng insert/select rời rạc.
// - Loại test: integration/RPC/RLS.
// - Đối tượng: public.create_course_with_owner và policy Select courses dynamic filter.
// - Case thành công:
//   - admin/teacher tạo draft course qua RPC và được gán owner.
//   - collaborator owner/co_owner/editor/previewer thấy draft/pending course.
//   - anonymous user thấy published course chưa bị remove.
// - Case thất bại:
//   - authenticated student không tạo được course qua RPC.
//   - unrelated authenticated user không thấy draft/pending course.
// - Bảo mật/phân quyền:
//   - không dùng service-role client cho RPC app flow; service-role chỉ dùng setup/cleanup/assert.
//   - removed course giữ trash visibility hiện có: admin và owner/co_owner thấy, editor/previewer/unrelated/public không thấy.
// - Ổn định/resilience:
//   - invariant chính là course và owner collaborator cùng tồn tại sau RPC thành công; RPC lỗi không để lại course theo slug test.
// - Invariant cần giữ:
//   - can_view_course_basic tiếp tục là nguồn sự thật duy nhất cho SELECT visibility.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:integration`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEEDED_ADMIN_EMAIL = "admin@gmail.com";
const SEEDED_TEACHER_EMAIL = "teacher@gmail.com";
const SEEDED_STUDENT_EMAIL = "student@gmail.com";
const SEEDED_PASSWORD = "123123";
const SEEDED_ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const SEEDED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let adminClient: SupabaseClient;
let teacherClient: SupabaseClient;
let studentClient: SupabaseClient;
let anonymousClient: SupabaseClient;
const createdCourseIds = new Set<string>();

type CourseStatus = "draft" | "pending" | "published";
type CollaboratorRole = "owner" | "co_owner" | "editor" | "previewer";

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chặn test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true nếu chắc chắn đang dùng test/dev DB.",
    );
  }

  if (!SUPABASE_URL.startsWith("http://127.0.0.1:45321")) {
    throw new Error(
      `Chặn test DB integration vì Supabase URL không phải local: ${SUPABASE_URL}`,
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
    throw new Error(`Không thể đăng nhập seeded user ${email}: ${error.message}`);
  }

  return client;
}

async function createCourseViaRpc(client: SupabaseClient, slugPrefix: string) {
  const suffix = randomUUID();
  const { data, error } = await client.rpc("create_course_with_owner", {
    p_title: `Course Creation RLS ${suffix}`,
    p_slug: `${slugPrefix}-${suffix}`,
    p_description: "Course created by course creation RLS integration test",
    p_price: 0,
    p_thumbnail_url: null,
  });

  if (error || !data) {
    throw new Error(`Không thể tạo course qua RPC: ${error?.message}`);
  }

  createdCourseIds.add(data);
  return data as string;
}

async function createCourseFixture(status: CourseStatus, removedAt: string | null = null) {
  const suffix = randomUUID();
  const { data, error } = await supabaseAdmin
    .from("courses")
    .insert({
      title: `Course Visibility Fixture ${suffix}`,
      slug: `course-visibility-fixture-${suffix}`,
      description: "Course created by course visibility integration test",
      price: 0,
      status,
      removed_at: removedAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Không thể tạo course fixture: ${error?.message}`);
  }

  createdCourseIds.add(data.id);
  return data.id as string;
}

async function addCollaborator(courseId: string, userId: string, role: CollaboratorRole) {
  const { error } = await supabaseAdmin.from("course_collaborators").insert({
    course_id: courseId,
    user_id: userId,
    role,
    added_by: SEEDED_ADMIN_ID,
  });

  if (error) {
    throw new Error(`Không thể tạo collaborator fixture: ${error.message}`);
  }
}

async function getVisibleCourseIds(client: SupabaseClient, courseIds: string[]) {
  const { data, error } = await client
    .from("courses")
    .select("id")
    .in("id", courseIds);

  if (error) {
    throw new Error(`Không thể đọc visible courses: ${error.message}`);
  }

  return new Set((data ?? []).map((course) => course.id as string));
}

async function cleanupCreatedCourses() {
  const courseIds = Array.from(createdCourseIds);
  createdCourseIds.clear();

  if (courseIds.length === 0) return;

  await supabaseAdmin.from("course_collaborators").delete().in("course_id", courseIds);
  await supabaseAdmin.from("courses").delete().in("id", courseIds);
}

describe.sequential("course creation RPC and course SELECT RLS", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();

    anonymousClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    adminClient = await signInSeededUser(SEEDED_ADMIN_EMAIL);
    teacherClient = await signInSeededUser(SEEDED_TEACHER_EMAIL);
    studentClient = await signInSeededUser(SEEDED_STUDENT_EMAIL);
  });

  afterEach(async () => {
    await cleanupCreatedCourses();
  });

  it("allows admin to create a draft course through the RPC and become owner", async () => {
    const courseId = await createCourseViaRpc(adminClient, "admin-rpc-course");

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, status, removed_at")
      .eq("id", courseId)
      .single();

    expect(courseError).toBeNull();
    expect(course).toMatchObject({ id: courseId, status: "draft", removed_at: null });

    const { data: collaborator, error: collaboratorError } = await supabaseAdmin
      .from("course_collaborators")
      .select("course_id, user_id, role, added_by")
      .eq("course_id", courseId)
      .eq("user_id", SEEDED_ADMIN_ID)
      .single();

    expect(collaboratorError).toBeNull();
    expect(collaborator).toMatchObject({
      course_id: courseId,
      user_id: SEEDED_ADMIN_ID,
      role: "owner",
      added_by: SEEDED_ADMIN_ID,
    });
  });

  it("allows teacher to create a draft course through the RPC and become owner", async () => {
    const courseId = await createCourseViaRpc(teacherClient, "teacher-rpc-course");

    const visibleToTeacher = await getVisibleCourseIds(teacherClient, [courseId]);
    expect(visibleToTeacher.has(courseId)).toBe(true);

    const { data: collaborator, error } = await supabaseAdmin
      .from("course_collaborators")
      .select("course_id, user_id, role, added_by")
      .eq("course_id", courseId)
      .eq("user_id", SEEDED_TEACHER_ID)
      .single();

    expect(error).toBeNull();
    expect(collaborator).toMatchObject({
      course_id: courseId,
      user_id: SEEDED_TEACHER_ID,
      role: "owner",
      added_by: SEEDED_TEACHER_ID,
    });
  });

  it("rejects authenticated non-teacher non-admin users without leaving a course", async () => {
    const slug = `student-rpc-course-${randomUUID()}`;
    const { data, error } = await studentClient.rpc("create_course_with_owner", {
      p_title: "Student Forbidden Course",
      p_slug: slug,
      p_description: "Student should not be allowed to create this course",
      p_price: 0,
      p_thumbnail_url: null,
    });

    expect(data).toBeNull();
    expect(error?.message).toContain("COURSE_CREATE_FORBIDDEN");

    const { data: leakedCourse, error: lookupError } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("slug", slug);

    expect(lookupError).toBeNull();
    expect(leakedCourse).toEqual([]);
  });

  it("allows collaborators to view draft and pending courses while unrelated users cannot", async () => {
    const roles: CollaboratorRole[] = ["owner", "co_owner", "editor", "previewer"];
    const statuses: CourseStatus[] = ["draft", "pending"];
    const courseIds: string[] = [];

    for (const status of statuses) {
      for (const role of roles) {
        const courseId = await createCourseFixture(status);
        await addCollaborator(courseId, SEEDED_TEACHER_ID, role);
        courseIds.push(courseId);
      }
    }

    const visibleToTeacher = await getVisibleCourseIds(teacherClient, courseIds);
    const visibleToStudent = await getVisibleCourseIds(studentClient, courseIds);

    expect(visibleToTeacher).toEqual(new Set(courseIds));
    expect(visibleToStudent.size).toBe(0);
  });

  it("allows public users to view only published non-removed courses", async () => {
    const publishedCourseId = await createCourseFixture("published");
    const draftCourseId = await createCourseFixture("draft");
    const removedPublishedCourseId = await createCourseFixture(
      "published",
      new Date().toISOString(),
    );

    const visibleToPublic = await getVisibleCourseIds(anonymousClient, [
      publishedCourseId,
      draftCourseId,
      removedPublishedCourseId,
    ]);

    expect(visibleToPublic).toEqual(new Set([publishedCourseId]));
  });

  it("keeps removed course visibility aligned with existing trash behavior", async () => {
    const removedAt = new Date().toISOString();
    const ownerCourseId = await createCourseFixture("draft", removedAt);
    const coOwnerCourseId = await createCourseFixture("draft", removedAt);
    const editorCourseId = await createCourseFixture("draft", removedAt);
    const previewerCourseId = await createCourseFixture("draft", removedAt);
    const courseIds = [
      ownerCourseId,
      coOwnerCourseId,
      editorCourseId,
      previewerCourseId,
    ];

    await addCollaborator(ownerCourseId, SEEDED_TEACHER_ID, "owner");
    await addCollaborator(coOwnerCourseId, SEEDED_TEACHER_ID, "co_owner");
    await addCollaborator(editorCourseId, SEEDED_TEACHER_ID, "editor");
    await addCollaborator(previewerCourseId, SEEDED_TEACHER_ID, "previewer");

    const visibleToTeacher = await getVisibleCourseIds(teacherClient, courseIds);
    const visibleToAdmin = await getVisibleCourseIds(adminClient, courseIds);
    const visibleToStudent = await getVisibleCourseIds(studentClient, courseIds);
    const visibleToPublic = await getVisibleCourseIds(anonymousClient, courseIds);

    expect(visibleToTeacher).toEqual(new Set([ownerCourseId, coOwnerCourseId]));
    expect(visibleToAdmin).toEqual(new Set(courseIds));
    expect(visibleToStudent.size).toBe(0);
    expect(visibleToPublic.size).toBe(0);
  });
});
