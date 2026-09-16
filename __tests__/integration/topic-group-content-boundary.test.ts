import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: chứng minh mọi content mutation của D1 dùng topic authorship group làm boundary.
// - Loại test: real local Supabase integration/RPC/RLS.
// - Đối tượng: topic/card/exercise/question/option mutation RPC, direct table RLS và restore.
// - Case thành công:
//   - contributor được tạo/sửa content draft, gọi legacy RPC arity và restore topic/content.
//   - responsible author giữ được published confirm + atomic demotion path.
// - Case thất bại:
//   - course collaborator ngoài topic group không được direct-write hoặc gọi legacy RPC bypass.
//   - pending content bị frozen; published content thiếu confirm bị từ chối.
// - Bảo mật/phân quyền: authenticated actors dùng client thường; service-role chỉ dựng fixture/assert/cleanup.
// - Ổn định/resilience: published demotion và content write nằm cùng trusted transaction; mỗi fixture tách theo course.
// - Invariant cần giữ: ngoài topic group chỉ read-only; pending không đổi; direct published write không bypass confirmation.
// - Kết quả verify gần nhất: passed `18/18` bằng focused P2 command cùng Storage suite.
// - Ghi chú: test chỉ dùng local Supabase với ALLOW_DB_INTEGRATION_TESTS=true.

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
    title: `D1 content boundary course ${suffix}`,
    slug: `d1-content-boundary-${suffix}`,
    description: "P2-A topic-group content fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  if (courseError || !course) throw new Error(`Course fixture failed: ${courseError?.message}`);
  courseIds.add(course.id);

  const { data: collaborators, error: collaboratorError } = await service.from("course_collaborators").insert([
    { course_id: course.id, user_id: USERS.teacher.id, role: "owner", added_by: USERS.admin.id, can_review_topics: false },
    { course_id: course.id, user_id: USERS.student.id, role: "editor", added_by: USERS.admin.id, can_review_topics: false },
    { course_id: course.id, user_id: USERS.admin.id, role: "co_owner", added_by: USERS.teacher.id, can_review_topics: false },
  ]).select("id, user_id");
  if (collaboratorError || !collaborators) throw new Error(`Collaborator fixture failed: ${collaboratorError?.message}`);

  const { data: chapter, error: chapterError } = await service.from("chapters").insert({
    course_id: course.id,
    title: "P2-A chapter",
    order_index: 1,
  }).select("id").single();
  if (chapterError || !chapter) throw new Error(`Chapter fixture failed: ${chapterError?.message}`);

  const created = await clients.teacher.rpc("create_topic_ordered", {
    p_course_id: course.id,
    p_chapter_id: chapter.id,
    p_title: "P2-A topic",
  });
  if (created.error || !created.data?.topic?.id) throw new Error(`Topic fixture failed: ${created.error?.message ?? "missing topic"}`);

  const topicId = created.data.topic.id as string;
  const { data: card, error: cardError } = await service.from("cards").insert({
    topic_id: topicId,
    front_content: { word: "P2 card" },
    back_content: { translation: "P2 translation" },
    order_index: 0,
  }).select("id").single();
  if (cardError || !card) throw new Error(`Card fixture failed: ${cardError?.message}`);

  return {
    courseId: course.id as string,
    chapterId: chapter.id as string,
    topicId,
    cardId: card.id as string,
    studentCollaboratorId: collaborators.find((row) => row.user_id === USERS.student.id)?.id as string,
  };
}

async function createQuestionFixture(topicId: string, courseId: string) {
  const exerciseId = randomUUID();
  const questionId = randomUUID();
  const { error: exerciseError } = await service.from("exercises").insert({
    id: exerciseId,
    topic_id: topicId,
    course_id: courseId,
    title: "P2 child exercise",
    part_type: "part5",
    order_index: 1,
  });
  if (exerciseError) throw new Error(`Exercise fixture failed: ${exerciseError.message}`);

  const { error: questionError } = await service.from("questions").insert({
    id: questionId,
    exercise_id: exerciseId,
    course_id: courseId,
    content: "Original question",
    explanation: null,
    order_index: 0,
  });
  if (questionError) throw new Error(`Question fixture failed: ${questionError.message}`);

  const { error: optionError } = await service.from("question_options").insert([
    { question_id: questionId, content: "A", label: "A", is_correct: true, order_index: 0 },
    { question_id: questionId, content: "B", label: "B", is_correct: false, order_index: 1 },
  ]);
  if (optionError) throw new Error(`Option fixture failed: ${optionError.message}`);

  return { exerciseId, questionId };
}

