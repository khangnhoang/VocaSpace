import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { parseAikenToGroups } from "@/lib/utils/aiken-parser";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEEDED_ADMIN_EMAIL = "admin@gmail.com";
const SEEDED_TEACHER_EMAIL = "teacher@gmail.com";
const SEEDED_STUDENT_EMAIL = "student@gmail.com";
const SEEDED_PASSWORD = "123123";
const SEEDED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let adminClient: SupabaseClient;
let teacherClient: SupabaseClient;
let studentClient: SupabaseClient;
const createdCourseIds = new Set<string>();

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chặn test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true nếu chắc chắn đang dùng test/dev DB.",
    );
  }

  if (!SUPABASE_URL.startsWith("http://127.0.0.1:54321")) {
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

async function createCourseTree(
  collaboratorRole?: "owner" | "co_owner" | "editor" | "previewer",
) {
  const suffix = randomUUID();
  const courseId = randomUUID();
  const chapterId = randomUUID();
  const topicId = randomUUID();

  const { error: courseError } = await supabaseAdmin.from("courses").insert({
    id: courseId,
    title: `Exercise RPC Test Course ${suffix}`,
    slug: `exercise-rpc-test-course-${suffix}`,
    description: "Course created by exercise authoring RPC integration test",
    price: 0,
    status: "published",
    removed_at: null,
  });

  if (courseError) throw new Error(`Không thể tạo course test: ${courseError.message}`);

  createdCourseIds.add(courseId);

  if (collaboratorRole) {
    const { error: collaboratorError } = await supabaseAdmin
      .from("course_collaborators")
      .upsert(
        {
          course_id: courseId,
          user_id: SEEDED_TEACHER_ID,
          role: collaboratorRole,
          added_by: SEEDED_TEACHER_ID,
        },
        { onConflict: "course_id,user_id" },
      );

    if (collaboratorError) {
      throw new Error(`Không thể tạo collaborator test: ${collaboratorError.message}`);
    }
  }

  const { error: chapterError } = await supabaseAdmin.from("chapters").insert({
    id: chapterId,
    course_id: courseId,
    title: `Exercise RPC Test Chapter ${suffix}`,
    order_index: 1,
    removed_at: null,
  });

  if (chapterError) throw new Error(`Không thể tạo chapter test: ${chapterError.message}`);

  const { error: topicError } = await supabaseAdmin.from("topics").insert({
    id: topicId,
    course_id: courseId,
    chapter_id: chapterId,
    title: `Exercise RPC Test Topic ${suffix}`,
    slug: `exercise-rpc-test-topic-${suffix}`,
    status: "published",
    order_index: 1,
    removed_at: null,
  });

  if (topicError) throw new Error(`Không thể tạo topic test: ${topicError.message}`);

  return { courseId, chapterId, topicId };
}

async function cleanupCourse(courseId: string) {
  const { data: exercises } = await supabaseAdmin
    .from("exercises")
    .select("id")
    .eq("course_id", courseId);

  const exerciseIds = exercises?.map((exercise) => exercise.id) ?? [];

  if (exerciseIds.length > 0) {
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id")
      .in("exercise_id", exerciseIds);

    const questionIds = questions?.map((question) => question.id) ?? [];

    if (questionIds.length > 0) {
      await supabaseAdmin.from("question_options").delete().in("question_id", questionIds);
    }

    await supabaseAdmin.from("questions").delete().in("exercise_id", exerciseIds);
    await supabaseAdmin.from("question_groups").delete().in("exercise_id", exerciseIds);
    await supabaseAdmin.from("exercises").delete().in("id", exerciseIds);
  }

  await supabaseAdmin.from("topics").delete().eq("course_id", courseId);
  await supabaseAdmin.from("chapters").delete().eq("course_id", courseId);
  await supabaseAdmin.from("course_collaborators").delete().eq("course_id", courseId);
  await supabaseAdmin.from("courses").delete().eq("id", courseId);
}

async function cleanupCreatedData() {
  const ids = Array.from(createdCourseIds);
  createdCourseIds.clear();

  for (const courseId of ids) {
    await cleanupCourse(courseId);
  }
}

function validNestedPayload(title = `Exercise ${randomUUID()}`) {
  return {
    title,
    part_type: "part7",
    groups: [
      {
        passage_text: "A short passage for testing.",
        questions: [
          {
            content: "Which option is correct?",
            explanation: "The first option is correct.",
            options: [
              { content: " Alpha ", is_correct: true },
              { content: " Beta ", is_correct: false },
              { content: "   ", is_correct: false },
              { content: " Gamma ", is_correct: false },
            ],
          },
        ],
      },
    ],
  };
}

async function createExerciseThroughRpc(topicId: string, title?: string) {
  const { data, error } = await teacherClient.rpc("create_exercise_with_content", {
    p_topic_id: topicId,
    p_payload: validNestedPayload(title),
  });

  if (error) throw new Error(`Không thể tạo exercise qua RPC: ${error.message}`);

  const exerciseId = (data as { exercise_id: string }).exercise_id;
  return exerciseId;
}

async function createExerciseTreeForCascade(courseId: string, topicId: string) {
  const exerciseId = randomUUID();
  const groupId = randomUUID();
  const groupedQuestionId = randomUUID();
  const rootQuestionId = randomUUID();
  const optionIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

  const { error: exerciseError } = await supabaseAdmin.from("exercises").insert({
    id: exerciseId,
    topic_id: topicId,
    course_id: courseId,
    title: `Cascade Exercise ${randomUUID()}`,
    part_type: "part7",
    order_index: 1,
    removed_at: null,
  });

  if (exerciseError) throw new Error(`Không thể tạo exercise test: ${exerciseError.message}`);

  const { error: groupError } = await supabaseAdmin.from("question_groups").insert({
    id: groupId,
    exercise_id: exerciseId,
    passage_text: "Cascade group",
    order_index: 1,
    removed_at: null,
  });

  if (groupError) throw new Error(`Không thể tạo group test: ${groupError.message}`);

  const { error: questionError } = await supabaseAdmin.from("questions").insert([
    {
      id: groupedQuestionId,
      exercise_id: exerciseId,
      course_id: courseId,
      group_id: groupId,
      content: "Grouped question",
      order_index: 1,
      removed_at: null,
    },
    {
      id: rootQuestionId,
      exercise_id: exerciseId,
      course_id: courseId,
      group_id: null,
      content: "Root question",
      order_index: 2,
      removed_at: null,
    },
  ]);

  if (questionError) throw new Error(`Không thể tạo question test: ${questionError.message}`);

  const { error: optionError } = await supabaseAdmin.from("question_options").insert([
    {
      id: optionIds[0],
      question_id: groupedQuestionId,
      content: "A",
      label: "A",
      is_correct: true,
      order_index: 0,
      removed_at: null,
    },
    {
      id: optionIds[1],
      question_id: groupedQuestionId,
      content: "B",
      label: "B",
      is_correct: false,
      order_index: 1,
      removed_at: null,
    },
    {
      id: optionIds[2],
      question_id: rootQuestionId,
      content: "C",
      label: "A",
      is_correct: true,
      order_index: 0,
      removed_at: null,
    },
    {
      id: optionIds[3],
      question_id: rootQuestionId,
      content: "D",
      label: "B",
      is_correct: false,
      order_index: 1,
      removed_at: null,
    },
  ]);

  if (optionError) throw new Error(`Không thể tạo option test: ${optionError.message}`);

  return { exerciseId, groupId, groupedQuestionId, rootQuestionId, optionIds };
}

async function getActiveExerciseCount(topicId: string, title: string) {
  const { count, error } = await supabaseAdmin
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId)
    .eq("title", title);

  if (error) throw new Error(`Không thể đếm exercise test: ${error.message}`);

  return count ?? 0;
}

