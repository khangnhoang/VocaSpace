import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra C1 của D3 — memory check là `activity_stage` riêng, không tính là exercise và phải trả lời được trước khi topic rời draft.
// - Loại test: real local Supabase integration/RLS/RPC.
// - Đối tượng: ràng buộc bảng `exercises`, `d3_add_memory_check_question`, `request_topic_review`, `approve_topic_review` và `get_topic_workflow_state`.
// - Case thành công:
//   - Thêm câu đầu tiên tạo bộ memory check; câu sau nối vào đúng bộ đó với thứ tự và nhãn option tăng dần.
//   - Topic có card, exercise và memory check hợp lệ gửi duyệt được; topic không có memory check giữ luồng cũ.
// - Case thất bại:
//   - Topic chỉ có memory check bị `TOPIC_REVIEW_NOT_READY`; câu memory check thiếu option đúng bị `TOPIC_MEMORY_CHECK_NOT_READY` ở request và approve.
//   - Payload thiếu option, thiếu đáp án đúng, topic pending, outsider và published chưa xác nhận đều bị từ chối và không để lại row nào.
// - Bảo mật/phân quyền:
//   - Mutation dùng authority D1 (`d1_prepare_topic_content_mutation`); published được hạ về draft trong cùng transaction.
// - Invariant cần giữ:
//   - Tối đa một bộ memory check active mỗi topic; memory check không có part_type, exercise phải có part_type; stage không đổi sau khi tạo; exercise cũ mặc định stage `exercise`.
// - Kết quả verify gần nhất: passed (13 test) bằng `npm.cmd run test:integration -- __tests__/integration/memory-check-stage.test.ts`.
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

const SEEDED_PART5_EXERCISE_ID = "66666666-6666-4666-8666-666666666669";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const courseIds = new Set<string>();

