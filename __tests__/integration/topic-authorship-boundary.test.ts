import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: chứng minh trusted boundary cho topic authoring group, role-only downgrade, review exclusion và responsibility transfer khi remove/leave.
// - Loại test: real local Supabase integration/RPC/RLS với service-role fixture setup.
// - Case thành công: responsible author request, downgrade giữ nguyên authorship, remove/leave transfer tới recipient hợp lệ.
// - Case thất bại: contributor/outside-group request hoặc edit, reviewer thuộc initial group, remove/leave thiếu recipient.
// - Bảo mật/phân quyền: direct collaborator DML bị thu hồi; admin chỉ có course-scoped role trong fixture, không có bypass global.
// - Invariant cần giữ: role downgrade không đổi creator/responsible/contributor; remove/leave transfer atomic và không để thiếu responsible author.

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
    adminCollaboratorId: collaborators.find((row) => row.user_id === USERS.admin.id)?.id as string,
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
      "TOPIC_AUTHOR_SUBMIT_REQUIRED",
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
    // D20: the student is still an active contributor, so they stay excluded
    // from reviewing this topic at every round — including after the first
    // approval, where the old exclusion predicate expired.
    expectRpcError(
      await clients.student.rpc("approve_topic_review", { p_submission_id: secondSubmission.data.id }),
      "TOPIC_REVIEW_FORBIDDEN",
    );
    expect((await clients.admin.rpc("approve_topic_review", { p_submission_id: secondSubmission.data.id })).error).toBeNull();
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

    // D22: the creator keeps submit rights after transferring responsibility,
    // so the old responsible-only error no longer applies to them.
    // The gate order matters: the authoring-group check runs before the
    // submitter rule, so a co_owner outside the group (admin) is refused
    // there. Assert that while the topic is still `draft`, otherwise the
    // status check would answer first.
    const adminWorkflow = await clients.admin.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(adminWorkflow.data).toMatchObject({ canEdit: false, canRequestReview: false });
    expectRpcError(
      await clients.admin.rpc("request_topic_review", { p_topic_id: fixture.topicId }),
      "COURSE_EDIT_FORBIDDEN",
    );
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    // Cancel the creator's submission so the responsible author can submit
    // their own; TOPIC_REVIEW_ALREADY_PENDING would fire otherwise.
    expect((await clients.teacher.rpc("withdraw_review_to_draft", { p_topic_id: fixture.topicId })).error).toBeNull();
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

  it("keeps submit rights with the creator and the responsible author after a transfer", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();

    // D22: the creator keeps submit rights after transferring responsibility,
    // and the new responsible author gains them.
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    expect((await clients.teacher.rpc("withdraw_review_to_draft", { p_topic_id: fixture.topicId })).error).toBeNull();
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

  it("keeps removal transfer to an existing topic contributor", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.admin.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();

    const removed = await clients.teacher.rpc("remove_course_collaborator_with_responsibility", {
      p_collaborator_id: fixture.studentCollaboratorId,
      p_recipient_user_id: USERS.admin.id,
    });
    expect(removed.error).toBeNull();
    expect((await service.from("topics").select("responsible_author_user_id").eq("id", fixture.topicId).single()).data)
      .toMatchObject({ responsible_author_user_id: USERS.admin.id });
    expect((await service.from("course_collaborators").select("id").eq("id", fixture.studentCollaboratorId).maybeSingle()).data)
      .toBeNull();
  });

  it.each([
    { target: "editor" as const, expectedUserId: USERS.student.id },
    { target: "co_owner" as const, expectedUserId: USERS.admin.id },
  ])("downgrades a responsible $target to previewer without changing topic authorship", async ({ target, expectedUserId }) => {
    const fixture = await createFixture();
    const contributorUserId = target === "editor" ? USERS.admin.id : USERS.student.id;
    const collaboratorId = target === "editor" ? fixture.studentCollaboratorId : fixture.adminCollaboratorId;
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: expectedUserId,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: expectedUserId,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: contributorUserId,
    })).error).toBeNull();

    const beforeTopic = await service.from("topics")
      .select("original_creator_user_id, responsible_author_user_id")
      .eq("id", fixture.topicId)
      .single();
    const beforeContributors = await service.from("topic_contributors")
      .select("user_id, removed_at")
      .eq("topic_id", fixture.topicId)
      .order("user_id");

    const downgraded = await clients.teacher.rpc("update_course_collaborator_role", {
      p_collaborator_id: collaboratorId,
      p_role: "previewer",
    });
    expect(downgraded.error).toBeNull();

    const afterTopic = await service.from("topics")
      .select("original_creator_user_id, responsible_author_user_id")
      .eq("id", fixture.topicId)
      .single();
    const afterContributors = await service.from("topic_contributors")
      .select("user_id, removed_at")
      .eq("topic_id", fixture.topicId)
      .order("user_id");
    expect(afterTopic.data).toEqual(beforeTopic.data);
    expect(afterContributors.data).toEqual(beforeContributors.data);
    expect(afterTopic.data).toMatchObject({ responsible_author_user_id: expectedUserId });
    expect((await service.from("course_collaborators").select("role, can_review_topics").eq("id", collaboratorId).single()).data)
      .toEqual({ role: "previewer", can_review_topics: false });
  });

  it("still requires a recipient before removing a responsible collaborator", async () => {
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

  it("keeps historical exclusion for members who already left the group before first approval", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    // Removing the contributor leaves the historical exclusion row behind; the
    // dynamic branch no longer covers them, so only D21 can still block them.
    const contributorRow = await service.from("topic_contributors").select("id")
      .eq("topic_id", fixture.topicId).eq("user_id", USERS.student.id).single();
    expect(contributorRow.error).toBeNull();
    if (!contributorRow.data) return;
    expect((await clients.teacher.rpc("remove_topic_contributor", {
      p_contributor_id: contributorRow.data.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await service.from("topic_review_submissions").select("id")
      .eq("topic_id", fixture.topicId).eq("status", "pending").single();
    expect(submission.data).toBeTruthy();
    if (!submission.data) return;
    expectRpcError(
      await clients.student.rpc("approve_topic_review", { p_submission_id: submission.data.id }),
      "TOPIC_REVIEW_FORBIDDEN",
    );
  });

  it("refuses to add the creator as a contributor so the slot is never consumed twice", async () => {
    const fixture = await createFixture();
    // Transfer responsibility first: while the creator is also the responsible
    // author the earlier responsible-author branch would fire instead.
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();

    expectRpcError(
      await clients.teacher.rpc("add_topic_contributor", {
        p_topic_id: fixture.topicId,
        p_user_id: USERS.teacher.id,
      }),
      "TOPIC_CREATOR_NOT_CONTRIBUTOR",
    );
    const contributors = await service.from("topic_contributors").select("user_id")
      .eq("topic_id", fixture.topicId).is("removed_at", null);
    expect(contributors.data).toEqual([]);
  });

  it("lets the creator and responsible author withdraw a pending review, and nobody else", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();

    expectRpcError(
      await clients.student.rpc("withdraw_review_to_draft", { p_topic_id: fixture.topicId }),
      "COURSE_EDIT_FORBIDDEN",
    );
    expectRpcError(
      await clients.admin.rpc("withdraw_review_to_draft", { p_topic_id: fixture.topicId }),
      "COURSE_EDIT_FORBIDDEN",
    );
    expect((await clients.teacher.rpc("withdraw_review_to_draft", { p_topic_id: fixture.topicId })).error).toBeNull();

    const topic = await service.from("topics").select("status").eq("id", fixture.topicId).single();
    expect(topic.data).toMatchObject({ status: "draft" });
    const cancelled = await service.from("topic_review_submissions")
      .select("status, cancellation_reason").eq("topic_id", fixture.topicId).single();
    expect(cancelled.data).toMatchObject({
      status: "cancelled",
      cancellation_reason: "Tác giả hủy yêu cầu duyệt để tiếp tục chỉnh sửa.",
    });
  });

  it("rejects a creator who was removed from the course from withdrawing a pending review", async () => {
    // The fixture creator (teacher) is the course owner, and an owner seat
    // cannot be removed at all (COURSE_OWNER_REMOVAL_FORBIDDEN). Hand the
    // owner seat to admin, and the responsible-author slot to the student, so
    // the creator is a removable, non-responsible member.
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await service.from("course_collaborators")
      .update({ role: "co_owner" }).eq("course_id", fixture.courseId).eq("user_id", USERS.teacher.id)).error).toBeNull();
    expect((await service.from("course_collaborators")
      .update({ role: "owner" }).eq("course_id", fixture.courseId).eq("user_id", USERS.admin.id)).error).toBeNull();
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.student.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const teacherCollaborator = await service.from("course_collaborators").select("id")
      .eq("course_id", fixture.courseId).eq("user_id", USERS.teacher.id).single();
    expect(teacherCollaborator.error).toBeNull();
    if (!teacherCollaborator.data) return;
    expect((await clients.admin.rpc("remove_course_collaborator", {
      p_collaborator_id: teacherCollaborator.data.id,
    })).error).toBeNull();

    // P3: topic identity alone is not enough — active course membership is required.
    expectRpcError(
      await clients.teacher.rpc("withdraw_review_to_draft", { p_topic_id: fixture.topicId }),
      "COURSE_EDIT_FORBIDDEN",
    );
  });

  it("deletes a topic in any lifecycle state through one RPC and keeps removed/status consistent", async () => {
    // draft
    const draftFixture = await createFixture();
    expect((await clients.teacher.rpc("d1_delete_topic", { p_topic_id: draftFixture.topicId })).error).toBeNull();
    expect((await service.from("topics").select("status, removed_at").eq("id", draftFixture.topicId).single()).data)
      .toMatchObject({ status: "draft", removed_at: expect.any(String) });
    expectRpcError(
      await clients.teacher.rpc("d1_delete_topic", { p_topic_id: draftFixture.topicId }),
      "TOPIC_NOT_FOUND",
    );

    // pending: cancel then delete, leaving no pending row behind (A39)
    const pendingFixture = await createFixture();
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: pendingFixture.topicId })).error).toBeNull();
    // A51/R28: this call must NOT raise TOPIC_PENDING_FROZEN. The final
    // `update public.topics` passes d1_guard_topic_lifecycle_mutation only
    // because the cancel step set voca.d1_trusted_topic_lifecycle first.
    expect((await clients.teacher.rpc("d1_delete_topic", { p_topic_id: pendingFixture.topicId })).error).toBeNull();
    const pendingRows = await service.from("topic_review_submissions")
      .select("status, cancellation_reason").eq("topic_id", pendingFixture.topicId);
    expect(pendingRows.data).toEqual([{
      status: "cancelled",
      cancellation_reason: "Hủy yêu cầu duyệt để xóa bài học.",
    }]);
    // A50: the invariant holds for the pending state too.
    expect((await service.from("topics").select("status, removed_at").eq("id", pendingFixture.topicId).single()).data)
      .toMatchObject({ status: "draft", removed_at: expect.any(String) });

    // published: confirmation is required before anything mutates
    const publishedFixture = await createFixture();
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: publishedFixture.topicId })).error).toBeNull();
    const publishedSubmission = await service.from("topic_review_submissions").select("id")
      .eq("topic_id", publishedFixture.topicId).eq("status", "pending").single();
    expect(publishedSubmission.data).toBeTruthy();
    if (!publishedSubmission.data) return;
    expect((await clients.admin.rpc("approve_topic_review", { p_submission_id: publishedSubmission.data.id })).error).toBeNull();
    expectRpcError(
      await clients.teacher.rpc("d1_delete_topic", { p_topic_id: publishedFixture.topicId }),
      "TOPIC_PUBLISHED_CONFIRM_REQUIRED",
    );
    expect((await service.from("topics").select("status, removed_at").eq("id", publishedFixture.topicId).single()).data)
      .toMatchObject({ status: "published", removed_at: null });
    expect((await clients.teacher.rpc("d1_delete_topic", {
      p_topic_id: publishedFixture.topicId,
      p_confirm_published: true,
    })).error).toBeNull();
    expect((await service.from("topics").select("status, removed_at").eq("id", publishedFixture.topicId).single()).data)
      .toMatchObject({ status: "draft", removed_at: expect.any(String) });
    // A50: restore returns a draft, never a resurrected published topic.
    expect((await clients.teacher.rpc("d1_restore_topic", { p_topic_id: publishedFixture.topicId })).error).toBeNull();
    expect((await service.from("topics").select("status, removed_at").eq("id", publishedFixture.topicId).single()).data)
      .toMatchObject({ status: "draft", removed_at: null });
  });

  it("gives delete to owners outside the group and refuses contributors", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: fixture.topicId,
      p_user_id: USERS.student.id,
    })).error).toBeNull();
    expectRpcError(
      await clients.student.rpc("d1_delete_topic", { p_topic_id: fixture.topicId }),
      "COURSE_EDIT_FORBIDDEN",
    );
    expect((await clients.admin.rpc("d1_delete_topic", { p_topic_id: fixture.topicId })).error).toBeNull();
    expect((await service.from("topics").select("removed_at").eq("id", fixture.topicId).single()).data)
      .toMatchObject({ removed_at: expect.any(String) });
  });

  it("serializes a reviewer approval against a concurrent delete without orphaning a pending row", async () => {
    const fixture = await createFixture();
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await service.from("topic_review_submissions").select("id")
      .eq("topic_id", fixture.topicId).eq("status", "pending").single();
    expect(submission.data).toBeTruthy();
    if (!submission.data) return;

    // Both writers take the course -> topic advisory lock pair, so one waits
    // for the other instead of deadlocking. Whichever wins, the loser must
    // fail cleanly rather than leave a `pending` row behind that would block
    // every later submission for this topic (A39).
    const [approval, deletion] = await Promise.all([
      clients.admin.rpc("approve_topic_review", { p_submission_id: submission.data.id }),
      clients.teacher.rpc("d1_delete_topic", { p_topic_id: fixture.topicId }),
    ]);
    expect(approval.error !== null || deletion.error !== null).toBe(true);

    const rows = await service.from("topic_review_submissions")
      .select("status").eq("topic_id", fixture.topicId).eq("status", "pending");
    expect(rows.data).toEqual([]);
    const topic = await service.from("topics").select("status, removed_at").eq("id", fixture.topicId).single();
    // The two outcomes are "approved then deleted" or "deleted before approval".
    expect(["draft", "published"]).toContain(topic.data?.status);
    if (deletion.error === null) {
      expect(topic.data).toMatchObject({ status: "draft", removed_at: expect.any(String) });
    }
  });

  it("splits rename (content) from reorder (course structure)", async () => {
    const fixture = await createFixture();
    const secondTopic = await clients.teacher.rpc("create_topic_ordered", {
      p_course_id: fixture.courseId,
      p_chapter_id: (await service.from("topics").select("chapter_id").eq("id", fixture.topicId).single()).data?.chapter_id,
      p_title: "P1-A topic two",
    });
    expect(secondTopic.error).toBeNull();

    // The admin is a co_owner outside the authoring group: reorder passes,
    // rename does not (D31/D32/D37).
    const adminMove = await clients.admin.rpc("move_topic_order", {
      p_topic_id: fixture.topicId,
      p_direction: "down",
    });
    expect(adminMove.error).toBeNull();
    expect((await clients.admin.rpc("d1_update_topic", {
      p_topic_id: fixture.topicId,
      p_title: "renamed by outsider",
      p_confirm_published: false,
    })).error).not.toBeNull();
  });
});
