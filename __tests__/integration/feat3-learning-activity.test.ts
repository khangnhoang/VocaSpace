import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { submitCardReview } from "@/app/actions/review";
import { runLocalPsql } from "./helpers/local-psql";

// Test plan:
// - Mục tiêu: FEAT3 CP1 - máy chủ ghi mỗi hành động học theo phút (kèm course/topic) và chỉ chủ dòng đọc được tóm tắt
//   streak, 7 ngày, thời gian học tuần và 3 topic gần nhất (AC1-AC4, AC6, AC8, AC10, G1-G6).
// - Loại: integration trên runtime E2E tách biệt (Data API/RLS + RPC + trigger + psql với quyền postgres); không mock database.
//   Chỉ `submitCardReview` đi qua Server Action thật với adapter session của Next.js được thay.
// - Đối tượng: trigger `feat3_record_answer_activity`/`feat3_record_card_activity`, bảng `user_learning_activity`,
//   `public.feat3_learning_summary` và các hàm đọc `private.feat3_*`.
// - Thành công: mỗi hành động AC1 (bài tập, memory check, chấm thẻ qua RPC và qua Server Action của review sheet) ghi đúng một dòng
//   phút với đúng course và topic; nhiều hành động cùng phút chỉ một dòng; nộp lại cùng đáp án/điểm vẫn tính; streak hôm nay,
//   hôm qua, đứt, cạnh nửa đêm Asia/Ho_Chi_Minh; ranh giới tuần; quy tắc khoảng cách 5 phút; 3 topic gần nhất có thứ tự hòa phút cố định.
// - Thất bại: hành động bị từ chối (chưa enroll, memory_locked, option lạ, câu không tồn tại) không ghi; ghi hoạt động lỗi thường
//   hay bị hủy (57014) không làm hỏng RPC trả lời lẫn chấm thẻ; RPC tóm tắt thiếu/lỗi do app xử lý ở CP2.
// - Bảo mật/phân quyền: học viên không insert/update/delete trực tiếp; service_role và anon không ghi/đọc; học viên khác, giáo viên
//   tác giả và admin không đọc được dòng của người khác và RPC tóm tắt chỉ trả dữ liệu của chính người gọi; hàm ghi không chạy được
//   bởi vai trò nào của API; xóa user xóa hoạt động.
// - Ổn định/resilience: trigger chỉ chạy khi auth.uid() là chủ dòng (service_role/migration/backfill/LF9/sync không ghi); lệnh chỉ
//   đổi updated_at không ghi; khóa chính cùng phút idempotent; số dòng đọc của từng phần tóm tắt bị chặn theo cửa sổ hay độ dài streak
//   (G6), đo bằng bộ đếm index của transaction và EXPLAIN.
// - Invariant cần giữ: activity chỉ đến từ hành động học đã lưu của chính người học, một dòng cho mỗi (user, topic, phút), ngày
//   luôn tính trong SQL theo Asia/Ho_Chi_Minh, và việc ghi hoạt động không bao giờ làm đổi kết quả học.
// - Kết quả verify gần nhất: xem milestone FEAT3 CP1 trong progress.md.
// - Ghi chú: chạy bằng `node` wrapper hoặc `ALLOW_DB_INTEGRATION_TESTS=true E2E_SUPABASE_WORKDIR=.e2e-runtime npm run test:integration -- __tests__/integration/feat3-learning-activity.test.ts`
//   với API 45441 và psql. Preview công khai không ghi gì vào hai bảng đáp án/thẻ nên không có đường ghi để kiểm ở tầng này.
//   Ngày cố định (2026-03-11) chỉ dùng cho các hàm đọc nhận `p_today`; các test qua RPC dùng đồng hồ thật nhưng đặt dòng theo mốc 00:00
//   Asia/Ho_Chi_Minh của hôm nay nên không phụ thuộc giờ chạy. Trigger lỗi thử nghiệm được cài/gỡ bằng DDL trên chính runtime tách biệt.

const authenticated = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => authenticated.client }));

const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const runtimeUrl = new URL(api);
if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true"
  || process.env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime" || runtimeUrl.protocol !== "http:"
  || !["127.0.0.1", "localhost"].includes(runtimeUrl.hostname) || runtimeUrl.port !== "45441") {
  throw new Error("FEAT3 integration requires the explicitly enabled isolated E2E runtime on port 45441");
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const studentId = "33333333-3333-4333-8333-333333333333";
const teacherId = "22222222-2222-4222-8222-222222222222";
const adminId = "11111111-1111-4111-8111-111111111111";
const FAIL_TRIGGER = "feat3_test_activity_failure";

type Q = { id: string; right: string; wrong: string };
type TopicSpec = { chapter: number; order: number; memory?: boolean; exercise?: boolean };
type BuiltTopic = TopicSpec & {
  id: string; cardId: string; memoryExerciseId?: string; exerciseId?: string; memoryQ?: Q; exerciseQ?: Q;
};
type BuiltCourse = { id: string; chapterIds: string[]; topics: BuiltTopic[] };
type Activity = { topic_id: string; course_id: string; aligned: boolean };
type Summary = {
  streak: number; studied_today: boolean;
  days?: { date: string; studied: boolean }[]; week_study_minutes?: number;
  recent_topics?: { topic_id: string; slug: string; title: string; last_activity_at: string; days_ago: number }[];
};

let learner: SupabaseClient;
let teacher: SupabaseClient;
let adminClient: SupabaseClient;
let other: SupabaseClient;
let otherId = "";
const courses: BuiltCourse[] = [];
const extraUsers: string[] = [];

const sql = (query: string) => runLocalPsql(query);
const jsonSql = <T>(query: string) => JSON.parse(sql(query)) as T;
const lit = (value: string) => `'${value}'`;

async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const r = await service.from(table).insert(rows as never);
  if (r.error) throw new Error(`${table}: ${r.error.message}`);
}
async function patch(table: string, id: string, values: Record<string, unknown>) {
  const r = await service.from(table).update(values).eq("id", id);
  if (r.error) throw r.error;
}
async function signIn(email: string) {
  const client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  const r = await client.auth.signInWithPassword({ email, password: "123123" });
  if (r.error) throw r.error;
  return client;
}

