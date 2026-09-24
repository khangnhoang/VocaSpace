import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra boundary authoring mới derive từ membership role, không derive từ global profile role.
// - Loại test: integration/RPC/RLS với authenticated clients và service-role fixture setup.
// - Matrix: global teacher/student/admin × owner/co_owner/editor/previewer; ba role authoring đầu đạt, previewer bị chặn.
// - Invariant: user không có membership bị chặn; role downgrade owner/co_owner xuống editor/previewer xoá capability flag trong cùng UPDATE.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEEDED_PASSWORD = "123123";

const USERS = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
} as const;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type GlobalRole = keyof typeof USERS;
type CollaboratorRole = "owner" | "co_owner" | "editor" | "previewer";

const createdCourseIds = new Set<string>();

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
  if (error) throw new Error(`Không thể đăng nhập seeded user ${email}: ${error.message}`);
  return client;
}

async function createCourseWithMembership(
  globalRole: GlobalRole,
  collaboratorRole: CollaboratorRole,
  canReviewTopics = false,
) {
  const suffix = randomUUID();
  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .insert({
      title: `D1 Authoring Matrix ${suffix}`,
      slug: `d1-authoring-matrix-${suffix}`,
      description: "D1 authoring role matrix fixture",
      price: 0,
      status: "draft",
    })
    .select("id")
    .single();

  if (courseError || !course) {
    throw new Error(`Không thể tạo course matrix fixture: ${courseError?.message}`);
  }
  createdCourseIds.add(course.id);

  const { error: collaboratorError } = await supabaseAdmin
    .from("course_collaborators")
    .insert({
      course_id: course.id,
      user_id: USERS[globalRole].id,
      role: collaboratorRole,
      can_review_topics: canReviewTopics,
      added_by: USERS.admin.id,
    });

  if (collaboratorError) {
    throw new Error(`Không thể tạo collaborator matrix fixture: ${collaboratorError.message}`);
  }

  return course.id as string;
}

async function createTopicFixture(courseId: string) {
  const chapter = await supabaseAdmin
    .from("chapters")
    .insert({
      course_id: courseId,
      created_by_user_id: USERS.teacher.id,
      title: "D1 Review Foundation Chapter",
      order_index: 1,
    })
    .select("id")
    .single();
  if (chapter.error || !chapter.data) {
    throw new Error(`Không thể tạo chapter review fixture: ${chapter.error?.message}`);
  }

  const topic = await supabaseAdmin
    .from("topics")
    .insert({
      course_id: courseId,
      chapter_id: chapter.data.id,
      title: "D1 Review Foundation Topic",
      status: "draft",
      order_index: 1,
      original_creator_user_id: USERS.teacher.id,
      responsible_author_user_id: USERS.teacher.id,
    })
    .select("id")
    .single();
  if (topic.error || !topic.data) {
    throw new Error(`Không thể tạo topic review fixture: ${topic.error?.message}`);
  }

  return topic.data.id as string;
}

async function cleanupFixtures() {
  const ids = Array.from(createdCourseIds);
  createdCourseIds.clear();
  if (ids.length > 0) {
    await supabaseAdmin.from("course_collaborators").delete().in("course_id", ids);
    await supabaseAdmin.from("courses").delete().in("id", ids);
  }
}

