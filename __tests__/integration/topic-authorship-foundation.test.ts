import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: chứng minh nền tảng authorship P0-A ở DB boundary thật.
// - Loại test: integration/RPC/RLS với authenticated client và service-role fixture setup.
// - Case thành công: create RPC khởi tạo creator/responsible và exclusion evidence; 0/1/2 contributor hợp lệ.
// - Case thất bại: direct Data API không đổi authorship fields, không insert contributor và không vượt cap hai người.
// - Bảo mật/phân quyền: service-role chỉ dựng fixture/assert/cleanup; authorship create dùng authenticated RPC.
// - Invariant cần giữ: creator immutable, active topic có đúng một responsible author, responsible không chiếm contributor slot.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";

const USERS = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
} as const;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let teacherClient: SupabaseClient;
const courseIds = new Set<string>();

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

async function createTopicFixture() {
  const suffix = randomUUID();
  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .insert({
      title: `D1 authorship foundation course ${suffix}`,
      slug: `d1-authorship-foundation-${suffix}`,
      description: "P0-A topic authorship foundation fixture",
      status: "draft",
      price: 0,
    })
    .select("id")
    .single();
  if (courseError || !course) throw new Error(`Course fixture failed: ${courseError?.message}`);
  courseIds.add(course.id);

  const { error: collaboratorError } = await supabaseAdmin.from("course_collaborators").insert({
    course_id: course.id,
    user_id: USERS.teacher.id,
    role: "owner",
    added_by: USERS.admin.id,
    can_review_topics: false,
  });
  if (collaboratorError) throw new Error(`Collaborator fixture failed: ${collaboratorError.message}`);

  const { data: chapter, error: chapterError } = await supabaseAdmin
    .from("chapters")
    .insert({
      course_id: course.id,
      created_by_user_id: USERS.teacher.id,
      title: "P0-A chapter",
      order_index: 1,
    })
    .select("id")
    .single();
  if (chapterError || !chapter) throw new Error(`Chapter fixture failed: ${chapterError?.message}`);

  const created = await teacherClient.rpc("create_topic_ordered", {
    p_course_id: course.id,
    p_chapter_id: chapter.id,
    p_title: "P0-A topic",
  });
  if (created.error || !created.data?.topic?.id) {
    throw new Error(`Topic RPC fixture failed: ${created.error?.message ?? "missing topic"}`);
  }

  return {
    courseId: course.id as string,
    chapterId: chapter.id as string,
    topicId: created.data.topic.id as string,
  };
}

async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length === 0) return;
  await supabaseAdmin.from("topics").delete().in("course_id", ids);
  await supabaseAdmin.from("course_collaborators").delete().in("course_id", ids);
  await supabaseAdmin.from("chapters").delete().in("course_id", ids);
  await supabaseAdmin.from("courses").delete().in("id", ids);
}

function expectError(result: { error: { code?: string; message?: string } | null }, text: string) {
  expect(result.error).not.toBeNull();
  expect(result.error?.message).toContain(text);
}

function expectErrorCode(result: { error: { code?: string; message?: string } | null }, code: string) {
  expect(result.error).not.toBeNull();
  expect(result.error?.code).toBe(code);
}

