import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createQuestionGroupManagedMediaReference } from "@/lib/schemas/exercise";
import { GET as getPreviewMedia } from "@/app/api/public-course-preview/media/[groupId]/[type]/route";
import {
  answerPublicCoursePreviewQuestion,
  getPublicCoursePreview,
} from "@/app/actions/public-course-preview";

const privileged = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => privileged.client,
}));

// Test plan:
// - Mục tiêu: chứng minh public Preview read/answer/private media được gate bằng persisted eligibility.
// - Loại test: local Supabase RPC/RLS/Storage integration và Route Handler integration.
// - Đối tượng: D2 service RPC, published parent chain, private question-group Storage và Range response.
// - Thành công: guest/enrolled actor cùng đọc nội dung an toàn; answer được trả stateless; image/audio tải qua route.
// - Thất bại: unmarked/draft/removed/unpublished/over-cap/cross-parent target đồng loạt unavailable.
// - Bảo mật: anon không gọi full-content RPC hoặc private bucket; initial payload không có answer key/learning state.
// - Ổn định: await eligibility-changing commit trước khi bắt đầu read, answer và media requests; các request mới dùng quota đã commit.
// - Invariant: không ghi user_flashcards, user_question_answers hoặc user_topic_progress.
// - Kết quả verify gần nhất ghi trong progress.md: 3 files / 37 tests đạt, gồm correction rerun ngày 2026-09-25; candidate có real Server Action assertions.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEEDED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const SEEDED_STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const SEEDED_STUDENT_EMAIL = "student@gmail.com";
const SEEDED_PASSWORD = "123123";
const IMAGE_BUCKET = "question_group_images";
const AUDIO_BUCKET = "question_group_audios";
const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const audioBytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
privileged.client = supabaseAdmin;

let anonymousClient: SupabaseClient;
let enrolledClient: SupabaseClient;
let fixture: {
  courseId: string;
  courseSlug: string;
  chapterId: string;
  topicIds: string[];
  topicSlugs: string[];
  cardId: string;
  exerciseIds: string[];
  groupIds: string[];
  questionIds: string[];
  optionIds: string[];
  imagePath: string;
  audioPath: string;
} | null = null;

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

function asBlob(bytes: Uint8Array, type: string) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type });
}