let teacher: SupabaseClient;
let student: SupabaseClient;

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
  status?: "draft" | "published";
} = {}) {
  const suffix = randomUUID();
  const { data: course, error: courseError } = await admin.from("courses").insert({
    title: `D3 memory course ${suffix}`,
    slug: `d3-memory-course-${suffix}`,
    description: "D3 memory check integration fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  if (courseError || !course) throw new Error(`Course fixture failed: ${courseError?.message}`);
  courseIds.add(course.id);

  const { error: collaboratorError } = await admin.from("course_collaborators").insert([
    { course_id: course.id, user_id: USERS.teacher.id, role: "owner", added_by: USERS.admin.id, can_review_topics: false },
    { course_id: course.id, user_id: USERS.admin.id, role: "editor", added_by: USERS.admin.id, can_review_topics: true },
  ]);
  if (collaboratorError) throw new Error(`Collaborator fixture failed: ${collaboratorError.message}`);

  const { data: chapter, error: chapterError } = await admin.from("chapters").insert({
    course_id: course.id,
    created_by_user_id: USERS.teacher.id,
    title: "D3 memory chapter",
    order_index: 1,
  }).select("id").single();
  if (chapterError || !chapter) throw new Error(`Chapter fixture failed: ${chapterError?.message}`);

  const { data: topic, error: topicError } = await admin.from("topics").insert({
    course_id: course.id,
    chapter_id: chapter.id,
    title: "D3 memory topic",
    status: "draft",
    order_index: 1,
    original_creator_user_id: USERS.teacher.id,
    responsible_author_user_id: USERS.teacher.id,
  }).select("id").single();
  if (topicError || !topic) throw new Error(`Topic fixture failed: ${topicError?.message}`);

  if ((options.cards ?? 0) > 0) {
    const { error } = await admin.from("cards").insert(Array.from({ length: options.cards ?? 0 }, (_, index) => ({
      topic_id: topic.id,
      front_content: { word: `card-${index}` },
      back_content: { translation: `translation-${index}` },
      order_index: index,
    })));
    if (error) throw new Error(`Card fixture failed: ${error.message}`);
  }
  if ((options.exercises ?? 0) > 0) {
    const { error } = await admin.from("exercises").insert(Array.from({ length: options.exercises ?? 0 }, (_, index) => ({
      topic_id: topic.id,
      course_id: course.id,
      title: `exercise-${index}`,
      part_type: "part5",
      order_index: index + 1,
    })));
    if (error) throw new Error(`Exercise fixture failed: ${error.message}`);
  }

  return { courseId: course.id as string, topicId: topic.id as string };
}

async function setTopicStatus(topicId: string, status: "draft" | "pending" | "published") {
  const patch = status === "published" ? { status, first_approved_at: new Date().toISOString() } : { status };
  const { error } = await admin.from("topics").update(patch).eq("id", topicId);
  if (error) throw new Error(`Topic status fixture failed: ${error.message}`);
}

function memoryQuestion(content = "\"progress\" nghĩa là gì?") {
  return {
    content,
    explanation: "progress = tiến độ.",
    options: [
      { content: "tiến độ", is_correct: true },
      { content: "tiền lương", is_correct: false },
      { content: "  ", is_correct: false },
      { content: "tiến sĩ", is_correct: false },
    ],
  };
}

async function addMemoryQuestion(client: SupabaseClient, topicId: string, question: unknown, confirm = false) {
  return client.rpc("d3_add_memory_check_question", {
    p_topic_id: topicId,
    p_question: question,
    p_confirm_published: confirm,
  });
}

async function memoryRows(topicId: string) {
  const { data: exercises, error } = await admin.from("exercises")
    .select("id, part_type, activity_stage, title, removed_at")
    .eq("topic_id", topicId).eq("activity_stage", "memory_check");
  if (error) throw new Error(`Memory exercise read failed: ${error.message}`);
  const ids = (exercises ?? []).map((row) => row.id as string);
  const { data: questions, error: questionError } = ids.length === 0
    ? { data: [], error: null }
    : await admin.from("questions")
      .select("id, exercise_id, group_id, content, order_index, question_options(label, content, is_correct, order_index)")
      .in("exercise_id", ids).order("order_index");
  if (questionError) throw new Error(`Memory question read failed: ${questionError.message}`);
  return { exercises: exercises ?? [], questions: questions ?? [] };
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

describe.sequential("D3 memory check stage", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    teacher = await signIn(USERS.teacher.email);
    student = await signIn(USERS.student.email);
  });

  afterEach(cleanup);

  it("keeps existing exercises on the exercise stage", async () => {
    const { data, error } = await admin.from("exercises")
      .select("activity_stage, part_type").eq("id", SEEDED_PART5_EXERCISE_ID).single();
    expect(error).toBeNull();
    expect(data).toEqual({ activity_stage: "exercise", part_type: "part5" });
  });

  it("creates the memory check set on the first question and appends later questions to it", async () => {
    const fixture = await createFixture();

    const first = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion("Câu 1"));
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ created_memory_check: true, topic_status: "draft" });

    const second = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion("Câu 2"));
    expect(second.error).toBeNull();
    expect(second.data).toMatchObject({ created_memory_check: false, exercise_id: first.data.exercise_id });

    const rows = await memoryRows(fixture.topicId);
    expect(rows.exercises).toEqual([
      expect.objectContaining({ id: first.data.exercise_id, part_type: null, activity_stage: "memory_check", removed_at: null }),
    ]);
    expect(rows.questions.map((row) => [row.content, row.order_index, row.group_id])).toEqual([
      ["Câu 1", 1, null],
      ["Câu 2", 2, null],
    ]);
    const options = [...rows.questions[0].question_options].sort((a, b) => a.order_index - b.order_index);
    expect(options.map((option) => [option.label, option.content, option.is_correct])).toEqual([
      ["A", "tiến độ", true],
      ["B", "tiền lương", false],
      ["C", "tiến sĩ", false],
    ]);
  });

  it("never appends memory questions to an exercise-stage exercise", async () => {
    const fixture = await createFixture({ exercises: 1 });
    const result = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion());
    expect(result.error).toBeNull();

    const { data: regular } = await admin.from("exercises")
      .select("id").eq("topic_id", fixture.topicId).eq("activity_stage", "exercise").single();
    expect(result.data.exercise_id).not.toBe(regular?.id);
    const { data: regularQuestions } = await admin.from("questions").select("id").eq("exercise_id", regular?.id);
    expect(regularQuestions).toEqual([]);
  });

  it.each([
    ["one clean option", { content: "Q", options: [{ content: "A", is_correct: true }, { content: " ", is_correct: false }] }, "QUESTION_REQUIRES_TWO_OPTIONS"],
    ["no correct option", { content: "Q", options: [{ content: "A", is_correct: false }, { content: "B", is_correct: false }] }, "QUESTION_REQUIRES_CORRECT_OPTION"],
    ["blank content", { content: "  ", options: [{ content: "A", is_correct: true }, { content: "B", is_correct: false }] }, "QUESTION_CONTENT_REQUIRED"],
    ["non-object payload", [], "QUESTION_PAYLOAD_INVALID"],
  ] as const)("rejects %s without leaving rows", async (_label, payload, code) => {
    const fixture = await createFixture();
    expectRpcError(await addMemoryQuestion(teacher, fixture.topicId, payload), code);
    expect(await memoryRows(fixture.topicId)).toEqual({ exercises: [], questions: [] });
  });

  it("applies D1 authority: outsider and pending are denied, published needs confirmation and is demoted", async () => {
    const fixture = await createFixture();
    expectRpcError(await addMemoryQuestion(student, fixture.topicId, memoryQuestion()), "COURSE_EDIT_FORBIDDEN");

    await setTopicStatus(fixture.topicId, "pending");
    expectRpcError(await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion()), "TOPIC_PENDING_FROZEN");

    await setTopicStatus(fixture.topicId, "published");
    expectRpcError(await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion()), "TOPIC_PUBLISHED_CONFIRM_REQUIRED");
    expect(await memoryRows(fixture.topicId)).toEqual({ exercises: [], questions: [] });

    const confirmed = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion(), true);
    expect(confirmed.error).toBeNull();
    expect(confirmed.data).toMatchObject({ topic_status: "draft" });
    const { data: topic } = await admin.from("topics").select("status").eq("id", fixture.topicId).single();
    expect(topic?.status).toBe("draft");
  });

  it("rolls back the published demotion when the question is invalid", async () => {
    const fixture = await createFixture();
    await setTopicStatus(fixture.topicId, "published");
    expectRpcError(
      await addMemoryQuestion(teacher, fixture.topicId, { content: "Q", options: [{ content: "A", is_correct: true }] }, true),
      "QUESTION_REQUIRES_TWO_OPTIONS",
    );
    const { data: topic } = await admin.from("topics").select("status").eq("id", fixture.topicId).single();
    expect(topic?.status).toBe("published");
  });

  it("enforces stage/part_type pairing, one active set per topic and immutable stage", async () => {
    const fixture = await createFixture({ exercises: 1 });
    const created = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion());
    expect(created.error).toBeNull();

    const second = await admin.from("exercises").insert({
      topic_id: fixture.topicId, course_id: fixture.courseId, title: "Second", part_type: null, activity_stage: "memory_check",
    });
    expect(second.error?.message).toContain("exercises_one_active_memory_check_per_topic");

    const withPart = await admin.from("exercises").insert({
      topic_id: fixture.topicId, course_id: fixture.courseId, title: "Bad", part_type: "part5", activity_stage: "memory_check",
    });
    expect(withPart.error?.message).toContain("exercises_stage_part_type_check");

    const withoutPart = await admin.from("exercises").insert({
      topic_id: fixture.topicId, course_id: fixture.courseId, title: "Bad", part_type: null,
    });
    expect(withoutPart.error?.message).toContain("exercises_stage_part_type_check");

    const unknownStage = await admin.from("exercises").insert({
      topic_id: fixture.topicId, course_id: fixture.courseId, title: "Bad", part_type: "part5", activity_stage: "warmup",
    });
    expect(unknownStage.error?.message).toContain("exercises_activity_stage_check");

    const flip = await admin.from("exercises")
      .update({ activity_stage: "exercise", part_type: "part5" }).eq("id", created.data.exercise_id);
    expect(flip.error?.message).toContain("EXERCISE_ACTIVITY_STAGE_IMMUTABLE");
  });

  it("keeps memory questions standalone so none can drop out of the gate through a group", async () => {
    const fixture = await createFixture({ exercises: 1 });
    const created = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion());
    expect(created.error).toBeNull();

    const memoryGroup = await teacher.from("question_groups").insert({
      exercise_id: created.data.exercise_id, passage_text: "Bypass", order_index: 0,
    });
    expect(memoryGroup.error?.message).toContain("MEMORY_CHECK_GROUP_NOT_ALLOWED");

    // Group hợp lệ của exercise thường vẫn không gắn được vào câu memory check.
    const { data: exercise } = await admin.from("exercises")
      .select("id").eq("topic_id", fixture.topicId).eq("activity_stage", "exercise").single();
    const exerciseGroup = await admin.from("question_groups")
      .insert({ exercise_id: exercise!.id, passage_text: "Part 6", order_index: 0 }).select("id").single();
    expect(exerciseGroup.error).toBeNull();

    const attach = await teacher.from("questions")
      .update({ group_id: exerciseGroup.data!.id }).eq("id", created.data.question_id);
    expect(attach.error?.message).toContain("MEMORY_CHECK_GROUP_NOT_ALLOWED");

    const insertGrouped = await teacher.from("questions").insert({
      course_id: fixture.courseId, exercise_id: created.data.exercise_id, group_id: exerciseGroup.data!.id,
      content: "Grouped memory?", order_index: 5,
    });
    expect(insertGrouped.error?.message).toContain("MEMORY_CHECK_GROUP_NOT_ALLOWED");

    // Chuyển row sẵn có sang bộ memory check qua `exercise_id` cũng bị chặn.
    const moveGroup = await teacher.from("question_groups")
      .update({ exercise_id: created.data.exercise_id }).eq("id", exerciseGroup.data!.id);
    expect(moveGroup.error?.message).toContain("MEMORY_CHECK_GROUP_NOT_ALLOWED");

    const groupedQuestion = await admin.from("questions").insert({
      course_id: fixture.courseId, exercise_id: exercise!.id, group_id: exerciseGroup.data!.id,
      content: "Part 6 question?", order_index: 0,
    }).select("id").single();
    expect(groupedQuestion.error).toBeNull();
    const moveQuestion = await teacher.from("questions")
      .update({ exercise_id: created.data.exercise_id }).eq("id", groupedQuestion.data!.id);
    expect(moveQuestion.error?.message).toContain("MEMORY_CHECK_GROUP_NOT_ALLOWED");

    const workflow = await teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(workflow.data).toMatchObject({ activeMemoryCheckQuestionCount: 1 });
  });

  it("does not count a memory check as an exercise for review readiness", async () => {
    const fixture = await createFixture({ cards: 1 });
    expect((await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion())).error).toBeNull();

    expectRpcError(await teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId }), "TOPIC_REVIEW_NOT_READY");
    const workflow = await teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(workflow.error).toBeNull();
    expect(workflow.data).toMatchObject({
      activeExerciseCount: 0,
      activeMemoryCheckQuestionCount: 1,
      isMemoryCheckReady: true,
      isReady: false,
      canRequestReview: false,
    });
  });

  it("keeps the old readiness for a topic without a memory check", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1 });
    const workflow = await teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(workflow.data).toMatchObject({
      activeMemoryCheckQuestionCount: 0,
      isMemoryCheckReady: true,
      isReady: true,
      canRequestReview: true,
    });
    const request = await teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expect(request.error).toBeNull();
  });

  it("blocks request and approve while a memory question has no correct option", async () => {
    const fixture = await createFixture({ cards: 1, exercises: 1 });
    const created = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion());
    expect(created.error).toBeNull();

    const breakAnswerKey = (isCorrect: boolean) =>
      admin.from("question_options").update({ is_correct: isCorrect }).eq("question_id", created.data.question_id).eq("label", "A");

    expect((await breakAnswerKey(false)).error).toBeNull();
    expectRpcError(await teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId }), "TOPIC_MEMORY_CHECK_NOT_READY");
    const workflow = await teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(workflow.data).toMatchObject({ isMemoryCheckReady: false, isReady: false, canRequestReview: false });

    expect((await breakAnswerKey(true)).error).toBeNull();
    const request = await teacher.rpc("request_topic_review", { p_topic_id: fixture.topicId });
    expect(request.error).toBeNull();

    // Đáp án bị phá khi đang pending (chỉ service role làm được) vẫn không lọt qua approve.
    expect((await breakAnswerKey(false)).error).toBeNull();
    const reviewer = await signIn(USERS.admin.email);
    const { data: submission } = await admin.from("topic_review_submissions")
      .select("id").eq("topic_id", fixture.topicId).eq("status", "pending").single();
    expectRpcError(
      await reviewer.rpc("approve_topic_review", { p_submission_id: submission?.id }),
      "TOPIC_MEMORY_CHECK_NOT_READY",
    );
    const { data: topic } = await admin.from("topics").select("status").eq("id", fixture.topicId).single();
    expect(topic?.status).toBe("pending");
  });

  it("edits and deletes memory questions through the existing question RPCs", async () => {
    const fixture = await createFixture();
    const first = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion("Câu 1"));
    const second = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion("Câu 2"));
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const { data: existing } = await admin.from("question_options")
      .select("id, content, is_correct").eq("question_id", first.data.question_id).order("order_index");
    const edit = await teacher.rpc("sync_question_with_options", {
      p_question_id: first.data.question_id,
      p_content: "Câu 1 đã sửa",
      p_explanation: null,
      p_options: (existing ?? []).map((option) => ({ ...option, is_correct: option.content === "tiền lương" })),
      p_confirm_published: false,
    });
    expect(edit.error).toBeNull();
    let rows = await memoryRows(fixture.topicId);
    expect(rows.questions[0].content).toBe("Câu 1 đã sửa");
    expect(rows.questions[0].question_options.filter((option) => option.is_correct).map((option) => option.content))
      .toEqual(["tiền lương"]);

    const removeSecond = await teacher.rpc("d1_delete_question", { p_question_id: second.data.question_id, p_confirm_published: false });
    expect(removeSecond.error).toBeNull();
    expectRpcError(
      await teacher.rpc("d1_delete_question", { p_question_id: first.data.question_id, p_confirm_published: false }),
      "EXERCISE_LAST_QUESTION",
    );

    // Gỡ câu cuối = gỡ cả bộ memory check; sau đó teacher tạo được bộ mới.
    const removeSet = await teacher.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: first.data.exercise_id,
      p_confirm_published: false,
    });
    expect(removeSet.error).toBeNull();
    const workflow = await teacher.rpc("get_topic_workflow_state", { p_topic_id: fixture.topicId });
    expect(workflow.data).toMatchObject({ activeMemoryCheckQuestionCount: 0, isMemoryCheckReady: true });

    const recreated = await addMemoryQuestion(teacher, fixture.topicId, memoryQuestion("Câu mới"));
    expect(recreated.error).toBeNull();
    expect(recreated.data).toMatchObject({ created_memory_check: true });
    expect(recreated.data.exercise_id).not.toBe(first.data.exercise_id);
    rows = await memoryRows(fixture.topicId);
    expect(rows.exercises.filter((row) => row.removed_at === null)).toHaveLength(1);
  });
});
