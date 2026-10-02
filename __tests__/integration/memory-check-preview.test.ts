import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  answerPublicCoursePreviewQuestion,
  getPublicCoursePreview,
} from "@/app/actions/public-course-preview";

const privileged = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => privileged.client,
}));

// Test plan:
// - Mục tiêu: D3 C5 — public Preview vẫn hợp lệ khi topic có memory check (phương án mặc định §5.5).
// - Loại test: local Supabase RPC integration + Server Action parse qua schema preview thật.
// - Thành công: RPC trả `activity_stage` cho từng exercise, memory check có `part_type` null; action parse được.
// - Bảo mật: payload không có `is_correct`/learning state; câu memory chấm stateless theo option đang chọn.
// - Thất bại: bỏ đánh dấu preview hoặc vượt quota thì read và answer của memory check đều unavailable.
// - Invariant: không ghi user_question_answers hay user_topic_progress cho bất kỳ user nào.
// - Kết quả verify gần nhất: xem plan D3 §10.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEEDED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
privileged.client = supabaseAdmin;

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Blocked DB integration test; explicitly allow local DB integration first.");
  }
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error(`Blocked DB integration test because Supabase is not local: ${SUPABASE_URL}`);
  }
}

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

const suffix = randomUUID();
const ids = {
  course: randomUUID(),
  chapter: randomUUID(),
  topics: Array.from({ length: 5 }, () => randomUUID()),
  exercise: randomUUID(),
  memory: randomUUID(),
  exerciseQuestion: randomUUID(),
  memoryQuestion: randomUUID(),
  exerciseOption: randomUUID(),
  memoryRight: randomUUID(),
  memoryAlsoRight: randomUUID(),
  memoryWrong: randomUUID(),
};
const courseSlug = `memory-preview-${suffix}`;
const topicSlugs = ids.topics.map((_, index) => `memory-preview-topic-${index}-${suffix}`);

async function createFixture() {
  throwIfError("create course", (await supabaseAdmin.from("courses").insert({
    id: ids.course,
    title: `Memory Preview ${suffix}`,
    slug: courseSlug,
    description: "D3 C5 fixture",
    price: 0,
    status: "published",
  })).error);
  throwIfError("create chapter", (await supabaseAdmin.from("chapters").insert({
    id: ids.chapter,
    course_id: ids.course,
    created_by_user_id: SEEDED_TEACHER_ID,
    title: "Memory preview chapter",
    order_index: 0,
  })).error);
  throwIfError("create topics", (await supabaseAdmin.from("topics").insert(
    ids.topics.map((id, index) => ({
      id,
      course_id: ids.course,
      chapter_id: ids.chapter,
      title: `Memory preview topic ${index}`,
      slug: topicSlugs[index],
      status: "published",
      order_index: index,
      original_creator_user_id: SEEDED_TEACHER_ID,
      responsible_author_user_id: SEEDED_TEACHER_ID,
      first_approved_at: "2026-01-10T12:00:00.000Z",
    })),
  )).error);
  throwIfError("mark preview topic", (await supabaseAdmin
    .from("topics")
    .update({ is_preview: true })
    .eq("id", ids.topics[0])).error);
  throwIfError("create exercises", (await supabaseAdmin.from("exercises").insert([
    {
      id: ids.exercise,
      course_id: ids.course,
      topic_id: ids.topics[0],
      title: "Part 5 practice",
      part_type: "part5",
      activity_stage: "exercise",
      order_index: 0,
    },
    {
      id: ids.memory,
      course_id: ids.course,
      topic_id: ids.topics[0],
      title: "Memory check",
      part_type: null,
      activity_stage: "memory_check",
      order_index: 1,
    },
  ])).error);
  throwIfError("create questions", (await supabaseAdmin.from("questions").insert([
    {
      id: ids.exerciseQuestion,
      course_id: ids.course,
      exercise_id: ids.exercise,
      group_id: null,
      content: "Exercise question?",
      explanation: "Exercise explanation.",
      order_index: 0,
    },
    {
      id: ids.memoryQuestion,
      course_id: ids.course,
      exercise_id: ids.memory,
      group_id: null,
      content: "Memory question?",
      explanation: "Memory explanation.",
      order_index: 0,
    },
  ])).error);
  throwIfError("create options", (await supabaseAdmin.from("question_options").insert([
    { id: ids.exerciseOption, question_id: ids.exerciseQuestion, content: "Only", label: "A", order_index: 0, is_correct: true },
    { id: ids.memoryRight, question_id: ids.memoryQuestion, content: "Right", label: "A", order_index: 0, is_correct: true },
    { id: ids.memoryAlsoRight, question_id: ids.memoryQuestion, content: "Also right", label: "B", order_index: 1, is_correct: true },
    { id: ids.memoryWrong, question_id: ids.memoryQuestion, content: "Wrong", label: "C", order_index: 2, is_correct: false },
  ])).error);
}

