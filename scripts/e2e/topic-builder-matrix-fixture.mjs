import { createClient } from "@supabase/supabase-js";
import { ensureAuthUser } from "./support/auth-users.mjs";
import { upsertRow } from "./support/db-write.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

// Fixture QA cho topic builder TFEAT4: một khóa học với các bài học ở từng trạng thái vòng đời
// (nháp, chờ duyệt, bị từ chối, đã xuất bản) và ba vai trò (tác giả, cộng tác viên ngoài nhóm
// bài học, previewer trong nhóm bài học). Trạng thái chờ duyệt/bị từ chối đi qua RPC thật bằng
// tài khoản đã đăng nhập để trigger vòng đời chạy đúng như trong app.

const PASSWORD = "123123";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";

export const topicBuilderMatrix = {
  courseId: "7b000000-0000-4000-8000-000000000001",
  chapterId: "7b000000-0000-4000-8000-000000000002",
  courseSlug: "tfeat4-topic-builder-matrix",
  users: {
    admin: { id: ADMIN_ID, email: "admin@gmail.com" },
    teacher: { id: TEACHER_ID, email: "teacher@gmail.com" },
    outsider: { id: "7b000000-0000-4000-8000-0000000000a1", email: "tb.outsider@example.test" },
    previewer: { id: "7b000000-0000-4000-8000-0000000000a2", email: "tb.previewer@example.test" },
  },
  password: PASSWORD,
  topics: {
    draft: { id: "7b000000-0000-4000-8000-000000000011", title: "TB4 Nháp đầy đủ nội dung", slug: "tb4-draft" },
    pending: { id: "7b000000-0000-4000-8000-000000000012", title: "TB4 Đang chờ duyệt", slug: "tb4-pending" },
    rejected: { id: "7b000000-0000-4000-8000-000000000013", title: "TB4 Bị từ chối", slug: "tb4-rejected" },
    published: { id: "7b000000-0000-4000-8000-000000000014", title: "TB4 Đã xuất bản", slug: "tb4-published" },
    empty: { id: "7b000000-0000-4000-8000-000000000015", title: "TB4 Nháp trống", slug: "tb4-empty" },
  },
  rejectionReason: "Thiếu ví dụ cho từ vựng và câu 2 chưa có giải thích.",
};

// Quyền mong đợi lấy từ get_topic_workflow_state (nguồn của DTO), không suy từ tên vai trò.
export const expectedTopicBuilderMatrix = [
  { topic: "draft", user: "teacher", status: "draft", canEdit: true },
  { topic: "draft", user: "outsider", status: "draft", canEdit: false },
  { topic: "draft", user: "previewer", status: "draft", canEdit: true },
  { topic: "pending", user: "teacher", status: "pending", canEdit: true },
  { topic: "rejected", user: "teacher", status: "draft", canEdit: true },
  { topic: "published", user: "teacher", status: "published", canEdit: true },
  { topic: "published", user: "outsider", status: "published", canEdit: false },
];

function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

// Chỉ ghi vào Supabase local; database dev (không phải runtime E2E 45441) cần cờ rõ ràng.
function assertLocalTarget(env, { allowDevDatabase = false } = {}) {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error(`Refusing to seed the topic builder matrix on a non-local Supabase: ${url.origin}`);
  }
  if (url.port !== "45441" && !allowDevDatabase) {
    throw new Error(`Refusing to seed outside the isolated E2E runtime (${url.origin}) without --allow-dev-db.`);
  }
}

async function signIn(env, email) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  checked(await client.auth.signInWithPassword({ email, password: PASSWORD }), `Sign in ${email}`);
  return client;
}

let idCounter = 0x100;
function nextId() {
  idCounter += 1;
  return `7b000000-0000-4000-8000-${idCounter.toString(16).padStart(12, "0")}`;
}

async function addCards(supabase, topicId, words) {
  checked(
    await supabase.from("cards").insert(
      words.map(([word, translation, example], index) => ({
        id: nextId(),
        topic_id: topicId,
        front_content: { word, pos: "n", phonetic: example ? "/ˈsæmpəl/" : "" },
        back_content: { translation, example: example ?? "" },
        order_index: index + 1,
      })),
    ),
    "Create cards",
  );
}

async function addExercise(supabase, topicId, { title, partType, stage = "exercise", order }) {
  const id = nextId();
  checked(
    await supabase.from("exercises").insert({
      id,
      course_id: topicBuilderMatrix.courseId,
      topic_id: topicId,
      title,
      part_type: stage === "memory_check" ? null : partType,
      activity_stage: stage,
      order_index: order,
      removed_at: null,
    }),
    `Create exercise ${title}`,
  );
  return id;
}

async function addGroup(supabase, exerciseId, context) {
  const id = nextId();
  checked(
    await supabase.from("question_groups").insert({
      id,
      exercise_id: exerciseId,
      passage_text: context.passage ?? null,
      audio_url: context.audio ?? null,
      image_url: context.image ?? null,
      order_index: 1,
      removed_at: null,
    }),
    "Create group",
  );
  return id;
}

