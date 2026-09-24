import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createQuestionGroupManagedMediaReference } from "@/lib/schemas/exercise";

const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_BUCKET = "question_group_images";
const PNG_BYTES = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/t1QAAAAASUVORK5CYII=",
  "base64",
));

function asBlob(bytes: Uint8Array, type: string) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type });
}

function assertLocalSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("D2 browser fixture requires the E2E Supabase environment.");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error(`D2 browser fixture refuses non-local Supabase: ${url}`);
  }
}

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function createD2PreviewBrowserFixture() {
  assertLocalSupabaseEnvironment();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const suffix = randomUUID().slice(0, 8);
  const courseId = randomUUID();
  const chapterId = randomUUID();
  const topicIds = Array.from({ length: 21 }, () => randomUUID());
  const topicSlugs = topicIds.map((_, index) => `d2-preview-${suffix}-lesson-${index + 1}`);
  const topicTitles = topicIds.map((_, index) => `D2 preview lesson ${index + 1} ${suffix}`);
  const cardIds = [randomUUID(), randomUUID()];
  const exerciseId = randomUUID();
  const groupId = randomUUID();
  const questionId = randomUUID();
  const optionIds = [randomUUID(), randomUUID()];
  const imagePath = `${courseId}/${topicIds[0]}/${TEACHER_ID}/d2-preview-${suffix}.png`;
  const imageReference = createQuestionGroupManagedMediaReference("image", imagePath);
  if (!imageReference) throw new Error("Could not create the D2 private image reference.");

  let moderationAuditId: string | null = null;
  let courseInserted = false;
  let imageUploaded = false;
  const cleanup = async () => {
    if (moderationAuditId) {
      const { error } = await supabase.from("course_preview_moderation_causes")
        .delete().eq("course_id", courseId);
      throwIfError("remove D2 preview cause pointer", error);
      const { error: auditError } = await supabase.from("platform_moderation_audits")
        .delete().eq("id", moderationAuditId);
      throwIfError("remove D2 moderation audit", auditError);
    }
    if (imageUploaded) {
      const { error: mediaError } = await supabase.storage.from(IMAGE_BUCKET).remove([imagePath]);
      throwIfError("remove D2 preview image", mediaError);
      imageUploaded = false;
    }
    const { error: optionError } = await supabase.from("question_options").delete().in("id", optionIds);
    throwIfError("remove D2 options", optionError);
    const { error: questionError } = await supabase.from("questions").delete().eq("id", questionId);
    throwIfError("remove D2 question", questionError);
    const { error: groupError } = await supabase.from("question_groups").delete().eq("id", groupId);
    throwIfError("remove D2 question group", groupError);
    const { error: exerciseError } = await supabase.from("exercises").delete().eq("id", exerciseId);
    throwIfError("remove D2 exercise", exerciseError);
    const { error: cardError } = await supabase.from("cards").delete().in("id", cardIds);
    throwIfError("remove D2 cards", cardError);
    const { error: enrollmentError } = await supabase.from("enrollments")
      .delete().eq("course_id", courseId);
    throwIfError("remove D2 enrollment", enrollmentError);
    if (courseInserted) {
      const { error: topicError } = await supabase.from("topics").delete().eq("course_id", courseId);
      throwIfError("remove D2 topics", topicError);
      const { error: chapterError } = await supabase.from("chapters").delete().eq("id", chapterId);
      throwIfError("remove D2 chapter", chapterError);
      const { error: collaboratorError } = await supabase.from("course_collaborators")
        .delete().eq("course_id", courseId);
      throwIfError("remove D2 course owner", collaboratorError);
      const { error: courseError } = await supabase.from("courses").delete().eq("id", courseId);
      throwIfError("remove D2 course", courseError);
    }
  };

  try {
    const courseTitle = `D2 browser Preview ${suffix}`;
    const courseSlug = `d2-browser-preview-${suffix}`;
    const { error: courseError } = await supabase.from("courses").insert({
      id: courseId,
      title: courseTitle,
      slug: courseSlug,
      description: "Local-only D2 browser acceptance fixture.",
      price: 0,
      status: "published",
      removed_at: null,
    });
    throwIfError("create D2 course", courseError);
    courseInserted = true;

    const { error: collaboratorError } = await supabase.from("course_collaborators").insert({
      course_id: courseId,
      user_id: TEACHER_ID,
      role: "owner",
      added_by: ADMIN_ID,
      can_review_topics: false,
    });
    throwIfError("add D2 course owner", collaboratorError);

    const { error: chapterError } = await supabase.from("chapters").insert({
      id: chapterId,
      course_id: courseId,
      created_by_user_id: TEACHER_ID,
      title: `D2 browser chapter ${suffix}`,
      order_index: 1,
      removed_at: null,
    });
    throwIfError("create D2 chapter", chapterError);

    const { error: topicError } = await supabase.from("topics").insert(
      topicIds.map((id, index) => ({
        id,
        course_id: courseId,
        chapter_id: chapterId,
        title: topicTitles[index],
        slug: topicSlugs[index],
        description: index === 0 ? "A temporary practice session." : null,
        status: "published",
        order_index: index + 1,
        original_creator_user_id: TEACHER_ID,
        responsible_author_user_id: TEACHER_ID,
        first_approved_at: "2026-01-10T12:00:00.000Z",
        removed_at: null,
        is_preview: index < 5,
      })),
    );
    throwIfError("create D2 topics", topicError);

    const { error: cardError } = await supabase.from("cards").insert([
      {
        id: cardIds[0],
        topic_id: topicIds[0],
        front_content: { word: "orbit", pos: "noun", phonetic: "/ˈɔːrbɪt/" },
        back_content: { translation: "quỹ đạo", example: "The satellite entered orbit." },
        order_index: 0,
        removed_at: null,
      },
      {
        id: cardIds[1],
        topic_id: topicIds[0],
        front_content: { word: "harbor", pos: "noun", phonetic: "/ˈhɑːrbər/" },
        back_content: { translation: "bến cảng", example: "The ship reached the harbor." },
        order_index: 1,
        removed_at: null,
      },
    ]);
    throwIfError("create D2 cards", cardError);

    const { error: exerciseError } = await supabase.from("exercises").insert({
      id: exerciseId,
      course_id: courseId,
      topic_id: topicIds[0],
      title: "D2 Preview question",
      part_type: "part5",
      order_index: 0,
      removed_at: null,
    });
    throwIfError("create D2 exercise", exerciseError);

    const { error: imageError } = await supabase.storage.from(IMAGE_BUCKET).upload(
      imagePath,
      asBlob(PNG_BYTES, "image/png"),
      { contentType: "image/png" },
    );
    throwIfError("upload D2 private image", imageError);
    imageUploaded = true;

    const { error: groupError } = await supabase.from("question_groups").insert({
      id: groupId,
      exercise_id: exerciseId,
      passage_text: "A short passage for the preview question.",
      audio_url: null,
      image_url: imageReference,
      order_index: 0,
      removed_at: null,
    });
    throwIfError("create D2 question group", groupError);

    const { error: questionError } = await supabase.from("questions").insert({
      id: questionId,
      course_id: courseId,
      exercise_id: exerciseId,
      group_id: groupId,
      content: "Choose the correct answer.",
      explanation: "D2 explanation for the correct preview answer.",
      order_index: 0,
      removed_at: null,
    });
    throwIfError("create D2 question", questionError);

    const { error: optionsError } = await supabase.from("question_options").insert([
      {
        id: optionIds[0],
        question_id: questionId,
        content: "Đáp án đúng",
        label: "A",
        order_index: 0,
        is_correct: true,
        removed_at: null,
      },
      {
        id: optionIds[1],
        question_id: questionId,
        content: "Đáp án khác",
        label: "B",
        order_index: 1,
        is_correct: false,
        removed_at: null,
      },
    ]);
    throwIfError("create D2 options", optionsError);

    const { error: enrollmentError } = await supabase.from("enrollments").insert({
      user_id: STUDENT_ID,
      course_id: courseId,
    });
    throwIfError("enroll D2 test learner", enrollmentError);

    return {
      supabase,
      suffix,
      courseId,
      courseTitle,
      courseSlug,
      chapterId,
      topicIds,
      topicSlugs,
      topicTitles,
      cardIds,
      groupId,
      questionId,
      studentId: STUDENT_ID,
      imagePath,
      rememberModerationAuditId(id: string) {
        moderationAuditId = id;
      },
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