async function addQuestion(courseId: string, exerciseId: string): Promise<Q> {
  const q: Q = { id: randomUUID(), right: randomUUID(), wrong: randomUUID() };
  await insert("questions", { id: q.id, exercise_id: exerciseId, course_id: courseId, content: "FEAT3", explanation: "Giải thích", order_index: 0 });
  await insert("question_options", [
    { id: q.right, question_id: q.id, content: "đúng", label: "A", is_correct: true, order_index: 0 },
    { id: q.wrong, question_id: q.id, content: "sai", label: "B", is_correct: false, order_index: 1 },
  ]);
  return q;
}

// Topic được tạo theo thứ tự ngược với vị trí trong course để thứ tự insert/id không giống thứ tự chapter-topic.
async function buildCourse(specs: TopicSpec[], enroll = true): Promise<BuiltCourse> {
  const course: BuiltCourse = { id: randomUUID(), chapterIds: [], topics: [] };
  courses.push(course);
  await insert("courses", { id: course.id, title: "FEAT3", slug: `feat3-${course.id}`, price: 0, status: "published" });
  await insert("course_collaborators", { course_id: course.id, user_id: teacherId, role: "owner", added_by: teacherId });
  const chapterCount = Math.max(...specs.map((s) => s.chapter)) + 1;
  for (let index = 0; index < chapterCount; index += 1) {
    const id = randomUUID();
    course.chapterIds.push(id);
    await insert("chapters", { id, course_id: course.id, title: `FEAT3 ${index}`, created_by_user_id: teacherId, order_index: index });
  }
  for (const spec of [...specs].reverse()) {
    const topic: BuiltTopic = { ...spec, id: randomUUID(), cardId: randomUUID() };
    course.topics.push(topic);
    await insert("topics", {
      id: topic.id, course_id: course.id, chapter_id: course.chapterIds[spec.chapter], title: `FEAT3 c${spec.chapter}t${spec.order}`,
      slug: `feat3-${topic.id}`, status: "published", first_approved_at: new Date().toISOString(), order_index: spec.order,
      original_creator_user_id: teacherId, responsible_author_user_id: teacherId,
    });
    await insert("cards", { id: topic.cardId, topic_id: topic.id, front_content: { word: "feat3" }, back_content: { translation: "feat3" } });
    if (spec.memory) {
      topic.memoryExerciseId = randomUUID();
      await insert("exercises", { id: topic.memoryExerciseId, topic_id: topic.id, course_id: course.id, title: "Memory", part_type: null, activity_stage: "memory_check", order_index: 0 });
      topic.memoryQ = await addQuestion(course.id, topic.memoryExerciseId);
      // Cổng LF3: memory check chỉ ghi được khi học viên đã có dòng user_flashcards cho mọi thẻ. service_role ghi nên không có hoạt động.
      await insert("user_flashcards", { user_id: studentId, card_id: topic.cardId, last_rating: 3 });
    }
    if (spec.exercise) {
      topic.exerciseId = randomUUID();
      await insert("exercises", { id: topic.exerciseId, topic_id: topic.id, course_id: course.id, title: "Part 6", part_type: "part6", activity_stage: "exercise", order_index: 1 });
      topic.exerciseQ = await addQuestion(course.id, topic.exerciseId);
    }
  }
  if (enroll) await insert("enrollments", { course_id: course.id, user_id: studentId });
  return course;
}
const topicAt = (course: BuiltCourse, chapter: number, order: number) =>
  course.topics.find((t) => t.chapter === chapter && t.order === order)!;

async function cleanupCourses() {
  for (const c of courses.splice(0)) {
    const topicIds = c.topics.map((t) => t.id);
    const exerciseIds = c.topics.flatMap((t) => [t.memoryExerciseId, t.exerciseId].filter(Boolean) as string[]);
    const questionIds = c.topics.flatMap((t) => [t.memoryQ?.id, t.exerciseQ?.id].filter(Boolean) as string[]);
    const cardIds = c.topics.map((t) => t.cardId);
    for (const [table, column, ids] of [
      ["user_question_answers", "question_id", questionIds], ["user_flashcards", "card_id", cardIds],
      ["user_topic_progress", "topic_id", topicIds], ["enrollments", "course_id", [c.id]],
      ["question_options", "question_id", questionIds], ["questions", "id", questionIds],
      ["exercises", "id", exerciseIds], ["cards", "id", cardIds], ["topics", "id", topicIds],
      ["chapters", "id", c.chapterIds], ["course_collaborators", "course_id", [c.id]], ["courses", "id", [c.id]],
    ] as const) {
      const r = await service.from(table).delete().in(column, [...ids]);
      if (r.error) throw r.error;
    }
  }
}

const clearActivity = (...userIds: string[]) =>
  sql(`delete from public.user_learning_activity where user_id in (${userIds.map(lit).join(",")})`);
const activityOf = (userId: string) => jsonSql<Activity[]>(`
  select coalesce(json_agg(json_build_object('topic_id', topic_id, 'course_id', course_id,
    'aligned', activity_minute = date_trunc('minute', activity_minute)) order by topic_id), '[]'::json)
  from public.user_learning_activity where user_id = ${lit(userId)}`);
const activityCount = (userId: string) => Number(sql(`select count(*) from public.user_learning_activity where user_id = ${lit(userId)}`));

// Chạy body trong đúng một phút của database; thử lại nếu ranh giới phút rơi vào giữa chừng.
async function withinOneMinute<T>(body: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const minute = () => sql("select to_char(date_trunc('minute', clock_timestamp()), 'HH24:MI')");
    clearActivity(studentId);
    const before = minute();
    const result = await body();
    if (before === minute()) return result;
  }
  throw new Error("Could not run the scenario inside a single database minute");
}

// Thêm dòng hoạt động bằng quyền postgres (đường duy nhất ngoài trigger, chỉ để dựng lịch sử trong test).
function seed(userId: string, topic: BuiltTopic, course: BuiltCourse, at: string) {
  sql(`insert into public.user_learning_activity (user_id, topic_id, course_id, activity_minute)
       values (${lit(userId)}, ${lit(topic.id)}, ${lit(course.id)}, ${at}) on conflict do nothing`);
}
const todayStart = "private.feat3_ict_day_start(private.feat3_ict_date(now()))";
const dayStart = (daysAgo: number) => `private.feat3_ict_day_start(private.feat3_ict_date(now()) - ${daysAgo})`;

