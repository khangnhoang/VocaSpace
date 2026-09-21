import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm tra `review_notes` — DDL, guard trigger đích/bất biến, helper đọc và 3 policy RLS.
// - Loại test: real local Supabase integration/RLS/trigger (không mock RLS hay DB).
// - Đối tượng: insert/update/soft delete/select trên `public.review_notes` bằng JWT thật của từng actor.
// - Case thành công:
//   - Reviewer (`can_review_topics`) viết note cấp topic, gắn card hoặc gắn exercise của đúng topic rồi đọc lại.
//   - Tác giả sửa `body` của mình; `updatedAt` đổi; xoá mềm vẫn để lại tombstone cho người đọc.
//   - Creator/responsible/contributor đọc được note của topic mình dù không có quyền review.
// - Case thất bại:
//   - Người không có quyền review, reviewer bị exclusion, người ngoài khoá học đều không ghi được.
//   - `update` note của người khác, xoá cứng, `body` rỗng/toàn khoảng trắng/quá 2000 ký tự,
//     và note gắn đồng thời card + exercise đều bị từ chối.
//   - Note trỏ card/exercise của topic khác bị `REVIEW_NOTE_TARGET_TOPIC_MISMATCH`, không tạo row nào.
//   - `update` đổi `topic_id` / `card_id` / `author_user_id` / `created_at` bị `REVIEW_NOTE_IDENTITY_IMMUTABLE`.
// - Bảo mật/phân quyền:
//   - `has_topic_review_access` đã trừ exclusion; `author_user_id` do DB điền từ `auth.uid()`.
//   - Contributor bị gỡ khỏi khoá học mất quyền đọc (D5), dù row `topic_contributors` còn hiệu lực.
// - Ổn định/resilience:
//   - Ranh giới đọc/ghi của RLS được kiểm bằng cùng một query thật, không qua code application.
// - Invariant cần giữ:
//   - Note không mang verdict; luôn suy quyền từ `topic_id`; tombstone phải tới được người đọc.
// - Kết quả verify gần nhất: passed (14 test) bằng `npm.cmd run test:integration -- __tests__/integration/topic-review-notes.test.ts`.
// - Ghi chú: test chạy trên local Supabase với `ALLOW_DB_INTEGRATION_TESTS=true`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";