function questionPayload(content = "Which option is correct?") {
  return {
    content,
    options: [
      { content: "Correct", is_correct: true },
      { content: "Wrong", is_correct: false },
    ],
  };
}

function groupedToeicPayload(
  part_type: string,
  group: Record<string, unknown>,
  title = `TOEIC Context ${randomUUID()}`,
) {
  return {
    title,
    part_type,
    groups: [
      {
        ...group,
        questions: [questionPayload()],
      },
    ],
  };
}

function part5Payload(title = `Part 5 ${randomUUID()}`) {
  return {
    title,
    part_type: "part5",
    questions: [questionPayload()],
  };
}

async function expectRpcRejectsWithoutPartialInsert(
  topicId: string,
  payload: Record<string, unknown>,
  expectedCode: string,
) {
  const { error } = await teacherClient.rpc("create_exercise_with_content", {
    p_topic_id: topicId,
    p_payload: payload,
  });

  expect(error?.message).toContain(expectedCode);
  expect(await getActiveExerciseCount(topicId, String(payload.title))).toBe(0);
}

describe.sequential("exercise authoring RPC integration", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();

    adminClient = await signInSeededUser(SEEDED_ADMIN_EMAIL);
    teacherClient = await signInSeededUser(SEEDED_TEACHER_EMAIL);
    studentClient = await signInSeededUser(SEEDED_STUDENT_EMAIL);
  });

  afterEach(async () => {
    await cleanupCreatedData();
  });

  afterAll(async () => {
    await cleanupCreatedData();
    await adminClient?.auth.signOut();
    await teacherClient?.auth.signOut();
    await studentClient?.auth.signOut();
  });

  it("create_exercise_with_content creates nested content with zero-based option order and labels", async () => {
    const { topicId } = await createCourseTree("owner");
    const exerciseId = await createExerciseThroughRpc(topicId);

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id, content, question_options(id, content, label, order_index)")
      .eq("exercise_id", exerciseId)
      .order("order_index", { ascending: true })
      .single();

    expect(questionsError).toBeNull();
    expect(questions?.content).toBe("Which option is correct?");

    const options = (questions?.question_options ?? [])
      .slice()
      .sort((a, b) => a.order_index - b.order_index);

    expect(options.map((option) => option.content)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(options.map((option) => option.order_index)).toEqual([0, 1, 2]);
    expect(options.map((option) => option.label)).toEqual(["A", "B", "C"]);
  });

  it("create_exercise_with_content rejects invalid payloads without partial inserts", async () => {
    const { topicId } = await createCourseTree("owner");
    const title = `Invalid Payload ${randomUUID()}`;

    const { error } = await teacherClient.rpc("create_exercise_with_content", {
      p_topic_id: topicId,
      p_payload: {
        title,
        part_type: "part7",
        groups: [{ passage_text: "Group without valid question", questions: [] }],
      },
    });

    expect(error?.message).toContain("GROUP_REQUIRES_QUESTION");
    expect(await getActiveExerciseCount(topicId, title)).toBe(0);
  });

  it("create_exercise_with_content rejects grouped TOEIC parts without required context", async () => {
    const { topicId } = await createCourseTree("owner");

    await expectRpcRejectsWithoutPartialInsert(
      topicId,
      groupedToeicPayload("part7", {}, `Part 7 Missing Passage ${randomUUID()}`),
      "GROUP_REQUIRES_PASSAGE",
    );
    await expectRpcRejectsWithoutPartialInsert(
      topicId,
      groupedToeicPayload("part6", {}, `Part 6 Missing Passage ${randomUUID()}`),
      "GROUP_REQUIRES_PASSAGE",
    );
    await expectRpcRejectsWithoutPartialInsert(
      topicId,
      groupedToeicPayload("part1", {}, `Part 1 Missing Media ${randomUUID()}`),
      "GROUP_REQUIRES_IMAGE",
    );

    for (const partType of ["part2", "part3", "part4"]) {
      await expectRpcRejectsWithoutPartialInsert(
        topicId,
        groupedToeicPayload(partType, {}, `${partType} Missing Audio ${randomUUID()}`),
        "GROUP_REQUIRES_AUDIO",
      );
    }
  });

  it("create_exercise_with_content inserts valid TOEIC part context payloads", async () => {
    const { topicId } = await createCourseTree("owner");
    const payloads = [
      groupedToeicPayload("part1", {
        image_url: "https://placehold.co/600x400.png",
        audio_url: "https://example.com/listening.mp3",
      }),
      groupedToeicPayload("part2", { audio_url: "https://example.com/listening.mp3" }),
      groupedToeicPayload("part3", { audio_url: "https://example.com/listening.mp3" }),
      groupedToeicPayload("part4", { audio_url: "https://example.com/listening.mp3" }),
      groupedToeicPayload("part6", { passage_text: "A reading passage." }),
      groupedToeicPayload("part7", { passage_text: "A reading passage." }),
      part5Payload(),
    ];

    for (const payload of payloads) {
      const { error } = await teacherClient.rpc("create_exercise_with_content", {
        p_topic_id: topicId,
        p_payload: payload,
      });

      expect(error).toBeNull();
      expect(await getActiveExerciseCount(topicId, payload.title)).toBe(1);
    }
  });

  it("bulk AIKEN Part 5 payload creates standalone questions through the RPC flow", async () => {
    const { topicId } = await createCourseTree("owner");
    const title = `Bulk Part 5 ${randomUUID()}`;
    const groups = parseAikenToGroups(`Q: What is the correct answer?
A. First option
B. Second option
C. Third option
D. Fourth option
ANSWER: B

Q2: Choose the best response.
A. Option A
B. Option B
C. Option C
D. Option D
ANSWER: D`);

    const { data, error } = await teacherClient.rpc("create_exercise_with_content", {
      p_topic_id: topicId,
      p_payload: {
        title,
        part_type: "part5",
        questions: groups.flatMap((group) => group.questions),
      },
    });

    expect(error).toBeNull();
    const exerciseId = (data as { exercise_id: string }).exercise_id;
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, group_id, question_options(id)")
      .eq("exercise_id", exerciseId);

    expect(questions).toHaveLength(2);
    expect(questions?.every((question) => question.group_id === null)).toBe(true);
    expect(await getActiveExerciseCount(topicId, title)).toBe(1);
  });

  it("invalid bulk AIKEN parser errors stop before RPC insert", async () => {
    const { topicId } = await createCourseTree("owner");
    const title = `Invalid Bulk Parse ${randomUUID()}`;

    expect(() =>
      parseAikenToGroups(`Q: What is the correct answer?
A. First option
B. Second option`),
    ).toThrow();
    expect(await getActiveExerciseCount(topicId, title)).toBe(0);
  });

  it("bulk AIKEN grouped payload follows TOEIC context rules without partial inserts", async () => {
    const { topicId } = await createCourseTree("owner");
    const groups = parseAikenToGroups(`Q: What is the correct answer?
A. First option
B. Second option
C. Third option
D. Fourth option
ANSWER: B`);

    await expectRpcRejectsWithoutPartialInsert(
      topicId,
      {
        title: `Bulk Part 7 Missing Passage ${randomUUID()}`,
        part_type: "part7",
        groups,
      },
      "GROUP_REQUIRES_PASSAGE",
    );

    await expectRpcRejectsWithoutPartialInsert(
      topicId,
      {
        title: `Bulk Part 1 Missing Media ${randomUUID()}`,
        part_type: "part1",
        groups,
      },
      "GROUP_REQUIRES_IMAGE",
    );
  });

  it("create_exercise_with_content rejects unauthorized users", async () => {
    const { topicId } = await createCourseTree();

    const { error } = await studentClient.rpc("create_exercise_with_content", {
      p_topic_id: topicId,
      p_payload: validNestedPayload(),
    });

    expect(error?.message).toContain("COURSE_EDIT_FORBIDDEN");
  });

  it("sync_question_with_options updates, inserts, soft-deletes, and reorders options", async () => {
    const { topicId } = await createCourseTree("owner");
    const exerciseId = await createExerciseThroughRpc(topicId);

    const { data: question } = await supabaseAdmin
      .from("questions")
      .select("id, question_options(id, content, order_index)")
      .eq("exercise_id", exerciseId)
      .single();

    const existingOptions = (question?.question_options ?? [])
      .slice()
      .sort((a, b) => a.order_index - b.order_index);

    const { data, error } = await teacherClient.rpc("sync_question_with_options", {
      p_question_id: question!.id,
      p_content: " Updated question content ",
      p_explanation: " Updated explanation ",
      p_options: [
        { id: existingOptions[1].id, content: " Second is now A ", is_correct: true },
        { content: " Brand new option ", is_correct: false },
        { id: existingOptions[0].id, content: " First moved to C ", is_correct: false },
      ],
    });

    expect(error).toBeNull();
    expect((data as { question_id: string }).question_id).toBe(question!.id);

    const { data: updatedQuestion } = await supabaseAdmin
      .from("questions")
      .select("content, explanation, question_options(id, content, label, order_index, removed_at)")
      .eq("id", question!.id)
      .single();

    expect(updatedQuestion?.content).toBe("Updated question content");
    expect(updatedQuestion?.explanation).toBe("Updated explanation");

    const activeOptions = (updatedQuestion?.question_options ?? [])
      .filter((option) => option.removed_at === null)
      .sort((a, b) => a.order_index - b.order_index);
    const removedOptions = (updatedQuestion?.question_options ?? []).filter(
      (option) => option.removed_at !== null,
    );

    expect(activeOptions.map((option) => option.content)).toEqual([
      "Second is now A",
      "Brand new option",
      "First moved to C",
    ]);
    expect(activeOptions.map((option) => option.label)).toEqual(["A", "B", "C"]);
    expect(activeOptions.map((option) => option.order_index)).toEqual([0, 1, 2]);
    expect(removedOptions).toHaveLength(1);
  });

  it("sync_question_with_options rejects invalid option payloads and rolls back partial changes", async () => {
    const { topicId } = await createCourseTree("owner");
    const exerciseId = await createExerciseThroughRpc(topicId);

    const { data: question } = await supabaseAdmin
      .from("questions")
      .select("id, content, question_options(id, content, removed_at, order_index)")
      .eq("exercise_id", exerciseId)
      .single();

    const existingOptions = (question?.question_options ?? [])
      .slice()
      .sort((a, b) => a.order_index - b.order_index);
    const originalSecondOptionId = existingOptions[1].id;

    const { error } = await teacherClient.rpc("sync_question_with_options", {
      p_question_id: question!.id,
      p_content: "Should roll back",
      p_explanation: "Should roll back",
      p_options: [
        { id: existingOptions[0].id, content: "Changed before failure", is_correct: true },
        { id: randomUUID(), content: "Bogus option id", is_correct: false },
      ],
    });

    expect(error?.message).toContain("OPTION_NOT_FOUND");

    const { data: afterFailure } = await supabaseAdmin
      .from("questions")
      .select("content, explanation, question_options(id, content, removed_at)")
      .eq("id", question!.id)
      .single();

    const secondOption = afterFailure?.question_options.find(
      (option) => option.id === originalSecondOptionId,
    );

    expect(afterFailure?.content).toBe(question?.content);
    expect(secondOption?.removed_at).toBeNull();
    expect(afterFailure?.question_options.some((option) => option.content === "Changed before failure")).toBe(false);
  });

  it("sync_question_with_options rejects fewer than 2 valid options and no correct option", async () => {
    const { topicId } = await createCourseTree("owner");
    const exerciseId = await createExerciseThroughRpc(topicId);

    const { data: question } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("exercise_id", exerciseId)
      .single();

    const tooFew = await teacherClient.rpc("sync_question_with_options", {
      p_question_id: question!.id,
      p_content: "Question",
      p_explanation: null,
      p_options: [{ content: "Only one", is_correct: true }],
    });

    expect(tooFew.error?.message).toContain("QUESTION_REQUIRES_TWO_OPTIONS");

    const noCorrect = await teacherClient.rpc("sync_question_with_options", {
      p_question_id: question!.id,
      p_content: "Question",
      p_explanation: null,
      p_options: [
        { content: "A", is_correct: false },
        { content: "B", is_correct: false },
      ],
    });

    expect(noCorrect.error?.message).toContain("QUESTION_REQUIRES_CORRECT_OPTION");
  });

  it("soft_delete_exercise_cascade soft-deletes exercise descendants with one timestamp", async () => {
    const { courseId, topicId } = await createCourseTree("owner");
    const tree = await createExerciseTreeForCascade(courseId, topicId);

    const { data, error } = await teacherClient.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: tree.exerciseId,
    });

    expect(error).toBeNull();
    expect((data as { exercise_id: string }).exercise_id).toBe(tree.exerciseId);

    const { data: exercise } = await supabaseAdmin
      .from("exercises")
      .select("removed_at")
      .eq("id", tree.exerciseId)
      .single();
    const { data: groups } = await supabaseAdmin
      .from("question_groups")
      .select("removed_at")
      .eq("exercise_id", tree.exerciseId);
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, removed_at")
      .eq("exercise_id", tree.exerciseId);
    const { data: options } = await supabaseAdmin
      .from("question_options")
      .select("removed_at")
      .in("question_id", questions?.map((question) => question.id) ?? []);

    const removedAtValues = [
      exercise?.removed_at,
      ...(groups ?? []).map((group) => group.removed_at),
      ...(questions ?? []).map((question) => question.removed_at),
      ...(options ?? []).map((option) => option.removed_at),
    ];

    expect(removedAtValues.every(Boolean)).toBe(true);
    expect(new Set(removedAtValues).size).toBe(1);
  });

  it("soft_delete_exercise_cascade rejects unauthenticated and unauthorized users", async () => {
    const { courseId, topicId } = await createCourseTree();
    const tree = await createExerciseTreeForCascade(courseId, topicId);
    const anonymousClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const unauthenticated = await anonymousClient.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: tree.exerciseId,
    });
    expect(unauthenticated.error?.message).toContain("AUTH_REQUIRED");

    const unauthorized = await studentClient.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: tree.exerciseId,
    });
    expect(unauthorized.error?.message).toContain("COURSE_EDIT_FORBIDDEN");

    const { data: exercise } = await supabaseAdmin
      .from("exercises")
      .select("removed_at")
      .eq("id", tree.exerciseId)
      .single();
    expect(exercise?.removed_at).toBeNull();
  });

  it.each(["owner", "editor", "co_owner"] as const)(
    "soft_delete_exercise_cascade allows teacher collaborator role %s",
    async (role) => {
      const { courseId, topicId } = await createCourseTree(role);
      const tree = await createExerciseTreeForCascade(courseId, topicId);

      const { error } = await teacherClient.rpc("soft_delete_exercise_cascade", {
        p_exercise_id: tree.exerciseId,
      });

      expect(error).toBeNull();
    },
  );

  it("soft_delete_exercise_cascade allows admin without course collaborator row", async () => {
    const { courseId, topicId } = await createCourseTree();
    const tree = await createExerciseTreeForCascade(courseId, topicId);

    const { error } = await adminClient.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: tree.exerciseId,
    });

    expect(error).toBeNull();
  });

  it("getExercisesByTopicId filters soft-deleted exercises and nested removed rows", async () => {
    const { courseId, topicId } = await createCourseTree("owner");
    const deletedTree = await createExerciseTreeForCascade(courseId, topicId);
    await teacherClient.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: deletedTree.exerciseId,
    });

    const activeTree = await createExerciseTreeForCascade(courseId, topicId);
    await supabaseAdmin
      .from("question_groups")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", activeTree.groupId);
    await supabaseAdmin
      .from("question_options")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", activeTree.optionIds[2]);

    vi.resetModules();
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: async () => supabaseAdmin,
    }));
    const { getExercisesByTopicId } = await import("@/app/actions/exercise");

    const result = await getExercisesByTopicId(topicId);

    expect(result.error).toBeUndefined();
    expect(result.data?.map((exercise) => exercise.id)).not.toContain(deletedTree.exerciseId);
    expect(result.data?.map((exercise) => exercise.id)).toContain(activeTree.exerciseId);

    const activeExercise = result.data?.find(
      (exercise) => exercise.id === activeTree.exerciseId,
    );

    expect(activeExercise?.groups).toHaveLength(0);
    expect(activeExercise?.questions?.[0]?.options.map((option) => option.id)).not.toContain(
      activeTree.optionIds[2],
    );

    vi.doUnmock("@/utils/supabase/server");
  });
});
