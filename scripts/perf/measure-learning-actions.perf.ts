import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { submitCardReview } from "@/app/actions/review";
import { submitQuestionAnswer } from "@/app/actions/progress";

// Đo LF2 AC1/AC2 trên runtime E2E tách biệt: chạy Server Action thật với client learner thật,
// đếm round trip tới Supabase và đọc dòng `[learning-action-timing]` do bộ đo env-flag phát ra.
// Cách chạy ở cuối file; không bao giờ trỏ vào root 45321 hay hosted.
// Fixture mô phỏng khóa free TOEIC: mỗi topic 10 thẻ, memory check 5 câu, bài tập part5 8 câu (4 lựa chọn).

const authenticated = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => authenticated.client }));

const api = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const runtimeUrl = new URL(api || "http://invalid.local");
if (
  process.env.ALLOW_DB_INTEGRATION_TESTS !== "true" ||
  process.env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" ||
  runtimeUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(runtimeUrl.hostname) ||
  runtimeUrl.port !== "45441"
) {
  throw new Error("LF2 timing requires the explicitly enabled isolated E2E runtime on port 45441");
}

const TOPICS = 4;
const CARDS_PER_TOPIC = 10;
const MEMORY_PER_TOPIC = 5;
const EXERCISE_PER_TOPIC = 8;
const MEMORY_PASSES = 2;
const teacherId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);

type Question = { id: string; right: string; wrong: string };
type Fixture = {
  courseId: string;
  chapterId: string;
  topicIds: string[];
  exerciseIds: string[];
  cardIds: string[];
  memory: Question[];
  exercise: Question[];
};
type Sample = { path: string; totalMs: number; steps: Record<string, number>; requests: string[] };

const requests: string[] = [];
const countingFetch: typeof fetch = (input, init) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  requests.push(`${init?.method ?? "GET"} ${new URL(href).pathname}`);
  return fetch(input, init);
};

const timingLines: string[] = [];
const fixture: Fixture = {
  courseId: randomUUID(), chapterId: randomUUID(), topicIds: [], exerciseIds: [], cardIds: [], memory: [], exercise: [],
};
let learner: SupabaseClient;

async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const result = await service.from(table).insert(rows as never);
  if (result.error) throw new Error(`${table}: ${result.error.message}`);
}

async function buildFixture() {
  await insert("courses", { id: fixture.courseId, title: "LF2 timing", slug: `lf2-timing-${fixture.courseId}`, price: 0, status: "published" });
  await insert("course_collaborators", { course_id: fixture.courseId, user_id: teacherId, role: "owner", added_by: teacherId });
  await insert("chapters", { id: fixture.chapterId, course_id: fixture.courseId, title: "LF2", created_by_user_id: teacherId, order_index: 0 });
  for (let t = 0; t < TOPICS; t += 1) {
    const topicId = randomUUID();
    const memoryExerciseId = randomUUID();
    const exerciseId = randomUUID();
    fixture.topicIds.push(topicId);
    fixture.exerciseIds.push(memoryExerciseId, exerciseId);
    await insert("topics", {
      id: topicId, course_id: fixture.courseId, chapter_id: fixture.chapterId, title: `LF2 ${t}`, slug: `lf2-${topicId}`,
      status: "published", first_approved_at: new Date().toISOString(), order_index: t,
      original_creator_user_id: teacherId, responsible_author_user_id: teacherId,
    });
    const cardIds = Array.from({ length: CARDS_PER_TOPIC }, () => randomUUID());
    fixture.cardIds.push(...cardIds);
    await insert("cards", cardIds.map((id, index) => ({
      id, topic_id: topicId, front_content: { word: `w${t}-${index}` }, back_content: { translation: `n${t}-${index}` },
    })));
    await insert("exercises", [
      { id: memoryExerciseId, topic_id: topicId, course_id: fixture.courseId, title: "Memory", part_type: null, activity_stage: "memory_check", order_index: 0 },
      { id: exerciseId, topic_id: topicId, course_id: fixture.courseId, title: "Part 5", part_type: "part5", activity_stage: "exercise", order_index: 1 },
    ]);
    for (const [exerciseRef, count, bucket] of [
      [memoryExerciseId, MEMORY_PER_TOPIC, fixture.memory],
      [exerciseId, EXERCISE_PER_TOPIC, fixture.exercise],
    ] as const) {
      const questions: Question[] = Array.from({ length: count }, () => ({ id: randomUUID(), right: randomUUID(), wrong: randomUUID() }));
      bucket.push(...questions);
      await insert("questions", questions.map((q, index) => ({
        id: q.id, exercise_id: exerciseRef, course_id: fixture.courseId, content: `Q ${index}`, explanation: "Giải thích", order_index: index,
      })));
      await insert("question_options", questions.flatMap((q) => [
        { id: q.right, question_id: q.id, content: "đúng", label: "A", is_correct: true, order_index: 0 },
        ...["B", "C", "D"].map((label, index) => ({
          id: index === 0 ? q.wrong : randomUUID(), question_id: q.id, content: label, label, is_correct: false, order_index: index + 1,
        })),
      ]));
    }
  }
  await insert("enrollments", { course_id: fixture.courseId, user_id: studentId });
}