async function addStudentToTopic(fixture: { topicId: string }) {
  const result = await clients.teacher.rpc("add_topic_contributor", {
    p_topic_id: fixture.topicId,
    p_user_id: USERS.student.id,
  });
  if (result.error) throw new Error(`Contributor fixture failed: ${result.error.message}`);
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

describe.sequential("D1 topic-group content boundary", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    clients = {
      admin: await signIn(USERS.admin.email),
      teacher: await signIn(USERS.teacher.email),
      student: await signIn(USERS.student.email),
    };
  });

  afterEach(cleanup);

  afterAll(async () => {
    await clients.admin?.auth.signOut();
    await clients.teacher?.auth.signOut();
    await clients.student?.auth.signOut();
  });

  it("allows a topic contributor while rejecting a course collaborator outside the topic group", async () => {
    const fixture = await createFixture();
    await addStudentToTopic(fixture);

    const directTopicUpdate = await clients.student.from("topics").update({ title: "Direct bypass" })
      .eq("id", fixture.topicId).select("id").single();
    expect(directTopicUpdate.data).toBeNull();
    expect(directTopicUpdate.error).not.toBeNull();

    const trustedTopicUpdate = await clients.student.rpc("d1_update_topic", {
      p_topic_id: fixture.topicId,
      p_title: "Trusted topic update",
      p_confirm_published: false,
    });
    expect(trustedTopicUpdate.error).toBeNull();

    const studentCard = await clients.student.from("cards").insert({
      topic_id: fixture.topicId,
      front_content: { word: "student card" },
      back_content: { translation: "allowed" },
      order_index: 1,
    }).select("id").single();
    expect(studentCard.error).toBeNull();

    const adminCard = await clients.admin.from("cards").insert({
      topic_id: fixture.topicId,
      front_content: { word: "admin card" },
      back_content: { translation: "denied" },
      order_index: 2,
    }).select("id").single();
    expect(adminCard.data).toBeNull();
    expect(adminCard.error).not.toBeNull();

    const studentExercise = await clients.student.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId,
      p_payload: {
        title: "Student exercise",
        part_type: "part5",
        questions: [{
          content: "Which answer is correct?",
          options: [
            { content: "A", is_correct: true },
            { content: "B", is_correct: false },
          ],
        }],
      },
    });
    expect(studentExercise.error).toBeNull();

    const adminExercise = await clients.admin.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId,
      p_payload: {
        title: "Admin exercise",
        part_type: "part5",
        questions: [{
          content: "Should be rejected",
          options: [
            { content: "A", is_correct: true },
            { content: "B", is_correct: false },
          ],
        }],
      },
    });
    expectRpcError(adminExercise, "COURSE_EDIT_FORBIDDEN");
  });

  it("applies the group boundary to child writes and legacy question sync", async () => {
    const fixture = await createFixture();
    await addStudentToTopic(fixture);
    const child = await createQuestionFixture(fixture.topicId, fixture.courseId);

    const studentQuestion = await clients.student.from("questions")
      .update({ content: "Student edited question" })
      .eq("id", child.questionId)
      .select("id, content")
      .single();
    expect(studentQuestion.error).toBeNull();
    expect(studentQuestion.data?.content).toBe("Student edited question");

    const adminQuestion = await clients.admin.from("questions")
      .update({ content: "Admin must not edit" })
      .eq("id", child.questionId)
      .select("id")
      .single();
    expect(adminQuestion.data).toBeNull();
    expect(adminQuestion.error).not.toBeNull();

    const studentSync = await clients.student.rpc("sync_question_with_options", {
      p_question_id: child.questionId,
      p_content: "Student synced question",
      p_explanation: null,
      p_options: [
        { content: "A", is_correct: true },
        { content: "B", is_correct: false },
      ],
    });
    expect(studentSync.error).toBeNull();

    const adminSync = await clients.admin.rpc("sync_question_with_options", {
      p_question_id: child.questionId,
      p_content: "Admin must not sync",
      p_explanation: null,
      p_options: [
        { content: "A", is_correct: true },
        { content: "B", is_correct: false },
      ],
    });
    expectRpcError(adminSync, "COURSE_EDIT_FORBIDDEN");
  });

  it("applies the group boundary to topic ordering", async () => {
    const fixture = await createFixture();
    const created = await clients.teacher.rpc("create_topic_ordered", {
      p_course_id: fixture.courseId,
      p_chapter_id: fixture.chapterId,
      p_title: "P2-A second topic",
    });
    expect(created.error).toBeNull();
    const secondTopicId = created.data?.topic?.id as string;
    expect(secondTopicId).toBeTruthy();

    const added = await clients.teacher.rpc("add_topic_contributor", {
      p_topic_id: secondTopicId,
      p_user_id: USERS.student.id,
    });
    expect(added.error).toBeNull();

    const studentMove = await clients.student.rpc("move_topic_order", {
      p_topic_id: secondTopicId,
      p_direction: "up",
    });
    expect(studentMove.error).toBeNull();

    const adminMove = await clients.admin.rpc("move_topic_order", {
      p_topic_id: secondTopicId,
      p_direction: "down",
    });
    expectRpcError(adminMove, "COURSE_EDIT_FORBIDDEN");
  });

  it("rechecks topic-group membership after the mutation lock", async () => {
    const fixture = await createFixture();
    await addStudentToTopic(fixture);

    const allowedBeforeRemoval = await clients.student.from("cards")
      .update({ back_content: { translation: "allowed before removal" } })
      .eq("id", fixture.cardId)
      .select("id")
      .single();
    expect(allowedBeforeRemoval.error).toBeNull();

    const { data: contributor, error: contributorError } = await service
      .from("topic_contributors")
      .select("id")
      .eq("topic_id", fixture.topicId)
      .eq("user_id", USERS.student.id)
      .is("removed_at", null)
      .single();
    expect(contributorError).toBeNull();
    expect(contributor?.id).toBeTruthy();

    const removed = await clients.teacher.rpc("remove_topic_contributor", {
      p_contributor_id: contributor!.id,
    });
    expect(removed.error).toBeNull();

    const deniedAfterRemoval = await clients.student.from("cards")
      .update({ back_content: { translation: "must remain unchanged" } })
      .eq("id", fixture.cardId)
      .select("id")
      .single();
    expect(deniedAfterRemoval.data).toBeNull();
    expect(deniedAfterRemoval.error).not.toBeNull();
  });

  it("freezes direct and trusted content writes while pending", async () => {
    const fixture = await createFixture();
    await addStudentToTopic(fixture);
    expect((await service.from("topics").update({ status: "pending" }).eq("id", fixture.topicId)).error).toBeNull();

    const directUpdate = await clients.student.from("cards")
      .update({ back_content: { translation: "must remain frozen" } })
      .eq("id", fixture.cardId)
      .select("id")
      .single();
    expect(directUpdate.data).toBeNull();
    expect(directUpdate.error).not.toBeNull();

    const trustedUpdate = await clients.student.rpc("d1_update_card", {
      p_card_id: fixture.cardId,
      p_front_content: { word: "blocked" },
      p_back_content: { translation: "blocked" },
      p_confirm_published: false,
    });
    expectRpcError(trustedUpdate, "TOPIC_PENDING_FROZEN");
  });

  it("requires published confirmation and permits group restore as active draft", async () => {
    const fixture = await createFixture();
    await addStudentToTopic(fixture);

    const approvalTime = new Date().toISOString();
    expect((await service.from("topics").update({
      status: "published",
      first_approved_at: approvalTime,
    }).eq("id", fixture.topicId)).error).toBeNull();

    const directPublishedUpdate = await clients.student.from("cards")
      .update({ back_content: { translation: "direct bypass" } })
      .eq("id", fixture.cardId)
      .select("id")
      .single();
    expect(directPublishedUpdate.data).toBeNull();
    expect(directPublishedUpdate.error).not.toBeNull();

    const unconfirmed = await clients.student.rpc("d1_update_card", {
      p_card_id: fixture.cardId,
      p_front_content: { word: "blocked" },
      p_back_content: { translation: "blocked" },
      p_confirm_published: false,
    });
    expectRpcError(unconfirmed, "TOPIC_PUBLISHED_CONFIRM_REQUIRED");

    const confirmed = await clients.student.rpc("d1_update_card", {
      p_card_id: fixture.cardId,
      p_front_content: { word: "confirmed" },
      p_back_content: { translation: "demoted" },
      p_confirm_published: true,
    });
    expect(confirmed.error).toBeNull();
    const demoted = await service.from("topics").select("status").eq("id", fixture.topicId).single();
    expect(demoted.data?.status).toBe("draft");

    expect((await service.from("cards").update({ removed_at: new Date().toISOString() }).eq("id", fixture.cardId)).error).toBeNull();
    const restoredCard = await clients.student.rpc("d1_restore_topic_content", {
      p_content_type: "card",
      p_content_id: fixture.cardId,
      p_confirm_published: false,
    });
    expect(restoredCard.error).toBeNull();

    expect((await service.from("topics").update({ removed_at: new Date().toISOString(), status: "draft" }).eq("id", fixture.topicId)).error).toBeNull();
    const outsideRestore = await clients.admin.rpc("d1_restore_topic", { p_topic_id: fixture.topicId });
    expectRpcError(outsideRestore, "COURSE_EDIT_FORBIDDEN");
    const restoredTopic = await clients.student.rpc("d1_restore_topic", { p_topic_id: fixture.topicId });
    expect(restoredTopic.error).toBeNull();

    const finalTopic = await service.from("topics").select("status, removed_at").eq("id", fixture.topicId).single();
    expect(finalTopic.data).toMatchObject({ status: "draft", removed_at: null });
  });
});
