import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { runLocalPsql } from "./helpers/local-psql";

// Test plan:
// - Mục tiêu: chứng minh mọi content mutation của D1 dùng topic authorship group làm boundary.
// - Loại test: real local Supabase integration/RPC/RLS.
// - Đối tượng: topic/card/exercise/question/option mutation RPC, direct table RLS và restore.
// - Case thành công:
//   - contributor được tạo/sửa content draft, gọi legacy RPC arity và restore topic/content.
//   - TFEAT1: member của topic group sửa nội dung topic published tại chỗ qua RPC (có hoặc không có cờ cũ), topic vẫn published; cả hai overload của create_exercise_with_content, soft_delete_exercise_cascade, sync_question_with_options.
//   - creator bị hạ xuống `previewer` vẫn sửa topic published qua RPC nội dung.
//   - learner đã enroll đọc thẻ vừa sửa; đổi đáp án đúng giữ nguyên snapshot câu đã trả lời, lần sync D4 kế tiếp dùng đáp án hiện hành và `is_topic_completed` giữ sticky.
//   - creator bị hạ xuống `previewer` vẫn tạo được exercise vì inner create path theo topic-content authority (M24).
// - Case thất bại:
//   - course collaborator ngoài topic group không được direct-write hoặc gọi legacy RPC bypass.
//   - authenticated actor không gọi trực tiếp được `d1_create_exercise_with_content_unchecked`.
//   - pending content bị frozen (cả hai overload wrapper); outsider (co_owner ngoài topic group) bị từ chối trên topic published.
//   - ghi trực tiếp qua Data API vào mọi bảng content của topic published vẫn bị từ chối; `d1_lock_topic_for_mutation` không nhận published từ caller thường.
// - Bảo mật/phân quyền: authenticated actors dùng client thường; service-role chỉ dựng fixture/assert/cleanup.
//   `*_unchecked` vẫn chỉ service_role execute được sau khi nới authority của inner create path.
// - Ổn định/resilience: dấu hiệu "trusted published edit" chỉ đúng một topic trong một transaction (kiểm bằng psql một transaction hai topic); mỗi fixture tách theo course.
// - Invariant cần giữ: ngoài topic group chỉ read-only; pending không đổi; direct published write không bypass RPC tin cậy.
// - Kết quả verify gần nhất: passed (14 test) bằng `npm run test:integration -- __tests__/integration/topic-group-content-boundary.test.ts` trên runtime E2E cô lập (API 45441) sau local reset (TFEAT1 CP1); với down.sql áp dụng thì 7 case published mới fail.
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
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !["45321", "45441"].includes(url.port)) {
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
    created_by_user_id: USERS.teacher.id,
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

const syncOptions = [
  { content: "A", is_correct: true },
  { content: "B", is_correct: false },
];

function exercisePayload(title: string) {
  return {
    title,
    part_type: "part5",
    questions: [{
      content: "Which answer is correct?",
      options: [
        { content: "A", is_correct: true },
        { content: "B", is_correct: false },
      ],
    }],
  };
}

async function publishTopic(topicId: string) {
  const { error } = await service.from("topics")
    .update({ status: "published", first_approved_at: new Date().toISOString() })
    .eq("id", topicId);
  if (error) throw new Error(`Publish fixture failed: ${error.message}`);
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

  it("applies the course-structure boundary to topic ordering", async () => {
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

    // D37: ordering is a course-structure mutation, so a co_owner outside the
    // authoring group may reorder even though they may not rename (D32).
    const adminMove = await clients.admin.rpc("move_topic_order", {
      p_topic_id: secondTopicId,
      p_direction: "down",
    });
    expect(adminMove.error).toBeNull();
    expectRpcError(
      await clients.admin.rpc("d1_update_topic", {
        p_topic_id: secondTopicId,
        p_title: "renamed by outsider",
        p_confirm_published: false,
      }),
      "COURSE_EDIT_FORBIDDEN",
    );
  });

  it("lets a previewer creator rename but not reorder, because ordering is course-scoped", async () => {
    const fixture = await createFixture();
    // The creator is the fixture teacher; demote them out of the course-author
    // tier so only the D22/D26 creator branch still holds group membership.
    expect((await service.from("course_collaborators")
      .update({ role: "previewer" }).eq("course_id", fixture.courseId).eq("user_id", USERS.teacher.id)).error).toBeNull();

    // D22/D26: the creator keeps the content boundary regardless of role.
    expect((await clients.teacher.rpc("d1_update_topic", {
      p_topic_id: fixture.topicId,
      p_title: "renamed by previewer creator",
      p_confirm_published: false,
    })).error).toBeNull();

    // D37/D40: ordering is a course-structure mutation and d1_is_active_course_author
    // deliberately excludes `previewer`, so the same actor is refused here.
    expectRpcError(
      await clients.teacher.rpc("move_topic_order", {
        p_topic_id: fixture.topicId,
        p_direction: "down",
      }),
      "COURSE_EDIT_FORBIDDEN",
    );

    // Positive control: the refusal above is authorization, not a structural
    // dead end. Restoring the course-author tier lets the same call through
    // (this fixture holds one topic, so an authorized move is a clean noop).
    expect((await service.from("course_collaborators")
      .update({ role: "editor" }).eq("course_id", fixture.courseId).eq("user_id", USERS.teacher.id)).error).toBeNull();
    const allowed = await clients.teacher.rpc("move_topic_order", {
      p_topic_id: fixture.topicId,
      p_direction: "down",
    });
    expect(allowed.error).toBeNull();
    expect(allowed.data).toMatchObject({ status: "noop" });
  });

  // M24: `d1_create_exercise_with_content_unchecked` từng gate bằng
  // `has_course_management_access` (course-scoped) trong khi các inner helper
  // anh em đã chuyển sang `can_modify_content_by_topic`. Test này pin rằng
  // inner create path dùng CÙNG topic-content authority với edit/delete/card,
  // và rằng việc nới authority không mở luôn chính `*_unchecked` helper.
  it("lets a previewer creator create exercise content through the topic-content authority", async () => {
    const fixture = await createFixture();
    // Người tạo topic là teacher. Hạ họ xuống `previewer` để chỉ còn nhánh
    // creator của topic group giữ quyền, đúng như tiền lệ ở test D22/D26 phía trên.
    expect((await service.from("course_collaborators")
      .update({ role: "previewer" }).eq("course_id", fixture.courseId).eq("user_id", USERS.teacher.id)).error).toBeNull();

    // Hướng phân biệt được: creator ngoài course-author tier PHẢI tạo được
    // exercise, vì inner create path giờ theo topic-content authority.
    const creatorExercise = await clients.teacher.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId,
      p_payload: {
        title: "Creator exercise",
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
    expect(creatorExercise.error).toBeNull();

    // Hướng bảo vệ: co_owner nằm trong course-author tier nhưng ngoài topic
    // group vẫn bị từ chối. Đây là non-regression guard trên cùng public
    // contract, không phải hướng phân biệt (wrapper đã chặn trước inner helper).
    const outsiderExercise = await clients.admin.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId,
      p_payload: {
        title: "Outsider exercise",
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
    expectRpcError(outsiderExercise, "COURSE_EDIT_FORBIDDEN");

    // Security boundary của `*_unchecked` vẫn nguyên: authenticated actor
    // không gọi trực tiếp được inner helper.
    const directInnerCall = await clients.teacher.rpc("d1_create_exercise_with_content_unchecked", {
      p_topic_id: fixture.topicId,
      p_payload: {
        title: "Bypass attempt",
        part_type: "part5",
        questions: [{
          content: "Should never be created",
          options: [
            { content: "A", is_correct: true },
            { content: "B", is_correct: false },
          ],
        }],
      },
    });
    expect(directInnerCall.error).not.toBeNull();
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

  it("edits published content in place, refuses direct writes and lets the delete tier restore as active draft", async () => {
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

    const unflagged = await clients.student.rpc("d1_update_card", {
      p_card_id: fixture.cardId,
      p_front_content: { word: "live edit" },
      p_back_content: { translation: "unflagged" },
      p_confirm_published: false,
    });
    expect(unflagged.error).toBeNull();
    const stillPublished = await service.from("topics").select("status").eq("id", fixture.topicId).single();
    expect(stillPublished.data?.status).toBe("published");
    expect((await service.from("cards").select("front_content").eq("id", fixture.cardId).single()).data?.front_content)
      .toMatchObject({ word: "live edit" });

    const legacyFlag = await clients.student.rpc("d1_update_card", {
      p_card_id: fixture.cardId,
      p_front_content: { word: "legacy flag" },
      p_back_content: { translation: "flag ignored" },
      p_confirm_published: true,
    });
    expect(legacyFlag.error).toBeNull();
    expect((await service.from("topics").select("status").eq("id", fixture.topicId).single()).data?.status)
      .toBe("published");

    expect((await service.from("cards").update({ removed_at: new Date().toISOString() }).eq("id", fixture.cardId)).error).toBeNull();
    const restoredCard = await clients.student.rpc("d1_restore_topic_content", {
      p_content_type: "card",
      p_content_id: fixture.cardId,
      p_confirm_published: false,
    });
    expect(restoredCard.error).toBeNull();
    expect((await service.from("topics").select("status").eq("id", fixture.topicId).single()).data?.status)
      .toBe("published");

    expect((await service.from("topics").update({ removed_at: new Date().toISOString(), status: "draft" }).eq("id", fixture.topicId)).error).toBeNull();
    // D36: restore mirrors delete, so it is the delete tier — owner/co_owner,
    // creator or responsible author — and NOT the authoring group. A plain
    // contributor may edit content but may not resurrect the topic.
    expectRpcError(
      await clients.student.rpc("d1_restore_topic", { p_topic_id: fixture.topicId }),
      "COURSE_EDIT_FORBIDDEN",
    );
    expect((await service.from("topics").select("status, removed_at").eq("id", fixture.topicId).single()).data)
      .toMatchObject({ status: "draft", removed_at: expect.any(String) });
    // The co_owner outside the authoring group holds the delete tier.
    const outsideRestore = await clients.admin.rpc("d1_restore_topic", { p_topic_id: fixture.topicId });
    expect(outsideRestore.error).toBeNull();
    expect((await service.from("topics").select("status, removed_at").eq("id", fixture.topicId).single()).data)
      .toMatchObject({ status: "draft", removed_at: null });

    const finalTopic = await service.from("topics").select("status, removed_at").eq("id", fixture.topicId).single();
    expect(finalTopic.data).toMatchObject({ status: "draft", removed_at: null });
  });

  it("refuses direct Data API writes to every published content table while the trusted RPC still works", async () => {
    const fixture = await createFixture();
    await addStudentToTopic(fixture);
    const child = await createQuestionFixture(fixture.topicId, fixture.courseId);
    const groupId = randomUUID();
    expect((await service.from("question_groups").insert({
      id: groupId, exercise_id: child.exerciseId, passage_text: "Original passage", order_index: 0,
    })).error).toBeNull();
    await publishTopic(fixture.topicId);

    const refused = (result: { error: unknown; data: unknown }) => {
      expect(result.error !== null || (Array.isArray(result.data) && result.data.length === 0)).toBe(true);
    };
    refused(await clients.student.from("cards").insert({
      topic_id: fixture.topicId, front_content: { word: "direct" }, back_content: { translation: "direct" }, order_index: 5,
    }).select("id"));
    refused(await clients.student.from("exercises").update({ title: "Direct exercise title" })
      .eq("id", child.exerciseId).select("id"));
    refused(await clients.student.from("question_groups").update({ passage_text: "Direct passage" })
      .eq("id", groupId).select("id"));
    refused(await clients.student.from("questions").update({ content: "Direct question" })
      .eq("id", child.questionId).select("id"));
    refused(await clients.student.from("question_options").update({ content: "Direct option" })
      .eq("question_id", child.questionId).select("id"));

    expect((await service.from("cards").select("id").eq("topic_id", fixture.topicId)).data).toHaveLength(1);
    expect((await service.from("exercises").select("title").eq("id", child.exerciseId).single()).data?.title)
      .toBe("P2 child exercise");
    expect((await service.from("question_groups").select("passage_text").eq("id", groupId).single()).data?.passage_text)
      .toBe("Original passage");
    expect((await service.from("questions").select("content").eq("id", child.questionId).single()).data?.content)
      .toBe("Original question");
    expect((await service.from("question_options").select("content").eq("question_id", child.questionId)
      .order("order_index")).data?.map((row) => row.content)).toEqual(["A", "B"]);

    // Hàm khóa public không nhận topic published từ caller thường nếu RPC tin cậy chưa đánh dấu.
    expectRpcError(
      await clients.student.rpc("d1_lock_topic_for_mutation", { p_topic_id: fixture.topicId }),
      "TOPIC_PUBLISHED_MUTATION_REQUIRES_TRUSTED_BOUNDARY",
    );

    const trusted = await clients.student.rpc("d1_update_question_group", {
      p_group_id: groupId,
      p_passage_text: "Trusted passage",
      p_audio_url: null,
      p_image_url: null,
    });
    expect(trusted.error).toBeNull();
    expect((await service.from("question_groups").select("passage_text").eq("id", groupId).single()).data?.passage_text)
      .toBe("Trusted passage");
  });

  it("scopes the trusted published edit to the prepared topic inside one transaction", async () => {
    const first = await createFixture();
    const second = await createFixture();
    await publishTopic(first.topicId);
    await publishTopic(second.topicId);

    // Một transaction: chuẩn bị topic A (published) rồi ghi vào topic B (published) với tư cách authenticated.
    const asTeacher = (statements: string) => `
      begin;
      select set_config('request.jwt.claims', '{"sub":"${USERS.teacher.id}","role":"authenticated"}', true);
      set local role service_role;
      select public.d1_prepare_topic_content_mutation('${first.topicId}'::uuid, false);
      ${statements}
      rollback;
    `;
    expect(() => runLocalPsql(asTeacher(
      `update public.cards set back_content = '{"translation":"cross topic"}'::jsonb where id = '${second.cardId}'::uuid;`,
    ))).toThrow(/TOPIC_PUBLISHED_MUTATION_REQUIRES_TRUSTED_BOUNDARY/);

    // Đối chứng: cùng transaction, ghi vào đúng topic A thì được.
    expect(() => runLocalPsql(asTeacher(
      `update public.cards set back_content = '{"translation":"same topic"}'::jsonb where id = '${first.cardId}'::uuid;`,
    ))).not.toThrow();

    expect((await service.from("cards").select("back_content").eq("id", second.cardId).single()).data?.back_content)
      .toMatchObject({ translation: "P2 translation" });
    expect((await service.from("cards").select("back_content").eq("id", first.cardId).single()).data?.back_content)
      .toMatchObject({ translation: "P2 translation" });
  });

  it("lets a previewer creator edit a published topic through the content RPCs", async () => {
    const fixture = await createFixture();
    const child = await createQuestionFixture(fixture.topicId, fixture.courseId);
    expect((await service.from("course_collaborators")
      .update({ role: "previewer" }).eq("course_id", fixture.courseId).eq("user_id", USERS.teacher.id)).error).toBeNull();
    await publishTopic(fixture.topicId);

    expect((await clients.teacher.rpc("d1_update_topic", {
      p_topic_id: fixture.topicId, p_title: "renamed live by previewer creator", p_confirm_published: false,
    })).error).toBeNull();
    const created = await clients.teacher.rpc("d1_create_card", {
      p_topic_id: fixture.topicId,
      p_front_content: { word: "previewer card" },
      p_back_content: { translation: "live" },
      p_confirm_published: false,
    });
    expect(created.error).toBeNull();
    expect((await clients.teacher.rpc("d1_update_card", {
      p_card_id: fixture.cardId,
      p_front_content: { word: "previewer edit" },
      p_back_content: { translation: "live" },
    })).error).toBeNull();
    expect((await clients.teacher.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId, p_payload: exercisePayload("Previewer exercise"),
    })).error).toBeNull();
    expect((await clients.teacher.rpc("sync_question_with_options", {
      p_question_id: child.questionId,
      p_content: "Previewer synced question",
      p_explanation: null,
      p_options: syncOptions,
    })).error).toBeNull();

    const topic = await service.from("topics").select("status, title").eq("id", fixture.topicId).single();
    expect(topic.data).toMatchObject({ status: "published", title: "renamed live by previewer creator" });
    expect((await service.from("questions").select("content").eq("id", child.questionId).single()).data?.content)
      .toBe("Previewer synced question");

    // Previewer vẫn không ghi trực tiếp được vào bảng.
    const direct = await clients.teacher.from("cards").update({ back_content: { translation: "direct" } })
      .eq("id", fixture.cardId).select("id");
    expect(direct.error !== null || (direct.data ?? []).length === 0).toBe(true);
  });

  it("runs both overloads of each exercise wrapper on a published topic and refuses outsiders and pending", async () => {
    const fixture = await createFixture();
    await addStudentToTopic(fixture);
    const child = await createQuestionFixture(fixture.topicId, fixture.courseId);
    await publishTopic(fixture.topicId);
    const status = async () => (await service.from("topics").select("status").eq("id", fixture.topicId).single()).data?.status;

    const createdTwoArg = await clients.student.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId, p_payload: exercisePayload("Two-arg exercise"),
    });
    expect(createdTwoArg.error).toBeNull();
    const createdThreeArg = await clients.student.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId, p_payload: exercisePayload("Three-arg exercise"), p_confirm_published: false,
    });
    expect(createdThreeArg.error).toBeNull();
    const createdFlagged = await clients.student.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId, p_payload: exercisePayload("Flagged exercise"), p_confirm_published: true,
    });
    expect(createdFlagged.error).toBeNull();
    expect(await status()).toBe("published");

    expect((await clients.student.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: (createdTwoArg.data as { exercise_id: string }).exercise_id,
    })).error).toBeNull();
    expect((await clients.student.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: (createdThreeArg.data as { exercise_id: string }).exercise_id, p_confirm_published: false,
    })).error).toBeNull();
    expect((await clients.student.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: (createdFlagged.data as { exercise_id: string }).exercise_id, p_confirm_published: true,
    })).error).toBeNull();
    expect(await status()).toBe("published");

    expect((await clients.student.rpc("sync_question_with_options", {
      p_question_id: child.questionId, p_content: "Four-arg sync", p_explanation: null, p_options: syncOptions,
    })).error).toBeNull();
    expect((await clients.student.rpc("sync_question_with_options", {
      p_question_id: child.questionId, p_content: "Five-arg sync", p_explanation: null, p_options: syncOptions,
      p_confirm_published: false,
    })).error).toBeNull();
    expect((await clients.student.rpc("sync_question_with_options", {
      p_question_id: child.questionId, p_content: "Flagged sync", p_explanation: null, p_options: syncOptions,
      p_confirm_published: true,
    })).error).toBeNull();
    expect((await service.from("questions").select("content").eq("id", child.questionId).single()).data?.content)
      .toBe("Flagged sync");
    expect(await status()).toBe("published");

    // Outsider (co_owner ngoài topic group) bị từ chối trên topic published ở mọi overload.
    for (const confirm of [undefined, false, true]) {
      const flag = confirm === undefined ? {} : { p_confirm_published: confirm };
      expectRpcError(await clients.admin.rpc("create_exercise_with_content", {
        p_topic_id: fixture.topicId, p_payload: exercisePayload("Outsider exercise"), ...flag,
      }), "COURSE_EDIT_FORBIDDEN");
      expectRpcError(await clients.admin.rpc("soft_delete_exercise_cascade", {
        p_exercise_id: child.exerciseId, ...flag,
      }), "COURSE_EDIT_FORBIDDEN");
      expectRpcError(await clients.admin.rpc("sync_question_with_options", {
        p_question_id: child.questionId, p_content: "Outsider sync", p_explanation: null, p_options: syncOptions, ...flag,
      }), "COURSE_EDIT_FORBIDDEN");
    }

    // Pending vẫn đóng băng ở mọi overload.
    expect((await service.from("topics").update({ status: "pending" }).eq("id", fixture.topicId)).error).toBeNull();
    for (const confirm of [undefined, true]) {
      const flag = confirm === undefined ? {} : { p_confirm_published: confirm };
      expectRpcError(await clients.student.rpc("create_exercise_with_content", {
        p_topic_id: fixture.topicId, p_payload: exercisePayload("Pending exercise"), ...flag,
      }), "TOPIC_PENDING_FROZEN");
      expectRpcError(await clients.student.rpc("soft_delete_exercise_cascade", {
        p_exercise_id: child.exerciseId, ...flag,
      }), "TOPIC_PENDING_FROZEN");
      expectRpcError(await clients.student.rpc("sync_question_with_options", {
        p_question_id: child.questionId, p_content: "Pending sync", p_explanation: null, p_options: syncOptions, ...flag,
      }), "TOPIC_PENDING_FROZEN");
    }
    expect((await service.from("questions").select("content").eq("id", child.questionId).single()).data?.content)
      .toBe("Flagged sync");
  });
});

