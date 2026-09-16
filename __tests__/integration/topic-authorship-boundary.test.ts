import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: chứng minh P1 trusted boundary cho topic authoring group, review exclusion và responsibility transfer.
// - Loại test: real local Supabase integration/RPC/RLS với service-role fixture setup.
// - Case thành công: responsible author request, owner/co-owner transfer và leave có recipient hợp lệ.
// - Case thất bại: contributor/outside-group request hoặc edit, reviewer thuộc initial group, membership mutation thiếu recipient.
// - Bảo mật/phân quyền: direct collaborator DML bị thu hồi; admin chỉ có course-scoped role trong fixture, không có bypass global.
// - Invariant cần giữ: một responsible author, contributor group rõ ràng, exclusion trước first approval và transfer atomic với membership mutation.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";

const USERS = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
} as const;

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const courseIds = new Set<string>();
let clients: Record<keyof typeof USERS, SupabaseClient>;

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

async function createFixture() {
  const suffix = randomUUID();
  const { data: course, error: courseError } = await service.from("courses").insert({
    title: `D1 authorship boundary course ${suffix}`,
    slug: `d1-authorship-boundary-${suffix}`,
    description: "P1-A topic authorship boundary fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  if (courseError || !course) throw new Error(`Course fixture failed: ${courseError?.message}`);
  courseIds.add(course.id);

  const { data: collaborators, error: collaboratorError } = await service.from("course_collaborators").insert([
    { course_id: course.id, user_id: USERS.teacher.id, role: "owner", added_by: USERS.admin.id, can_review_topics: false },
    { course_id: course.id, user_id: USERS.student.id, role: "editor", added_by: USERS.admin.id, can_review_topics: true },
    { course_id: course.id, user_id: USERS.admin.id, role: "co_owner", added_by: USERS.teacher.id, can_review_topics: false },
  ]).select("id, user_id");
  if (collaboratorError || !collaborators) throw new Error(`Collaborator fixture failed: ${collaboratorError?.message}`);

  const { data: chapter, error: chapterError } = await service.from("chapters").insert({
    course_id: course.id,
    title: "P1-A chapter",
    order_index: 1,
  }).select("id").single();
  if (chapterError || !chapter) throw new Error(`Chapter fixture failed: ${chapterError?.message}`);

  const created = await clients.teacher.rpc("create_topic_ordered", {
    p_course_id: course.id,
    p_chapter_id: chapter.id,
    p_title: "P1-A topic",
  });
  if (created.error || !created.data?.topic?.id) throw new Error(`Topic fixture failed: ${created.error?.message ?? "missing topic"}`);
  const topicId = created.data.topic.id as string;

  const { error: cardError } = await service.from("cards").insert({
    topic_id: topicId,
    front_content: { word: "P1 card" },
    back_content: { translation: "P1 translation" },
    order_index: 0,
  });
  if (cardError) throw new Error(`Card fixture failed: ${cardError.message}`);
  const { error: exerciseError } = await service.from("exercises").insert({
    topic_id: topicId,
    course_id: course.id,
    title: "P1 exercise",
    part_type: "part_5",
    order_index: 0,
  });
  if (exerciseError) throw new Error(`Exercise fixture failed: ${exerciseError.message}`);

  return {
    courseId: course.id as string,
    topicId,
    studentCollaboratorId: collaborators.find((row) => row.user_id === USERS.student.id)?.id as string,
  };
}

async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length > 0) await service.from("courses").delete().in("id", ids);
}

function expectRpcError(result: { error: { message?: string } | null }, code: string) {
  expect(result.error).not.toBeNull();
  expect(result.error?.message).toContain(code);
}

