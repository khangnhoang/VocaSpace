import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createQuestionGroupManagedMediaReference } from "@/lib/schemas/exercise";

// Test plan:
// - Mục tiêu: kiểm tra media upload/delete/read giữ đúng topic-group authoring và lifecycle freeze.
// - Loại test: real local Supabase Storage/RLS integration.
// - Đối tượng: question_group_images/audios policies và private managed-media references.
// - Case thành công: topic-group author/contributor delete trên draft, authorized read, admin moderation delete, canonical reference persistence và cleanup khi URL ngoài chỉ trùng object path.
// - Case thất bại: admin không membership, student và topic pending không upload được; ordinary delete bị chặn ngoài draft/group/uploader boundary.
// - Bảo mật/phân quyền: upload và ordinary delete yêu cầu active topic-group membership; admin delete là quyền moderation riêng.
// - Ổn định/resilience: object path server-owned theo course/topic/user/UUID, không overwrite.
// - Invariant cần giữ: path/public URL không bypass topic read, authoring hoặc pending freeze.
// - Kết quả verify gần nhất: 22/22 passed bằng `npm.cmd run test:integration -- __tests__/integration/question-group-media-storage.test.ts` sau local reset.
// - Ghi chú: test chạy trên local Supabase với `ALLOW_DB_INTEGRATION_TESTS=true`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEEDED_ADMIN_EMAIL = "admin@gmail.com";
const SEEDED_TEACHER_EMAIL = "teacher@gmail.com";
const SEEDED_STUDENT_EMAIL = "student@gmail.com";
const SEEDED_PASSWORD = "123123";
const SEEDED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const SEEDED_STUDENT_ID = "33333333-3333-4333-8333-333333333333";

const IMAGE_BUCKET = "question_group_images";
const AUDIO_BUCKET = "question_group_audios";

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let adminClient: SupabaseClient;
let teacherClient: SupabaseClient;
let studentClient: SupabaseClient;
let anonymousClient: SupabaseClient;

const uploadedObjects = new Set<string>();
const createdCourseIds = new Set<string>();

function objectKey(bucket: string, path: string) {
  return `${bucket}:${path}`;
}

function rememberUpload(bucket: string, path: string) {
  uploadedObjects.add(objectKey(bucket, path));
}

