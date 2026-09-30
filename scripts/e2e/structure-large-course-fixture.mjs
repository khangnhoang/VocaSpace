import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ensureAuthUser } from "./support/auth-users.mjs";
import { createBaseAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";
import { upsertRow } from "./support/db-write.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

// UI-4 D3: khóa học lớn chỉ dùng lúc test để review và QA màn Structure trên
// Supabase cục bộ. Không đụng seed.sql; chạy lại sẽ dựng lại đúng cùng trạng thái.
export const structureLargeCourseFixture = {
  adminId: "11111111-1111-4111-8111-111111111111",
  teacherId: "22222222-2222-4222-8222-222222222222",
  teacherEmail: "teacher@gmail.com",
  teacherPassword: "123123",
  previewerId: "55555555-5555-4555-8555-5555555555d3",
  previewerEmail: "structure-previewer@gmail.com",
  courseId: "44444444-4444-4444-8444-4444444444d3",
  ownerCollaboratorId: "77777777-7777-4777-8777-7777777777d3",
  previewerCollaboratorId: "77777777-7777-4777-8777-7777777777d4",
  activeChapterCount: 22,
  busyChapterTopicStatuses: [
    "published",
    "draft",
    "pending",
    "published",
    "draft",
    "pending",
    "draft",
    "published",
  ],
  removedChapterTitle: "Chương đã xóa để khôi phục",
};

const fixture = structureLargeCourseFixture;

export async function prepareStructureLargeCourseFixture(env = process.env) {
  const { supabase } = await createBaseAuthoringFixture({
    env,
    fixture,
    teacherProfile: {
      bio: "Local teacher account for UI-4 structure review.",
      experience_years: 1,
      certifications: "Local structure fixture",
    },
    course: {
      title: "Khóa học cấu trúc lớn (UI-4)",
      slug: "ui-4-large-structure-course",
      description: "Khóa học cục bộ để review màn cấu trúc với nhiều chương.",
      price: 0,
      status: "draft",
      order_index: 90,
      removed_at: null,
    },
    collaborator: { id: fixture.ownerCollaboratorId },
  });

  await ensureAuthUser(supabase, {
    id: fixture.previewerId,
    email: fixture.previewerEmail,
    password: fixture.teacherPassword,
    fullName: "Structure Previewer",
    username: "structure_previewer",
  });
  await upsertRow(supabase, "profiles", {
    id: fixture.previewerId,
    email: fixture.previewerEmail,
    full_name: "Structure Previewer",
    username: "structure_previewer",
    role: "teacher",
    removed_at: null,
  });
  await upsertRow(
    supabase,
    "course_collaborators",
    {
      id: fixture.previewerCollaboratorId,
      course_id: fixture.courseId,
      user_id: fixture.previewerId,
      role: "previewer",
      added_by: fixture.teacherId,
    },
    "course_id,user_id",
  );

  await cleanupStructureContent(supabase);

  const chapterRows = Array.from({ length: fixture.activeChapterCount }, (_, index) => ({
    course_id: fixture.courseId,
    title: `Chương ${index + 1}: ${chapterTopics[index % chapterTopics.length]}`,
    order_index: index + 1,
    created_by_user_id: fixture.teacherId,
    removed_at: null,
  }));
  chapterRows.push({
    course_id: fixture.courseId,
    title: fixture.removedChapterTitle,
    order_index: fixture.activeChapterCount + 1,
    created_by_user_id: fixture.teacherId,
    removed_at: new Date().toISOString(),
  });
  const { data: chapters, error: chapterError } = await supabase
    .from("chapters")
    .insert(chapterRows)
    .select("id, order_index");
  if (chapterError || !chapters) {
    throw new Error(`Cannot prepare fixture chapters: ${chapterError?.message}`);
  }
  const chapterIdByOrder = new Map(chapters.map((chapter) => [chapter.order_index, chapter.id]));

  // Chương 1 dày bài học với đủ trạng thái; vài chương sau có 1–3 bài; phần còn lại trống.
  const topicRows = fixture.busyChapterTopicStatuses.map((status, index) =>
    topicRow(chapterIdByOrder.get(1), index, status),
  );
  for (const order of [2, 3, 5, 8]) {
    for (let index = 0; index < (order % 3) + 1; index += 1) {
      topicRows.push(topicRow(chapterIdByOrder.get(order), index, "draft"));
    }
  }
  topicRows.push(topicRow(chapterIdByOrder.get(fixture.activeChapterCount + 1), 0, "draft"));

  const { data: topics, error: topicError } = await supabase
    .from("topics")
    .insert(topicRows)
    .select("id, status");
  if (topicError || !topics) {
    throw new Error(`Cannot prepare fixture topics: ${topicError?.message}`);
  }

  const pendingSubmissions = topics
    .filter((topic) => topic.status === "pending")
    .map((topic) => ({
      topic_id: topic.id,
      submitted_by_user_id: fixture.teacherId,
      status: "pending",
      attempt_number: 1,
    }));
  const { error: submissionError } = await supabase
    .from("topic_review_submissions")
    .insert(pendingSubmissions);
  if (submissionError) {
    throw new Error(`Cannot prepare fixture topic_review_submissions: ${submissionError.message}`);
  }

  return {
    courseId: fixture.courseId,
    activeChapters: fixture.activeChapterCount,
    removedChapters: 1,
    busyChapterTopics: fixture.busyChapterTopicStatuses.length,
    teacherEmail: fixture.teacherEmail,
    previewerEmail: fixture.previewerEmail,
  };
}

export async function cleanupStructureLargeCourseFixture(env = process.env) {
  const supabase = createSupabaseAdmin(env);
  await cleanupStructureContent(supabase);
  await deleteRows(supabase, "course_collaborators", "course_id", fixture.courseId);
  await deleteRows(supabase, "courses", "id", fixture.courseId);
}

const chapterTopics = [
  "Chào hỏi",
  "Gia đình",
  "Công việc",
  "Du lịch",
  "Mua sắm",
  "Sức khỏe",
  "Họp hành",
];

function topicRow(chapterId, index, status) {
  return {
    course_id: fixture.courseId,
    chapter_id: chapterId,
    title: `Bài ${index + 1} (${statusLabel[status]})`,
    status,
    order_index: index + 1,
    original_creator_user_id: fixture.teacherId,
    responsible_author_user_id: fixture.teacherId,
    is_preview: false,
    first_approved_at: status === "published" ? "2026-09-01T00:00:00.000Z" : null,
  };
}

const statusLabel = { draft: "nháp", pending: "chờ duyệt", published: "đã xuất bản" };

async function cleanupStructureContent(supabase) {
  const { data: topics, error } = await supabase
    .from("topics")
    .select("id")
    .eq("course_id", fixture.courseId);
  if (error) throw new Error(`Cannot inspect fixture topics: ${error.message}`);

  const topicIds = (topics ?? []).map((topic) => topic.id);
  if (topicIds.length > 0) {
    await deleteRows(supabase, "topic_review_submissions", "topic_id", topicIds);
  }
  await deleteRows(supabase, "topics", "course_id", fixture.courseId);
  await deleteRows(supabase, "chapters", "course_id", fixture.courseId);
}

async function deleteRows(supabase, table, column, value) {
  const query = supabase.from(table).delete();
  const { error } = Array.isArray(value) ? await query.in(column, value) : await query.eq(column, value);
  if (error) throw new Error(`Cannot clean fixture ${table}: ${error.message}`);
}

// CLI: `node scripts/e2e/structure-large-course-fixture.mjs [prepare|cleanup]`
// Chỉ chạy trên stack Supabase E2E cục bộ (.e2e-runtime), không in khóa nào.
async function main() {
  const command = process.argv[2] ?? "prepare";
  const env = { ...process.env, ...readLocalE2eSupabaseEnv() };

  if (command === "cleanup") {
    await cleanupStructureLargeCourseFixture(env);
    console.log(`Removed UI-4 large structure course ${fixture.courseId}.`);
    return;
  }
  if (command !== "prepare") throw new Error(`Unknown command: ${command}`);

  const summary = await prepareStructureLargeCourseFixture(env);
  console.log(JSON.stringify(summary, null, 2));
}

function readLocalE2eSupabaseEnv() {
  const repoRoot = resolve(import.meta.dirname, "..", "..");
  // Windows cần gọi npx.cmd qua cmd.exe; các đối số ở đây là hằng số, không lấy từ input.
  const [command, args] =
    process.platform === "win32"
      ? [process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx.cmd supabase --workdir .e2e-runtime status -o env"]]
      : ["npx", ["supabase", "--workdir", ".e2e-runtime", "status", "-o", "env"]];
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error("Cannot read the local E2E Supabase status. Run `npm run test:e2e` once first.");
  }

  const values = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, "");
  }

  const url = new URL(values.API_URL ?? "");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error(`Refusing to write fixtures to a non-local Supabase URL: ${url.origin}`);
  }
  if (!values.SERVICE_ROLE_KEY) throw new Error("Local E2E Supabase status is missing SERVICE_ROLE_KEY.");

  return {
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
