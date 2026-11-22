import { randomUUID } from "node:crypto";
import { createBaseAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";
import { upsertRow } from "./support/db-write.mjs";
import { assertIsolatedRuntime } from "./support/worker-scope.mjs";

export function topicCreateNavigationFixtureFor(scope) {
  return {
    adminId: "11111111-1111-4111-8111-111111111111",
    teacherId: scope.teacher.id,
    teacherEmail: scope.teacher.email,
    teacherPassword: scope.teacher.password,
    teacherFullName: scope.teacher.fullName,
    teacherUsername: scope.teacher.username,
    courseId: scope.id("create-nav-course"),
    collaboratorId: scope.id("create-nav-collaborator"),
    courseSlug: scope.slug("d1-topic-navigation-smoke-course"),
    chapters: [
      { key: "zero", id: scope.id("create-nav-chapter-zero"), existingDraftCount: 0 },
      { key: "one", id: scope.id("create-nav-chapter-one"), existingDraftCount: 1 },
      { key: "multiple", id: scope.id("create-nav-chapter-multiple"), existingDraftCount: 3 },
    ],
  };
}

export async function prepareTopicCreateNavigationFixture(scope, env = process.env) {
  assertIsolatedRuntime(env);
  const topicCreateNavigationFixture = topicCreateNavigationFixtureFor(scope);
  const { supabase } = await createBaseAuthoringFixture({
    env,
    fixture: topicCreateNavigationFixture,
    teacherProfile: {
      bio: "D1 create-navigation browser smoke fixture.",
      experience_years: 1,
      certifications: "D1 bounded smoke",
    },
    course: {
      title: `D1 Topic Navigation Smoke Course ${scope.tag}`,
      slug: topicCreateNavigationFixture.courseSlug,
      description: "Bounded D1 create-to-builder navigation smoke fixture.",
      price: 0,
      status: "draft",
      order_index: 0,
      removed_at: null,
    },
    collaborator: {
      id: topicCreateNavigationFixture.collaboratorId,
    },
  });

  // Một lần prepare lại trên cùng worker (trước lần reset DB kế tiếp) không được để sót topic tạo từ UI hay draft cũ trong
  // ba chương này: xóa hết topic của đúng ba chương trước khi dựng lại để số draft ban đầu luôn là 0/1/3.
  const chapterIds = topicCreateNavigationFixture.chapters.map((chapter) => chapter.id);
  const removed = await supabase.from("topics").delete().in("chapter_id", chapterIds);
  if (removed.error) {
    throw new Error(`Cannot clear D1 navigation topics: ${removed.error.message}`);
  }

  const suffix = `${new Date().toISOString()} ${randomUUID()}`;
  const chapters = [];

  for (const [index, chapter] of topicCreateNavigationFixture.chapters.entries()) {
    const chapterTitle = `D1 Navigation ${chapter.key} ${suffix}`;
    await upsertRow(supabase, "chapters", {
      id: chapter.id,
      course_id: topicCreateNavigationFixture.courseId,
      title: chapterTitle,
      order_index: index,
      created_by_user_id: topicCreateNavigationFixture.teacherId,
      removed_at: null,
    });

    for (let topicIndex = 0; topicIndex < chapter.existingDraftCount; topicIndex += 1) {
      await upsertRow(supabase, "topics", {
        id: scope.id(`create-nav-draft-${chapter.key}-${topicIndex}`),
        course_id: topicCreateNavigationFixture.courseId,
        chapter_id: chapter.id,
        title: `Existing draft ${chapter.key} ${topicIndex} ${suffix}`,
        status: "draft",
        order_index: topicIndex,
        removed_at: null,
        original_creator_user_id: topicCreateNavigationFixture.teacherId,
        responsible_author_user_id: topicCreateNavigationFixture.teacherId,
      });
    }

    chapters.push({
      ...chapter,
      title: chapterTitle,
      createTitle: `Created topic ${chapter.key} ${suffix}`,
    });
  }

  for (const chapter of topicCreateNavigationFixture.chapters) {
    const counted = await supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapter.id)
      .is("removed_at", null);
    if (counted.error || counted.count !== chapter.existingDraftCount) {
      throw new Error(
        `D1 navigation chapter ${chapter.key} should start with ${chapter.existingDraftCount} drafts, found ${counted.count ?? counted.error?.message}.`,
      );
    }
  }

  return {
    E2E_TEACHER_EMAIL: topicCreateNavigationFixture.teacherEmail,
    E2E_TEACHER_PASSWORD: topicCreateNavigationFixture.teacherPassword,
    E2E_COURSE_ID: topicCreateNavigationFixture.courseId,
    suffix,
    chapters,
  };
}

export async function findCreatedTopicByTitle(scope, title, env = process.env) {
  assertIsolatedRuntime(env);
  const topicCreateNavigationFixture = topicCreateNavigationFixtureFor(scope);
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("topics")
    .select("id, course_id, chapter_id, title, status, removed_at")
    .eq("course_id", topicCreateNavigationFixture.courseId)
    .eq("title", title)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Cannot find created D1 navigation topic: ${error?.message ?? title}`);
  }

  return data;
}