async function createFixture() {
  const suffix = randomUUID();
  const courseId = randomUUID();
  const chapterId = randomUUID();
  const topicIds = Array.from({ length: 5 }, () => randomUUID());
  const topicSlugs = topicIds.map((_, index) => `preview-topic-${index}-${suffix}`);
  const cardId = randomUUID();
  const exerciseIds = [randomUUID(), randomUUID()];
  const groupIds = [randomUUID(), randomUUID()];
  const questionIds = [randomUUID(), randomUUID()];
  const optionIds = Array.from({ length: 4 }, () => randomUUID());
  const imagePath = `${courseId}/${topicIds[0]}/${SEEDED_TEACHER_ID}/preview-${suffix}.png`;
  const audioPath = `${courseId}/${topicIds[0]}/${SEEDED_TEACHER_ID}/preview-${suffix}.mp3`;

  const { error: courseError } = await supabaseAdmin.from("courses").insert({
    id: courseId,
    title: `Public Preview ${suffix}`,
    slug: `public-preview-${suffix}`,
    description: "D2 local integration fixture",
    price: 0,
    status: "published",
    removed_at: null,
  });
  throwIfError("create course", courseError);

  const { error: chapterError } = await supabaseAdmin.from("chapters").insert({
    id: chapterId,
    course_id: courseId,
    created_by_user_id: SEEDED_TEACHER_ID,
    title: "Preview chapter",
    order_index: 0,
    removed_at: null,
  });
  throwIfError("create chapter", chapterError);

  const { error: topicError } = await supabaseAdmin.from("topics").insert(
    topicIds.map((id, index) => ({
      id,
      course_id: courseId,
      chapter_id: chapterId,
      title: `Preview topic ${index}`,
      slug: topicSlugs[index],
      description: index === 0 ? "Public topic description" : null,
      status: "published",
      order_index: index,
      original_creator_user_id: SEEDED_TEACHER_ID,
      responsible_author_user_id: SEEDED_TEACHER_ID,
      first_approved_at: "2026-01-10T12:00:00.000Z",
      removed_at: null,
    })),
  );
  throwIfError("create topics", topicError);

  const { error: markerError } = await supabaseAdmin
    .from("topics")
    .update({ is_preview: true })
    .eq("id", topicIds[0]);
  throwIfError("mark preview topic", markerError);

  const { error: cardError } = await supabaseAdmin.from("cards").insert({
    id: cardId,
    topic_id: topicIds[0],
    front_content: { word: "preview", pos: "noun", phonetic: "/ˈpriːvjuː/" },
    back_content: { translation: "xem thử", example: "A safe example." },
    order_index: 0,
    removed_at: null,
  });
  throwIfError("create card", cardError);

  const { error: exerciseError } = await supabaseAdmin.from("exercises").insert(
    exerciseIds.map((id, index) => ({
      id,
      course_id: courseId,
      topic_id: topicIds[index],
      title: `Exercise ${index}`,
      part_type: "part5",
      order_index: 0,
      removed_at: null,
    })),
  );
  throwIfError("create exercises", exerciseError);

  const imageReference = createQuestionGroupManagedMediaReference("image", imagePath)!;
  const audioReference = createQuestionGroupManagedMediaReference("audio", audioPath)!;
  const { error: imageUploadError } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .upload(imagePath, asBlob(pngBytes, "image/png"), { contentType: "image/png" });
  throwIfError("upload private preview image", imageUploadError);
  const { error: audioUploadError } = await supabaseAdmin.storage
    .from(AUDIO_BUCKET)
    .upload(audioPath, asBlob(audioBytes, "audio/mpeg"), { contentType: "audio/mpeg" });
  throwIfError("upload private preview audio", audioUploadError);

  const { error: groupError } = await supabaseAdmin.from("question_groups").insert(
    groupIds.map((id, index) => ({
      id,
      exercise_id: exerciseIds[index],
      passage_text: index === 0 ? "A short passage." : null,
      audio_url: index === 0 ? audioReference : null,
      image_url: index === 0 ? imageReference : null,
      order_index: 0,
      removed_at: null,
    })),
  );
  throwIfError("create question groups", groupError);

  const { error: questionError } = await supabaseAdmin.from("questions").insert(
    questionIds.map((id, index) => ({
      id,
      course_id: courseId,
      exercise_id: exerciseIds[index],
      group_id: groupIds[index],
      content: `Question ${index}?`,
      explanation: `Explanation ${index}.`,
      order_index: 0,
      removed_at: null,
    })),
  );
  throwIfError("create questions", questionError);

  const { error: optionError } = await supabaseAdmin.from("question_options").insert(
    optionIds.map((id, index) => ({
      id,
      question_id: questionIds[Math.floor(index / 2)],
      content: `Option ${index}`,
      label: index % 2 === 0 ? "A" : "B",
      order_index: index % 2,
      is_correct: index % 2 === 0,
      removed_at: null,
    })),
  );
  throwIfError("create options", optionError);

  const { error: enrollmentError } = await supabaseAdmin.from("enrollments").insert({
    user_id: SEEDED_STUDENT_ID,
    course_id: courseId,
  });
  throwIfError("create enrolled student", enrollmentError);

  return {
    courseId,
    courseSlug: `public-preview-${suffix}`,
    chapterId,
    topicIds,
    topicSlugs,
    cardId,
    exerciseIds,
    groupIds,
    questionIds,
    optionIds,
    imagePath,
    audioPath,
  };
}

async function previewRpc(topicSlug = fixture!.topicSlugs[0]) {
  return supabaseAdmin.rpc("get_public_course_preview", {
    p_course_slug: fixture!.courseSlug,
    p_topic_slug: topicSlug,
  });
}

async function answerRpc(questionId = fixture!.questionIds[0], optionId = fixture!.optionIds[0], topicSlug = fixture!.topicSlugs[0]) {
  return supabaseAdmin.rpc("get_public_course_preview_answer", {
    p_course_slug: fixture!.courseSlug,
    p_topic_slug: topicSlug,
    p_question_id: questionId,
    p_option_id: optionId,
  });
}

async function mediaRequest(groupId = fixture!.groupIds[0], type: "image" | "audio" = "image", range?: string) {
  const headers = range ? { range } : undefined;
  return getPreviewMedia(
    new Request(`http://localhost/api/public-course-preview/media/${groupId}/${type}`, { headers }),
    { params: Promise.resolve({ groupId, type }) },
  );
}

