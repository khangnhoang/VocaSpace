import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra RLS cho xóa mềm flashcard sau khi thêm policy đọc thẻ đã xóa.
// - Loại test: integration/RLS.
// - Đối tượng: public.cards policies và helper quyền course/topic hiện có.
// - Case thành công:
//   - Teacher owner sửa field thường, xóa mềm card active, đọc lại card đã xóa, và active query không còn thấy card đó.
// - Case thất bại:
//   - Teacher không có quyền, learner, và anonymous không đọc hoặc xóa mềm card ngoài quyền.
// - Bảo mật/phân quyền:
//   - Service-role chỉ dựng fixture/cleanup/assert; hành động được kiểm quyền dùng client thường.
// - Ổn định/resilience:
//   - Dữ liệu fixture dùng UUID riêng và cleanup sau từng test.
// - Invariant cần giữ:
//   - Policy mới chỉ mở row đã xóa cho người có quyền quản trị khóa học qua topic cha.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEEDED_ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const SEEDED_TEACHER_EMAIL = "teacher@gmail.com";
const SEEDED_STUDENT_EMAIL = "student@gmail.com";
const SEEDED_PASSWORD = "123123";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ownerClient: SupabaseClient;
let learnerClient: SupabaseClient;
let outsiderTeacherClient: SupabaseClient;
let anonymousClient: SupabaseClient;
let outsiderTeacherId: string | null = null;

const createdCourseIds = new Set<string>();
const createdChapterIds = new Set<string>();
const createdTopicIds = new Set<string>();
const createdCardIds = new Set<string>();

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chặn test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true nếu chắc chắn đang dùng test/dev DB.",
    );
  }

  if (!SUPABASE_URL.startsWith("http://127.0.0.1:45321")) {
    throw new Error(
      `Chặn test DB integration vì Supabase URL không phải local: ${SUPABASE_URL}`,
    );
  }
}

async function signInUser(email: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password: SEEDED_PASSWORD,
  });

  if (error) throw new Error(`Không thể đăng nhập ${email}: ${error.message}`);
  return client;
}

async function createOutsiderTeacher() {
  const id = randomUUID();
  const email = `card-rls-teacher-${id}@example.com`;

  const { error: authError } = await supabaseAdmin.auth.admin.createUser({
    id,
    email,
    password: SEEDED_PASSWORD,
    email_confirm: true,
  });
  if (authError) throw new Error(`Không thể tạo teacher ngoài course: ${authError.message}`);

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id,
    email,
    full_name: "Card RLS Outsider Teacher",
    username: `card_rls_${id.slice(0, 8)}`,
    role: "teacher",
    removed_at: null,
  });
  if (profileError) throw new Error(`Không thể tạo profile teacher ngoài course: ${profileError.message}`);

  outsiderTeacherId = id;
  return signInUser(email);
}

async function createCourseFixture() {
  const suffix = randomUUID();
  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .insert({
      title: `Card RLS Course ${suffix}`,
      slug: `card-rls-course-${suffix}`,
      description: "Course fixture for card RLS test",
      price: 0,
      status: "published",
      removed_at: null,
    })
    .select("id")
    .single();
  if (courseError || !course) throw new Error(`Không thể tạo course fixture: ${courseError?.message}`);
  createdCourseIds.add(course.id);

  const { error: collaboratorError } = await supabaseAdmin.from("course_collaborators").insert({
    course_id: course.id,
    user_id: "22222222-2222-4222-8222-222222222222",
    role: "owner",
    added_by: SEEDED_ADMIN_ID,
  });
  if (collaboratorError) throw new Error(`Không thể tạo collaborator fixture: ${collaboratorError.message}`);

  const { data: chapter, error: chapterError } = await supabaseAdmin
    .from("chapters")
    .insert({
      course_id: course.id,
      title: `Card RLS Chapter ${suffix}`,
      order_index: 1,
      removed_at: null,
    })
    .select("id")
    .single();
  if (chapterError || !chapter) throw new Error(`Không thể tạo chapter fixture: ${chapterError?.message}`);
  createdChapterIds.add(chapter.id);

  const { data: topic, error: topicError } = await supabaseAdmin
    .from("topics")
    .insert({
      course_id: course.id,
      chapter_id: chapter.id,
      title: `Card RLS Topic ${suffix}`,
      slug: `card-rls-topic-${suffix}`,
      status: "published",
      order_index: 1,
      removed_at: null,
    })
    .select("id")
    .single();
  if (topicError || !topic) throw new Error(`Không thể tạo topic fixture: ${topicError?.message}`);
  createdTopicIds.add(topic.id);

  return { courseId: course.id as string, topicId: topic.id as string };
}