describe.sequential("D1 topic authorship foundation", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    teacherClient = await signIn(USERS.teacher.email);
  });

  afterEach(cleanup);

  it("initializes immutable creator, one responsible author and initial exclusion evidence", async () => {
    const fixture = await createTopicFixture();

    const { data: topic, error: topicError } = await supabaseAdmin
      .from("topics")
      .select("original_creator_user_id, responsible_author_user_id, first_approved_at, status")
      .eq("id", fixture.topicId)
      .single();
    expect(topicError).toBeNull();
    expect(topic).toEqual({
      original_creator_user_id: USERS.teacher.id,
      responsible_author_user_id: USERS.teacher.id,
      first_approved_at: null,
      status: "draft",
    });

    const { data: exclusions, error: exclusionError } = await supabaseAdmin
      .from("topic_author_review_exclusions")
      .select("user_id, exclusion_type")
      .eq("topic_id", fixture.topicId);
    expect(exclusionError).toBeNull();
    expect(exclusions).toEqual([
      { user_id: USERS.teacher.id, exclusion_type: "original_creator" },
    ]);
  });

  it("rejects direct authorship writes and contributor table writes from an authenticated caller", async () => {
    const fixture = await createTopicFixture();

    const directCreate = await teacherClient.from("topics").insert({
      course_id: fixture.courseId,
      chapter_id: fixture.chapterId,
      title: "Direct authorship topic",
      slug: `direct-authorship-topic-${randomUUID()}`,
      status: "draft",
      order_index: 2,
      original_creator_user_id: USERS.teacher.id,
      responsible_author_user_id: USERS.teacher.id,
    });
    expectErrorCode(directCreate, "42501");

    expectError(
      await teacherClient.from("topics").update({
        original_creator_user_id: USERS.student.id,
      }).eq("id", fixture.topicId),
      "permission",
    );
    expectError(
      await teacherClient.from("topics").update({
        responsible_author_user_id: USERS.student.id,
      }).eq("id", fixture.topicId),
      "permission",
    );
    expectError(
      await teacherClient.from("topic_contributors").insert({
        topic_id: fixture.topicId,
        user_id: USERS.student.id,
      }),
      "permission",
    );
  });

  it("allows zero, one and two contributors, while responsible author does not consume a slot", async () => {
    const fixture = await createTopicFixture();

    const empty = await supabaseAdmin
      .from("topic_contributors")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", fixture.topicId)
      .is("removed_at", null);
    expect(empty.error).toBeNull();
    expect(empty.count).toBe(0);

    const first = await supabaseAdmin.from("topic_contributors").insert({
      topic_id: fixture.topicId,
      user_id: USERS.student.id,
      added_by_user_id: USERS.teacher.id,
    });
    expect(first.error).toBeNull();

    const second = await supabaseAdmin.from("topic_contributors").insert({
      topic_id: fixture.topicId,
      user_id: USERS.admin.id,
      added_by_user_id: USERS.teacher.id,
    });
    expect(second.error).toBeNull();

    const active = await supabaseAdmin
      .from("topic_contributors")
      .select("user_id", { count: "exact" })
      .eq("topic_id", fixture.topicId)
      .is("removed_at", null);
    expect(active.error).toBeNull();
    expect(active.count).toBe(2);

    const third = await supabaseAdmin.from("topic_contributors").insert({
      topic_id: fixture.topicId,
      user_id: USERS.student.id,
      added_by_user_id: USERS.teacher.id,
    });
    expectError(third, "TOPIC_CONTRIBUTOR_CAP_REACHED");

    const { data: firstRow } = await supabaseAdmin
      .from("topic_contributors")
      .select("id")
      .eq("topic_id", fixture.topicId)
      .eq("user_id", USERS.student.id)
      .single();
    expect(firstRow).toBeTruthy();
    if (!firstRow) return;

    expect((await supabaseAdmin.from("topic_contributors").update({ removed_at: new Date().toISOString() }).eq("id", firstRow.id)).error)
      .toBeNull();
    const replacement = await supabaseAdmin.from("topic_contributors").insert({
      topic_id: fixture.topicId,
      user_id: USERS.student.id,
      added_by_user_id: USERS.teacher.id,
    });
    expect(replacement.error).toBeNull();
  });

  it("keeps creator immutable and responsible author non-null at the DB boundary", async () => {
    const fixture = await createTopicFixture();

    const creatorChange = await supabaseAdmin.from("topics").update({
      original_creator_user_id: USERS.student.id,
    }).eq("id", fixture.topicId);
    expectError(creatorChange, "TOPIC_ORIGINAL_CREATOR_IMMUTABLE");

    const responsibilityRemoval = await supabaseAdmin.from("topics").update({
      responsible_author_user_id: null,
    }).eq("id", fixture.topicId);
    expect(responsibilityRemoval.error).not.toBeNull();
    expect(responsibilityRemoval.error?.code).toBe("23502");
  });
});