async function addQuestion(supabase, exerciseId, groupId, order, content, options, explanation = null) {
  const id = nextId();
  checked(
    await supabase.from("questions").insert({
      id,
      course_id: topicBuilderMatrix.courseId,
      exercise_id: exerciseId,
      group_id: groupId,
      content,
      explanation,
      order_index: order,
      removed_at: null,
    }),
    "Create question",
  );
  checked(
    await supabase.from("question_options").insert(
      options.map((optionContent, index) => ({
        id: nextId(),
        question_id: id,
        content: optionContent,
        label: String.fromCharCode(65 + index),
        order_index: index,
        is_correct: index === 0,
        removed_at: null,
      })),
    ),
    "Create options",
  );
}

async function addMinimalContent(supabase, topicId) {
  await addCards(supabase, topicId, [["budget", "ngân sách", "We cut the budget."]]);
  const exerciseId = await addExercise(supabase, topicId, { title: "Part 5 nhanh", partType: "part5", order: 1 });
  await addQuestion(supabase, exerciseId, null, 1, "The ___ was approved.", ["budget", "budgeted", "budgeting"]);
}

export async function seedTopicBuilderMatrix(env = process.env, options = {}) {
  assertLocalTarget(env, options);
  const supabase = createSupabaseAdmin(env);
  await cleanupTopicBuilderMatrix(env, options);
  idCounter = 0x100;
  const { courseId, chapterId, users, topics } = topicBuilderMatrix;

  for (const [key, user] of Object.entries({ outsider: users.outsider, previewer: users.previewer })) {
    await ensureAuthUser(supabase, {
      id: user.id,
      email: user.email,
      password: PASSWORD,
      fullName: key === "outsider" ? "TB Cộng tác viên ngoài nhóm" : "TB Previewer trong nhóm",
      username: `tb_${key}`,
    });
    await upsertRow(supabase, "profiles", {
      id: user.id,
      email: user.email,
      full_name: key === "outsider" ? "TB Cộng tác viên ngoài nhóm" : "TB Previewer trong nhóm",
      username: `tb_${key}`,
      role: "teacher",
      removed_at: null,
    });
  }

  checked(
    await supabase.from("courses").insert({
      id: courseId,
      title: "TFEAT4 Topic builder matrix",
      slug: topicBuilderMatrix.courseSlug,
      description: "Synthetic course for topic builder browser QA.",
      price: 0,
      status: "published",
      removed_at: null,
    }),
    "Create course",
  );
  checked(
    await supabase.from("course_collaborators").insert([
      { course_id: courseId, user_id: ADMIN_ID, role: "owner", added_by: ADMIN_ID, can_review_topics: true },
      { course_id: courseId, user_id: TEACHER_ID, role: "co_owner", added_by: ADMIN_ID, can_review_topics: false },
      { course_id: courseId, user_id: users.outsider.id, role: "editor", added_by: ADMIN_ID, can_review_topics: false },
      { course_id: courseId, user_id: users.previewer.id, role: "previewer", added_by: ADMIN_ID, can_review_topics: false },
    ]),
    "Add collaborators",
  );
  checked(
    await supabase.from("chapters").insert({
      id: chapterId,
      course_id: courseId,
      created_by_user_id: TEACHER_ID,
      title: "TB4 Chương kiểm thử",
      order_index: 1,
      removed_at: null,
    }),
    "Create chapter",
  );
  checked(
    await supabase.from("topics").insert(
      Object.entries(topics).map(([key, topic], index) => ({
        id: topic.id,
        course_id: courseId,
        chapter_id: chapterId,
        title: topic.title,
        slug: topic.slug,
        status: key === "published" ? "published" : "draft",
        first_approved_at: key === "published" ? "2026-10-01T08:00:00.000Z" : null,
        order_index: index + 1,
        original_creator_user_id: TEACHER_ID,
        responsible_author_user_id: TEACHER_ID,
        removed_at: null,
      })),
    ),
    "Create topics",
  );
  checked(
    await supabase.from("topic_contributors").insert({
      topic_id: topics.draft.id,
      user_id: users.previewer.id,
      added_by_user_id: TEACHER_ID,
    }),
    "Add previewer to the draft topic group",
  );

  // Bài nháp đầy đủ: thẻ có/thiếu ví dụ, memory check 1 câu, Part 1 có media, Part 7 có đoạn văn, Part 5.
  await addCards(supabase, topics.draft.id, [
    ["negotiate", "đàm phán", "We negotiate the contract."],
    ["deadline", "hạn chót"],
    ["invoice", "hóa đơn", "Please send the invoice."],
  ]);
  const memoryCheckId = await addExercise(supabase, topics.draft.id, {
    title: "Memory check",
    stage: "memory_check",
    order: 0,
  });
  await addQuestion(supabase, memoryCheckId, null, 1, "\"negotiate\" nghĩa là gì?", ["đàm phán", "hóa đơn"]);
  const part1 = await addExercise(supabase, topics.draft.id, { title: "Part 1 mô tả ảnh", partType: "part1", order: 1 });
  const part1Group = await addGroup(supabase, part1, {
    image: "https://placehold.co/640x400.png",
    audio: "https://example.com/tb4-part1.mp3",
  });
  await addQuestion(supabase, part1, part1Group, 1, "What is the man doing?", ["Signing a contract", "Eating lunch", "Driving"], "Người đàn ông đang ký hợp đồng.");
  const part7 = await addExercise(supabase, topics.draft.id, { title: "Part 7 đọc email", partType: "part7", order: 2 });
  const part7Group = await addGroup(supabase, part7, {
    passage: "Dear Ms. Lan,\nPlease find attached the invoice for the March order. Payment is due by Friday.",
  });
  await addQuestion(supabase, part7, part7Group, 1, "When is the payment due?", ["Friday", "Monday", "Next month"]);
  await addQuestion(supabase, part7, part7Group, 2, "What is attached?", ["An invoice", "A contract"]);
  await addMinimalContent(supabase, topics.published.id);
  await addMinimalContent(supabase, topics.pending.id);
  await addMinimalContent(supabase, topics.rejected.id);

  const teacher = await signIn(env, users.teacher.email);
  const admin = await signIn(env, users.admin.email);
  checked(await teacher.rpc("request_topic_review", { p_topic_id: topics.pending.id }), "Request review (pending)");
  checked(await teacher.rpc("request_topic_review", { p_topic_id: topics.rejected.id }), "Request review (rejected)");
  const submission = checked(
    await supabase
      .from("topic_review_submissions")
      .select("id")
      .eq("topic_id", topics.rejected.id)
      .eq("status", "pending")
      .single(),
    "Read submission to reject",
  );
  checked(
    await admin.rpc("reject_topic_review", { p_submission_id: submission.id, p_reason: topicBuilderMatrix.rejectionReason }),
    "Reject review",
  );

  return verifyTopicBuilderMatrix(env);
}