async function createCardFixture(topicId: string, label: string) {
  const { data, error } = await supabaseAdmin
    .from("cards")
    .insert({
      topic_id: topicId,
      front_content: { word: label, pos: "n", phonetic: "" },
      back_content: { translation: "before", explanation: "" },
      order_index: 1,
      removed_at: null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Không thể tạo card fixture: ${error?.message}`);
  createdCardIds.add(data.id);
  return data.id as string;
}

async function cleanupFixtures() {
  const cardIds = Array.from(createdCardIds);
  const topicIds = Array.from(createdTopicIds);
  const chapterIds = Array.from(createdChapterIds);
  const courseIds = Array.from(createdCourseIds);
  createdCardIds.clear();
  createdTopicIds.clear();
  createdChapterIds.clear();
  createdCourseIds.clear();

  if (cardIds.length > 0) await supabaseAdmin.from("cards").delete().in("id", cardIds);
  if (topicIds.length > 0) await supabaseAdmin.from("topics").delete().in("id", topicIds);
  if (chapterIds.length > 0) await supabaseAdmin.from("chapters").delete().in("id", chapterIds);
  if (courseIds.length > 0) {
    await supabaseAdmin.from("course_collaborators").delete().in("course_id", courseIds);
    await supabaseAdmin.from("courses").delete().in("id", courseIds);
  }
}

describe.sequential("cards RLS soft delete", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();
    ownerClient = await signInUser(SEEDED_TEACHER_EMAIL);
    learnerClient = await signInUser(SEEDED_STUDENT_EMAIL);
    outsiderTeacherClient = await createOutsiderTeacher();
    anonymousClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    if (!outsiderTeacherId) return;

    await supabaseAdmin.from("profiles").delete().eq("id", outsiderTeacherId);
    await supabaseAdmin.auth.admin.deleteUser(outsiderTeacherId);
  });

  it("allows only authorized course management users to soft-delete and read deleted cards", async () => {
    const { topicId } = await createCourseFixture();
    const cardId = await createCardFixture(topicId, `Card RLS ${randomUUID()}`);
    const outsiderCardId = await createCardFixture(topicId, `Card RLS Outsider ${randomUUID()}`);

    const { data: activeBefore, error: activeBeforeError } = await ownerClient
      .from("cards")
      .select("id, removed_at")
      .eq("id", cardId)
      .is("removed_at", null)
      .single();
    expect(activeBeforeError).toBeNull();
    expect(activeBefore).toMatchObject({ id: cardId, removed_at: null });

    const { data: ordinaryUpdate, error: ordinaryUpdateError } = await ownerClient
      .from("cards")
      .update({ back_content: { translation: "after ordinary update" } })
      .eq("id", cardId)
      .is("removed_at", null)
      .select("id, removed_at")
      .single();
    expect(ordinaryUpdateError).toBeNull();
    expect(ordinaryUpdate).toMatchObject({ id: cardId, removed_at: null });

    const { data: softDeleted, error: softDeleteError } = await ownerClient
      .from("cards")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", cardId)
      .is("removed_at", null)
      .select("id, removed_at")
      .single();
    expect(softDeleteError).toBeNull();
    expect(softDeleted?.id).toBe(cardId);
    expect(softDeleted?.removed_at).not.toBeNull();

    const { data: activeAfter, error: activeAfterError } = await ownerClient
      .from("cards")
      .select("id")
      .eq("id", cardId)
      .is("removed_at", null);
    expect(activeAfterError).toBeNull();
    expect(activeAfter).toEqual([]);

    const { data: deletedVisibleToOwner, error: deletedOwnerError } = await ownerClient
      .from("cards")
      .select("id, removed_at")
      .eq("id", cardId)
      .single();
    expect(deletedOwnerError).toBeNull();
    expect(deletedVisibleToOwner?.removed_at).not.toBeNull();

    for (const deniedClient of [outsiderTeacherClient, learnerClient, anonymousClient]) {
      const { data: deniedRead, error: deniedReadError } = await deniedClient
        .from("cards")
        .select("id")
        .eq("id", cardId);
      expect(deniedReadError).toBeNull();
      expect(deniedRead).toEqual([]);

      const { data: deniedDelete } = await deniedClient
        .from("cards")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", outsiderCardId)
        .is("removed_at", null)
        .select("id");
      expect(deniedDelete ?? []).toEqual([]);
    }

    const { data: outsiderCardState, error: outsiderCardError } = await supabaseAdmin
      .from("cards")
      .select("id, removed_at")
      .eq("id", outsiderCardId)
      .single();
    expect(outsiderCardError).toBeNull();
    expect(outsiderCardState).toMatchObject({
      id: outsiderCardId,
      removed_at: null,
    });
  });
});
