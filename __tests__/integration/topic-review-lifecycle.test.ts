import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra trusted topic review lifecycle, readiness, reviewer capability, pending freeze, published mutation safety và admin moderation.
// - Loại test: real local Supabase integration/RLS/RPC.
// - Đối tượng: request/approve/reject RPC, canonical topic-scoped rejection history, collaborator boundary, topic/content policies và moderation audit.
// - Case thành công:
//   - Chỉ matrix có active card và active exercise mới request được; reviewer hợp lệ approve được.
//   - Từ chối chỉ đưa topic về draft; lần gửi thứ tư vẫn thành công; lịch sử từ chối tính theo topic và giống nhau với mọi caller.
//   - Moderation topic/chapter/course và collaborator lifecycle đi qua boundary được phép.
// - Case thất bại:
//   - Readiness thiếu content, self-review, direct status write, pending mutation, unconfirmed published mutation, self-delete profile và unauthorized role/capability đều bị từ chối.
// - Bảo mật/phân quyền:
//   - Global admin không có membership không review/author nhưng vẫn moderation; capability derive từ membership role/flag.
// - Ổn định/resilience:
//   - Last-reviewer safety, published demotion rollback và request/delete race được kiểm tra trên local transaction boundary.
// - Invariant cần giữ:
//   - Không có topic pending thiếu required content; moderation không masquerade thành review rejection.
// - Kết quả verify gần nhất: passed (31 test) bằng `npm.cmd run test:integration -- __tests__/integration/topic-review-lifecycle.test.ts`.
// - Ghi chú: test chạy trên local Supabase với `ALLOW_DB_INTEGRATION_TESTS=true`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";

const USERS = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
} as const;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const courseIds = new Set<string>();

type ClientMap = Record<keyof typeof USERS, SupabaseClient>;
let clients: ClientMap;

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

async function createFixture(options: {
  cards?: number;
  exercises?: number;
  reviewer?: "student" | "admin";
  reviewerRole?: "editor" | "co_owner" | "previewer";
  reviewerCapability?: boolean;
} = {}) {
  const suffix = randomUUID();
  const { data: course, error: courseError } = await admin.from("courses").insert({
    title: `D1 review course ${suffix}`,
    slug: `d1-review-course-${suffix}`,
    description: "D1 trusted lifecycle integration fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  if (courseError || !course) throw new Error(`Course fixture failed: ${courseError?.message}`);
  courseIds.add(course.id);

  const collaborators = [
    { course_id: course.id, user_id: USERS.teacher.id, role: "owner", added_by: USERS.admin.id, can_review_topics: false },
  ];
  if (options.reviewer) {
    collaborators.push({
      course_id: course.id,
      user_id: USERS[options.reviewer].id,
      role: options.reviewerRole ?? "editor",
      added_by: USERS.admin.id,
      can_review_topics: options.reviewerCapability ?? true,
    } as unknown as (typeof collaborators)[number]);
  }
  const { error: collaboratorError } = await admin.from("course_collaborators").insert(collaborators);
  if (collaboratorError) throw new Error(`Collaborator fixture failed: ${collaboratorError.message}`);

  const { data: chapter, error: chapterError } = await admin.from("chapters").insert({
    course_id: course.id,
    title: "D1 review chapter",
    order_index: 1,
  }).select("id").single();
  if (chapterError || !chapter) throw new Error(`Chapter fixture failed: ${chapterError?.message}`);

  const { data: topic, error: topicError } = await admin.from("topics").insert({
    course_id: course.id,
    chapter_id: chapter.id,
    title: "D1 review topic",
    status: "draft",
    order_index: 1,
    original_creator_user_id: USERS.teacher.id,
    responsible_author_user_id: USERS.teacher.id,
  }).select("id").single();
  if (topicError || !topic) throw new Error(`Topic fixture failed: ${topicError?.message}`);

  const cardCount = options.cards ?? 0;
  if (cardCount > 0) {
    const { error } = await admin.from("cards").insert(Array.from({ length: cardCount }, (_, index) => ({
      topic_id: topic.id,
      front_content: { word: `card-${index}` },
      back_content: { translation: `translation-${index}` },
      order_index: index,
    })));
    if (error) throw new Error(`Card fixture failed: ${error.message}`);
  }
  const exerciseCount = options.exercises ?? 0;
  if (exerciseCount > 0) {
    const { error } = await admin.from("exercises").insert(Array.from({ length: exerciseCount }, (_, index) => ({
      topic_id: topic.id,
      course_id: course.id,
      title: `exercise-${index}`,
      part_type: "part_5",
      order_index: index,
    })));
    if (error) throw new Error(`Exercise fixture failed: ${error.message}`);
  }

  return { courseId: course.id as string, chapterId: chapter.id as string, topicId: topic.id as string };
}

async function getTopic(topicId: string) {
  const { data, error } = await admin.from("topics").select("status, removed_at, first_approved_at").eq("id", topicId).single();
  if (error || !data) throw new Error(`Topic state failed: ${error?.message}`);
  return data;
}

async function getPendingSubmission(topicId: string) {
  const { data, error } = await admin.from("topic_review_submissions")
    .select("id, status, submitted_by_user_id, attempt_number")
    .eq("topic_id", topicId).eq("status", "pending").single();
  if (error || !data) throw new Error(`Submission state failed: ${error?.message}`);
  return data;
}

async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length > 0) await admin.from("courses").delete().in("id", ids);
}

function expectRpcError(result: { error: { message?: string } | null }, code: string) {
  expect(result.error).not.toBeNull();
  expect(result.error?.message).toContain(code);
}