describe.sequential("D1 topic authorship boundary", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    clients = {
      admin: await signIn(USERS.admin.email),
      teacher: await signIn(USERS.teacher.email),
      student: await signIn(USERS.student.email),
    };
  });

  afterEach(cleanup);

  it("limits editing/request to the topic group and excludes initial authors before first approval", async () => {
    const fixture = await createFixture();
    const contributor = await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    });
    expect(contributor.error).toBeNull();

    const teacherWorkflow = await clients.teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(teacherWorkflow.data).toMatchObject({
      canEdit: true,
      canRequestReview: true,
      originalCreator: { userId: USERS.teacher.id },
      responsibleAuthor: { userId: USERS.teacher.id },
      contributors: [{ userId: USERS.student.id }],
      canManageAuthorship: true,
      isCurrentUserResponsible: true,
      isCurrentUserContributor: false,
      latestAuthorshipFeedback: null,
    });
    const studentWorkflow = await clients.student.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(studentWorkflow.data).toMatchObject({ canEdit: true, canRequestReview: false, canReview: false });
    const adminWorkflow = await clients.admin.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(adminWorkflow.data).toMatchObject({ canEdit: false, canReview: true });

    expectRpcError(
      await clients.student.rpc("request_topic_review", { p_topic_id: fixture.topicId }),
      "TOPIC_RESPONSIBLE_AUTHOR_REQUIRED",
    );
    const outsideGroupUpdate = await clients.admin.from("topics").update({ title: "outside group" })
      .eq("id", fixture.topicId).select("id").single();
    expect(outsideGroupUpdate.data).toBeNull();
    expect(outsideGroupUpdate.error).not.toBeNull();

    const request = await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expect(request.error).toBeNull();
    const submissionId = request.data.submission_id as string;
    expectRpcError(
      await clients.student.rpc("approve_topic_review", { p_submission_id: submissionId }),
      "TOPIC_REVIEW_FORBIDDEN",
    );
    expect((await clients.admin.rpc("approve_topic_review", { p_submission_id: submissionId })).error).toBeNull();

    const approved = await service.from("topics").select("status, first_approved_at").eq("id", fixture.topicId).single();
    expect(approved.data).toMatchObject({ status: "published" });
    expect(approved.data?.first_approved_at).toEqual(expect.any(String));

    expect((await service.from("topics").update({ status: "draft" }).eq("id", fixture.topicId)).error).toBeNull();
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const secondSubmission = await service.from("topic_review_submissions")
      .select("id").eq("topic_id", fixture.topicId).eq("status", "pending").single();
    expect(secondSubmission.data).toBeTruthy();
    if (!secondSubmission.data) return;
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: secondSubmission.data.id })).error).toBeNull();
  });

  it("transfers responsibility atomically and records pre-approval evidence and feedback", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();

    const transfer = await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.student.id,
    });
    expect(transfer.error).toBeNull();
    const topic = await service.from("topics").select("responsible_author_user_id").eq("id", fixture.topicId).single();
    expect(topic.data?.responsible_author_user_id).toBe(USERS.student.id);
    const contributorRows = await service.from("topic_contributors").select("id").eq("topic_id", fixture.topicId).is("removed_at", null);
    expect(contributorRows.data).toEqual([]);
    const exclusion = await service.from("topic_author_review_exclusions")
      .select("user_id, exclusion_type").eq("topic_id", fixture.topicId).eq("user_id", USERS.teacher.id);
    expect(exclusion.data).toContainEqual({ user_id: USERS.teacher.id, exclusion_type: "preapproval_responsible" });
    const feedback = await service.from("topic_authorship_feedback")
      .select("recipient_user_id, actor_user_id, previous_responsible_user_id, new_responsible_user_id, feedback_type")
      .eq("topic_id", fixture.topicId).single();
    expect(feedback.data).toEqual({
      recipient_user_id: USERS.student.id,
      actor_user_id: USERS.teacher.id,
      previous_responsible_user_id: USERS.teacher.id,
      new_responsible_user_id: USERS.student.id,
      feedback_type: "responsibility_transfer",
    });

    expectRpcError(
      await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId }),
      "TOPIC_RESPONSIBLE_AUTHOR_REQUIRED",
    );
    expect((await clients.student.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId })).data)
      .toMatchObject({
        responsibleAuthor: { userId: USERS.student.id },
        contributors: [],
        isCurrentUserResponsible: true,
        latestAuthorshipFeedback: {
          actorUserId: USERS.teacher.id,
          previousResponsibleUserId: USERS.teacher.id,
          newResponsibleUserId: USERS.student.id,
          feedbackType: "responsibility_transfer",
        },
      });
    expect((await clients.student.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
  });

  it("rejects management transfer to an unrelated co-owner or editor", async () => {
    const fixture = await createFixture();

    expectRpcError(
      await clients.teacher.rpc("transfer_topic_responsibility", {
        p_topic_id: fixture.topicId,
        p_recipient_user_id: USERS.admin.id,
      }),
      "TOPIC_RESPONSIBILITY_RECIPIENT_INVALID",
    );
    expectRpcError(
      await clients.teacher.rpc("transfer_topic_responsibility", {
        p_topic_id: fixture.topicId,
        p_recipient_user_id: USERS.student.id,
      }),
      "TOPIC_RESPONSIBILITY_RECIPIENT_INVALID",
    );
    expect((await service.from("topics").select("responsible_author_user_id")
      .eq("id", fixture.topicId).single()).data?.responsible_author_user_id)
      .toBe(USERS.teacher.id);
  });

  it("requires a recipient before responsible membership downgrade or removal", async () => {
    const downgradeFixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: downgradeFixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: downgradeFixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();

    expectRpcError(
      await clients.teacher.rpc("update_course_collaborator_role", {
        p_collaborator_id: downgradeFixture.studentCollaboratorId,
        p_role: "previewer",
      }),
      "TOPIC_RESPONSIBILITY_TRANSFER_REQUIRED",
    );
    const downgraded = await clients.teacher.rpc("update_course_collaborator_role_with_responsibility", {
      p_collaborator_id: downgradeFixture.studentCollaboratorId,
      p_role: "previewer",
      p_recipient_user_id: USERS.teacher.id,
    });
    expect(downgraded.error).toBeNull();
    expect((await service.from("topics").select("responsible_author_user_id").eq("id", downgradeFixture.topicId).single()).data)
      .toMatchObject({ responsible_author_user_id: USERS.teacher.id });
    expect((await service.from("course_collaborators").select("role, can_review_topics").eq("id", downgradeFixture.studentCollaboratorId).single()).data)
      .toEqual({ role: "previewer", can_review_topics: false });

    const removeFixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: removeFixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: removeFixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();
    expectRpcError(
      await clients.teacher.rpc("remove_course_collaborator", { p_collaborator_id: removeFixture.studentCollaboratorId }),
      "TOPIC_RESPONSIBILITY_TRANSFER_REQUIRED",
    );
    const removed = await clients.teacher.rpc("remove_course_collaborator_with_responsibility", {
      p_collaborator_id: removeFixture.studentCollaboratorId,
      p_recipient_user_id: USERS.teacher.id,
    });
    expect(removed.error).toBeNull();
    expect((await service.from("course_collaborators").select("id").eq("id", removeFixture.studentCollaboratorId).maybeSingle()).data).toBeNull();
    expect((await service.from("topics").select("responsible_author_user_id").eq("id", removeFixture.topicId).single()).data)
      .toMatchObject({ responsible_author_user_id: USERS.teacher.id });
  });

  it("transfers a responsible author before self-leave and blocks leave without a recipient", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();

    expectRpcError(
      await clients.student.rpc("leave_course_collaboration", { p_course_id: fixture.courseId }),
      "TOPIC_RESPONSIBILITY_TRANSFER_REQUIRED",
    );
    const left = await clients.student.rpc("leave_course_collaboration", {
      p_course_id: fixture.courseId,
      p_recipient_user_id: USERS.teacher.id,
    });
    expect(left.error).toBeNull();
    expect((await service.from("course_collaborators").select("id").eq("course_id", fixture.courseId).eq("user_id", USERS.student.id).maybeSingle()).data)
      .toBeNull();
    expect((await service.from("topics").select("responsible_author_user_id").eq("id", fixture.topicId).single()).data)
      .toMatchObject({ responsible_author_user_id: USERS.teacher.id });
    expect((await service.from("topic_authorship_feedback").select("recipient_user_id, actor_user_id").eq("topic_id", fixture.topicId).order("created_at")).data)
      .toContainEqual({ recipient_user_id: USERS.teacher.id, actor_user_id: USERS.student.id });
  });

  it("serializes concurrent contributor adds and responsibility transfers", async () => {
    const contributorFixture = await createFixture();
    const [studentAdd, adminAdd] = await Promise.all([
      clients.teacher.rpc("add_topic_contributor", {
        p_topic_id: contributorFixture.topicId,
        p_user_id: USERS.student.id,
      }),
      clients.teacher.rpc("add_topic_contributor", {
        p_topic_id: contributorFixture.topicId,
        p_user_id: USERS.admin.id,
      }),
    ]);
    expect(studentAdd.error).toBeNull();
    expect(adminAdd.error).toBeNull();
    const contributors = await service.from("topic_contributors").select("user_id")
      .eq("topic_id", contributorFixture.topicId).is("removed_at", null);
    expect(contributors.error).toBeNull();
    expect(contributors.data).toHaveLength(2);

    const transferFixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: transferFixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    const [teacherTransfer, adminTransfer] = await Promise.all([
      clients.teacher.rpc("transfer_topic_responsibility", {
        p_topic_id: transferFixture.topicId,
        p_recipient_user_id: USERS.student.id,
      }),
      clients.admin.rpc("transfer_topic_responsibility", {
        p_topic_id: transferFixture.topicId,
        p_recipient_user_id: USERS.student.id,
      }),
    ]);
    const transferResults = [teacherTransfer, adminTransfer];
    expect(transferResults.filter((result) => result.error === null)).toHaveLength(1);
    expect(transferResults.filter((result) => result.error?.message?.includes("TOPIC_RESPONSIBILITY_RECIPIENT_INVALID"))).toHaveLength(1);
    const topic = await service.from("topics").select("responsible_author_user_id")
      .eq("id", transferFixture.topicId).single();
    expect(topic.data?.responsible_author_user_id).toBe(USERS.student.id);
    const activeContributors = await service.from("topic_contributors").select("user_id")
      .eq("topic_id", transferFixture.topicId).is("removed_at", null);
    expect(activeContributors.data).toEqual([]);
  });

  it("keeps reviewer safety topic-specific after responsibility transfer", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.student.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();

    const adminCollaborator = await service.from("course_collaborators").select("id")
      .eq("course_id", fixture.courseId).eq("user_id", USERS.admin.id).single();
    expect(adminCollaborator.error).toBeNull();
    if (!adminCollaborator.data) return;
    expectRpcError(
      await clients.teacher.rpc("remove_course_collaborator", {
        p_collaborator_id: adminCollaborator.data.id,
      }),
      "COLLABORATOR_LAST_REVIEWER_REQUIRED",
    );
  });
});