const rpcAnswer = async (client: SupabaseClient, q: Q, option: string) => {
  const r = await client.rpc("lf2_submit_question_answer", { p_question_id: q.id, p_selected_option_id: option });
  if (r.error) throw new Error(`answer rpc error: ${r.error.message}`);
  return r.data as { status: string; [key: string]: unknown };
};
const cardArgs = (topic: BuiltTopic, existingId: string | null = null, rating = 3) => ({
  p_card_id: topic.cardId, p_user_flashcard_id: existingId, p_next_review_date: new Date(Date.now() + 86_400_000).toISOString(),
  p_fsrs_meta: { reps: 1, state: 2 }, p_last_rating: rating, p_updated_at: new Date().toISOString(),
});
const rpcCard = async (client: SupabaseClient, args: ReturnType<typeof cardArgs>) => {
  const r = await client.rpc("lf2_submit_card_review", args);
  if (r.error) throw new Error(`card rpc error: ${r.error.message}`);
  return r.data as { status: string; progress: unknown };
};
const storedCardId = async (topic: BuiltTopic, userId = studentId) => {
  const r = await service.from("user_flashcards").select("id").eq("user_id", userId).eq("card_id", topic.cardId);
  if (r.error) throw r.error;
  return (r.data[0]?.id ?? null) as string | null;
};
const summary = async (client: SupabaseClient, courseId: string | null = null) => {
  const r = await client.rpc("feat3_learning_summary", courseId ? { p_course_id: courseId } : {});
  if (r.error) throw new Error(`summary rpc error: ${r.error.message}`);
  return r.data as Summary;
};

function removeFailureTrigger() {
  sql(`drop trigger if exists ${FAIL_TRIGGER} on public.user_learning_activity;
       drop function if exists private.${FAIL_TRIGGER}()`);
}
function installFailureTrigger(mode: "error" | "cancel") {
  const raise = mode === "error"
    ? "raise exception 'FEAT3_TEST_ACTIVITY_FAILURE'"
    : "raise exception 'canceling statement due to statement timeout' using errcode = '57014'";
  sql(`create function private.${FAIL_TRIGGER}() returns trigger language plpgsql as $f$ begin ${raise}; end $f$;
       create trigger ${FAIL_TRIGGER} before insert on public.user_learning_activity
       for each row execute function private.${FAIL_TRIGGER}()`);
}

