import { randomUUID } from "node:crypto";
import { createBaseAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

export const courseStructureFixture = {
  adminId: "11111111-1111-4111-8111-111111111111",
  teacherId: "22222222-2222-4222-8222-222222222222",
  teacherEmail: "teacher@gmail.com",
  teacherPassword: "123123",
  courseId: "44444444-4444-4444-8444-444444444445",
  collaboratorId: "77777777-7777-4777-8777-777777777773",
  chapterTitlePrefix: "E2E Structure Chapter",
  topicTitlePrefix: "E2E Structure Topic",
};

export async function prepareCourseStructureFixture(env = process.env) {
  const { supabase } = await createBaseAuthoringFixture({
    env,
    fixture: courseStructureFixture,
    teacherProfile: {
      bio: "Local teacher account for course structure smoke E2E.",
      experience_years: 1,
      certifications: "Local smoke fixture",
    },
    course: {
      title: "Local Structure Test Course",
      slug: "local-structure-test-course",
      description: "Local seed course for course structure smoke tests.",
      price: 0,
      status: "published",
      order_index: 2,
      removed_at: null,
    },
    collaborator: {
      id: courseStructureFixture.collaboratorId,
    },
  });
  const suffix = `${new Date().toISOString()} ${randomUUID()}`;

  await cleanupStructureRows(supabase);

  return {
    E2E_TEACHER_EMAIL: courseStructureFixture.teacherEmail,
    E2E_TEACHER_PASSWORD: courseStructureFixture.teacherPassword,
    E2E_COURSE_ID: courseStructureFixture.courseId,
    E2E_STRUCTURE_CHAPTER_TITLE: `${courseStructureFixture.chapterTitlePrefix} ${suffix}`,
    E2E_STRUCTURE_CHAPTER_SECOND_TITLE: `${courseStructureFixture.chapterTitlePrefix} Second ${suffix}`,
    E2E_STRUCTURE_CHAPTER_THIRD_TITLE: `${courseStructureFixture.chapterTitlePrefix} Third ${suffix}`,
    E2E_STRUCTURE_TOPIC_HIDDEN_TITLE: `${courseStructureFixture.topicTitlePrefix} Hidden ${suffix}`,
    E2E_STRUCTURE_TOPIC_ACTIVE_TITLE: `${courseStructureFixture.topicTitlePrefix} Active ${suffix}`,
    E2E_STRUCTURE_TOPIC_ORDER_TITLE: `${courseStructureFixture.topicTitlePrefix} Order ${suffix}`,
    E2E_STRUCTURE_TOPIC_UPDATED_TITLE: `${courseStructureFixture.topicTitlePrefix} Updated ${suffix}`,
  };
}

export async function assertCourseStructureOrderPersisted(
  { chapterTitles, topicChapterTitle, topicTitles },
  env = process.env,
) {
  const supabase = createSupabaseAdmin(env);
  const { data: chapters, error: chaptersError } = await supabase
    .from("chapters")
    .select("id, title, order_index, removed_at")
    .eq("course_id", courseStructureFixture.courseId)
    .in("title", chapterTitles)
    .is("removed_at", null)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (chaptersError) {
    throw new Error(`Cannot inspect structure smoke chapter order: ${chaptersError.message}`);
  }

  const orderedChapterTitles = chapters?.map((chapter) => chapter.title) ?? [];
  if (JSON.stringify(orderedChapterTitles) !== JSON.stringify(chapterTitles)) {
    throw new Error(
      `Unexpected structure smoke chapter order: ${JSON.stringify(orderedChapterTitles)}`,
    );
  }

  const topicChapter = chapters?.find((chapter) => chapter.title === topicChapterTitle);
  if (!topicChapter) {
    throw new Error(`Cannot find topic chapter for order check: ${topicChapterTitle}`);
  }

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, title, order_index, removed_at")
    .eq("course_id", courseStructureFixture.courseId)
    .eq("chapter_id", topicChapter.id)
    .in("title", topicTitles)
    .is("removed_at", null)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (topicsError) {
    throw new Error(`Cannot inspect structure smoke topic order: ${topicsError.message}`);
  }

  const orderedTopicTitles = topics?.map((topic) => topic.title) ?? [];
  if (JSON.stringify(orderedTopicTitles) !== JSON.stringify(topicTitles)) {
    throw new Error(
      `Unexpected structure smoke topic order: ${JSON.stringify(orderedTopicTitles)}`,
    );
  }

  return {
    chapterTitles: orderedChapterTitles,
    topicTitles: orderedTopicTitles,
  };
}

export async function findCourseStructureTopicByTitle(title, env = process.env) {
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("topics")
    .select("id, chapter_id, course_id, title, status, removed_at")
    .eq("course_id", courseStructureFixture.courseId)
    .eq("title", title)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Cannot find structure smoke topic ${title}: ${error?.message ?? "not found"}`);
  }

  return data;
}

export async function assertCourseStructureSmokePersisted(
  { chapterTitle, hiddenTopicTitle, activeTopicTitle },
  env = process.env,
) {
  const supabase = createSupabaseAdmin(env);
  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id, course_id, title, removed_at")
    .eq("course_id", courseStructureFixture.courseId)
    .eq("title", chapterTitle)
    .limit(1)
    .maybeSingle();

  if (chapterError || !chapter) {
    throw new Error(`Cannot find structure smoke chapter: ${chapterError?.message ?? chapterTitle}`);
  }

  const { data: hiddenTopic, error: hiddenTopicError } = await supabase
    .from("topics")
    .select("id, chapter_id, course_id, title, status, removed_at")
    .eq("course_id", courseStructureFixture.courseId)
    .eq("title", hiddenTopicTitle)
    .limit(1)
    .maybeSingle();

  if (hiddenTopicError || !hiddenTopic) {
    throw new Error(`Cannot find hidden structure smoke topic: ${hiddenTopicError?.message ?? hiddenTopicTitle}`);
  }

  const { data: activeTopic, error: activeTopicError } = await supabase
    .from("topics")
    .select("id, chapter_id, course_id, title, status, removed_at")
    .eq("course_id", courseStructureFixture.courseId)
    .eq("title", activeTopicTitle)
    .limit(1)
    .maybeSingle();

  if (activeTopicError || !activeTopic) {
    throw new Error(`Cannot find active structure smoke topic: ${activeTopicError?.message ?? activeTopicTitle}`);
  }

  if (
    chapter.removed_at === null ||
    hiddenTopic.removed_at === null ||
    activeTopic.removed_at !== null ||
    hiddenTopic.status !== "pending" ||
    activeTopic.status !== "draft" ||
    hiddenTopic.chapter_id !== chapter.id ||
    activeTopic.chapter_id !== chapter.id
  ) {
    throw new Error(
      `Course structure smoke persisted with an unexpected shape: ${JSON.stringify({
        chapter,
        hiddenTopic,
        activeTopic,
      })}`,
    );
  }

  return {
    chapterId: chapter.id,
    hiddenTopicId: hiddenTopic.id,
    activeTopicId: activeTopic.id,
  };
}

async function cleanupStructureRows(supabase) {
  const { data: chapters, error } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", courseStructureFixture.courseId)
    .like("title", `${courseStructureFixture.chapterTitlePrefix}%`);

  if (error) throw new Error(`Cannot find old structure smoke chapters: ${error.message}`);

  const chapterIds = chapters?.map((chapter) => chapter.id) ?? [];
  if (chapterIds.length === 0) return;

  const { error: topicDeleteError } = await supabase
    .from("topics")
    .delete()
    .in("chapter_id", chapterIds);

  if (topicDeleteError) {
    throw new Error(`Cannot delete old structure smoke topics: ${topicDeleteError.message}`);
  }

  const { error: chapterDeleteError } = await supabase
    .from("chapters")
    .delete()
    .in("id", chapterIds);

  if (chapterDeleteError) {
    throw new Error(`Cannot delete old structure smoke chapters: ${chapterDeleteError.message}`);
  }
}