async function cleanupFixture() {
  if (!fixture) return;
  const { error: imageError } = await supabaseAdmin.storage.from(IMAGE_BUCKET).remove([fixture.imagePath]);
  throwIfError("cleanup preview image", imageError);
  const { error: audioError } = await supabaseAdmin.storage.from(AUDIO_BUCKET).remove([fixture.audioPath]);
  throwIfError("cleanup preview audio", audioError);
  const { error: optionError } = await supabaseAdmin.from("question_options").delete().in("id", fixture.optionIds);
  throwIfError("cleanup preview options", optionError);
  const { error: questionError } = await supabaseAdmin.from("questions").delete().in("id", fixture.questionIds);
  throwIfError("cleanup preview questions", questionError);
  const { error: groupError } = await supabaseAdmin.from("question_groups").delete().in("id", fixture.groupIds);
  throwIfError("cleanup preview groups", groupError);
  const { error: exerciseError } = await supabaseAdmin.from("exercises").delete().in("id", fixture.exerciseIds);
  throwIfError("cleanup preview exercises", exerciseError);
  const { error: cardError } = await supabaseAdmin.from("cards").delete().eq("id", fixture.cardId);
  throwIfError("cleanup preview card", cardError);
  const { error: enrollmentError } = await supabaseAdmin.from("enrollments").delete().eq("course_id", fixture.courseId);
  throwIfError("cleanup preview enrollment", enrollmentError);
  const { error: topicError } = await supabaseAdmin.from("topics").delete().eq("course_id", fixture.courseId);
  throwIfError("cleanup preview topics", topicError);
  const { error: chapterError } = await supabaseAdmin.from("chapters").delete().eq("id", fixture.chapterId);
  throwIfError("cleanup preview chapter", chapterError);
  const { error: courseError } = await supabaseAdmin.from("courses").delete().eq("id", fixture.courseId);
  throwIfError("cleanup preview course", courseError);
}