describe.sequential("FEAT3 learning activity", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    removeFailureTrigger();
    learner = await signIn("student@gmail.com");
    teacher = await signIn("teacher@gmail.com");
    adminClient = await signIn("admin@gmail.com");
    otherId = randomUUID();
    extraUsers.push(otherId);
    const email = `feat3-${otherId}@example.com`;
    expect((await service.auth.admin.createUser({ id: otherId, email, password: "123123", email_confirm: true })).error).toBeNull();
    other = await signIn(email);
    authenticated.client = learner;
    clearActivity(studentId, teacherId, adminId, otherId);
  });
  afterEach(async () => {
    removeFailureTrigger();
    authenticated.client = learner;
    vi.restoreAllMocks();
    clearActivity(studentId, teacherId, adminId, otherId);
    await cleanupCourses();
  });
  afterAll(async () => {
    removeFailureTrigger();
    for (const id of extraUsers.splice(0)) await service.auth.admin.deleteUser(id);
    await Promise.all([learner, teacher, adminClient, other].map((c) => c?.auth.signOut()));
  });

  describe("recording a learning action (AC1, G1, G2)", () => {
    it("records one aligned minute row with the question's topic and course when a learner answers an exercise question", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, exercise: true }]);
      const topic = course.topics[0];
      expect((await rpcAnswer(learner, topic.exerciseQ!, topic.exerciseQ!.right)).status).toBe("ok");
      expect(await activityOf(studentId)).toEqual([{ topic_id: topic.id, course_id: course.id, aligned: true }]);
    });

    it("records a memory-check answer and keeps a rejected exercise answer (memory_locked) out of the activity", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, memory: true, exercise: true }]);
      const topic = course.topics[0];
      expect((await rpcAnswer(learner, topic.exerciseQ!, topic.exerciseQ!.right)).status).toBe("memory_locked");
      expect(await activityCount(studentId)).toBe(0);

      expect((await rpcAnswer(learner, topic.memoryQ!, topic.memoryQ!.right)).status).toBe("ok");
      expect(await activityOf(studentId)).toEqual([{ topic_id: topic.id, course_id: course.id, aligned: true }]);
    });

    it("records a flashcard rating on both the insert and the update path, attributed to the card's own topic and course", async () => {
      const first = await buildCourse([{ chapter: 0, order: 0 }]);
      const second = await buildCourse([{ chapter: 0, order: 0 }]);

      expect((await rpcCard(learner, cardArgs(first.topics[0]))).status).toBe("ok");
      expect(await activityOf(studentId)).toEqual([{ topic_id: first.topics[0].id, course_id: first.id, aligned: true }]);

      clearActivity(studentId);
      const existing = await storedCardId(first.topics[0]);
      expect((await rpcCard(learner, cardArgs(first.topics[0], existing, 1))).status).toBe("ok");
      expect(await activityOf(studentId)).toEqual([{ topic_id: first.topics[0].id, course_id: first.id, aligned: true }]);

      // Review sheet và workspace dùng cùng Server Action; thẻ của course khác được gán cho course của chính thẻ đó.
      clearActivity(studentId);
      authenticated.client = learner;
      expect(await submitCardReview(second.topics[0].cardId, 3)).toMatchObject({ success: true });
      expect(await activityOf(studentId)).toEqual([{ topic_id: second.topics[0].id, course_id: second.id, aligned: true }]);
    });

    it("leaves one row for several actions in the same minute and topic, and one per topic when topics differ", async () => {
      const course = await buildCourse([
        { chapter: 0, order: 0, exercise: true }, { chapter: 0, order: 1, exercise: true },
      ]);
      const [a, b] = [topicAt(course, 0, 0), topicAt(course, 0, 1)];
      await withinOneMinute(async () => {
        await rpcAnswer(learner, a.exerciseQ!, a.exerciseQ!.right);
        await rpcAnswer(learner, a.exerciseQ!, a.exerciseQ!.wrong);
        await rpcCard(learner, cardArgs(a));
        await rpcAnswer(learner, b.exerciseQ!, b.exerciseQ!.right);
      });
      const rows = await activityOf(studentId);
      expect(rows.map((r) => r.topic_id).sort()).toEqual([a.id, b.id].sort());
    });

    it("counts a resubmission of the same answer and the same rating", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, exercise: true }]);
      const topic = course.topics[0];
      await rpcAnswer(learner, topic.exerciseQ!, topic.exerciseQ!.right);
      await rpcCard(learner, cardArgs(topic, null, 3));
      expect(await activityCount(studentId)).toBe(1);

      clearActivity(studentId);
      await rpcAnswer(learner, topic.exerciseQ!, topic.exerciseQ!.right);
      expect(await activityCount(studentId)).toBe(1);

      clearActivity(studentId);
      await rpcCard(learner, cardArgs(topic, await storedCardId(topic), 3));
      expect(await activityCount(studentId)).toBe(1);
    });

    it("records a learner's own direct write of selected_option_id or last_rating but not an updated_at-only update", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, exercise: true }]);
      const topic = course.topics[0];
      await rpcAnswer(learner, topic.exerciseQ!, topic.exerciseQ!.right);
      const cardRow = await storedCardId(topic);
      expect(cardRow).toBeNull();
      await rpcCard(learner, cardArgs(topic));
      clearActivity(studentId);

      const touchAnswer = await learner.from("user_question_answers").update({ updated_at: new Date().toISOString() })
        .eq("user_id", studentId).eq("question_id", topic.exerciseQ!.id).select("id");
      expect(touchAnswer.error).toBeNull();
      expect(touchAnswer.data).toHaveLength(1);
      const touchCard = await learner.from("user_flashcards").update({ updated_at: new Date().toISOString() })
        .eq("user_id", studentId).eq("card_id", topic.cardId).select("id");
      expect(touchCard.error).toBeNull();
      expect(touchCard.data).toHaveLength(1);
      const otherColumn = await learner.from("user_flashcards").update({ fsrs_meta: { reps: 2 } })
        .eq("user_id", studentId).eq("card_id", topic.cardId).select("id");
      expect(otherColumn.data).toHaveLength(1);
      expect(await activityCount(studentId)).toBe(0);

      const sameAnswer = await learner.from("user_question_answers").update({ selected_option_id: topic.exerciseQ!.right })
        .eq("user_id", studentId).eq("question_id", topic.exerciseQ!.id).select("id");
      expect(sameAnswer.data).toHaveLength(1);
      expect(await activityCount(studentId)).toBe(1);
      clearActivity(studentId);
      const sameRating = await learner.from("user_flashcards").update({ last_rating: 3 })
        .eq("user_id", studentId).eq("card_id", topic.cardId).select("id");
      expect(sameRating.data).toHaveLength(1);
      expect(await activityCount(studentId)).toBe(1);
    });

    it("records nothing for a rejected action: not enrolled, foreign option, missing question, locked memory gate", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, memory: true, exercise: true }, { chapter: 0, order: 1, exercise: true }]);
      const withGate = topicAt(course, 0, 0);
      const plain = topicAt(course, 0, 1);

      // Giáo viên tác giả đọc được nhưng chưa enroll: RPC trả not_enrolled, thẻ bị policy chặn.
      expect((await rpcAnswer(teacher, plain.exerciseQ!, plain.exerciseQ!.right)).status).toBe("not_enrolled");
      const teacherCard = await teacher.rpc("lf2_submit_card_review", cardArgs(plain));
      expect(teacherCard.error ?? (teacherCard.data as { status: string }).status).not.toBe("ok");
      expect((await rpcAnswer(learner, plain.exerciseQ!, withGate.memoryQ!.right)).status).toBe("option_unavailable");
      const missing = await learner.rpc("lf2_submit_question_answer", { p_question_id: randomUUID(), p_selected_option_id: randomUUID() });
      expect((missing.data as { status: string }).status).toBe("unavailable");
      expect((await rpcAnswer(learner, withGate.exerciseQ!, withGate.exerciseQ!.right)).status).toBe("memory_locked");

      expect(await activityCount(studentId)).toBe(0);
      expect(await activityCount(teacherId)).toBe(0);
    });

    it("records nothing for the progress sync, the LF9 gate capture, service-role writes, migration-style writes and updated_at-only updates", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, memory: true, exercise: true }]);
      const topic = course.topics[0];
      // Sync tiến độ gọi bằng chính học viên: không phải hành động học.
      const sync = await learner.rpc("d4_sync_topic_progress", { p_topic_id: topic.id });
      expect(sync.error).toBeNull();
      // Trigger/backfill LF9 chỉ chạm user_topic_progress.
      sql(`select private.lf9_capture_memory_gate(${lit(studentId)}, ${lit(topic.id)})`);
      // service_role (auth.uid() null): ghi đáp án, chấm thẻ và đổi điểm.
      const serviceAnswer = await service.from("user_question_answers").upsert(
        { user_id: studentId, question_id: topic.memoryQ!.id, selected_option_id: topic.memoryQ!.right, is_correct: false },
        { onConflict: "user_id,question_id" });
      expect(serviceAnswer.error).toBeNull();
      const serviceCard = await service.from("user_flashcards").update({ last_rating: 4 }).eq("user_id", studentId).eq("card_id", topic.cardId);
      expect(serviceCard.error).toBeNull();
      // Ghi bằng quyền postgres không có JWT (migration/backfill), cả insert lẫn update cột kích hoạt.
      sql(`update public.user_flashcards set last_rating = 2 where user_id = ${lit(studentId)} and card_id = ${lit(topic.cardId)};
           update public.user_question_answers set selected_option_id = ${lit(topic.memoryQ!.right)}
             where user_id = ${lit(studentId)} and question_id = ${lit(topic.memoryQ!.id)}`);
      // Lệnh chỉ đổi updated_at, kể cả khi người gọi là chủ dòng.
      sql(`select set_config('request.jwt.claim.sub', ${lit(studentId)}, true)`);
      const touch = await service.from("user_flashcards").update({ updated_at: new Date().toISOString() }).eq("user_id", studentId);
      expect(touch.error).toBeNull();

      expect(await activityCount(studentId)).toBe(0);
    });
  });

  describe("a failing or cancelled activity write never fails the learning action (AC10, G2)", () => {
    it.each([["an ordinary error", "error" as const], ["a cancelled statement (57014)", "cancel" as const]])(
      "saves the answer and returns the normal result when the activity write hits %s",
      async (_name, mode) => {
        const failing = await buildCourse([{ chapter: 0, order: 0, exercise: true }]);
        const healthy = await buildCourse([{ chapter: 0, order: 0, exercise: true }]);
        const normal = await rpcAnswer(learner, healthy.topics[0].exerciseQ!, healthy.topics[0].exerciseQ!.right);
        expect(await activityCount(studentId)).toBe(1);
        clearActivity(studentId);

        installFailureTrigger(mode);
        const result = await rpcAnswer(learner, failing.topics[0].exerciseQ!, failing.topics[0].exerciseQ!.right);
        expect(result).toEqual(normal);
        const stored = await service.from("user_question_answers").select("selected_option_id")
          .eq("user_id", studentId).eq("question_id", failing.topics[0].exerciseQ!.id);
        expect(stored.data?.[0]?.selected_option_id).toBe(failing.topics[0].exerciseQ!.right);
        expect(await activityCount(studentId)).toBe(0);
      },
    );

    it.each([["an ordinary error", "error" as const], ["a cancelled statement (57014)", "cancel" as const]])(
      "saves the rating and returns the normal result when the activity write hits %s",
      async (_name, mode) => {
        const failing = await buildCourse([{ chapter: 0, order: 0 }]);
        const healthy = await buildCourse([{ chapter: 0, order: 0 }]);
        const normal = await rpcCard(learner, cardArgs(healthy.topics[0]));
        expect(await activityCount(studentId)).toBe(1);
        clearActivity(studentId);

        installFailureTrigger(mode);
        const result = await rpcCard(learner, cardArgs(failing.topics[0], null, 4));
        expect(result).toEqual(normal);
        const stored = await service.from("user_flashcards").select("last_rating")
          .eq("user_id", studentId).eq("card_id", failing.topics[0].cardId);
        expect(stored.data?.[0]?.last_rating).toBe(4);
        expect(await activityCount(studentId)).toBe(0);

        // Cập nhật thẻ đã có cũng được bảo vệ như nhau.
        const update = await rpcCard(learner, cardArgs(failing.topics[0], await storedCardId(failing.topics[0]), 1));
        expect(update.status).toBe("ok");
        expect(await activityCount(studentId)).toBe(0);
      },
    );
  });

  describe("access boundary (AC8, G4)", () => {
    it("lets a learner read only their own activity and denies every direct write from every API role", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, exercise: true }]);
      const topic = course.topics[0];
      await rpcAnswer(learner, topic.exerciseQ!, topic.exerciseQ!.right);

      const own = await learner.from("user_learning_activity").select("topic_id");
      expect(own.error).toBeNull();
      expect(own.data).toEqual([{ topic_id: topic.id }]);

      const row = { user_id: studentId, topic_id: topic.id, course_id: course.id, activity_minute: "2026-01-01T00:00:00Z" };
      for (const client of [learner, teacher, adminClient, service]) {
        expect((await client.from("user_learning_activity").insert(row)).error?.code).toBe("42501");
      }
      expect((await learner.from("user_learning_activity").update({ activity_minute: "2026-01-02T00:00:00Z" }).eq("user_id", studentId)).error?.code).toBe("42501");
      expect((await learner.from("user_learning_activity").delete().eq("user_id", studentId)).error?.code).toBe("42501");
      expect((await service.from("user_learning_activity").delete().eq("user_id", studentId)).error?.code).toBe("42501");
      const anon = createClient(api, process.env.NEXT_PUBLIC_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
      expect((await anon.from("user_learning_activity").select("topic_id")).error?.code).toBe("42501");
      expect(await activityCount(studentId)).toBe(1);
    });

    it("hides a learner's activity from another learner, the course's teacher-author and an admin", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, exercise: true }]);
      const topic = course.topics[0];
      await rpcAnswer(learner, topic.exerciseQ!, topic.exerciseQ!.right);
      expect(await activityCount(studentId)).toBe(1);

      for (const client of [other, teacher, adminClient]) {
        const read = await client.from("user_learning_activity").select("topic_id").eq("user_id", studentId);
        expect(read.error).toBeNull();
        expect(read.data).toEqual([]);
      }
    });

    it("lets no API role execute the write and read helpers and only authenticated call the summary RPC", async () => {
      const privateFunctions = [
        "private.feat3_record_learning_activity(uuid, uuid)", "private.feat3_record_answer_activity()",
        "private.feat3_record_card_activity()", "private.feat3_day_has_activity(uuid, uuid, date)",
        "private.feat3_streak(uuid, uuid, date)", "private.feat3_week_study_minutes(uuid, date, timestamptz)",
        "private.feat3_recent_topics(uuid, uuid, date, integer)", "private.feat3_ict_date(timestamptz)",
        "private.feat3_ict_day_start(date)",
      ];
      for (const fn of privateFunctions) {
        for (const role of ["public", "anon", "authenticated", "service_role"]) {
          expect(sql(`select has_function_privilege(${lit(role)}, ${lit(fn)}, 'execute')`), `${role} ${fn}`).toBe("f");
        }
      }
      expect(sql(`select string_agg(r || '=' || has_function_privilege(r, 'public.feat3_learning_summary(uuid)', 'execute')::text, ',' order by r)
                  from unnest(array['anon','authenticated','public','service_role']) r`))
        .toBe("anon=false,authenticated=true,public=false,service_role=false");
      expect(sql(`select p.prosecdef::text || '|' || array_to_string(p.proconfig, ',') from pg_proc p
                  where p.oid = 'public.feat3_learning_summary(uuid)'::regprocedure`)).toBe('true|search_path=""');
      for (const fn of ["feat3_record_answer_activity", "feat3_record_card_activity", "feat3_record_learning_activity"]) {
        expect((await learner.rpc(fn)).error, fn).not.toBeNull();
      }
      const anon = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
      expect((await anon.rpc("feat3_learning_summary")).error?.code).toBe("42501");
    });

    it("returns only the caller's own summary: another learner, a teacher-author and an admin get nothing for someone else", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0, exercise: true }]);
      const topic = course.topics[0];
      await rpcAnswer(learner, topic.exerciseQ!, topic.exerciseQ!.right);

      expect(await summary(learner)).toMatchObject({ streak: 1, studied_today: true });
      expect((await summary(learner, course.id)).recent_topics).toHaveLength(1);
      for (const client of [other, teacher, adminClient]) {
        expect(await summary(client)).toMatchObject({ streak: 0, studied_today: false, week_study_minutes: 0 });
        expect((await summary(client)).days!.every((d) => !d.studied)).toBe(true);
        expect(await summary(client, course.id)).toEqual({ streak: 0, studied_today: false, recent_topics: [] });
      }
    });

    it("deletes a user's activity together with the user", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0 }]);
      seed(otherId, course.topics[0], course, "now()");
      expect(activityCount(otherId)).toBe(1);
      expect((await service.auth.admin.deleteUser(otherId)).error).toBeNull();
      extraUsers.splice(extraUsers.indexOf(otherId), 1);
      expect(activityCount(otherId)).toBe(0);
      // Tạo lại một user phụ cho các test sau.
      otherId = randomUUID();
      extraUsers.push(otherId);
      const email = `feat3-${otherId}@example.com`;
      expect((await service.auth.admin.createUser({ id: otherId, email, password: "123123", email_confirm: true })).error).toBeNull();
      other = await signIn(email);
    });
  });

  describe("summary through the RPC with the database clock (AC2, AC3, AC5)", () => {
    it("returns a zero state with seven unstudied days ending today", async () => {
      const result = await summary(learner);
      expect(result).toMatchObject({ streak: 0, studied_today: false, week_study_minutes: 0 });
      expect(result.days).toHaveLength(7);
      expect(result.days!.every((d) => !d.studied)).toBe(true);
      const today = sql("select to_char(private.feat3_ict_date(now()), 'YYYY-MM-DD')");
      expect(result.days![6].date).toBe(today);
    });

    it.each([
      ["today only", [0], 1, true],
      ["yesterday only, today still empty", [1], 1, false],
      ["today and yesterday", [0, 1], 2, true],
      ["a run of three days ending yesterday", [1, 2, 3], 3, false],
      ["a break: today and two days ago", [0, 2], 1, true],
      ["nothing today or yesterday", [2, 3, 4], 0, false],
    ])("counts the streak for %s", async (_name, daysAgo, streak, studiedToday) => {
      const course = await buildCourse([{ chapter: 0, order: 0 }]);
      for (const ago of daysAgo) seed(studentId, course.topics[0], course, ago === 0 ? todayStart : `${dayStart(ago)} + interval '12 hours'`);
      const result = await summary(learner);
      expect(result).toMatchObject({ streak, studied_today: studiedToday });
      expect(result.days!.map((d) => d.studied)).toEqual([6, 5, 4, 3, 2, 1, 0].map((ago) => daysAgo.includes(ago)));
    });

    it("treats the Asia/Ho_Chi_Minh midnight as the day boundary, one minute before it still yesterday", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0 }]);
      seed(studentId, course.topics[0], course, `${todayStart} - interval '1 minute'`);
      expect(await summary(learner)).toMatchObject({ streak: 1, studied_today: false });
      seed(studentId, course.topics[0], course, todayStart);
      expect(await summary(learner)).toMatchObject({ streak: 2, studied_today: true });
    });

    it("computes a course streak from that course's actions only while the overall streak counts all courses", async () => {
      const first = await buildCourse([{ chapter: 0, order: 0 }]);
      const second = await buildCourse([{ chapter: 0, order: 0 }]);
      seed(studentId, first.topics[0], first, todayStart);
      seed(studentId, second.topics[0], second, `${todayStart} - interval '1 minute'`);

      expect(await summary(learner)).toMatchObject({ streak: 2, studied_today: true });
      expect(await summary(learner, first.id)).toMatchObject({ streak: 1, studied_today: true });
      expect(await summary(learner, second.id)).toMatchObject({ streak: 1, studied_today: false });
    });

    it("estimates this week's study minutes from the activity minute of the current moment", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0 }]);
      seed(studentId, course.topics[0], course, "date_trunc('minute', now())");
      expect((await summary(learner)).week_study_minutes).toBe(1);
    });
  });

  describe("fixed-date day, week and study-time rules", () => {
    const today = "date '2026-03-11'";
    const part = (fn: string, args: string) => sql(`select ${fn}(${args})`);

    it("applies the Asia/Ho_Chi_Minh day boundary (17:00 UTC) and the Monday week start", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0 }]);
      const t = course.topics[0];
      // 16:59 UTC ngày 10 = 23:59 ICT ngày 10; 17:00 UTC ngày 10 = 00:00 ICT ngày 11 (cùng ngày UTC, khác ngày ICT).
      seed(otherId, t, course, "timestamptz '2026-03-10 16:59:00+00'");
      expect(part("private.feat3_day_has_activity", `${lit(otherId)}, null, date '2026-03-10'`)).toBe("t");
      expect(part("private.feat3_day_has_activity", `${lit(otherId)}, null, date '2026-03-11'`)).toBe("f");
      seed(otherId, t, course, "timestamptz '2026-03-10 17:00:00+00'");
      expect(part("private.feat3_day_has_activity", `${lit(otherId)}, null, date '2026-03-11'`)).toBe("t");
      expect(part("private.feat3_streak", `${lit(otherId)}, null, ${today}`)).toBe("2");
      expect(part("private.feat3_streak", `${lit(otherId)}, ${lit(course.id)}, date '2026-03-12'`)).toBe("2");

      // Tuần bắt đầu thứ Hai 00:00 ICT = chủ nhật 17:00 UTC: 16:59 thuộc tuần trước, 17:00 thuộc tuần này.
      clearActivity(otherId);
      seed(otherId, t, course, "timestamptz '2026-03-08 16:59:00+00'");
      const minutes = () => part("private.feat3_week_study_minutes", `${lit(otherId)}, ${today}, timestamptz '2026-03-11 12:00:00+07'`);
      expect(minutes()).toBe("0");
      seed(otherId, t, course, "timestamptz '2026-03-08 17:00:00+00'");
      expect(minutes()).toBe("1");
      // Dòng sau thời điểm hiện tại không tính.
      seed(otherId, t, course, "timestamptz '2026-03-11 13:00:00+07'");
      expect(minutes()).toBe("1");
    });

    it("counts each activity minute once and bridges gaps of up to five minutes, never longer ones", async () => {
      const course = await buildCourse([{ chapter: 0, order: 0 }, { chapter: 0, order: 1 }]);
      const [a, b] = [topicAt(course, 0, 0), topicAt(course, 0, 1)];
      const at = (minute: number) => `timestamptz '2026-03-10 03:00:00+00' + interval '${minute} minutes'`;
      const minutes = () => part("private.feat3_week_study_minutes", `${lit(otherId)}, ${today}, timestamptz '2026-03-11 12:00:00+07'`);
      // Phút 0,1,2 liền nhau (3 phút) rồi khoảng cách 5 tới phút 7 (cầu nối 4 phút trống) = 8 phút; cùng phút ở hai topic gộp một.
      for (const m of [0, 1, 2, 7]) seed(otherId, a, course, at(m));
      seed(otherId, b, course, at(7));
      expect(minutes()).toBe("8");
      // Khoảng cách 6 (phút 13) không được cầu nối: thêm đúng 1 phút.
      seed(otherId, a, course, at(13));
      expect(minutes()).toBe("9");
    });
  });

  describe("recent topics of a course (AC6)", () => {
    // Vị trí trong course: c0t0, c0t1, c1t0, c1t1, c1t2.
    const specs: TopicSpec[] = [
      { chapter: 0, order: 0 }, { chapter: 0, order: 1 },
      { chapter: 1, order: 0 }, { chapter: 1, order: 1 }, { chapter: 1, order: 2 },
    ];
    const tied = `${dayStart(3)} + interval '10 hours'`;

    it("returns the three newest topics with relative days and a fixed order for same-minute ties", async () => {
      const course = await buildCourse(specs);
      seed(studentId, topicAt(course, 1, 1), course, todayStart);
      seed(studentId, topicAt(course, 1, 2), course, `${todayStart} - interval '1 minute'`);
      // Ba topic cùng một phút: thứ tự theo vị trí trong course, nên c0t1 và c1t0 vào top 3 còn c1t1... bị loại theo limit.
      for (const [chapter, order] of [[1, 0], [0, 1], [0, 0]]) seed(studentId, topicAt(course, chapter, order), course, tied);

      const expected = [[1, 1], [1, 2], [0, 0]].map(([c, o]) => topicAt(course, c, o).id);
      for (let call = 0; call < 3; call += 1) {
        const result = await summary(learner, course.id);
        expect(result.recent_topics!.map((t) => t.topic_id)).toEqual(expected);
        expect(result.recent_topics!.map((t) => t.days_ago)).toEqual([0, 1, 3]);
      }
      expect((await summary(learner, course.id)).recent_topics![0]).toMatchObject({
        slug: `feat3-${topicAt(course, 1, 1).id}`, title: "FEAT3 c1t1",
      });
    });

    it("skips a topic the learner can no longer see and fills the list from older ones", async () => {
      const course = await buildCourse(specs);
      const t = (chapter: number, order: number) => topicAt(course, chapter, order);
      seed(studentId, t(1, 2), course, todayStart);
      seed(studentId, t(1, 1), course, `${todayStart} - interval '1 minute'`);
      seed(studentId, t(1, 0), course, `${dayStart(2)} + interval '1 hour'`);
      seed(studentId, t(0, 1), course, `${dayStart(3)} + interval '1 hour'`);
      seed(studentId, t(0, 0), course, `${dayStart(4)} + interval '1 hour'`);
      const ids = async () => (await summary(learner, course.id)).recent_topics!.map((r) => r.topic_id);
      expect(await ids()).toEqual([t(1, 2).id, t(1, 1).id, t(1, 0).id]);

      await patch("topics", t(1, 2).id, { removed_at: new Date().toISOString() });
      expect(await ids()).toEqual([t(1, 1).id, t(1, 0).id, t(0, 1).id]);
      await patch("topics", t(1, 1).id, { status: "draft" });
      expect(await ids()).toEqual([t(1, 0).id, t(0, 1).id, t(0, 0).id]);
      await patch("chapters", course.chapterIds[1], { removed_at: new Date().toISOString() });
      expect(await ids()).toEqual([t(0, 1).id, t(0, 0).id]);
    });

    it("lists only topics of the requested course and nothing once the learner is no longer enrolled", async () => {
      const first = await buildCourse([{ chapter: 0, order: 0 }]);
      const second = await buildCourse([{ chapter: 0, order: 0 }]);
      seed(studentId, first.topics[0], first, todayStart);
      seed(studentId, second.topics[0], second, todayStart);
      expect((await summary(learner, first.id)).recent_topics!.map((t) => t.topic_id)).toEqual([first.topics[0].id]);

      expect((await service.from("enrollments").delete().eq("course_id", first.id)).error).toBeNull();
      expect(await summary(learner, first.id)).toMatchObject({ streak: 1, recent_topics: [] });
    });
  });

  describe("bounded reads for a long history (G6)", () => {
    const uid = () => studentId;
    // Mỗi phần chạy trong transaction riêng; bộ đếm pg_stat_xact_* là số dòng index/heap thật sự bị đọc trong transaction đó.
    const measure = (call: string, withClaim = false) => {
      const out = sql(`
        begin;
        ${withClaim ? `select set_config('request.jwt.claim.sub', ${lit(studentId)}, true);` : ""}
        select 'value=' || (${call})::text;
        select 'fetched=' || idx_tup_fetch || ' seq=' || seq_scan || ' seqrows=' || seq_tup_read
          from pg_stat_xact_user_tables where relname = 'user_learning_activity';
        rollback;`);
      const value = /value=(.*)/.exec(out)![1];
      const [, fetched, seq, seqRows] = /fetched=(\d+) seq=(\d+) seqrows=(\d+)/.exec(out)!;
      return { value, fetched: Number(fetched), seq: Number(seq), seqRows: Number(seqRows) };
    };

    it("reads rows bounded by the streak length, the window or the topic count, not by the size of the history", async () => {
      // 12 topic: 11 topic học đều và 1 topic chỉ học một lần từ lâu, để tra "dòng mới nhất của topic" gặp đúng ca lệch dữ liệu.
      const course = await buildCourse(Array.from({ length: 12 }, (_, order) => ({ chapter: order < 6 ? 0 : 1, order: order % 6 })));
      const ids = course.topics.slice(0, 11).map((t) => lit(t.id)).join(",");
      const oldTopic = course.topics[11];
      seed(studentId, oldTopic, course, "timestamptz '2025-12-01 08:00+07'");
      // Lịch sử dài: 97 ngày x 11 topic x 8 phút (khoảng 8.500 dòng), ngày 03-08 để trống, rồi 03-09..03-11 mỗi ngày 5 phút x 11 topic.
      sql(`
        insert into public.user_learning_activity (user_id, topic_id, course_id, activity_minute)
        select ${lit(studentId)}, t.id, ${lit(course.id)}, private.feat3_ict_day_start(d::date) + make_interval(hours => 8, mins => m)
        from unnest(array[${ids}]::uuid[]) as t(id), generate_series(date '2025-12-01', date '2026-03-07', interval '1 day') d, generate_series(0, 7) m;
        insert into public.user_learning_activity (user_id, topic_id, course_id, activity_minute)
        select ${lit(studentId)}, t.id, ${lit(course.id)}, private.feat3_ict_day_start(d::date) + make_interval(hours => 8, mins => m)
        from unnest(array[${ids}]::uuid[]) as t(id), generate_series(date '2026-03-09', date '2026-03-11', interval '1 day') d, generate_series(0, 4) m`);
      sql("analyze public.user_learning_activity"); // autovacuum làm việc này trong vận hành thật; test không chờ nó.
      const total = activityCount(studentId);
      expect(total).toBeGreaterThan(8000);
      const windowRows = Number(sql(`select count(*) from public.user_learning_activity where user_id = ${lit(studentId)}
        and activity_minute >= private.feat3_ict_day_start(date '2026-03-09')`));
      expect(windowRows).toBe(165);

      const overallStreak = measure(`private.feat3_streak(${lit(uid())}, null, date '2026-03-11')`);
      const courseStreak = measure(`private.feat3_streak(${lit(uid())}, ${lit(course.id)}, date '2026-03-11')`);
      const week = measure(`private.feat3_week_study_minutes(${lit(uid())}, date '2026-03-11', timestamptz '2026-03-11 12:00:00+07')`);
      const recent = measure(`private.feat3_recent_topics(${lit(uid())}, ${lit(course.id)}, date '2026-03-11', 3)`, true);
      const strip = measure(`(select count(*) filter (where private.feat3_day_has_activity(${lit(uid())}, null, d::date))
        from generate_series(date '2026-03-05', date '2026-03-11', interval '1 day') d)`);

      expect(overallStreak.value).toBe("3");
      expect(courseStreak.value).toBe("3");
      expect(week.value).toBe("15");
      expect(JSON.parse(recent.value)).toHaveLength(3);
      expect(strip.value).toBe("6");
      // Streak 3 ngày: 1 lần kiểm hôm nay + 3 ngày có + 1 ngày trống = 5 tra cứu, mỗi lần đọc nhiều nhất một dòng.
      expect(overallStreak.fetched).toBeLessThanOrEqual(5);
      expect(courseStreak.fetched).toBeLessThanOrEqual(5);
      // Tuần: chỉ cửa sổ thứ Hai tới giờ (45 dòng), không phải 8.700.
      expect(week.fetched).toBeLessThanOrEqual(windowRows);
      // Mỗi topic của course một lần tra dòng mới nhất (bộ đếm tính tối đa 2 lần đọc cho mỗi lần tra), không phụ thuộc độ dài lịch sử.
      expect(recent.fetched).toBeLessThanOrEqual(2 * course.topics.length);
      // Dải 7 ngày: tối đa một dòng mỗi ngày.
      expect(strip.fetched).toBeLessThanOrEqual(7);
      for (const m of [overallStreak, courseStreak, week, recent, strip]) {
        expect(m.seq).toBe(0);
        expect(m.seqRows).toBe(0);
      }

      // EXPLAIN của đúng các câu truy vấn trong migration: không Seq Scan, số dòng thực đọc bị chặn như trên.
      const explain = (query: string) => JSON.parse(sql(`explain (analyze, buffers, format json) ${query}`))[0].Plan as PlanNode;
      const dayProbe = explain(`select 1 from public.user_learning_activity a where a.user_id = ${lit(studentId)}
        and a.activity_minute >= private.feat3_ict_day_start(date '2026-03-08') and a.activity_minute < private.feat3_ict_day_start(date '2026-03-09')`);
      const weekWindow = explain(`select distinct a.activity_minute from public.user_learning_activity a where a.user_id = ${lit(studentId)}
        and a.activity_minute >= private.feat3_ict_day_start(date '2026-03-09') and a.activity_minute <= timestamptz '2026-03-11 12:00:00+07'`);
      const newest = explain(`select t.id, l.activity_minute from public.topics t cross join lateral (
          select a.activity_minute from public.user_learning_activity a where a.user_id = ${lit(studentId)} and a.topic_id = t.id
          order by a.activity_minute desc limit 1) l where t.course_id = ${lit(course.id)} and t.removed_at is null`);
      for (const plan of [dayProbe, weekWindow, newest]) {
        expect(nodes(plan).some((n) => n["Node Type"] === "Seq Scan" && n["Relation Name"] === "user_learning_activity")).toBe(false);
      }
      expect(rowsRead(dayProbe)).toBe(0);
      expect(rowsRead(weekWindow)).toBeLessThanOrEqual(windowRows);
      expect(rowsRead(newest)).toBeLessThanOrEqual(2 * course.topics.length);
    });
  });
});

type PlanNode = {
  "Node Type": string; "Relation Name"?: string; "Actual Rows": number; "Actual Loops": number;
  "Rows Removed by Filter"?: number; Plans?: PlanNode[];
};
function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap(nodes)];
}
// Dòng của user_learning_activity thật sự được quét (đã nhân số vòng lặp) trong một plan.
function rowsRead(plan: PlanNode): number {
  return nodes(plan)
    .filter((n) => n["Relation Name"] === "user_learning_activity")
    .reduce((sum, n) => sum + (n["Actual Rows"] + (n["Rows Removed by Filter"] ?? 0)) * n["Actual Loops"], 0);
}