function forgetUpload(bucket: string, path: string) {
  uploadedObjects.delete(objectKey(bucket, path));
}

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Blocked DB integration test. Set ALLOW_DB_INTEGRATION_TESTS=true only for a local test/dev DB.",
    );
  }

  const url = new URL(SUPABASE_URL);
  const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "http:" || !isLocalHost) {
    throw new Error(
      `Blocked DB integration test because Supabase URL is not local: ${SUPABASE_URL}`,
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

function blob(bytes: Uint8Array, type: string) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new Blob([buffer], { type });
}

function testPath(
  courseId: string,
  topicId: string,
  extension: string,
  userId = SEEDED_TEACHER_ID,
) {
  return `${courseId}/${topicId}/${userId}/integration-${randomUUID()}.${extension}`;
}

async function uploadObject(
  client: SupabaseClient,
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { error } = await client.storage.from(bucket).upload(path, blob(bytes, contentType), {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Không thể upload object test ${bucket}/${path}: ${error.message}`);
  }

  rememberUpload(bucket, path);
}

async function expectObjectExists(bucket: string, path: string) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  expect(error).toBeNull();
  expect(data?.size).toBeGreaterThan(0);
}

async function createCourseTree() {
  const suffix = randomUUID();
  const courseId = randomUUID();
  const chapterId = randomUUID();
  const topicId = randomUUID();

  const { error: courseError } = await supabaseAdmin.from("courses").insert({
    id: courseId,
    title: `Question Group Media Test Course ${suffix}`,
    slug: `question-group-media-test-course-${suffix}`,
    description: "Course created by question group media Storage integration test",
    price: 0,
    status: "published",
    removed_at: null,
  });

  if (courseError) throw new Error(`Không thể tạo course test: ${courseError.message}`);
  createdCourseIds.add(courseId);

  const { error: collaboratorError } = await supabaseAdmin
    .from("course_collaborators")
    .upsert(
      {
        course_id: courseId,
        user_id: SEEDED_TEACHER_ID,
        role: "owner",
        added_by: SEEDED_TEACHER_ID,
      },
      { onConflict: "course_id,user_id" },
    );

  if (collaboratorError) {
    throw new Error(`Không thể tạo collaborator test: ${collaboratorError.message}`);
  }

  const { error: chapterError } = await supabaseAdmin.from("chapters").insert({
    id: chapterId,
    course_id: courseId,
    created_by_user_id: SEEDED_TEACHER_ID,
    title: `Question Group Media Test Chapter ${suffix}`,
    order_index: 1,
    removed_at: null,
  });

  if (chapterError) throw new Error(`Không thể tạo chapter test: ${chapterError.message}`);

  const { error: topicError } = await supabaseAdmin.from("topics").insert({
    id: topicId,
    course_id: courseId,
    chapter_id: chapterId,
    title: `Question Group Media Test Topic ${suffix}`,
    slug: `question-group-media-test-topic-${suffix}`,
    status: "draft",
    order_index: 1,
    original_creator_user_id: SEEDED_TEACHER_ID,
    responsible_author_user_id: SEEDED_TEACHER_ID,
    removed_at: null,
  });

  if (topicError) throw new Error(`Không thể tạo topic test: ${topicError.message}`);

  return { courseId, topicId };
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

  const { data: topics } = await supabaseAdmin.from("topics").select("id")
    .eq("course_id", courseId);
  const topicIds = topics?.map((topic) => topic.id) ?? [];
  if (topicIds.length > 0) {
    await supabaseAdmin.from("cards").delete().in("topic_id", topicIds);
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

async function cleanupUploadedObjects() {
  const objects = Array.from(uploadedObjects);
  uploadedObjects.clear();

  for (const item of objects) {
    const [bucket, path] = item.split(":");
    await supabaseAdmin.storage.from(bucket).remove([path]);
  }
}

describe.sequential("question group media Storage integration", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();

    adminClient = await signInSeededUser(SEEDED_ADMIN_EMAIL);
    teacherClient = await signInSeededUser(SEEDED_TEACHER_EMAIL);
    studentClient = await signInSeededUser(SEEDED_STUDENT_EMAIL);
    anonymousClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterEach(async () => {
    await cleanupUploadedObjects();
    await cleanupCreatedData();
  });

  afterAll(async () => {
    await cleanupUploadedObjects();
    await cleanupCreatedData();
    await adminClient?.auth.signOut();
    await teacherClient?.auth.signOut();
    await studentClient?.auth.signOut();
  });

  it("has both question group media buckets", async () => {
    const imageBucket = await supabaseAdmin.storage.getBucket(IMAGE_BUCKET);
    const audioBucket = await supabaseAdmin.storage.getBucket(AUDIO_BUCKET);

    expect(imageBucket.error).toBeNull();
    expect(audioBucket.error).toBeNull();
    expect(imageBucket.data?.public).toBe(false);
    expect(audioBucket.data?.public).toBe(false);
  });

  it.each([
    [IMAGE_BUCKET, "png", pngBytes, "image/png"],
    [AUDIO_BUCKET, "mp3", mp3Bytes, "audio/mpeg"],
  ] as const)(
    "allows course author uploads to %s",
    async (bucket, extension, bytes, contentType) => {
      const { courseId, topicId } = await createCourseTree();
      const client = teacherClient;
      const path = testPath(courseId, topicId, extension as string);

      await uploadObject(
        client,
        bucket as string,
        path,
        bytes as Uint8Array,
        contentType as string,
      );

      const { data, error } = await supabaseAdmin.storage.from(bucket as string).download(path);
      expect(error).toBeNull();
      expect(data?.size).toBeGreaterThan(0);
    },
  );

  it("rejects global admin upload without course membership", async () => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, "png");
    const { error } = await adminClient.storage.from(IMAGE_BUCKET).upload(
      path,
      blob(pngBytes, "image/png"),
      { contentType: "image/png", upsert: false },
    );
    expect(error).not.toBeNull();
  });

  it.each([
    [IMAGE_BUCKET, "png", pngBytes, "image/png"],
    [AUDIO_BUCKET, "mp3", mp3Bytes, "audio/mpeg"],
  ])("rejects student uploads to %s", async (bucket, extension, bytes, contentType) => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, extension);

    const { error } = await studentClient.storage
      .from(bucket)
      .upload(path, blob(bytes, contentType), {
        contentType,
        upsert: false,
      });

    expect(error).not.toBeNull();
  });

  it("allows a course-local topic contributor to upload media", async () => {
    const { courseId, topicId } = await createCourseTree();
    const { error: collaboratorError } = await supabaseAdmin.from("course_collaborators").insert({
      course_id: courseId,
      user_id: SEEDED_STUDENT_ID,
      role: "editor",
      added_by: SEEDED_TEACHER_ID,
    });
    expect(collaboratorError).toBeNull();

    const { error: contributorError } = await teacherClient.rpc("add_topic_contributor", {
      p_topic_id: topicId,
      p_user_id: SEEDED_STUDENT_ID,
    });
    expect(contributorError).toBeNull();

    const path = testPath(courseId, topicId, "png", SEEDED_STUDENT_ID);
    await uploadObject(studentClient, IMAGE_BUCKET, path, pngBytes, "image/png");
  });

  it("rejects direct media uploads for a pending topic", async () => {
    const { courseId, topicId } = await createCourseTree();
    const { error: topicError } = await supabaseAdmin
      .from("topics")
      .update({ status: "pending" })
      .eq("id", topicId);
    expect(topicError).toBeNull();
    const { data: pendingTopic } = await supabaseAdmin
      .from("topics")
      .select("status")
      .eq("id", topicId)
      .single();
    expect(pendingTopic?.status).toBe("pending");

    const path = testPath(courseId, topicId, "png");
    const { error } = await teacherClient.storage.from(IMAGE_BUCKET).upload(
      path,
      blob(pngBytes, "image/png"),
      { contentType: "image/png", upsert: false },
    );
    expect(error).not.toBeNull();
  });

  it("denies anonymous object and old public-URL reads while allowing an authorized author", async () => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, "png");
    await uploadObject(teacherClient, IMAGE_BUCKET, path, pngBytes, "image/png");

    const { data, error } = await anonymousClient.storage.from(IMAGE_BUCKET).download(path);
    const authorRead = await teacherClient.storage.from(IMAGE_BUCKET).download(path);
    const oldPublicUrl = teacherClient.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    const oldPublicResponse = await fetch(oldPublicUrl);

    expect(error).not.toBeNull();
    expect(data).toBeNull();
    expect(authorRead.error).toBeNull();
    expect(authorRead.data?.size).toBeGreaterThan(0);
    expect(oldPublicResponse.ok).toBe(false);
  });

  it("denies previewer-only draft content and media but allows published topic media", async () => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, "png");
    await uploadObject(teacherClient, IMAGE_BUCKET, path, pngBytes, "image/png");
    const { error: collaboratorError } = await supabaseAdmin.from("course_collaborators").insert({
      course_id: courseId,
      user_id: SEEDED_STUDENT_ID,
      role: "previewer",
      added_by: SEEDED_TEACHER_ID,
    });
    expect(collaboratorError).toBeNull();
    const content = await teacherClient.rpc("create_exercise_with_content", {
      p_topic_id: topicId,
      p_payload: {
        title: `Preview boundary ${randomUUID()}`,
        part_type: "part7",
        groups: [{
          passage_text: "Only topic-authorized readers can see this passage.",
          questions: [{
            content: "What is the protected answer?",
            options: [
              { content: "First", is_correct: true },
              { content: "Second", is_correct: false },
            ],
          }],
        }],
      },
    });
    expect(content.error).toBeNull();
    const exerciseId = (content.data as { exercise_id: string }).exercise_id;
    const { data: createdCard, error: cardInsertError } = await supabaseAdmin
      .from("cards")
      .insert({
        topic_id: topicId,
        front_content: { word: "private" },
        back_content: { translation: "riêng tư" },
        order_index: 0,
      })
      .select("id").single();
    expect(cardInsertError).toBeNull();
    if (!createdCard) throw new Error("Missing card fixture");
    const { data: createdQuestion, error: questionLookupError } = await supabaseAdmin
      .from("questions").select("id").eq("exercise_id", exerciseId).single();
    expect(questionLookupError).toBeNull();
    if (!createdQuestion) throw new Error("Missing question fixture");

    const draftTopic = await studentClient.from("topics").select("id").eq("id", topicId);
    const draftExercise = await studentClient.from("exercises").select("id").eq("id", exerciseId);
    const draftCard = await studentClient.from("cards").select("id").eq("id", createdCard.id);
    const draftGroup = await studentClient.from("question_groups").select("id").eq("exercise_id", exerciseId);
    const draftQuestion = await studentClient.from("questions").select("id").eq("exercise_id", exerciseId);
    const draftOption = await studentClient.from("question_options").select("id")
      .eq("question_id", createdQuestion.id);
    const draftWorkflow = await studentClient.rpc("get_topic_workflow_state", { p_topic_id: topicId });
    const draftCapabilities = await studentClient.rpc("d1_topic_structure_capabilities", {
      p_topic_ids: [topicId],
    });
    const draftMedia = await studentClient.storage.from(IMAGE_BUCKET).download(path);
    expect(draftTopic.error).toBeNull();
    expect(draftTopic.data).toEqual([]);
    expect(draftExercise.data).toEqual([]);
    expect(draftCard.data).toEqual([]);
    expect(draftGroup.data).toEqual([]);
    expect(draftQuestion.data).toEqual([]);
    expect(draftOption.data).toEqual([]);
    expect(draftWorkflow.error).not.toBeNull();
    expect(draftCapabilities.data).toEqual([]);
    expect(draftMedia.error).not.toBeNull();

    const { error: pendingError } = await supabaseAdmin.from("topics")
      .update({ status: "pending" }).eq("id", topicId);
    expect(pendingError).toBeNull();
    expect((await studentClient.from("topics").select("id").eq("id", topicId)).data)
      .toEqual([]);
    expect((await studentClient.storage.from(IMAGE_BUCKET).download(path)).error)
      .not.toBeNull();

    const { error: publishError } = await supabaseAdmin.from("topics")
      .update({ status: "published", first_approved_at: new Date().toISOString() })
      .eq("id", topicId);
    expect(publishError).toBeNull();
    const publishedTopic = await studentClient.from("topics").select("id").eq("id", topicId);
    const publishedExercise = await studentClient.from("exercises").select("id").eq("id", exerciseId);
    const publishedCard = await studentClient.from("cards").select("id").eq("id", createdCard.id);
    const publishedWorkflow = await studentClient.rpc("get_topic_workflow_state", { p_topic_id: topicId });
    const publishedMedia = await studentClient.storage.from(IMAGE_BUCKET).download(path);
    expect(publishedTopic.error).toBeNull();
    expect(publishedTopic.data).toEqual([{ id: topicId }]);
    expect(publishedExercise.data).toEqual([{ id: exerciseId }]);
    expect(publishedCard.data).toEqual([{ id: createdCard.id }]);
    expect(publishedWorkflow.error).toBeNull();
    expect(publishedMedia.error).toBeNull();
    expect(publishedMedia.data?.size).toBeGreaterThan(0);
  });

  it("allows the draft topic object owner to delete their uploaded object", async () => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, "png");
    await uploadObject(teacherClient, IMAGE_BUCKET, path, pngBytes, "image/png");

    const { error } = await teacherClient.storage.from(IMAGE_BUCKET).remove([path]);

    expect(error).toBeNull();
    forgetUpload(IMAGE_BUCKET, path);
  });

  it("allows an active draft topic contributor to delete their uploaded object", async () => {
    const { courseId, topicId } = await createCourseTree();
    const { error: collaboratorError } = await supabaseAdmin.from("course_collaborators").insert({
      course_id: courseId,
      user_id: SEEDED_STUDENT_ID,
      role: "editor",
      added_by: SEEDED_TEACHER_ID,
    });
    expect(collaboratorError).toBeNull();

    const { error: contributorError } = await teacherClient.rpc("add_topic_contributor", {
      p_topic_id: topicId,
      p_user_id: SEEDED_STUDENT_ID,
    });
    expect(contributorError).toBeNull();

    const path = testPath(courseId, topicId, "png", SEEDED_STUDENT_ID);
    await uploadObject(studentClient, IMAGE_BUCKET, path, pngBytes, "image/png");

    const { error } = await studentClient.storage.from(IMAGE_BUCKET).remove([path]);

    expect(error).toBeNull();
    forgetUpload(IMAGE_BUCKET, path);
  });

  it("denies the uploader from deleting an object after the topic enters pending", async () => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, "png");
    await uploadObject(teacherClient, IMAGE_BUCKET, path, pngBytes, "image/png");

    const { error: topicError } = await supabaseAdmin
      .from("topics")
      .update({ status: "pending" })
      .eq("id", topicId);
    expect(topicError).toBeNull();

    const { error } = await teacherClient.storage.from(IMAGE_BUCKET).remove([path]);

    await expectObjectExists(IMAGE_BUCKET, path);
    expect(error).toBeNull();
  });

  it("denies ordinary deletion of a published topic object and keeps it available", async () => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, "png");
    await uploadObject(teacherClient, IMAGE_BUCKET, path, pngBytes, "image/png");

    const { error: topicError } = await supabaseAdmin
      .from("topics")
      .update({
        status: "published",
        first_approved_at: new Date().toISOString(),
      })
      .eq("id", topicId);
    expect(topicError).toBeNull();
    const { data: publishedTopic } = await supabaseAdmin
      .from("topics")
      .select("status")
      .eq("id", topicId)
      .single();
    expect(publishedTopic?.status).toBe("published");

    const { error } = await teacherClient.storage.from(IMAGE_BUCKET).remove([path]);

    await expectObjectExists(IMAGE_BUCKET, path);
    expect(error).toBeNull();
  });

  it("denies an object owner after they leave the topic group", async () => {
    const { courseId, topicId } = await createCourseTree();
    const { error: collaboratorError } = await supabaseAdmin.from("course_collaborators").insert({
      course_id: courseId,
      user_id: SEEDED_STUDENT_ID,
      role: "editor",
      added_by: SEEDED_TEACHER_ID,
    });
    expect(collaboratorError).toBeNull();

    const { error: contributorError } = await teacherClient.rpc("add_topic_contributor", {
      p_topic_id: topicId,
      p_user_id: SEEDED_STUDENT_ID,
    });
    expect(contributorError).toBeNull();

    const path = testPath(courseId, topicId, "png", SEEDED_STUDENT_ID);
    await uploadObject(studentClient, IMAGE_BUCKET, path, pngBytes, "image/png");

    const { data: contributor, error: contributorLookupError } = await supabaseAdmin
      .from("topic_contributors")
      .select("id")
      .eq("topic_id", topicId)
      .eq("user_id", SEEDED_STUDENT_ID)
      .is("removed_at", null)
      .single();
    expect(contributorLookupError).toBeNull();
    expect(contributor).toBeTruthy();
    if (!contributor) return;

    const { error: removeContributorError } = await teacherClient.rpc("remove_topic_contributor", {
      p_contributor_id: contributor.id,
    });
    expect(removeContributorError).toBeNull();

    const { error } = await studentClient.storage.from(IMAGE_BUCKET).remove([path]);

    await expectObjectExists(IMAGE_BUCKET, path);
    expect(error).toBeNull();
  });

  it("denies ordinary deletion for a removed topic", async () => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, "png");
    await uploadObject(teacherClient, IMAGE_BUCKET, path, pngBytes, "image/png");

    const { error: topicError } = await supabaseAdmin
      .from("topics")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", topicId);
    expect(topicError).toBeNull();
    const { data: removedTopic } = await supabaseAdmin
      .from("topics")
      .select("removed_at")
      .eq("id", topicId)
      .single();
    expect(removedTopic?.removed_at).not.toBeNull();

    const { error } = await teacherClient.storage.from(IMAGE_BUCKET).remove([path]);

    await expectObjectExists(IMAGE_BUCKET, path);
    expect(error).toBeNull();
  });

  it("allows admin to delete an uploaded object", async () => {
    const { courseId, topicId } = await createCourseTree();
    const path = testPath(courseId, topicId, "mp3");
    await uploadObject(teacherClient, AUDIO_BUCKET, path, mp3Bytes, "audio/mpeg");

    const { error } = await adminClient.storage.from(AUDIO_BUCKET).remove([path]);

    expect(error).toBeNull();
    forgetUpload(AUDIO_BUCKET, path);
  });

  it("stores canonical managed references through create_exercise_with_content", async () => {
    const { courseId, topicId } = await createCourseTree();
    const imagePath = testPath(courseId, topicId, "png");
    const audioPath = testPath(courseId, topicId, "mp3");

    await uploadObject(teacherClient, IMAGE_BUCKET, imagePath, pngBytes, "image/png");
    await uploadObject(teacherClient, AUDIO_BUCKET, audioPath, mp3Bytes, "audio/mpeg");

    const imageUrl = createQuestionGroupManagedMediaReference("image", imagePath);
    const audioUrl = createQuestionGroupManagedMediaReference("audio", audioPath);

    const { data, error } = await teacherClient.rpc("create_exercise_with_content", {
      p_topic_id: topicId,
      p_payload: {
        title: `Media URL Exercise ${randomUUID()}`,
        part_type: "part7",
        groups: [
          {
            passage_text: "A short passage for testing media URLs.",
            image_url: imageUrl,
            audio_url: audioUrl,
            questions: [
              {
                content: "Which option is correct?",
                options: [
                  { content: "A", is_correct: true },
                  { content: "B", is_correct: false },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(error).toBeNull();

    const exerciseId = (data as { exercise_id: string }).exercise_id;
    const { data: group, error: groupError } = await supabaseAdmin
      .from("question_groups")
      .select("image_url, audio_url")
      .eq("exercise_id", exerciseId)
      .single();

    expect(groupError).toBeNull();
    expect(group?.image_url).toBe(imageUrl);
    expect(group?.audio_url).toBe(audioUrl);
  });

  it("preserves an external HTTPS media URL without classifying it as managed Storage", async () => {
    const { topicId } = await createCourseTree();
    const externalUrl = "https://cdn.example.com/storage/v1/object/public/question_group_images/photo.png";
    const created = await teacherClient.rpc("create_exercise_with_content", {
      p_topic_id: topicId,
      p_payload: {
        title: `External media ${randomUUID()}`,
        part_type: "part7",
        groups: [{
          passage_text: "External media remains under its source host.",
          image_url: externalUrl,
          questions: [{
            content: "Which option is correct?",
            options: [
              { content: "A", is_correct: true },
              { content: "B", is_correct: false },
            ],
          }],
        }],
      },
    });
    expect(created.error).toBeNull();
    const exerciseId = (created.data as { exercise_id: string }).exercise_id;
    const group = await supabaseAdmin.from("question_groups").select("image_url")
      .eq("exercise_id", exerciseId).single();
    expect(group.error).toBeNull();
    expect(group.data?.image_url).toBe(externalUrl);
  });

  it("allows cleanup when an external HTTPS URL has the same path as an unreferenced managed object", async () => {
    const { courseId, topicId } = await createCourseTree();
    const imagePath = testPath(courseId, topicId, "png");
    await uploadObject(teacherClient, IMAGE_BUCKET, imagePath, pngBytes, "image/png");
    const externalUrl = `https://cdn.example.com/storage/v1/object/public/${IMAGE_BUCKET}/${imagePath}`;

    const created = await teacherClient.rpc("create_exercise_with_content", {
      p_topic_id: topicId,
      p_payload: {
        title: `External lookalike ${randomUUID()}`,
        part_type: "part7",
        groups: [{
          passage_text: "External media does not retain a VocaSpace object.",
          image_url: externalUrl,
          questions: [{
            content: "Which option is correct?",
            options: [
              { content: "A", is_correct: true },
              { content: "B", is_correct: false },
            ],
          }],
        }],
      },
    });
    expect(created.error).toBeNull();

    const guard = await teacherClient.rpc("d1_question_group_media_delete_allowed", {
      p_bucket_id: IMAGE_BUCKET,
      p_object_name: imagePath,
    });
    expect(guard.error).toBeNull();
    expect(guard.data).toBe(true);

    const deleted = await teacherClient.storage.from(IMAGE_BUCKET).remove([imagePath]);
    expect(deleted.error).toBeNull();
    const remaining = await supabaseAdmin.storage.from(IMAGE_BUCKET).download(imagePath);
    expect(remaining.data).toBeNull();
    forgetUpload(IMAGE_BUCKET, imagePath);
  });

  it.each(["canonical", "legacy public URL"] as const)(
    "protects %s persisted media from direct delete until the DB reference is cleared",
    async (representation) => {
    const { courseId, topicId } = await createCourseTree();
    const imagePath = testPath(courseId, topicId, "png");
    await uploadObject(teacherClient, IMAGE_BUCKET, imagePath, pngBytes, "image/png");
    const imageUrl = representation === "canonical"
      ? createQuestionGroupManagedMediaReference("image", imagePath)
      : teacherClient.storage.from(IMAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;

    const created = await teacherClient.rpc("create_exercise_with_content", {
      p_topic_id: topicId,
      p_payload: {
        title: `Persisted media delete ${randomUUID()}`,
        part_type: "part7",
        groups: [{
          passage_text: "A passage that keeps the group valid.",
          image_url: imageUrl,
          questions: [{
            content: "Which option is correct?",
            options: [
              { content: "A", is_correct: true },
              { content: "B", is_correct: false },
            ],
          }],
        }],
      },
    });
    expect(created.error).toBeNull();
    const exerciseId = (created.data as { exercise_id: string }).exercise_id;
    const group = await supabaseAdmin.from("question_groups").select("id, passage_text, image_url")
      .eq("exercise_id", exerciseId).single();
    expect(group.error).toBeNull();
    expect(group.data?.image_url).toBe(imageUrl);
    if (!group.data) return;

    const guard = await teacherClient.rpc("d1_question_group_media_delete_allowed", {
      p_bucket_id: IMAGE_BUCKET,
      p_object_name: imagePath,
    });
    expect(guard.error).toBeNull();
    expect(guard.data).toBe(false);

    expect((await teacherClient.storage.from(IMAGE_BUCKET).remove([imagePath])).error).toBeNull();
    await expectObjectExists(IMAGE_BUCKET, imagePath);

    const cleared = await teacherClient.rpc("d1_update_question_group", {
      p_group_id: group.data.id,
      p_passage_text: group.data.passage_text,
      p_audio_url: null,
      p_image_url: null,
      p_confirm_published: false,
    });
    expect(cleared.error).toBeNull();
    const deleted = await teacherClient.storage.from(IMAGE_BUCKET).remove([imagePath]);
    expect(deleted.error).toBeNull();
    forgetUpload(IMAGE_BUCKET, imagePath);
  });
});