describe.sequential("D2 public Preview guarded service", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();
    anonymousClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    enrolledClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authError } = await enrolledClient.auth.signInWithPassword({
      email: SEEDED_STUDENT_EMAIL,
      password: SEEDED_PASSWORD,
    });
    throwIfError("sign in enrolled student", authError);
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
    await enrolledClient?.auth.signOut();
  });

  it("returns persisted eligible detail and a whitelisted public payload without answer keys", async () => {
    const [{ data: detail, error: detailError }, { data, error }] = await Promise.all([
      anonymousClient.rpc("get_public_course_detail", { p_course_slug: fixture!.courseSlug }),
      previewRpc(),
    ]);
    expect(detailError).toBeNull();
    expect(error).toBeNull();
    expect(detail).toMatchObject({ is_preview_suspended: false });
    expect(detail.syllabus.flatMap((chapter: { topics: { slug: string; is_preview: boolean }[] }) => chapter.topics)
      .find((topic: { slug: string }) => topic.slug === fixture!.topicSlugs[0])?.is_preview).toBe(true);
    expect(data).toMatchObject({
      course: { slug: fixture!.courseSlug },
      topic: { slug: fixture!.topicSlugs[0], description: "Public topic description" },
      flashcards: [{ id: fixture!.cardId }],
      exercises: [{ groups: [{ id: fixture!.groupIds[0] }] }],
    });
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("is_correct");
    expect(serialized).not.toContain("user_question_answers");
    expect(serialized).not.toContain("user_topic_progress");
    const initialQuestion = data.exercises[0].groups[0].questions[0];
    expect(Object.keys(initialQuestion).sort()).toEqual([
      "content",
      "id",
      "options",
      "order_index",
    ]);
    expect(Object.keys(initialQuestion.options[0]).sort()).toEqual([
      "content",
      "id",
      "label",
      "order_index",
    ]);
    expect(serialized).not.toContain(fixture!.topicIds[1]);
    expect((await mediaRequest(fixture!.groupIds[1], "image")).status).toBe(404);

    const actionRead = await getPublicCoursePreview({
      courseSlug: fixture!.courseSlug,
      topicSlug: fixture!.topicSlugs[0],
    });
    expect(actionRead.status).toBe("success");
    if (actionRead.status !== "success") throw new Error("Expected server Action Preview success");
    expect(actionRead.data.exercises[0].groups[0].audio_url)
      .toBe(`/api/public-course-preview/media/${fixture!.groupIds[0]}/audio`);

    const anonRpc = await anonymousClient.rpc("get_public_course_preview", {
      p_course_slug: fixture!.courseSlug,
      p_topic_slug: fixture!.topicSlugs[0],
    });
    expect(anonRpc.data).toBeNull();
    expect(anonRpc.error?.code).toBe("42501");

    const anonAnswer = await anonymousClient.rpc("get_public_course_preview_answer", {
      p_course_slug: fixture!.courseSlug,
      p_topic_slug: fixture!.topicSlugs[0],
      p_question_id: fixture!.questionIds[0],
      p_option_id: fixture!.optionIds[0],
    });
    expect(anonAnswer.data).toBeNull();
    expect(anonAnswer.error?.code).toBe("42501");

    const anonMediaReference = await anonymousClient.rpc("get_public_course_preview_group_media", {
      p_group_id: fixture!.groupIds[0],
      p_type: "image",
    });
    expect(anonMediaReference.data).toBeNull();
    expect(anonMediaReference.error?.code).toBe("42501");

    for (const deniedCall of [
      enrolledClient.rpc("get_public_course_preview", {
        p_course_slug: fixture!.courseSlug,
        p_topic_slug: fixture!.topicSlugs[0],
      }),
      enrolledClient.rpc("get_public_course_preview_answer", {
        p_course_slug: fixture!.courseSlug,
        p_topic_slug: fixture!.topicSlugs[0],
        p_question_id: fixture!.questionIds[0],
        p_option_id: fixture!.optionIds[0],
      }),
      enrolledClient.rpc("get_public_course_preview_group_media", {
        p_group_id: fixture!.groupIds[0],
        p_type: "image",
      }),
    ]) {
      const denied = await deniedCall;
      expect(denied.data).toBeNull();
      expect(denied.error?.code).toBe("42501");
    }
    expect((await previewRpc(fixture!.topicSlugs[1])).data).toBeNull();
  });

  it("delivers private image/audio through the persisted group and preserves audio Range", async () => {
    const image = await mediaRequest(fixture!.groupIds[0], "image");
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toContain("image/png");
    expect(image.headers.get("x-content-type-options")).toBe("nosniff");
    expect(image.headers.get("cache-control")).toBe("private, no-store");
    expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([...pngBytes]);

    const audio = await mediaRequest(fixture!.groupIds[0], "audio", "bytes=1-3");
    expect(audio.status).toBe(206);
    expect(audio.headers.get("content-type")).toContain("audio/mpeg");
    expect(audio.headers.get("content-range")).toBe(`bytes 1-3/${audioBytes.length}`);
    expect([...new Uint8Array(await audio.arrayBuffer())]).toEqual([...audioBytes.slice(1, 4)]);

    const directAnonymousDownload = await anonymousClient.storage
      .from(IMAGE_BUCKET)
      .download(fixture!.imagePath);
    expect(directAnonymousDownload.data).toBeNull();
    expect(directAnonymousDownload.error).not.toBeNull();
  });

  it("answers statelessly, rejects cross-parent IDs, and leaves enrolled learning rows unchanged", async () => {
    const before = await Promise.all([
      supabaseAdmin.from("user_flashcards").select("id").eq("user_id", SEEDED_STUDENT_ID).eq("card_id", fixture!.cardId),
      supabaseAdmin.from("user_question_answers").select("id").eq("user_id", SEEDED_STUDENT_ID).eq("question_id", fixture!.questionIds[0]),
      supabaseAdmin.from("user_topic_progress").select("id").eq("user_id", SEEDED_STUDENT_ID).eq("topic_id", fixture!.topicIds[0]),
    ]);
    before.forEach(({ error }) => expect(error).toBeNull());
    expect(before.map(({ data }) => data)).toEqual([[], [], []]);

    const { data: correct, error: correctError } = await answerRpc();
    expect(correctError).toBeNull();
    expect(correct).toEqual({ is_correct: true, explanation: "Explanation 0." });
    await expect(
      answerPublicCoursePreviewQuestion({
        courseSlug: fixture!.courseSlug,
        topicSlug: fixture!.topicSlugs[0],
        questionId: fixture!.questionIds[0],
        selectedOptionId: fixture!.optionIds[0],
      }),
    ).resolves.toEqual({
      status: "success",
      data: { isCorrect: true, explanation: "Explanation 0." },
    });
    const { data: incorrect, error: incorrectError } = await answerRpc(
      fixture!.questionIds[0],
      fixture!.optionIds[1],
    );
    expect(incorrectError).toBeNull();
    expect(incorrect).toEqual({ is_correct: false, explanation: "Explanation 0." });

    const { data: crossParent, error: crossParentError } = await answerRpc(
      fixture!.questionIds[1],
      fixture!.optionIds[2],
    );
    expect(crossParentError).toBeNull();
    expect(crossParent).toBeNull();

    const after = await Promise.all([
      supabaseAdmin.from("user_flashcards").select("id").eq("user_id", SEEDED_STUDENT_ID).eq("card_id", fixture!.cardId),
      supabaseAdmin.from("user_question_answers").select("id").eq("user_id", SEEDED_STUDENT_ID).eq("question_id", fixture!.questionIds[0]),
      supabaseAdmin.from("user_topic_progress").select("id").eq("user_id", SEEDED_STUDENT_ID).eq("topic_id", fixture!.topicIds[0]),
    ]);
    after.forEach(({ error }) => expect(error).toBeNull());
    expect(after.map(({ data }) => data)).toEqual([[], [], []]);
    expect(await enrolledClient.auth.getUser()).toMatchObject({ data: { user: { id: SEEDED_STUDENT_ID } } });
  });

  it("closes read, answer, and media after revocation, ineligibility, or an over-cap commit", async () => {
    const unmark = await supabaseAdmin.from("topics").update({ is_preview: false }).eq("id", fixture!.topicIds[0]);
    expect(unmark.error).toBeNull();
    expect((await previewRpc()).data).toBeNull();
    expect((await answerRpc()).data).toBeNull();
    expect((await mediaRequest()).status).toBe(404);

    const remark = await supabaseAdmin.from("topics").update({ is_preview: true }).eq("id", fixture!.topicIds[0]);
    expect(remark.error).toBeNull();
    const overMark = await supabaseAdmin.from("topics").update({ is_preview: true }).eq("id", fixture!.topicIds[1]);
    expect(overMark.error).toBeNull();
    const { data: suspendedDetail, error: detailError } = await anonymousClient.rpc(
      "get_public_course_detail",
      { p_course_slug: fixture!.courseSlug },
    );
    expect(detailError).toBeNull();
    expect(suspendedDetail.is_preview_suspended).toBe(true);
    expect(suspendedDetail.syllabus.flatMap((chapter: { topics: { is_preview: boolean }[] }) => chapter.topics)
      .every((topic: { is_preview: boolean }) => topic.is_preview === false)).toBe(true);
    expect(JSON.stringify(suspendedDetail)).not.toMatch(/quota|moderation|audit|marked_topic_count|quota_cap/i);
    expect((await previewRpc()).data).toBeNull();
    expect((await answerRpc()).data).toBeNull();
    expect((await mediaRequest()).status).toBe(404);

    await supabaseAdmin.from("topics").update({ is_preview: false }).eq("id", fixture!.topicIds[1]);
    await supabaseAdmin.from("topics").update({ is_preview: true }).eq("id", fixture!.topicIds[0]);
    await supabaseAdmin.from("courses").update({ status: "draft" }).eq("id", fixture!.courseId);
    expect((await previewRpc()).data).toBeNull();
    expect((await answerRpc()).data).toBeNull();
    expect((await mediaRequest()).status).toBe(404);
    await supabaseAdmin.from("courses").update({ status: "published" }).eq("id", fixture!.courseId);

    await supabaseAdmin.from("topics").update({ status: "draft" }).eq("id", fixture!.topicIds[0]);
    expect((await previewRpc()).data).toBeNull();
    expect((await answerRpc()).data).toBeNull();
    expect((await mediaRequest()).status).toBe(404);
    await supabaseAdmin.from("topics").update({ status: "published" }).eq("id", fixture!.topicIds[0]);

    await supabaseAdmin.from("topics").update({ removed_at: new Date().toISOString() }).eq("id", fixture!.topicIds[0]);
    expect((await previewRpc()).data).toBeNull();
    expect((await answerRpc()).data).toBeNull();
    expect((await mediaRequest()).status).toBe(404);
    await supabaseAdmin.from("topics").update({ removed_at: null }).eq("id", fixture!.topicIds[0]);

    await supabaseAdmin.from("chapters").update({ removed_at: new Date().toISOString() }).eq("id", fixture!.chapterId);
    expect((await previewRpc()).data).toBeNull();
    expect((await answerRpc()).data).toBeNull();
    expect((await mediaRequest()).status).toBe(404);
    await supabaseAdmin.from("chapters").update({ removed_at: null }).eq("id", fixture!.chapterId);

    const finalRevocation = await supabaseAdmin.from("topics")
      .update({ is_preview: false })
      .eq("id", fixture!.topicIds[0])
      .select("is_preview")
      .single();
    expect(finalRevocation.error).toBeNull();
    expect(finalRevocation.data).toEqual({ is_preview: false });

    const [postCommitRead, postCommitAnswer, postCommitMedia] = await Promise.all([
      previewRpc(),
      answerRpc(),
      mediaRequest(),
    ]);
    expect(postCommitRead.error).toBeNull();
    expect(postCommitRead.data).toBeNull();
    expect(postCommitAnswer.error).toBeNull();
    expect(postCommitAnswer.data).toBeNull();
    expect(postCommitMedia.status).toBe(404);
  });
});