function expectRpcErrorOneOf(result: { error: { message?: string } | null }, codes: string[]) {
  expect(result.error).not.toBeNull();
  expect(codes.some((code) => result.error?.message?.includes(code))).toBe(true);
}

describe.sequential("D1 trusted topic review lifecycle", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    clients = {
      admin: await signIn(USERS.admin.email),
      teacher: await signIn(USERS.teacher.email),
      student: await signIn(USERS.student.email),
    };
  });

  afterEach(cleanup);

  it.each([
    [0, 0],
    [1, 0],
    [0, 1],
  ] as const)("rejects readiness matrix %s cards / %s exercises", async (cards, exercises) => {
    const fixture = await createFixture({ cards, exercises });
    const result = await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expectRpcError(result, "TOPIC_REVIEW_NOT_READY");
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "draft", removed_at: null });
    const submissions = await admin.from("topic_review_submissions").select("id").eq("topic_id", fixture.topicId);
    expect(submissions.error).toBeNull();
    expect(submissions.data).toEqual([]);
  });

  it("allows only the both-content matrix and never publishes on request", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    const result = await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ status: "pending", topic_id: fixture.topicId });
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "pending", removed_at: null });
    expect((await getPendingSubmission(fixture.topicId)).submitted_by_user_id).toBe(USERS.teacher.id);
  });

  it.each([
    [0, 0, false],
    [1, 0, false],
    [0, 1, false],
    [1, 1, true],
  ] as const)("returns server-derived topic workflow readiness for %s cards / %s exercises", async (cards, exercises, ready) => {
    const fixture = await createFixture({ cards, exercises, reviewer: ready ? "student" : undefined });
    const result = await clients.teacher.rpc("get_topic_workflow_state", {
      p_topic_id: fixture.topicId,
    });

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      topicId: fixture.topicId,
      courseId: fixture.courseId,
      chapterId: fixture.chapterId,
      activeFlashcardCount: cards,
      activeExerciseCount: exercises,
      isReady: ready,
      canRequestReview: ready,
      status: "draft",
      pendingSubmissionId: null,
      isCurrentUserSubmitter: false,
      rejectionCount: 0,
      rejectionHistory: [],
    });
  });

  it("keeps workflow read access membership-scoped and role-aware", async () => {
    const fixture = await createFixture({
      cards: 1,
      exercises: 1,
      reviewer: "student",
      reviewerRole: "previewer",
      reviewerCapability: true,
    });

    const previewer = await clients.student.rpc("get_topic_workflow_state", {
      p_topic_id: fixture.topicId,
    });
    expect(previewer.error).toBeNull();
    expect(previewer.data).toMatchObject({
      role: "previewer",
      canEdit: false,
      canReview: true,
      canRequestReview: false,
      isReady: true,
    });

    expectRpcError(
      await clients.admin.rpc("get_topic_workflow_state", {
        p_topic_id: fixture.topicId,
      }),
      "TOPIC_WORKFLOW_FORBIDDEN",
    );
  });

  it("separates admin moderation from reviewer authority and enforces no-self-review", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    const request = await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expect(request.error).toBeNull();
    const submission = await getPendingSubmission(fixture.topicId);

    expectRpcError(await clients.teacher.rpc("approve_topic_review", { p_submission_id: submission.id }), "TOPIC_REVIEW_SELF_REVIEW");
    expectRpcError(await clients.admin.rpc("approve_topic_review", { p_submission_id: submission.id }), "TOPIC_REVIEW_FORBIDDEN");
    expectRpcError(await clients.admin.rpc("reject_topic_review", { p_submission_id: submission.id, p_reason: "admin must not review" }), "TOPIC_REVIEW_FORBIDDEN");
    expectRpcErrorOneOf(await clients.admin.rpc("request_topic_review", { p_topic_id: fixture.topicId }), [
      "COURSE_EDIT_FORBIDDEN",
      "TOPIC_NOT_DRAFT",
    ]);

    const approved = await clients.student.rpc("approve_topic_review", { p_submission_id: submission.id });
    expect(approved.error).toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({
      status: "published",
      first_approved_at: expect.any(String),
    });
  });

  it("rejects direct lifecycle writes and freezes pending content", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    const directInsert = await clients.teacher.from("topics").insert({
      course_id: fixture.courseId,
      chapter_id: fixture.chapterId,
      title: "direct published topic",
      status: "published",
      order_index: 2,
    }).select("id").single();
    expect(directInsert.data).toBeNull();
    expect(directInsert.error).not.toBeNull();

    const directUpdate = await clients.teacher.from("topics").update({ status: "published" })
      .eq("id", fixture.topicId).select("id").single();
    expect(directUpdate.data).toBeNull();
    expect(directUpdate.error).not.toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "draft" });

    const directCourseUpdate = await clients.admin.from("courses").update({ status: "published" })
      .eq("id", fixture.courseId).select("id").single();
    expect(directCourseUpdate.data).toBeNull();
    expect(directCourseUpdate.error).not.toBeNull();

    const request = await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expect(request.error).toBeNull();

    const blockedExerciseCreate = await clients.teacher.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId,
      p_payload: {
        title: "pending exercise",
        part_type: "part5",
        questions: [{
          content: "pending question",
          options: [
            { content: "A", is_correct: true },
            { content: "B", is_correct: false },
          ],
        }],
      },
    });
    expectRpcError(blockedExerciseCreate, "TOPIC_PENDING_FROZEN");

    const blockedTopicUpdate = await clients.teacher.from("topics").update({ title: "blocked pending topic" })
      .eq("id", fixture.topicId).select("id").single();
    expect(blockedTopicUpdate.data).toBeNull();
    expect(blockedTopicUpdate.error).not.toBeNull();
    const blockedTopicDelete = await clients.teacher.from("topics").update({ removed_at: new Date().toISOString() })
      .eq("id", fixture.topicId).select("id").single();
    expect(blockedTopicDelete.data).toBeNull();
    expect(blockedTopicDelete.error).not.toBeNull();

    const { data: exercise } = await admin.from("exercises").select("id").eq("topic_id", fixture.topicId).single();
    expect(exercise).toBeTruthy();
    if (!exercise) return;
    const groupId = randomUUID();
    const questionId = randomUUID();
    const optionId = randomUUID();
    expect((await admin.from("question_groups").insert({
      id: groupId,
      exercise_id: exercise.id,
      passage_text: "pending group",
      order_index: 0,
    })).error).toBeNull();
    expect((await admin.from("questions").insert({
      id: questionId,
      group_id: groupId,
      exercise_id: exercise.id,
      course_id: fixture.courseId,
      content: "pending question",
      order_index: 0,
    })).error).toBeNull();
    expect((await admin.from("question_options").insert({
      id: optionId,
      question_id: questionId,
      content: "pending option",
      label: "A",
      is_correct: true,
      order_index: 0,
    })).error).toBeNull();

    const { data: card } = await admin.from("cards").select("id, removed_at").eq("topic_id", fixture.topicId).single();
    expect(card).toBeTruthy();
    if (!card) return;
    const blockedCard = await clients.teacher.from("cards").update({ removed_at: new Date().toISOString() })
      .eq("id", card.id).select("id").single();
    expect(blockedCard.data).toBeNull();
    expect(blockedCard.error).not.toBeNull();
    expect((await admin.from("cards").select("removed_at").eq("id", card.id).single()).data?.removed_at).toBeNull();

    const blockedChapter = await clients.teacher.from("chapters").update({ title: "blocked pending chapter" })
      .eq("id", fixture.chapterId).select("id").single();
    expect(blockedChapter.data).toBeNull();
    expect(blockedChapter.error).not.toBeNull();
    expect((await admin.from("chapters").select("title").eq("id", fixture.chapterId).single()).data?.title)
      .toBe("D1 review chapter");

    const blockedGroup = await clients.teacher.from("question_groups").update({ passage_text: "changed" })
      .eq("id", groupId).select("id").single();
    const blockedQuestion = await clients.teacher.from("questions").update({ content: "changed" })
      .eq("id", questionId).select("id").single();
    const blockedOption = await clients.teacher.from("question_options").update({ content: "changed" })
      .eq("id", optionId).select("id").single();
    expect(blockedGroup.data).toBeNull();
    expect(blockedGroup.error).not.toBeNull();
    expect(blockedQuestion.data).toBeNull();
    expect(blockedQuestion.error).not.toBeNull();
    expect(blockedOption.data).toBeNull();
    expect(blockedOption.error).not.toBeNull();
  });

  it("rejects a third time without locking the topic for resubmission", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
      const submission = await getPendingSubmission(fixture.topicId);
      expect((await clients.student.rpc("reject_topic_review", {
        p_submission_id: submission.id,
        p_reason: `third rejection ${attempt}`,
      })).error).toBeNull();
    }

    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "draft" });
    // Lần gửi thứ tư phải thành công: không còn hold cấp topic sau 3 lần từ chối.
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "pending" });

    // A12: người từng bị từ chối vẫn tạo được topic mới trong cùng khoá học.
    const created = await clients.teacher.rpc("create_topic_ordered", {
      p_course_id: fixture.courseId,
      p_chapter_id: fixture.chapterId,
      p_title: "topic created after three rejections",
    });
    expect(created.error).toBeNull();
  });

  it("reports the same rejection count to every caller", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
      const submission = await getPendingSubmission(fixture.topicId);
      expect((await clients.student.rpc("reject_topic_review", {
        p_submission_id: submission.id,
        p_reason: `canonical count ${attempt}`,
      })).error).toBeNull();
    }

    // F6 chống tái phát: submitter và một reviewer khác phải thấy cùng canonical state.
    const submitterState = await clients.teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    const reviewerState = await clients.student.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(submitterState.error).toBeNull();
    expect(reviewerState.error).toBeNull();
    expect(submitterState.data).toMatchObject({ rejectionCount: 3 });
    expect(reviewerState.data).toMatchObject({ rejectionCount: 3 });
    expect((submitterState.data as { rejectionCount: number }).rejectionCount)
      .toBe((reviewerState.data as { rejectionCount: number }).rejectionCount);
  });

  it("reports the same rejection history to every caller", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
      const submission = await getPendingSubmission(fixture.topicId);
      expect((await clients.student.rpc("reject_topic_review", {
        p_submission_id: submission.id,
        p_reason: `history ${attempt}`,
      })).error).toBeNull();
    }

    const submitterState = await clients.teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    const reviewerState = await clients.student.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(submitterState.error).toBeNull();
    expect(reviewerState.error).toBeNull();

    const submitterHistory = (submitterState.data as {
      rejectionHistory: Array<{ index: number; reason: string; reviewer: { userId: string } | null }>;
    }).rejectionHistory;
    const reviewerHistory = (reviewerState.data as {
      rejectionHistory: Array<{ index: number; reason: string; reviewer: { userId: string } | null }>;
    }).rejectionHistory;
    expect(submitterHistory).toHaveLength(2);
    // Bằng nhau từng phần tử, không chỉ cùng độ dài.
    expect(submitterHistory).toEqual(reviewerHistory);
    expect(submitterHistory).toEqual([
      expect.objectContaining({ index: 1, reason: "history 1", reviewedAt: expect.any(String) }),
      expect.objectContaining({ index: 2, reason: "history 2", reviewedAt: expect.any(String) }),
    ]);
    expect(submitterHistory[1]?.reviewer).toMatchObject({ userId: USERS.student.id });
  });

  it("numbers rejections chronologically across different submitters", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student", reviewerRole: "co_owner" });
    // Admin vào khoá học với quyền review để luôn còn reviewer hợp lệ khi người
    // gửi đổi qua lại: chính người gửi và responsible author cũ đều bị loại.
    expect((await admin.from("course_collaborators").insert({
      course_id: fixture.courseId,
      user_id: USERS.admin.id,
      role: "previewer",
      can_review_topics: true,
      added_by: USERS.teacher.id,
    })).error).toBeNull();

    // Lần 1: teacher (responsible) gửi, student (co_owner) từ chối.
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const firstSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("reject_topic_review", {
      p_submission_id: firstSubmission.id,
      p_reason: "submitter A rejection",
    })).error).toBeNull();

    // Lần 2: student tự nhận trách nhiệm (co_owner); teacher bị loại nên admin từ chối.
    expect((await clients.student.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.student.id,
    })).error).toBeNull();
    expect((await clients.student.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const secondSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.admin.rpc("reject_topic_review", {
      p_submission_id: secondSubmission.id,
      p_reason: "submitter B rejection",
    })).error).toBeNull();

    // Lần 3: teacher tự nhận lại trách nhiệm; student bị loại nên admin từ chối.
    expect((await clients.teacher.rpc("transfer_topic_responsibility", {
      p_topic_id: fixture.topicId,
      p_recipient_user_id: USERS.teacher.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const thirdSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.admin.rpc("reject_topic_review", {
      p_submission_id: thirdSubmission.id,
      p_reason: "submitter A rejection again",
    })).error).toBeNull();

    const workflow = await clients.teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(workflow.error).toBeNull();
    const history = (workflow.data as {
      rejectionHistory: Array<{ index: number; reason: string; reviewer: { userId: string } | null }>;
    }).rejectionHistory;
    // index theo thứ tự thời gian và KHÔNG reset khi đổi người gửi.
    expect(history.map((entry) => entry.index)).toEqual([1, 2, 3]);
    expect(history.map((entry) => entry.reason))
      .toEqual(["submitter A rejection", "submitter B rejection", "submitter A rejection again"]);
    expect(history[0]?.reviewer).toMatchObject({ userId: USERS.student.id });
    expect(history[1]?.reviewer).toMatchObject({ userId: USERS.admin.id });
  });

  it("keeps rejectionCount equal to rejectionHistory length after each rejection", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
      const submission = await getPendingSubmission(fixture.topicId);
      expect((await clients.student.rpc("reject_topic_review", {
        p_submission_id: submission.id,
        p_reason: `invariant ${attempt}`,
      })).error).toBeNull();

      const workflow = await clients.teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
      expect(workflow.error).toBeNull();
      const state = workflow.data as { rejectionCount: number; rejectionHistory: unknown[] };
      expect(state.rejectionCount).toBe(state.rejectionHistory.length);
      expect(state.rejectionCount).toBe(attempt);
    }
  });

  it("hides the rejection history once the topic is published", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const rejectedSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("reject_topic_review", {
      p_submission_id: rejectedSubmission.id,
      p_reason: "one rejection before publish",
    })).error).toBeNull();

    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const acceptedSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: acceptedSubmission.id })).error).toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "published" });

    const workflow = await clients.teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(workflow.error).toBeNull();
    expect(workflow.data).toMatchObject({ rejectionCount: 0, rejectionHistory: [] });
  });

  it("allows the rejecting reviewer to approve a later submission", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const firstSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("reject_topic_review", {
      p_submission_id: firstSubmission.id,
      p_reason: "needs another pass",
    })).error).toBeNull();

    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const secondSubmission = await getPendingSubmission(fixture.topicId);
    // F4 là hành vi cố ý: reviewer vừa từ chối vẫn duyệt được lần gửi sau.
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: secondSubmission.id })).error).toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "published" });
  });

  it("protects the last pending reviewer and keeps capability mutations trusted", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    const { data: collaborator } = await admin.from("course_collaborators").select("id")
      .eq("course_id", fixture.courseId).eq("user_id", USERS.student.id).single();
    expect(collaborator).toBeTruthy();
    if (!collaborator) return;
    expectRpcError(await clients.student.rpc("set_course_collaborator_review_capability", {
      p_collaborator_id: collaborator.id, p_can_review_topics: false,
    }), "COLLABORATOR_MANAGEMENT_FORBIDDEN");

    const request = await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expect(request.error).toBeNull();
    expectRpcError(await clients.teacher.rpc("set_course_collaborator_review_capability", {
      p_collaborator_id: collaborator.id, p_can_review_topics: false,
    }), "COLLABORATOR_LAST_REVIEWER_REQUIRED");

    const direct = await clients.student.from("course_collaborators").update({ can_review_topics: false })
      .eq("id", collaborator.id).select("id").single();
    expect(direct.data).toBeNull();
    expect(direct.error).not.toBeNull();
  });

  it("rejects request when the only course reviewer is the submitter", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1 });
    const result = await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expectRpcError(result, "TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER");
    expect((await clients.teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId })).data)
      .toMatchObject({ hasDistinctEligibleReviewer: false, canRequestReview: false });
  });

  it("derives review capability from role, clears it on downgrade, and removes it with membership", async () => {
    const ownerFixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    // D20: the owner here is also the topic's creator, so the dynamic exclusion
    // branch keeps them out of reviewing their own topic at every round — the
    // old predicate let them back in once first_approved_at was set.
    expect((await clients.teacher.rpc("has_topic_review_access", { target_topic_id: ownerFixture.topicId })).data)
      .toBe(false);
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: ownerFixture.topicId })).error).toBeNull();
    const ownerSubmission = await getPendingSubmission(ownerFixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: ownerSubmission.id })).error).toBeNull();
    expect((await getTopic(ownerFixture.topicId)).first_approved_at).toEqual(expect.any(String));
    expect((await clients.teacher.rpc("has_topic_review_access", { target_topic_id: ownerFixture.topicId })).data)
      .toBe(false);

    const coOwnerFixture = await createFixture({
      cards: 1,
      exercises: 1,
      reviewer: "student",
      reviewerRole: "co_owner",
      reviewerCapability: false,
    });
    expect((await clients.student.rpc("has_topic_review_access", { target_topic_id: coOwnerFixture.topicId })).data)
      .toBe(true);

    const delegatedFixture = await createFixture({
      cards: 1,
      exercises: 1,
      reviewer: "student",
      reviewerRole: "editor",
      reviewerCapability: false,
    });
    const collaborator = await admin.from("course_collaborators").select("id, role, can_review_topics")
      .eq("course_id", delegatedFixture.courseId).eq("user_id", USERS.student.id).single();
    expect(collaborator.error).toBeNull();
    expect(collaborator.data).toMatchObject({ role: "editor", can_review_topics: false });
    if (!collaborator.data) return;

    expect((await clients.student.rpc("has_topic_review_access", { target_topic_id: delegatedFixture.topicId })).data)
      .toBe(false);
    expect((await clients.teacher.rpc("set_course_collaborator_review_capability", {
      p_collaborator_id: collaborator.data.id,
      p_can_review_topics: true,
    })).error).toBeNull();
    expect((await clients.student.rpc("has_topic_review_access", { target_topic_id: delegatedFixture.topicId })).data)
      .toBe(true);

    const downgraded = await clients.teacher.rpc("update_course_collaborator_role", {
      p_collaborator_id: collaborator.data.id,
      p_role: "previewer",
    });
    expect(downgraded.error).toBeNull();
    expect(downgraded.data).toMatchObject({ role: "previewer", can_review_topics: false });
    expect((await clients.student.rpc("has_topic_review_access", { target_topic_id: delegatedFixture.topicId })).data)
      .toBe(false);

    expect((await clients.teacher.rpc("set_course_collaborator_review_capability", {
      p_collaborator_id: collaborator.data.id,
      p_can_review_topics: true,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("remove_course_collaborator", {
      p_collaborator_id: collaborator.data.id,
    })).error).toBeNull();
    expect((await admin.from("course_collaborators").select("id").eq("id", collaborator.data.id).single()).data)
      .toBeNull();
    expect((await clients.student.rpc("has_topic_review_access", { target_topic_id: delegatedFixture.topicId })).data)
      .toBe(false);
  });

  it("supports distinct admin demotion and pending invalidation audit", async () => {
    const publishedFixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: publishedFixture.topicId })).error).toBeNull();
    const publishedSubmission = await getPendingSubmission(publishedFixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: publishedSubmission.id })).error).toBeNull();

    const demoted = await clients.admin.rpc("moderate_platform_content", {
      p_target_type: "topic", p_target_id: publishedFixture.topicId, p_action: "demote", p_reason: "Policy maintenance review.",
    });
    expect(demoted.error).toBeNull();
    expect(await getTopic(publishedFixture.topicId)).toMatchObject({ status: "draft", removed_at: null });

    const pendingFixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: pendingFixture.topicId })).error).toBeNull();
    const invalidated = await clients.admin.rpc("moderate_platform_content", {
      p_target_type: "topic", p_target_id: pendingFixture.topicId, p_action: "invalidate_review", p_reason: "Candidate no longer meets policy.",
    });
    expect(invalidated.error).toBeNull();
    expect(await getTopic(pendingFixture.topicId)).toMatchObject({ status: "draft" });
    const cancelled = await admin.from("topic_review_submissions").select("status, rejection_reason, cancellation_reason")
      .eq("topic_id", pendingFixture.topicId).single();
    expect(cancelled.error).toBeNull();
    expect(cancelled.data).toMatchObject({ status: "cancelled", rejection_reason: null });

    const audits = await admin.from("platform_moderation_audits").select("target_id, action, reason")
      .in("target_id", [publishedFixture.topicId, pendingFixture.topicId]).order("created_at");
    expect(audits.error).toBeNull();
    expect(audits.data?.map((audit) => audit.action)).toEqual(["demote", "invalidate_review"]);

    const chapterFixture = await createFixture();
    const chapterTakedown = await clients.admin.rpc("moderate_platform_content", {
      p_target_type: "chapter",
      p_target_id: chapterFixture.chapterId,
      p_action: "takedown",
      p_reason: "Chapter violates platform policy.",
    });
    expect(chapterTakedown.error).toBeNull();
    expect((await admin.from("chapters").select("removed_at").eq("id", chapterFixture.chapterId).single()).data?.removed_at)
      .not.toBeNull();

    const courseFixture = await createFixture();
    expect((await admin.from("courses").update({ status: "published" }).eq("id", courseFixture.courseId)).error)
      .toBeNull();
    const courseDemotion = await clients.admin.rpc("moderate_platform_content", {
      p_target_type: "course",
      p_target_id: courseFixture.courseId,
      p_action: "demote",
      p_reason: "Course requires policy maintenance.",
    });
    expect(courseDemotion.error).toBeNull();
    expect((await admin.from("courses").select("status").eq("id", courseFixture.courseId).single()).data?.status)
      .toBe("draft");
  });

  it("blocks profile role escalation from creating or moderating as admin", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    const roleUpdate = await clients.student.from("profiles").update({ role: "admin" }).eq("id", USERS.student.id);
    expect(roleUpdate.error).not.toBeNull();
    expect((await admin.from("profiles").select("role").eq("id", USERS.student.id).single()).data?.role).toBe("student");

    expectRpcError(await clients.student.rpc("create_course_with_owner", {
      p_title: "Escalation course",
      p_slug: `escalation-${randomUUID()}`,
      p_description: "Role escalation must not create courses.",
      p_price: 0,
      p_thumbnail_url: null,
    }), "COURSE_CREATE_FORBIDDEN");
    expectRpcError(await clients.student.rpc("moderate_platform_content", {
      p_target_type: "topic",
      p_target_id: fixture.topicId,
      p_action: "takedown",
      p_reason: "Student role must not moderate.",
    }), "ADMIN_MODERATION_FORBIDDEN");
  });

  it("denies authenticated self-delete on profiles without changing the row", async () => {
    const before = await admin.from("profiles").select("id, role, removed_at").eq("id", USERS.student.id).single();
    expect(before.error).toBeNull();
    expect(before.data).toMatchObject({ id: USERS.student.id, role: "student" });

    const deletion = await clients.student.from("profiles").delete().eq("id", USERS.student.id).select("id").single();
    expect(deletion.data).toBeNull();
    expect(deletion.error).not.toBeNull();

    const after = await admin.from("profiles").select("id, role, removed_at").eq("id", USERS.student.id).single();
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it("does not leave pending with missing required content when request races card deletion", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1 });
    const { data: card } = await admin.from("cards").select("id").eq("topic_id", fixture.topicId).single();
    expect(card).toBeTruthy();
    if (!card) return;
    const [request, deletion] = await Promise.all([
      clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId }),
      clients.teacher.from("cards").update({ removed_at: new Date().toISOString() }).eq("id", card.id).select("id").single(),
    ]);
    expect(request.error === null || deletion.error === null).toBe(true);
    const topic = await getTopic(fixture.topicId);
    const { count } = await admin.from("cards").select("id", { count: "exact", head: true })
      .eq("topic_id", fixture.topicId).is("removed_at", null);
    const { count: exerciseCount } = await admin.from("exercises").select("id", { count: "exact", head: true })
      .eq("topic_id", fixture.topicId).is("removed_at", null);
    expect(!(topic.status === "pending" && ((count ?? 0) < 1 || (exerciseCount ?? 0) < 1))).toBe(true);
  });

  it("requires explicit published confirmation and rolls back demotion on failed content mutation", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: submission.id })).error).toBeNull();

    const { data: card } = await admin.from("cards").select("id, front_content").eq("topic_id", fixture.topicId).single();
    expect(card).toBeTruthy();
    if (!card) return;

    const directUpdate = await clients.teacher.from("cards").update({
      front_content: { word: "direct bypass" },
    }).eq("id", card.id).select("id").single();
    expect(directUpdate.data).toBeNull();
    expect(directUpdate.error).not.toBeNull();
    expect((await getTopic(fixture.topicId)).status).toBe("published");

    const unconfirmed = await clients.teacher.rpc("d1_update_card", {
      p_card_id: card.id,
      p_front_content: { word: "unconfirmed" },
      p_back_content: { translation: "unchanged" },
    });
    expectRpcError(unconfirmed, "TOPIC_PUBLISHED_CONFIRM_REQUIRED");
    expect((await getTopic(fixture.topicId)).status).toBe("published");

    const confirmed = await clients.teacher.rpc("d1_update_card", {
      p_card_id: card.id,
      p_front_content: { word: "confirmed update" },
      p_back_content: { translation: "updated" },
      p_confirm_published: true,
    });
    expect(confirmed.error).toBeNull();
    expect((await getTopic(fixture.topicId)).status).toBe("draft");
    expect((await admin.from("cards").select("front_content").eq("id", card.id).single()).data?.front_content)
      .toMatchObject({ word: "confirmed update" });

    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const republishSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: republishSubmission.id })).error).toBeNull();

    const failed = await clients.teacher.rpc("d1_update_card", {
      p_card_id: card.id,
      p_front_content: null,
      p_back_content: { translation: "must roll back" },
      p_confirm_published: true,
    });
    expect(failed.error).not.toBeNull();
    expect((await getTopic(fixture.topicId)).status).toBe("published");
    expect((await admin.from("cards").select("front_content").eq("id", card.id).single()).data?.front_content)
      .toMatchObject({ word: "confirmed update" });
  });

  it("blocks direct restore of removed published content and restores through the trusted boundary", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: submission.id })).error).toBeNull();

    const { data: card } = await admin.from("cards").select("id").eq("topic_id", fixture.topicId).single();
    expect(card).toBeTruthy();
    if (!card) return;
    expect((await admin.from("cards").update({ removed_at: new Date().toISOString() }).eq("id", card.id)).error)
      .toBeNull();

    const directRestore = await clients.teacher.from("cards").update({ removed_at: null })
      .eq("id", card.id).select("id").single();
    expect(directRestore.data).toBeNull();
    expect(directRestore.error).not.toBeNull();
    expect((await getTopic(fixture.topicId)).status).toBe("published");

    const unconfirmed = await clients.teacher.rpc("d1_restore_topic_content", {
      p_content_type: "card",
      p_content_id: card.id,
    });
    expectRpcError(unconfirmed, "TOPIC_PUBLISHED_CONFIRM_REQUIRED");

    const restored = await clients.teacher.rpc("d1_restore_topic_content", {
      p_content_type: "card",
      p_content_id: card.id,
      p_confirm_published: true,
    });
    expect(restored.error).toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "draft" });
    expect((await admin.from("cards").select("removed_at").eq("id", card.id).single()).data?.removed_at)
      .toBeNull();
  });

  it("uses atomic topic demotion for published topic delete and supports draft restore", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: submission.id })).error).toBeNull();

    const unconfirmed = await clients.teacher.rpc("d1_delete_topic", { p_topic_id: fixture.topicId });
    expectRpcError(unconfirmed, "TOPIC_PUBLISHED_CONFIRM_REQUIRED");
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "published", removed_at: null });

    const removed = await clients.teacher.rpc("d1_delete_topic", {
      p_topic_id: fixture.topicId,
      p_confirm_published: true,
    });
    expect(removed.error).toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "draft" });
    expect((await getTopic(fixture.topicId)).removed_at).not.toBeNull();

    const restored = await clients.teacher.rpc("d1_restore_topic", { p_topic_id: fixture.topicId });
    expect(restored.error).toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "draft", removed_at: null });
  });

  it("protects published exercise mutations and restores a removed exercise as draft", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: submission.id })).error).toBeNull();

    const payload = {
      title: "Confirmed exercise",
      part_type: "part5",
      questions: [{
        content: "Which answer is correct?",
        options: [
          { content: "A", is_correct: true },
          { content: "B", is_correct: false },
        ],
      }],
    };
    const unconfirmed = await clients.teacher.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId,
      p_payload: payload,
      p_confirm_published: false,
    });
    expectRpcError(unconfirmed, "TOPIC_PUBLISHED_CONFIRM_REQUIRED");

    const created = await clients.teacher.rpc("create_exercise_with_content", {
      p_topic_id: fixture.topicId,
      p_payload: payload,
      p_confirm_published: true,
    });
    expect(created.error).toBeNull();
    expect((await getTopic(fixture.topicId)).status).toBe("draft");
    const createdExerciseId = (created.data as { exercise_id: string }).exercise_id;

    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const republishSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: republishSubmission.id })).error).toBeNull();

    const deleted = await clients.teacher.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: createdExerciseId,
      p_confirm_published: true,
    });
    expect(deleted.error).toBeNull();
    expect(await getTopic(fixture.topicId)).toMatchObject({ status: "draft" });
    expect((await admin.from("exercises").select("removed_at").eq("id", createdExerciseId).single()).data?.removed_at)
      .not.toBeNull();

    const restored = await clients.teacher.rpc("d1_restore_topic_content", {
      p_content_type: "exercise",
      p_content_id: createdExerciseId,
    });
    expect(restored.error).toBeNull();
    expect((await admin.from("exercises").select("removed_at").eq("id", createdExerciseId).single()).data?.removed_at)
      .toBeNull();
    expect((await getTopic(fixture.topicId)).status).toBe("draft");
  });

  it("keeps child mutations behind the same published confirmation boundary", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    const { data: exercise } = await admin.from("exercises").select("id").eq("topic_id", fixture.topicId).single();
    expect(exercise).toBeTruthy();
    if (!exercise) return;

    const groupId = randomUUID();
    const questionIds = [randomUUID(), randomUUID()];
    const { error: groupError } = await admin.from("question_groups").insert({
      id: groupId,
      exercise_id: exercise.id,
      passage_text: "Original passage",
      order_index: 0,
    });
    expect(groupError).toBeNull();
    for (const [index, questionId] of questionIds.entries()) {
      expect((await admin.from("questions").insert({
        id: questionId,
        group_id: groupId,
        exercise_id: exercise.id,
        course_id: fixture.courseId,
        content: `Question ${index}`,
        order_index: index,
      })).error).toBeNull();
      expect((await admin.from("question_options").insert([
        { question_id: questionId, content: "A", label: "A", is_correct: true, order_index: 0 },
        { question_id: questionId, content: "B", label: "B", is_correct: false, order_index: 1 },
      ])).error).toBeNull();
    }

    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: submission.id })).error).toBeNull();

    const unconfirmedGroup = await clients.teacher.rpc("d1_update_question_group", {
      p_group_id: groupId,
      p_passage_text: "Unconfirmed passage",
      p_audio_url: null,
      p_image_url: null,
    });
    expectRpcError(unconfirmedGroup, "TOPIC_PUBLISHED_CONFIRM_REQUIRED");

    const confirmedGroup = await clients.teacher.rpc("d1_update_question_group", {
      p_group_id: groupId,
      p_passage_text: "Confirmed passage",
      p_audio_url: null,
      p_image_url: null,
      p_confirm_published: true,
    });
    expect(confirmedGroup.error).toBeNull();
    expect((await getTopic(fixture.topicId)).status).toBe("draft");
    expect((await admin.from("question_groups").select("passage_text").eq("id", groupId).single()).data?.passage_text)
      .toBe("Confirmed passage");

    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const republishSubmission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: republishSubmission.id })).error).toBeNull();

    const unconfirmedDelete = await clients.teacher.rpc("d1_delete_question", {
      p_question_id: questionIds[0],
    });
    expectRpcError(unconfirmedDelete, "TOPIC_PUBLISHED_CONFIRM_REQUIRED");
    const confirmedDelete = await clients.teacher.rpc("d1_delete_question", {
      p_question_id: questionIds[0],
      p_confirm_published: true,
    });
    expect(confirmedDelete.error).toBeNull();
    expect((await getTopic(fixture.topicId)).status).toBe("draft");

    const restored = await clients.teacher.rpc("d1_restore_topic_content", {
      p_content_type: "question",
      p_content_id: questionIds[0],
    });
    expect(restored.error).toBeNull();
    expect((await admin.from("questions").select("removed_at").eq("id", questionIds[0]).single()).data?.removed_at)
      .toBeNull();
  });

  it("serializes concurrent published edits without leaving a published mutation", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await getPendingSubmission(fixture.topicId);
    expect((await clients.student.rpc("approve_topic_review", { p_submission_id: submission.id })).error).toBeNull();

    const { data: card } = await admin.from("cards").select("id").eq("topic_id", fixture.topicId).single();
    expect(card).toBeTruthy();
    if (!card) return;
    const results = await Promise.all([
      clients.teacher.rpc("d1_update_card", {
        p_card_id: card.id,
        p_front_content: { word: "concurrent one" },
        p_back_content: { translation: "one" },
        p_confirm_published: true,
      }),
      clients.teacher.rpc("d1_update_card", {
        p_card_id: card.id,
        p_front_content: { word: "concurrent two" },
        p_back_content: { translation: "two" },
        p_confirm_published: true,
      }),
    ]);

    expect(results.every((result) => result.error === null)).toBe(true);
    expect((await getTopic(fixture.topicId)).status).toBe("draft");
    expect(["concurrent one", "concurrent two"]).toContain(
      ((await admin.from("cards").select("front_content").eq("id", card.id).single()).data?.front_content as { word: string }).word,
    );
  });

  // D41/A55: review authority is role-native for owner tier. These three cases
  // pin that the flag is inert there and decisive only for editor/previewer.
  // The co_owner flag=false case already lives in the test above (:620-628).
  // The reviewer here is deliberately not the topic's creator: a creator is
  // excluded by D20 whatever their role is.
  it("lets an owner outside the authoring group review regardless of the flag value", async () => {
    // createFixture already seats admin as a co_owner, so the owner seat is
    // taken. Move teacher out of the owner seat first, then give it to admin.
    // Direct DML is the fixture technique the plan sanctions for role
    // transitions (:1329); the RPC path only accepts editor/previewer targets.
    const fixture = await createFixture({
      cards: 1,
      exercises: 1,
      reviewer: "admin",
      reviewerRole: "co_owner",
      reviewerCapability: false,
    });
    const teacherCollaborator = await admin.from("course_collaborators").select("id")
      .eq("course_id", fixture.courseId).eq("user_id", USERS.teacher.id).single();
    expect(teacherCollaborator.error).toBeNull();
    if (!teacherCollaborator.data) return;
    const adminCollaborator = await admin.from("course_collaborators").select("id")
      .eq("course_id", fixture.courseId).eq("user_id", USERS.admin.id).single();
    expect(adminCollaborator.error).toBeNull();
    if (!adminCollaborator.data) return;
    expect((await admin.from("course_collaborators")
      .update({ role: "co_owner" }).eq("id", teacherCollaborator.data.id)).error).toBeNull();
    expect((await admin.from("course_collaborators")
      .update({ role: "owner" }).eq("id", adminCollaborator.data.id)).error).toBeNull();
    expect((await admin.from("course_collaborators").select("role, can_review_topics")
      .eq("id", adminCollaborator.data.id).single()).data)
      .toMatchObject({ role: "owner", can_review_topics: false });
    const access = await clients.admin.rpc("has_topic_review_access", { target_topic_id: fixture.topicId });
    expect(access.data).toBe(true);
  });

  it("lets a co_owner outside the authoring group review with the flag on as well as off", async () => {
    for (const capability of [false, true]) {
      const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "admin", reviewerRole: "co_owner", reviewerCapability: capability });
      const access = await clients.admin.rpc("has_topic_review_access", { target_topic_id: fixture.topicId });
      expect(access.data).toBe(true);
    }
  });

  it("gives editor and previewer review access only through the flag", async () => {
    for (const reviewerRole of ["editor", "previewer"] as const) {
      const withoutFlag = await createFixture({ cards: 1, exercises: 1, reviewer: "student", reviewerRole, reviewerCapability: false });
      expect((await clients.student.rpc("has_topic_review_access", { target_topic_id: withoutFlag.topicId })).data).toBe(false);

      const withFlag = await createFixture({ cards: 1, exercises: 1, reviewer: "student", reviewerRole, reviewerCapability: true });
      expect((await clients.student.rpc("has_topic_review_access", { target_topic_id: withFlag.topicId })).data).toBe(true);
    }
  });

  it("keeps a current contributor excluded from review after first approval", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1, reviewer: "student" });
    // A third collaborator is needed so an approval is possible at all: the
    // teacher is excluded as the creator and the student as the contributor.
    expect((await admin.from("course_collaborators").insert({
      course_id: fixture.courseId,
      user_id: USERS.admin.id,
      role: "co_owner",
      added_by: USERS.teacher.id,
      can_review_topics: false,
    })).error).toBeNull();
    expect((await admin.from("topic_contributors").insert({
      topic_id: fixture.topicId,
      user_id: USERS.student.id,
      added_by_user_id: USERS.teacher.id,
    })).error).toBeNull();
    expect((await clients.teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId })).error).toBeNull();
    const submission = await getPendingSubmission(fixture.topicId);
    expect((await clients.admin.rpc("approve_topic_review", { p_submission_id: submission.id })).error).toBeNull();
    expect((await getTopic(fixture.topicId)).first_approved_at).toEqual(expect.any(String));

    // The student is still in the group, so the dynamic branch of D20 keeps
    // them out even though the historical branch has expired.
    expect((await clients.student.rpc("has_topic_review_access", { target_topic_id: fixture.topicId })).data).toBe(false);
  });
});