describe.sequential("D1 membership-only course authoring boundary", () => {
  const clients = new Map<GlobalRole, SupabaseClient>();

  beforeAll(async () => {
    assertSafeIntegrationEnv();
    for (const role of Object.keys(USERS) as GlobalRole[]) {
      clients.set(role, await signInSeededUser(USERS[role].email));
    }
  });

  afterEach(cleanupFixtures);

  it.each([
    ["teacher", "owner", true],
    ["teacher", "co_owner", true],
    ["teacher", "editor", true],
    ["teacher", "previewer", false],
    ["student", "owner", true],
    ["student", "co_owner", true],
    ["student", "editor", true],
    ["student", "previewer", false],
    ["admin", "owner", true],
    ["admin", "co_owner", true],
    ["admin", "editor", true],
    ["admin", "previewer", false],
  ] as const)(
    "%s with %s membership has authoring=%s",
    async (globalRole, collaboratorRole, expected) => {
      const courseId = await createCourseWithMembership(globalRole, collaboratorRole);
      const { data, error } = await clients.get(globalRole)!.rpc(
        "has_course_authoring_access",
        { target_course_id: courseId },
      );

      expect(error).toBeNull();
      expect(data).toBe(expected);
    },
  );

  it("denies every global role without an active collaborator membership", async () => {
    const suffix = randomUUID();
    const { data: course, error } = await supabaseAdmin
      .from("courses")
      .insert({
        title: `D1 No Membership ${suffix}`,
        slug: `d1-no-membership-${suffix}`,
        description: "D1 no membership fixture",
        price: 0,
        status: "draft",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(course).toBeTruthy();
    if (!course) return;
    createdCourseIds.add(course.id);

    for (const role of Object.keys(USERS) as GlobalRole[]) {
      const result = await clients.get(role)!.rpc("has_course_authoring_access", {
        target_course_id: course.id,
      });
      expect(result.error).toBeNull();
      expect(result.data).toBe(false);
    }
  });

  it("clears delegated review capability when owner/co_owner is downgraded", async () => {
    const courseId = await createCourseWithMembership("student", "co_owner", true);
    const collaborator = await supabaseAdmin
      .from("course_collaborators")
      .select("id, role, can_review_topics")
      .eq("course_id", courseId)
      .eq("user_id", USERS.student.id)
      .single();

    expect(collaborator.error).toBeNull();
    expect(collaborator.data).toMatchObject({
      role: "co_owner",
      can_review_topics: true,
    });
    if (!collaborator.data) return;

    const { error } = await supabaseAdmin
      .from("course_collaborators")
      .update({ role: "editor", can_review_topics: true })
      .eq("id", collaborator.data.id);
    expect(error).toBeNull();

    const downgraded = await supabaseAdmin
      .from("course_collaborators")
      .select("role, can_review_topics")
      .eq("id", collaborator.data.id)
      .single();
    expect(downgraded.error).toBeNull();
    expect(downgraded.data).toEqual({ role: "editor", can_review_topics: false });
  });

  it("keeps review history behind a trusted boundary and enforces one pending submission", async () => {
    const courseId = await createCourseWithMembership("teacher", "owner");
    const topicId = await createTopicFixture(courseId);

    const submission = await supabaseAdmin
      .from("topic_review_submissions")
      .insert({
        topic_id: topicId,
        submitted_by_user_id: USERS.teacher.id,
        attempt_number: 1,
      })
      .select("status, attempt_number")
      .single();
    expect(submission.error).toBeNull();
    expect(submission.data).toEqual({ status: "pending", attempt_number: 1 });

    const duplicatePending = await supabaseAdmin
      .from("topic_review_submissions")
      .insert({
        topic_id: topicId,
        submitted_by_user_id: USERS.teacher.id,
        attempt_number: 2,
      });
    expect(duplicatePending.error?.code).toBe("23505");

    const rejectedWithoutReason = await supabaseAdmin
      .from("topic_review_submissions")
      .insert({
        topic_id: topicId,
        submitted_by_user_id: USERS.teacher.id,
        status: "rejected",
        attempt_number: 2,
      });
    expect(rejectedWithoutReason.error?.code).toBe("23514");

    const directRead = await clients.get("teacher")!.from("topic_review_submissions").select("id");
    expect(directRead.data).toBeNull();
    expect(directRead.error?.code).toBe("42501");
  });

  // D42 transition contract. The plan splits this into three distinct guards
  // that must not be conflated, and notes that the existing coverage only
  // exercised the trigger via direct DML — not the app-facing RPC path.
  it("rejects every role-change RPC target outside editor/previewer with its own guard", async () => {
    const courseId = await createCourseWithMembership("teacher", "owner");
    const owner = await signInSeededUser(USERS.teacher.email);

    // Guard 1: a co_owner target may only be demoted by the course owner.
    const { data: coOwner } = await supabaseAdmin.from("course_collaborators")
      .insert({ course_id: courseId, user_id: USERS.student.id, role: "co_owner", added_by: USERS.teacher.id })
      .select("id").single();
    expect(coOwner).toBeTruthy();
    if (!coOwner) return;
    const { data: studentClient } = { data: await signInSeededUser(USERS.student.email) };
    const coOwnerActor = studentClient!;
    expect((await coOwnerActor.rpc("update_course_collaborator_role", {
      p_collaborator_id: coOwner.id,
      p_role: "editor",
    })).error?.message).toContain("COLLABORATOR_MANAGEMENT_FORBIDDEN");
    // Guard 2: the owner target is never demotable, whatever the actor.
    const { data: ownerRow } = await supabaseAdmin.from("course_collaborators")
      .select("id").eq("course_id", courseId).eq("user_id", USERS.teacher.id).single();
    expect(ownerRow).toBeTruthy();
    if (!ownerRow) return;
    expect((await owner.rpc("update_course_collaborator_role", {
      p_collaborator_id: ownerRow.id,
      p_role: "editor",
    })).error?.message).toContain("COLLABORATOR_MANAGEMENT_FORBIDDEN");

    // Guard 3: p_role outside {editor, previewer} is refused before anything
    // else, including promotions back into the owner tier.
    const { data: editor } = await supabaseAdmin.from("course_collaborators")
      .insert({ course_id: courseId, user_id: USERS.admin.id, role: "editor", added_by: USERS.teacher.id })
      .select("id").single();
    expect(editor).toBeTruthy();
    if (!editor) return;
    expect((await owner.rpc("update_course_collaborator_role", {
      p_collaborator_id: editor.id,
      p_role: "owner",
    })).error?.message).toContain("COLLABORATOR_ROLE_CHANGE_OUTSIDE_D1");
  });

  it("clears the flag on a co_owner demotion through the RPC and requires a fresh grant", async () => {
    const courseId = await createCourseWithMembership("student", "co_owner", true);
    // The helper seats no owner, and every role-change RPC requires the actor
    // to be owner or co_owner of the course.
    expect((await supabaseAdmin.from("course_collaborators").insert({
      course_id: courseId, user_id: USERS.teacher.id, role: "owner", added_by: USERS.admin.id,
    })).error).toBeNull();
    const owner = await signInSeededUser(USERS.teacher.email);
    const topicId = await createTopicFixture(courseId);
    const student = await signInSeededUser(USERS.student.email);
    const { data: collaborator } = await supabaseAdmin.from("course_collaborators")
      .select("id, role, can_review_topics").eq("course_id", courseId).eq("user_id", USERS.student.id).single();
    expect(collaborator).toMatchObject({ role: "co_owner", can_review_topics: true });
    if (!collaborator) return;

    // The co_owner reviews by role, so access is granted before the demotion.
    expect((await student.rpc("has_topic_review_access", { target_topic_id: topicId })).data).toBe(true);

    const demoted = await owner.rpc("update_course_collaborator_role", {
      p_collaborator_id: collaborator.id,
      p_role: "editor",
    });
    expect(demoted.error).toBeNull();
    const after = await supabaseAdmin.from("course_collaborators")
      .select("role, can_review_topics").eq("id", collaborator.id).single();
    expect(after.data).toEqual({ role: "editor", can_review_topics: false });
    // editor without the flag is not a reviewer.
    expect((await student.rpc("has_topic_review_access", { target_topic_id: topicId })).data).toBe(false);

    // A fresh grant is what restores access, not the stale pre-demotion value.
    expect((await owner.rpc("set_course_collaborator_review_capability", {
      p_collaborator_id: collaborator.id,
      p_can_review_topics: true,
    })).error).toBeNull();
    expect((await student.rpc("has_topic_review_access", { target_topic_id: topicId })).data).toBe(true);
  });
});