describe.sequential("TFEAT1 learner view of published edits", { timeout: 30_000 }, () => {
  let learner: SupabaseClient;
  let learnerId = "";

  async function createPublishedLearnerFixture() {
    const fixture = await createFixture();
    const child = await createQuestionFixture(fixture.topicId, fixture.courseId);
    const { data: options } = await service.from("question_options").select("id, is_correct")
      .eq("question_id", child.questionId).order("order_index");
    const correctId = options?.find((option) => option.is_correct)?.id as string;
    const wrongId = options?.find((option) => !option.is_correct)?.id as string;
    expect((await service.from("courses").update({ status: "published" }).eq("id", fixture.courseId)).error).toBeNull();
    await publishTopic(fixture.topicId);
    expect((await service.from("enrollments").insert({ course_id: fixture.courseId, user_id: learnerId })).error).toBeNull();
    return { ...fixture, ...child, correctId, wrongId };
  }

  beforeAll(async () => {
    assertSafeEnvironment();
    learnerId = randomUUID();
    const email = `tfeat1-learner-${learnerId}@example.com`;
    const { error: authError } = await service.auth.admin.createUser({
      id: learnerId, email, password: PASSWORD, email_confirm: true,
    });
    if (authError) throw new Error(`Learner fixture failed: ${authError.message}`);
    const { error: profileError } = await service.from("profiles").upsert({
      id: learnerId, email, full_name: "TFEAT1 Learner", username: `tf1_${learnerId.slice(0, 8)}`,
      role: "student", removed_at: null,
    });
    if (profileError) throw new Error(`Learner profile failed: ${profileError.message}`);
    learner = await signIn(email);
    clients = {
      admin: await signIn(USERS.admin.email),
      teacher: await signIn(USERS.teacher.email),
      student: await signIn(USERS.student.email),
    };
  });

  afterEach(async () => {
    for (const courseId of courseIds) {
      const { data: topics } = await service.from("topics").select("id").eq("course_id", courseId);
      const topicIds = (topics ?? []).map((row) => row.id);
      const { data: questions } = await service.from("questions").select("id").eq("course_id", courseId);
      await service.from("user_question_answers").delete().in("question_id", (questions ?? []).map((row) => row.id));
      await service.from("user_topic_progress").delete().in("topic_id", topicIds);
      await service.from("enrollments").delete().eq("course_id", courseId);
    }
    await cleanup();
  });

  afterAll(async () => {
    await learner?.auth.signOut();
    if (learnerId) await service.auth.admin.deleteUser(learnerId);
  });

  it("shows an enrolled learner the card an author just edited on a published topic", async () => {
    const fixture = await createPublishedLearnerFixture();
    const before = await learner.from("cards").select("front_content").eq("id", fixture.cardId).single();
    expect(before.data?.front_content).toMatchObject({ word: "P2 card" });

    const edit = await clients.teacher.rpc("d1_update_card", {
      p_card_id: fixture.cardId,
      p_front_content: { word: "live edit for learners" },
      p_back_content: { translation: "ngay lập tức" },
    });
    expect(edit.error).toBeNull();

    const after = await learner.from("cards").select("front_content, back_content").eq("id", fixture.cardId).single();
    expect(after.error).toBeNull();
    expect(after.data).toMatchObject({
      front_content: { word: "live edit for learners" },
      back_content: { translation: "ngay lập tức" },
    });
    expect((await service.from("topics").select("status").eq("id", fixture.topicId).single()).data?.status)
      .toBe("published");
  });

  it("keeps the stored answer snapshot when the correct option changes and syncs against the live answer with sticky completion", async () => {
    const fixture = await createPublishedLearnerFixture();
    expect((await learner.from("user_flashcards").upsert(
      { user_id: learnerId, card_id: fixture.cardId, last_rating: 3 }, { onConflict: "user_id,card_id" },
    )).error).toBeNull();
    expect((await learner.from("user_question_answers").upsert({
      user_id: learnerId, question_id: fixture.questionId, selected_option_id: fixture.correctId, is_correct: true,
    }, { onConflict: "user_id,question_id" })).error).toBeNull();
    const completed = await learner.rpc("d4_sync_topic_progress", { p_topic_id: fixture.topicId });
    expect(completed.error).toBeNull();
    expect(completed.data).toMatchObject({ is_exercise_completed: true, is_topic_completed: true, newly_completed: true });

    // Tác giả đổi đáp án đúng từ A sang B ngay trên topic published.
    const swapped = await clients.teacher.rpc("sync_question_with_options", {
      p_question_id: fixture.questionId,
      p_content: "Original question",
      p_explanation: null,
      p_options: [
        { id: fixture.correctId, content: "A", is_correct: false },
        { id: fixture.wrongId, content: "B", is_correct: true },
      ],
    });
    expect(swapped.error).toBeNull();
    expect((await service.from("topics").select("status").eq("id", fixture.topicId).single()).data?.status)
      .toBe("published");

    // Snapshot đã lưu không bị chấm lại.
    expect((await service.from("user_question_answers").select("selected_option_id, is_correct")
      .eq("user_id", learnerId).eq("question_id", fixture.questionId).single()).data)
      .toMatchObject({ selected_option_id: fixture.correctId, is_correct: true });

    // Lần sync kế tiếp đọc đáp án hiện hành; hoàn thành topic vẫn sticky.
    const resynced = await learner.rpc("d4_sync_topic_progress", { p_topic_id: fixture.topicId });
    expect(resynced.error).toBeNull();
    expect(resynced.data).toMatchObject({ is_exercise_completed: false, is_topic_completed: true, newly_completed: false });

    expect((await learner.from("user_question_answers").upsert({
      user_id: learnerId, question_id: fixture.questionId, selected_option_id: fixture.wrongId, is_correct: true,
    }, { onConflict: "user_id,question_id" })).error).toBeNull();
    const answeredAgain = await learner.rpc("d4_sync_topic_progress", { p_topic_id: fixture.topicId });
    expect(answeredAgain.data).toMatchObject({ is_exercise_completed: true, is_topic_completed: true });
  });
});