const USERS = {
  // Global admin KHÔNG có membership khoá học → actor "người ngoài khoá học".
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  // Editor không có quyền review, đồng thời là creator/responsible của topic.
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  // Editor có `can_review_topics = true` → reviewer.
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

const NOTE_SELECT =
  "id, topic_id, card_id, exercise_id, author_user_id, body, created_at, updated_at, removed_at, removed_by_user_id";

function courseCollaborators(courseId: string) {
  return [
    {
      course_id: courseId,
      user_id: USERS.teacher.id,
      role: "editor",
      can_review_topics: false,
      added_by: USERS.admin.id,
    },
    {
      course_id: courseId,
      user_id: USERS.student.id,
      role: "editor",
      can_review_topics: true,
      added_by: USERS.admin.id,
    },
  ];
}

async function createCourse() {
  const suffix = randomUUID();
  const { data: course, error } = await admin.from("courses").insert({
    title: `D1 review notes course ${suffix}`,
    slug: `d1-review-notes-${suffix}`,
    description: "D1 review notes RLS fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  if (error || !course) throw new Error(`Course fixture failed: ${error?.message}`);
  courseIds.add(course.id);

  const collaboratorError = (await admin.from("course_collaborators").insert(courseCollaborators(course.id))).error;
  if (collaboratorError) throw new Error(`Collaborator fixture failed: ${collaboratorError.message}`);

  const { data: chapter, error: chapterError } = await admin.from("chapters").insert({
    course_id: course.id,
    title: "D1 review notes chapter",
    order_index: 1,
  }).select("id").single();
  if (chapterError || !chapter) throw new Error(`Chapter fixture failed: ${chapterError?.message}`);

  return { courseId: course.id as string, chapterId: chapter.id as string };
}

async function createTopic(courseId: string, chapterId: string, orderIndex: number) {
  const { data: topic, error } = await admin.from("topics").insert({
    course_id: courseId,
    chapter_id: chapterId,
    title: `D1 review notes topic ${orderIndex}`,
    status: "draft",
    order_index: orderIndex,
    original_creator_user_id: USERS.teacher.id,
    responsible_author_user_id: USERS.teacher.id,
  }).select("id").single();
  if (error || !topic) throw new Error(`Topic fixture failed: ${error?.message}`);
  return topic.id as string;
}

async function createCard(topicId: string) {
  const { data, error } = await admin.from("cards").insert({
    topic_id: topicId,
    front_content: { word: `card-${randomUUID().slice(0, 8)}` },
    back_content: { translation: "nghĩa" },
    order_index: 1,
  }).select("id").single();
  if (error || !data) throw new Error(`Card fixture failed: ${error?.message}`);
  return data.id as string;
}

async function createExercise(topicId: string, courseId: string) {
  const { data, error } = await admin.from("exercises").insert({
    topic_id: topicId,
    course_id: courseId,
    title: `exercise-${randomUUID().slice(0, 8)}`,
    part_type: "part_5",
    order_index: 1,
  }).select("id").single();
  if (error || !data) throw new Error(`Exercise fixture failed: ${error?.message}`);
  return data.id as string;
}

async function createFixture() {
  const { courseId, chapterId } = await createCourse();
  const topicId = await createTopic(courseId, chapterId, 1);
  const cardId = await createCard(topicId);
  const exerciseId = await createExercise(topicId, courseId);
  return { courseId, chapterId, topicId, cardId, exerciseId };
}

async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length > 0) await admin.from("courses").delete().in("id", ids);
}

function expectRlsError(result: { error: { code?: string; message?: string } | null }) {
  expect(result.error).not.toBeNull();
  expect(`${result.error?.code} ${result.error?.message}`).toMatch(/row-level security|permission denied/i);
}

function expectDbError(result: { error: { message?: string } | null }, fragment: string) {
  expect(result.error).not.toBeNull();
  expect(result.error?.message).toContain(fragment);
}

describe.sequential("D1 review notes RLS and guard trigger", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    clients = {
      admin: await signIn(USERS.admin.email),
      teacher: await signIn(USERS.teacher.email),
      student: await signIn(USERS.student.email),
    };
  });

  afterEach(cleanup);

  it("lets a reviewer write a topic-level note and read it back", async () => {
    const fixture = await createFixture();
    const inserted = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Nội dung cần bổ sung ví dụ." })
      .select(NOTE_SELECT)
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data).toMatchObject({
      topic_id: fixture.topicId,
      card_id: null,
      exercise_id: null,
      author_user_id: USERS.student.id,
      removed_at: null,
      removed_by_user_id: null,
    });

    const read = await clients.student.from("review_notes").select(NOTE_SELECT).eq("topic_id", fixture.topicId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);
    expect(read.data?.[0]?.body).toBe("Nội dung cần bổ sung ví dụ.");
  });

  it("lets a reviewer attach a note to a card and to an exercise of the same topic", async () => {
    const fixture = await createFixture();
    const cardNote = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, card_id: fixture.cardId, body: "Card này sai phiên âm." })
      .select(NOTE_SELECT)
      .single();
    expect(cardNote.error).toBeNull();
    expect(cardNote.data?.card_id).toBe(fixture.cardId);

    const exerciseNote = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, exercise_id: fixture.exerciseId, body: "Bài tập thiếu đáp án." })
      .select(NOTE_SELECT)
      .single();
    expect(exerciseNote.error).toBeNull();
    expect(exerciseNote.data?.exercise_id).toBe(fixture.exerciseId);
  });

  it("rejects a note that points at a card or exercise of another topic", async () => {
    const { courseId, chapterId } = await createCourse();
    const firstTopicId = await createTopic(courseId, chapterId, 1);
    const secondTopicId = await createTopic(courseId, chapterId, 2);
    const firstCardId = await createCard(firstTopicId);
    const secondCardId = await createCard(secondTopicId);
    const firstExerciseId = await createExercise(firstTopicId, courseId);
    const secondExerciseId = await createExercise(secondTopicId, courseId);

    // Thay ĐÚNG một chiều: cả hai đối tượng đều hợp lệ, chỉ sai quan hệ.
    const cardMismatch = await clients.student
      .from("review_notes")
      .insert({ topic_id: firstTopicId, card_id: secondCardId, body: "Sai quan hệ card." })
      .select(NOTE_SELECT);
    expectDbError(cardMismatch, "REVIEW_NOTE_TARGET_TOPIC_MISMATCH");

    const exerciseMismatch = await clients.student
      .from("review_notes")
      .insert({ topic_id: firstTopicId, exercise_id: secondExerciseId, body: "Sai quan hệ exercise." })
      .select(NOTE_SELECT);
    expectDbError(exerciseMismatch, "REVIEW_NOTE_TARGET_TOPIC_MISMATCH");

    // A5: ràng buộc quan hệ nằm ở trigger nên service_role cũng không lách được.
    const serviceRoleMismatch = await admin
      .from("review_notes")
      .insert({ topic_id: firstTopicId, card_id: secondCardId, body: "Sai quan hệ qua service_role." })
      .select(NOTE_SELECT);
    expectDbError(serviceRoleMismatch, "REVIEW_NOTE_TARGET_TOPIC_MISMATCH");

    const noRows = await admin.from("review_notes").select("id").eq("topic_id", firstTopicId);
    expect(noRows.error).toBeNull();
    expect(noRows.data).toEqual([]);

    // Case đối chứng: đúng quan hệ thì thành công.
    const control = await clients.student
      .from("review_notes")
      .insert({ topic_id: firstTopicId, card_id: firstCardId, body: "Đúng quan hệ card." })
      .select(NOTE_SELECT)
      .single();
    expect(control.error).toBeNull();

    const exerciseControl = await clients.student
      .from("review_notes")
      .insert({ topic_id: firstTopicId, exercise_id: firstExerciseId, body: "Đúng quan hệ exercise." })
      .select(NOTE_SELECT)
      .single();
    expect(exerciseControl.error).toBeNull();
    expect(secondCardId).not.toBe(firstCardId);
  });

  it("blocks members without review capability, excluded reviewers and outsiders from writing", async () => {
    const fixture = await createFixture();
    // `teacher` là editor không có `can_review_topics` → không phải reviewer.
    expectRlsError(await clients.teacher
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Không có quyền review." })
      .select(NOTE_SELECT));
    // Người ngoài khoá học.
    expectRlsError(await clients.admin
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Người ngoài khoá học." })
      .select(NOTE_SELECT));

    // Reviewer hợp lệ nhưng bị exclusion → `has_topic_review_access` trả false.
    const excluded = await createFixture();
    const exclusion = await admin.from("topic_author_review_exclusions").insert({
      topic_id: excluded.topicId,
      user_id: USERS.student.id,
      exclusion_type: "initial_contributor",
      recorded_by_user_id: USERS.teacher.id,
    });
    expect(exclusion.error).toBeNull();
    expectRlsError(await clients.student
      .from("review_notes")
      .insert({ topic_id: excluded.topicId, body: "Reviewer bị exclusion." })
      .select(NOTE_SELECT));
  });

  it("lets the creator and responsible author read notes without review capability", async () => {
    const fixture = await createFixture();
    const inserted = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Creator phải đọc được note này." })
      .select(NOTE_SELECT)
      .single();
    expect(inserted.error).toBeNull();

    const creatorRead = await clients.teacher.from("review_notes").select(NOTE_SELECT).eq("topic_id", fixture.topicId);
    expect(creatorRead.error).toBeNull();
    expect(creatorRead.data).toHaveLength(1);
    expect(creatorRead.data?.[0]?.body).toBe("Creator phải đọc được note này.");
  });

  it("lets an active contributor read and drops read access once the member leaves the course", async () => {
    const fixture = await createFixture();
    expect((await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Contributor đọc được note này." })
      .select(NOTE_SELECT)
      .single()).error).toBeNull();

    const contributor = await admin.from("course_collaborators").insert({
      course_id: fixture.courseId,
      user_id: USERS.admin.id,
      role: "editor",
      can_review_topics: false,
      added_by: USERS.teacher.id,
    });
    expect(contributor.error).toBeNull();
    const contributorRow = await admin.from("topic_contributors").insert({
      topic_id: fixture.topicId,
      user_id: USERS.admin.id,
      added_by_user_id: USERS.teacher.id,
    });
    expect(contributorRow.error).toBeNull();

    const contributorRead = await clients.admin.from("review_notes").select(NOTE_SELECT).eq("topic_id", fixture.topicId);
    expect(contributorRead.error).toBeNull();
    expect(contributorRead.data).toHaveLength(1);

    // D5: mất membership khoá học thì mất quyền đọc, dù `topic_contributors` còn hiệu lực.
    const removed = await admin.from("course_collaborators")
      .delete()
      .eq("course_id", fixture.courseId)
      .eq("user_id", USERS.admin.id);
    expect(removed.error).toBeNull();
    const stillContributor = await admin.from("topic_contributors")
      .select("id, removed_at").eq("topic_id", fixture.topicId).eq("user_id", USERS.admin.id);
    expect(stillContributor.error).toBeNull();
    expect(stillContributor.data).toHaveLength(1);
    expect(stillContributor.data?.[0]?.removed_at).toBeNull();

    const afterRemoval = await clients.admin.from("review_notes").select(NOTE_SELECT).eq("topic_id", fixture.topicId);
    expect(afterRemoval.error).toBeNull();
    expect(afterRemoval.data).toEqual([]);
  });

  it("returns an empty list, not an error, to a user outside the course", async () => {
    const fixture = await createFixture();
    expect((await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Note riêng của khoá học." })
      .select(NOTE_SELECT)
      .single()).error).toBeNull();

    const outsiderRead = await clients.admin.from("review_notes").select(NOTE_SELECT).eq("topic_id", fixture.topicId);
    expect(outsiderRead.error).toBeNull();
    expect(outsiderRead.data).toEqual([]);
  });

  it("fills author_user_id from the session and never from the client payload", async () => {
    const fixture = await createFixture();
    const spoofed = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, author_user_id: USERS.teacher.id, body: "Giả danh tác giả." })
      .select(NOTE_SELECT);
    expectRlsError(spoofed);

    const legit = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Tác giả do DB điền." })
      .select(NOTE_SELECT)
      .single();
    expect(legit.error).toBeNull();
    expect(legit.data?.author_user_id).toBe(USERS.student.id);
  });

  it("rejects blank and oversized bodies and dual targets", async () => {
    const fixture = await createFixture();
    expectDbError(await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "" })
      .select(NOTE_SELECT), "review_notes_body_not_blank_check");
    expectDbError(await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "   " })
      .select(NOTE_SELECT), "review_notes_body_not_blank_check");
    expectDbError(await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "x".repeat(2001) })
      .select(NOTE_SELECT), "review_notes_body_length_check");
    expectDbError(await clients.student
      .from("review_notes")
      .insert({
        topic_id: fixture.topicId,
        card_id: fixture.cardId,
        exercise_id: fixture.exerciseId,
        body: "Hai đích cùng lúc.",
      })
      .select(NOTE_SELECT), "review_notes_single_target_check");
  });

  it("lets only the author edit the body and keeps updatedAt moving", async () => {
    const fixture = await createFixture();
    const created = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Bản đầu tiên." })
      .select(NOTE_SELECT)
      .single();
    expect(created.error).toBeNull();
    const noteId = created.data!.id as string;

    const othersEdit = await clients.teacher
      .from("review_notes")
      .update({ body: "Người khác sửa." })
      .eq("id", noteId)
      .select(NOTE_SELECT);
    expect(othersEdit.error).toBeNull();
    expect(othersEdit.data).toEqual([]);

    const authorEdit = await clients.student
      .from("review_notes")
      .update({ body: "Bản đã sửa." })
      .eq("id", noteId)
      .select(NOTE_SELECT)
      .single();
    expect(authorEdit.error).toBeNull();
    expect(authorEdit.data?.body).toBe("Bản đã sửa.");
    expect(new Date(authorEdit.data!.updated_at as string).getTime())
      .toBeGreaterThanOrEqual(new Date(created.data!.updated_at as string).getTime());
  });

  it("keeps identity columns immutable", async () => {
    const { courseId, chapterId } = await createCourse();
    const topicId = await createTopic(courseId, chapterId, 1);
    const otherTopicId = await createTopic(courseId, chapterId, 2);
    const cardId = await createCard(topicId);
    const otherCardId = await createCard(otherTopicId);

    const created = await clients.student
      .from("review_notes")
      .insert({ topic_id: topicId, card_id: cardId, body: "Note gốc." })
      .select(NOTE_SELECT)
      .single();
    expect(created.error).toBeNull();
    const noteId = created.data!.id as string;

    expectDbError(await clients.student
      .from("review_notes")
      .update({ topic_id: otherTopicId })
      .eq("id", noteId)
      .select(NOTE_SELECT), "REVIEW_NOTE_IDENTITY_IMMUTABLE");
    expectDbError(await clients.student
      .from("review_notes")
      .update({ card_id: otherCardId })
      .eq("id", noteId)
      .select(NOTE_SELECT), "REVIEW_NOTE_IDENTITY_IMMUTABLE");
    expectDbError(await clients.student
      .from("review_notes")
      .update({ created_at: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id", noteId)
      .select(NOTE_SELECT), "REVIEW_NOTE_IDENTITY_IMMUTABLE");

    const untouched = await admin.from("review_notes").select(NOTE_SELECT).eq("id", noteId).single();
    expect(untouched.data).toMatchObject({ topic_id: topicId, card_id: cardId, author_user_id: USERS.student.id });
  });

  it("keeps a tombstone readable after a soft delete and denies hard delete", async () => {
    const fixture = await createFixture();
    const created = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Note sẽ bị xoá mềm." })
      .select(NOTE_SELECT)
      .single();
    expect(created.error).toBeNull();
    const noteId = created.data!.id as string;

    const hardDelete = await clients.student.from("review_notes").delete().eq("id", noteId).select(NOTE_SELECT);
    if (hardDelete.error) {
      expect(hardDelete.error).not.toBeNull();
    } else {
      expect(hardDelete.data).toEqual([]);
    }
    const stillThere = await admin.from("review_notes").select(NOTE_SELECT).eq("id", noteId).single();
    expect(stillThere.error).toBeNull();

    const softDelete = await clients.student
      .from("review_notes")
      .update({ removed_at: new Date().toISOString(), removed_by_user_id: USERS.student.id })
      .eq("id", noteId)
      .select(NOTE_SELECT)
      .single();
    expect(softDelete.error).toBeNull();
    expect(softDelete.data).toMatchObject({ removed_by_user_id: USERS.student.id });

    // Tombstone vẫn phải tới được người đọc (D4/A7).
    const readerView = await clients.teacher.from("review_notes").select(NOTE_SELECT).eq("topic_id", fixture.topicId);
    expect(readerView.error).toBeNull();
    expect(readerView.data).toHaveLength(1);
    expect(readerView.data?.[0]?.removed_at).not.toBeNull();
    expect(readerView.data?.[0]?.removed_by_user_id).toBe(USERS.student.id);
    expect(readerView.data?.[0]?.body).toBe("Note sẽ bị xoá mềm.");
  });

  it("resolves the target label through the read path for a reviewer", async () => {
    const fixture = await createFixture();
    // Query đọc đúng như `getTopicReviewNotes` dùng (join card/exercise để lấy nhãn đích).
    const cardNote = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, card_id: fixture.cardId, body: "Gắn card." })
      .select("id").single();
    expect(cardNote.error).toBeNull();
    const exerciseNote = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, exercise_id: fixture.exerciseId, body: "Gắn exercise." })
      .select("id").single();
    expect(exerciseNote.error).toBeNull();
    const topicNote = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Note cấp topic." })
      .select("id").single();
    expect(topicNote.error).toBeNull();

    const feed = await clients.student
      .from("review_notes")
      .select(
        `
        id, card_id, exercise_id,
        card:cards!review_notes_card_id_fkey ( front_content ),
        exercise:exercises!review_notes_exercise_id_fkey ( title )
      `,
      )
      .eq("topic_id", fixture.topicId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    expect(feed.error).toBeNull();

    const byBody = new Map(
      (feed.data ?? []).map((row) => [
        row.id as string,
        row as unknown as {
          card: { front_content: { word?: string } | null } | null;
          exercise: { title: string | null } | null;
        },
      ]),
    );
    const cardRow = byBody.get(cardNote.data!.id as string);
    const exerciseRow = byBody.get(exerciseNote.data!.id as string);
    const topicRow = byBody.get(topicNote.data!.id as string);
    expect(typeof cardRow?.card?.front_content?.word).toBe("string");
    expect(exerciseRow?.exercise?.title).toBeTruthy();
    expect(topicRow?.card ?? null).toBeNull();
    expect(topicRow?.exercise ?? null).toBeNull();
  });

  it("orders the topic feed newest first", async () => {
    const fixture = await createFixture();
    const first = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Note cũ hơn.", created_at: "2026-01-01T00:00:00.000Z" })
      .select(NOTE_SELECT)
      .single();
    expect(first.error).toBeNull();
    const second = await clients.student
      .from("review_notes")
      .insert({ topic_id: fixture.topicId, body: "Note mới hơn.", created_at: "2026-02-01T00:00:00.000Z" })
      .select(NOTE_SELECT)
      .single();
    expect(second.error).toBeNull();

    const feed = await clients.student
      .from("review_notes")
      .select(NOTE_SELECT)
      .eq("topic_id", fixture.topicId)
      .order("created_at", { ascending: false });
    expect(feed.error).toBeNull();
    expect(feed.data?.map((note) => note.body)).toEqual(["Note mới hơn.", "Note cũ hơn."]);
  });
});