// Đọc lại từng ô của ma trận bằng chính tài khoản đó để QA chỉ bắt đầu khi quyền khớp kỳ vọng.
export async function verifyTopicBuilderMatrix(env = process.env) {
  const clients = {};
  const rows = [];
  for (const expected of expectedTopicBuilderMatrix) {
    clients[expected.user] ??= await signIn(env, topicBuilderMatrix.users[expected.user].email);
    const state = checked(
      await clients[expected.user].rpc("get_topic_workflow_state", {
        p_topic_id: topicBuilderMatrix.topics[expected.topic].id,
      }),
      `Read workflow ${expected.topic}/${expected.user}`,
    );
    const actual = { status: state.status, canEdit: state.canEdit };
    if (actual.status !== expected.status || actual.canEdit !== expected.canEdit) {
      throw new Error(
        `Topic builder matrix mismatch for ${expected.topic}/${expected.user}: expected ${JSON.stringify({
          status: expected.status,
          canEdit: expected.canEdit,
        })}, got ${JSON.stringify(actual)}`,
      );
    }
    rows.push({ ...expected, url: `/teacher/courses/${topicBuilderMatrix.courseId}/topics/${topicBuilderMatrix.topics[expected.topic].id}` });
  }
  return rows;
}

export async function cleanupTopicBuilderMatrix(env = process.env, options = {}) {
  assertLocalTarget(env, options);
  const supabase = createSupabaseAdmin(env);
  const { courseId } = topicBuilderMatrix;
  const topicIds = Object.values(topicBuilderMatrix.topics).map((topic) => topic.id);
  const questions = checked(await supabase.from("questions").select("id").eq("course_id", courseId), "Read questions");
  const questionIds = questions.map((row) => row.id);
  const exercises = checked(await supabase.from("exercises").select("id").eq("course_id", courseId), "Read exercises");
  const exerciseIds = exercises.map((row) => row.id);

  if (questionIds.length) {
    checked(await supabase.from("question_options").delete().in("question_id", questionIds), "Clean options");
    checked(await supabase.from("questions").delete().in("id", questionIds), "Clean questions");
  }
  if (exerciseIds.length) {
    checked(await supabase.from("question_groups").delete().in("exercise_id", exerciseIds), "Clean groups");
    checked(await supabase.from("exercises").delete().in("id", exerciseIds), "Clean exercises");
  }
  checked(await supabase.from("cards").delete().in("topic_id", topicIds), "Clean cards");
  checked(await supabase.from("topic_review_submissions").delete().in("topic_id", topicIds), "Clean submissions");
  checked(await supabase.from("topic_contributors").delete().in("topic_id", topicIds), "Clean contributors");
  checked(await supabase.from("topics").delete().eq("course_id", courseId), "Clean topics");
  checked(await supabase.from("chapters").delete().eq("course_id", courseId), "Clean chapter");
  checked(await supabase.from("course_collaborators").delete().eq("course_id", courseId), "Clean collaborators");
  checked(await supabase.from("courses").delete().eq("id", courseId), "Clean course");
}