async function cleanupFixture() {
  const optionIds = [ids.exerciseOption, ids.memoryRight, ids.memoryAlsoRight, ids.memoryWrong];
  await supabaseAdmin.from("question_options").delete().in("id", optionIds);
  await supabaseAdmin.from("questions").delete().in("id", [ids.exerciseQuestion, ids.memoryQuestion]);
  await supabaseAdmin.from("exercises").delete().in("id", [ids.exercise, ids.memory]);
  await supabaseAdmin.from("topics").delete().eq("course_id", ids.course);
  await supabaseAdmin.from("chapters").delete().eq("id", ids.chapter);
  await supabaseAdmin.from("courses").delete().eq("id", ids.course);
}

function previewRpc() {
  return supabaseAdmin.rpc("get_public_course_preview", {
    p_course_slug: courseSlug,
    p_topic_slug: topicSlugs[0],
  });
}

function answerMemory(optionId: string) {
  return supabaseAdmin.rpc("get_public_course_preview_answer", {
    p_course_slug: courseSlug,
    p_topic_slug: topicSlugs[0],
    p_question_id: ids.memoryQuestion,
    p_option_id: optionId,
  });
}

async function learnerRowCounts() {
  const questionIds = [ids.exerciseQuestion, ids.memoryQuestion];
  const [answers, progress] = await Promise.all([
    supabaseAdmin.from("user_question_answers").select("id", { count: "exact", head: true }).in("question_id", questionIds),
    supabaseAdmin.from("user_topic_progress").select("id", { count: "exact", head: true }).eq("topic_id", ids.topics[0]),
  ]);
  throwIfError("count answers", answers.error);
  throwIfError("count progress", progress.error);
  return [answers.count, progress.count];
}

describe.sequential("D3 public Preview with a memory check", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();
    await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
  });

  it("returns each exercise's stage, keeps answer keys out, and parses through the preview action", async () => {
    const { data, error } = await previewRpc();
    expect(error).toBeNull();
    expect(data.exercises).toEqual([
      expect.objectContaining({ id: ids.exercise, activity_stage: "exercise", part_type: "part5" }),
      expect.objectContaining({ id: ids.memory, activity_stage: "memory_check", part_type: null }),
    ]);
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("is_correct");
    expect(serialized).not.toContain("Memory explanation.");
    expect(data.exercises[1].questions[0].options).toHaveLength(3);

    const action = await getPublicCoursePreview({ courseSlug, topicSlug: topicSlugs[0] });
    expect(action.status).toBe("success");
    if (action.status !== "success") throw new Error("Expected preview success");
    expect(action.data.exercises.map((exercise) => exercise.activity_stage)).toEqual([
      "exercise",
      "memory_check",
    ]);
  });

  it("grades a memory question statelessly by the selected option", async () => {
    expect(await learnerRowCounts()).toEqual([0, 0]);

    expect((await answerMemory(ids.memoryRight)).data).toEqual({ is_correct: true, explanation: "Memory explanation." });
    expect((await answerMemory(ids.memoryAlsoRight)).data).toEqual({ is_correct: true, explanation: "Memory explanation." });
    expect((await answerMemory(ids.memoryWrong)).data).toEqual({ is_correct: false, explanation: "Memory explanation." });
    await expect(
      answerPublicCoursePreviewQuestion({
        courseSlug,
        topicSlug: topicSlugs[0],
        questionId: ids.memoryQuestion,
        selectedOptionId: ids.memoryAlsoRight,
      }),
    ).resolves.toEqual({ status: "success", data: { isCorrect: true, explanation: "Memory explanation." } });
    // Preview không khóa bài tập sau memory check: câu exercise chấm được ngay.
    expect((await supabaseAdmin.rpc("get_public_course_preview_answer", {
      p_course_slug: courseSlug,
      p_topic_slug: topicSlugs[0],
      p_question_id: ids.exerciseQuestion,
      p_option_id: ids.exerciseOption,
    })).data).toEqual({ is_correct: true, explanation: "Exercise explanation." });

    expect(await learnerRowCounts()).toEqual([0, 0]);
  });

  it("closes memory check read and answer when the topic is unmarked or the course is over quota", async () => {
    throwIfError("unmark", (await supabaseAdmin.from("topics").update({ is_preview: false }).eq("id", ids.topics[0])).error);
    expect((await previewRpc()).data).toBeNull();
    expect((await answerMemory(ids.memoryRight)).data).toBeNull();

    throwIfError("remark", (await supabaseAdmin.from("topics").update({ is_preview: true }).eq("id", ids.topics[0])).error);
    expect((await previewRpc()).data).not.toBeNull();
    throwIfError("over-cap mark", (await supabaseAdmin.from("topics").update({ is_preview: true }).eq("id", ids.topics[1])).error);
    expect((await previewRpc()).data).toBeNull();
    expect((await answerMemory(ids.memoryRight)).data).toBeNull();
    await expect(getPublicCoursePreview({ courseSlug, topicSlug: topicSlugs[0] })).resolves.toEqual({
      status: "unavailable",
    });
  });
});