async function cleanup() {
  const questionIds = [...fixture.memory, ...fixture.exercise].map((q) => q.id);
  const steps: Array<[string, string, string[]]> = [
    ["user_question_answers", "question_id", questionIds],
    ["user_flashcards", "card_id", fixture.cardIds],
    ["user_topic_progress", "topic_id", fixture.topicIds],
    ["enrollments", "course_id", [fixture.courseId]],
    ["question_options", "question_id", questionIds],
    ["questions", "id", questionIds],
    ["exercises", "id", fixture.exerciseIds],
    ["cards", "id", fixture.cardIds],
    ["topics", "id", fixture.topicIds],
    ["chapters", "id", [fixture.chapterId]],
    ["course_collaborators", "course_id", [fixture.courseId]],
    ["courses", "id", [fixture.courseId]],
  ];
  for (const [table, column, ids] of steps) {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const result = await service.from(table).delete().in(column, ids.slice(offset, offset + 100));
      if (result.error) throw new Error(`cleanup ${table}: ${result.error.message}`);
    }
  }
}

async function measure(run: () => Promise<{ success?: boolean; error?: string }>): Promise<Sample> {
  requests.length = 0;
  timingLines.length = 0;
  const result = await run();
  if (!result.success) throw new Error(`Action failed: ${result.error}`);
  const sent = [...requests];
  expect(timingLines).toHaveLength(1);
  const record = JSON.parse(timingLines[0]) as { path: string; totalMs: number; steps: Array<{ name: string; ms: number }> };
  return {
    path: record.path,
    totalMs: record.totalMs,
    steps: Object.fromEntries(record.steps.map((step) => [step.name, step.ms])),
    requests: sent,
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(label: string, samples: Sample[]) {
  const [first, ...warm] = samples;
  const stepNames = [...new Set(samples.flatMap((sample) => Object.keys(sample.steps)))];
  const roundTrips = [...new Set(samples.map((sample) => sample.requests.length))];
  return {
    path: label,
    labelSeen: [...new Set(samples.map((sample) => sample.path))],
    n: samples.length,
    firstCallMs: first.totalMs,
    warmN: warm.length,
    warmMedianMs: median(warm.map((sample) => sample.totalMs)),
    warmMinMs: Math.min(...warm.map((sample) => sample.totalMs)),
    warmMaxMs: Math.max(...warm.map((sample) => sample.totalMs)),
    roundTrips,
    requestsOfFirstCall: first.requests,
    warmStepMedianMs: Object.fromEntries(stepNames.map((name) => [
      name,
      median(warm.map((sample) => sample.steps[name]).filter((value): value is number => value !== undefined)),
    ])),
  };
}

describe.sequential("LF2 learning action timing (baseline measurement, not a pass/fail test)", () => {
  beforeAll(async () => {
    process.env.LEARNING_ACTION_TIMING = "1";
    vi.spyOn(console, "info").mockImplementation((tag: unknown, line?: unknown) => {
      if (tag === "[learning-action-timing]") timingLines.push(String(line));
    });
    learner = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { ...options, global: { fetch: countingFetch } });
    const signIn = await learner.auth.signInWithPassword({ email: "student@gmail.com", password: "123123" });
    if (signIn.error) throw signIn.error;
    authenticated.client = learner;
    await buildFixture();
  }, 120_000);

  afterAll(async () => {
    await cleanup();
    await learner?.auth.signOut();
  }, 120_000);

  it("measures the four paths", { timeout: 600_000 }, async () => {
    const summaries = [];

    const create: Sample[] = [];
    for (const cardId of fixture.cardIds) create.push(await measure(() => submitCardReview(cardId, 3)));
    summaries.push(summarize("rating-create", create));

    const update: Sample[] = [];
    for (const cardId of fixture.cardIds) update.push(await measure(() => submitCardReview(cardId, 3)));
    summaries.push(summarize("rating-update", update));

    // Xóa đáp án cũ ngoài vùng đo để mỗi mẫu đi nhánh INSERT của upsert.
    const memory: Sample[] = [];
    for (let pass = 0; pass < MEMORY_PASSES; pass += 1) {
      for (const question of fixture.memory) {
        const removed = await service.from("user_question_answers").delete().eq("user_id", studentId).eq("question_id", question.id);
        if (removed.error) throw removed.error;
        memory.push(await measure(() => submitQuestionAnswer(question.id, question.right)));
      }
    }
    summaries.push(summarize("memory-answer", memory));

    // Exercise chỉ ghi được khi memory check đã qua; mọi câu memory đang có đáp án đúng sau lượt cuối.
    const exercise: Sample[] = [];
    for (const question of fixture.exercise) exercise.push(await measure(() => submitQuestionAnswer(question.id, question.right)));
    summaries.push(summarize("exercise-answer", exercise));

    process.stdout.write(
      `\nLF2_TIMING_RESULT ${JSON.stringify({
        runtime: api,
        fixture: { topics: TOPICS, cardsPerTopic: CARDS_PER_TOPIC, memoryPerTopic: MEMORY_PER_TOPIC, exercisePerTopic: EXERCISE_PER_TOPIC },
        summaries,
      }, null, 2)}\n`,
    );
  });
});

// Cách chạy (PowerShell/bash), lấy env từ runtime tách biệt, không in key:
//   npx supabase --workdir .e2e-runtime status -o env   -> API_URL, ANON_KEY, SERVICE_ROLE_KEY
//   ALLOW_DB_INTEGRATION_TESTS=true E2E_SUPABASE_WORKDIR=.e2e-runtime NEXT_PUBLIC_SUPABASE_URL=$API_URL \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
//   npx vitest run --config scripts/perf/vitest.config.ts
