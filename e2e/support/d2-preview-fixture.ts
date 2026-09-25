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
  let chapterCases: Awaited<ReturnType<typeof createD2ChapterCasesFixture>> | null = null;
  const cleanup = async () => {
    if (chapterCases) {
      await chapterCases.cleanup();
    }
    if (moderationAuditId) {
      const { error } = await supabase.from("course_preview_moderation_causes")
        .delete().eq("course_id", courseId);
      throwIfError("remove D2 preview cause pointer", error);
      const { error: auditError } = await supabase.from("platform_moderation_audits")
        .delete().eq("id", moderationAuditId);
      throwIfError("remove D2 moderation audit", auditError);
    }
    const { error: flashcardStateError } = await supabase.from("user_flashcards")
      .delete().eq("user_id", STUDENT_ID).in("card_id", cardIds);
    throwIfError("remove D2 learner flashcard state", flashcardStateError);
    const { error: answerStateError } = await supabase.from("user_question_answers")
      .delete().eq("user_id", STUDENT_ID).eq("question_id", questionId);
    throwIfError("remove D2 learner answer state", answerStateError);
    const { error: progressStateError } = await supabase.from("user_topic_progress")
      .delete().eq("user_id", STUDENT_ID).eq("topic_id", topicIds[0]);
    throwIfError("remove D2 learner topic progress", progressStateError);
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

    const learnerStateTimestamp = "2026-09-20T12:00:00.000Z";
    const { error: learnerFlashcardError } = await supabase.from("user_flashcards").insert([
      {
        user_id: STUDENT_ID,
        card_id: cardIds[0],
        ease_factor: 2.8,
        interval_days: 7,
        next_review_date: "2026-09-27T12:00:00.000Z",
        created_at: learnerStateTimestamp,
        updated_at: learnerStateTimestamp,
        fsrs_meta: {
          due: "2026-09-27T12:00:00.000Z",
          stability: 5.2,
          difficulty: 4.3,
          elapsed_days: 3,
          scheduled_days: 7,
          learning_steps: 0,
          reps: 4,
          lapses: 1,
          state: 2,
          last_review: "2026-09-20T12:00:00.000Z",
        },
      },
      {
        user_id: STUDENT_ID,
        card_id: cardIds[1],
        ease_factor: 2.4,
        interval_days: 3,
        next_review_date: "2026-09-23T12:00:00.000Z",
        created_at: learnerStateTimestamp,
        updated_at: learnerStateTimestamp,
        fsrs_meta: {
          due: "2026-09-23T12:00:00.000Z",
          stability: 2.1,
          difficulty: 5.1,
          elapsed_days: 2,
          scheduled_days: 3,
          learning_steps: 1,
          reps: 2,
          lapses: 1,
          state: 3,
          last_review: "2026-09-20T12:00:00.000Z",
        },
      },
    ]);
    throwIfError("seed D2 learner flashcard state", learnerFlashcardError);

    const { error: learnerAnswerError } = await supabase.from("user_question_answers").insert({
      user_id: STUDENT_ID,
      question_id: questionId,
      selected_option_id: optionIds[1],
      is_correct: false,
      created_at: learnerStateTimestamp,
      updated_at: learnerStateTimestamp,
    });
    throwIfError("seed D2 learner answer state", learnerAnswerError);

    const { error: learnerProgressError } = await supabase.from("user_topic_progress").insert({
      user_id: STUDENT_ID,
      topic_id: topicIds[0],
      is_flashcard_completed: true,
      is_exercise_completed: false,
      is_topic_completed: false,
      completed_at: null,
      created_at: learnerStateTimestamp,
      updated_at: learnerStateTimestamp,
    });
    throwIfError("seed D2 learner topic progress", learnerProgressError);

    chapterCases = await createD2ChapterCasesFixture(supabase, suffix);

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
      chapterCases: {
        case1CourseId: chapterCases.case1CourseId,
        case2CourseId: chapterCases.case2CourseId,
        case3CourseId: chapterCases.case3CourseId,
      },
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

export async function createD2ChapterCasesFixture(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  suffix: string,
) {
  const case1CourseId = randomUUID();
  const case2CourseId = randomUUID();
  const case3CourseId = randomUUID();

  const c1Ch1 = randomUUID();
  const c1Ch2 = randomUUID();

  const c2Ch1 = randomUUID();
  const c2Ch2 = randomUUID();

  const c3Ch1 = randomUUID();
  const c3Ch2 = randomUUID();
  const c3Ch3 = randomUUID();

  const courseIds = [case1CourseId, case2CourseId, case3CourseId];

  const cleanup = async () => {
    await supabase.from("topics").delete().in("course_id", courseIds);
    await supabase.from("chapters").delete().in("course_id", courseIds);
    await supabase.from("course_collaborators").delete().in("course_id", courseIds);
    await supabase.from("courses").delete().in("id", courseIds);
  };

  try {
    const { error: coursesError } = await supabase.from("courses").insert([
      {
        id: case1CourseId,
        title: `D2 Case 1 No Quota ${suffix}`,
        slug: `d2-case-1-${suffix}`,
        description: "Case 1: No preview topics, no quota impact",
        price: 0,
        status: "published",
        removed_at: null,
      },
      {
        id: case2CourseId,
        title: `D2 Case 2 Auto Clear ${suffix}`,
        slug: `d2-case-2-${suffix}`,
        description: "Case 2: Auto-clear preview topic in chapter",
        price: 0,
        status: "published",
        removed_at: null,
      },
      {
        id: case3CourseId,
        title: `D2 Case 3 Quota Resolution ${suffix}`,
        slug: `d2-case-3-${suffix}`,
        description: "Case 3: Denominator shrink triggers quota resolution",
        price: 0,
        status: "published",
        removed_at: null,
      },
    ]);
    throwIfError("create D2 chapter case courses", coursesError);

    const { error: collabsError } = await supabase.from("course_collaborators").insert([
      { course_id: case1CourseId, user_id: TEACHER_ID, role: "owner", added_by: ADMIN_ID, can_review_topics: false },
      { course_id: case2CourseId, user_id: TEACHER_ID, role: "owner", added_by: ADMIN_ID, can_review_topics: false },
      { course_id: case3CourseId, user_id: TEACHER_ID, role: "owner", added_by: ADMIN_ID, can_review_topics: false },
    ]);
    throwIfError("create D2 chapter case collaborators", collabsError);

    const { error: chaptersError } = await supabase.from("chapters").insert([
      { id: c1Ch1, course_id: case1CourseId, title: "Chương 1 (Không có bài xem thử)", order_index: 1, created_by_user_id: TEACHER_ID, removed_at: null },
      { id: c1Ch2, course_id: case1CourseId, title: "Chương 2 (Nền tảng)", order_index: 2, created_by_user_id: TEACHER_ID, removed_at: null },

      { id: c2Ch1, course_id: case2CourseId, title: "Chương 1 (Có bài xem thử)", order_index: 1, created_by_user_id: TEACHER_ID, removed_at: null },
      { id: c2Ch2, course_id: case2CourseId, title: "Chương 2 (Nền tảng)", order_index: 2, created_by_user_id: TEACHER_ID, removed_at: null },

      { id: c3Ch1, course_id: case3CourseId, title: "Chương 1 (Làm giảm giới hạn)", order_index: 1, created_by_user_id: TEACHER_ID, removed_at: null },
      { id: c3Ch2, course_id: case3CourseId, title: "Chương 2 (Kỹ năng mềm)", order_index: 2, created_by_user_id: TEACHER_ID, removed_at: null },
      { id: c3Ch3, course_id: case3CourseId, title: "Chương 3 (Đàm phán)", order_index: 3, created_by_user_id: TEACHER_ID, removed_at: null },
    ]);
    throwIfError("create D2 chapter case chapters", chaptersError);

    const now = new Date().toISOString();
    const c1Topics = [
      { id: randomUUID(), course_id: case1CourseId, chapter_id: c1Ch1, title: "Ch1 Bài 1", slug: `c1-t1-${suffix}`, is_preview: false, status: "published", order_index: 1, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      ...Array.from({ length: 4 }, (_, i) => ({
        id: randomUUID(), course_id: case1CourseId, chapter_id: c1Ch2, title: `Ch2 Bài ${i + 1}`, slug: `c1-t2-${i + 1}-${suffix}`, is_preview: false, status: "published", order_index: i + 1, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null,
      })),
    ];

    const c2Topics = [
      { id: randomUUID(), course_id: case2CourseId, chapter_id: c2Ch1, title: "Ch1 Bài xem thử", slug: `c2-t1-preview-${suffix}`, is_preview: true, status: "published", order_index: 1, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case2CourseId, chapter_id: c2Ch1, title: "Ch1 Bài thường", slug: `c2-t1-normal-${suffix}`, is_preview: false, status: "published", order_index: 2, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      ...Array.from({ length: 4 }, (_, i) => ({
        id: randomUUID(), course_id: case2CourseId, chapter_id: c2Ch2, title: `Ch2 Bài ${i + 1}`, slug: `c2-t2-${i + 1}-${suffix}`, is_preview: false, status: "published", order_index: i + 1, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null,
      })),
    ];

    const c3Topics = [
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch1, title: "Ch1 Bài nhập môn", slug: `c3-t1-intro-${suffix}`, is_preview: false, status: "published", order_index: 1, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch2, title: "Kỹ năng phỏng vấn", slug: `c3-t2-interview-${suffix}`, is_preview: true, status: "published", order_index: 1, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch2, title: "Thuyết trình dự án", slug: `c3-t2-present-${suffix}`, is_preview: true, status: "published", order_index: 2, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch2, title: "Soạn thảo email", slug: `c3-t2-email-${suffix}`, is_preview: false, status: "published", order_index: 3, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch2, title: "Giao tiếp điện thoại", slug: `c3-t2-phone-${suffix}`, is_preview: false, status: "published", order_index: 4, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch2, title: "Văn hóa công sở", slug: `c3-t2-culture-${suffix}`, is_preview: false, status: "published", order_index: 5, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch3, title: "Thuật ngữ hợp đồng", slug: `c3-t3-contract-${suffix}`, is_preview: true, status: "published", order_index: 1, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch3, title: "Chiến thuật giá", slug: `c3-t3-price-${suffix}`, is_preview: false, status: "published", order_index: 2, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch3, title: "Xử lý xung đột", slug: `c3-t3-conflict-${suffix}`, is_preview: false, status: "published", order_index: 3, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch3, title: "Ký kết điều khoản", slug: `c3-t3-signing-${suffix}`, is_preview: false, status: "published", order_index: 4, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
      { id: randomUUID(), course_id: case3CourseId, chapter_id: c3Ch3, title: "Hậu mãi", slug: `c3-t3-after-${suffix}`, is_preview: false, status: "published", order_index: 5, original_creator_user_id: TEACHER_ID, responsible_author_user_id: TEACHER_ID, first_approved_at: now, removed_at: null },
    ];

    const { error: topicsError } = await supabase.from("topics").insert([...c1Topics, ...c2Topics, ...c3Topics]);
    throwIfError("create D2 chapter case topics", topicsError);

    return {
      case1CourseId,
      case2CourseId,
      case3CourseId,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
