import { randomUUID } from "node:crypto";
import { deleteExerciseTreeByIds } from "./support/cleanup-learning-content.mjs";
import { createBaseTopicAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";
import { assertIsolatedRuntime } from "./support/worker-scope.mjs";

const sharedAdminId = "11111111-1111-4111-8111-111111111111";

// Mỗi worker có giáo viên, khóa học, chương và topic riêng (ID/slug suy ra từ `scope`, xem worker-scope.mjs);
// topic seed `66666666-…` và khóa học `44444444-…-444` không bị ghi nữa.
export function exerciseAuthoringFixtureFor(scope) {
  return {
    adminId: sharedAdminId,
    teacherId: scope.teacher.id,
    teacherEmail: scope.teacher.email,
    teacherPassword: scope.teacher.password,
    teacherFullName: scope.teacher.fullName,
    teacherUsername: scope.teacher.username,
    courseId: scope.id("authoring-course"),
    chapterId: scope.id("authoring-chapter"),
    topicId: scope.id("authoring-topic"),
    collaboratorId: scope.id("authoring-collaborator"),
    courseSlug: scope.slug("local-toeic-test-course"),
    topicSlug: scope.slug("local-test-topic"),
    titlePrefix: scope.prefix("E2E Smoke Exercise"),
  };
}

export async function prepareExerciseAuthoringFixture(scope, env = process.env) {
  assertIsolatedRuntime(env);
  const fixture = exerciseAuthoringFixtureFor(scope);
  const { supabase } = await createBaseTopicAuthoringFixture({
    env,
    fixture,
    teacherProfile: {
      bio: "Local teacher account for exercise smoke E2E.",
      experience_years: 1,
      certifications: "Local smoke fixture",
    },
    course: {
      title: `Local TOEIC Test Course ${scope.tag}`,
      slug: fixture.courseSlug,
      description: "Local seed course for exercise authoring smoke tests.",
      price: 0,
      status: "published",
      order_index: 1,
      removed_at: null,
    },
    collaborator: {
      id: fixture.collaboratorId,
      // Fixture nền thêm admin làm owner của khóa học worker; teacher giữ co_owner theo invariant D1.
      role: "co_owner",
    },
    chapter: {
      created_by_user_id: fixture.adminId,
      title: "Local Test Chapter",
      order_index: 1,
      removed_at: null,
    },
    topic: {
      original_creator_user_id: fixture.teacherId,
      responsible_author_user_id: fixture.teacherId,
      title: "Local Test Topic",
      slug: fixture.topicSlug,
      // Các scenario soạn nội dung bắt đầu từ draft.
      status: "draft",
      order_index: 1,
      removed_at: null,
    },
  });
  const title = `${fixture.titlePrefix} ${new Date().toISOString()} ${randomUUID()}`;

  await cleanupSmokeExercises(supabase, fixture);

  return {
    E2E_EXERCISE_TITLE: title,
    E2E_TEACHER_EMAIL: fixture.teacherEmail,
    E2E_TEACHER_PASSWORD: fixture.teacherPassword,
    E2E_COURSE_ID: fixture.courseId,
    E2E_TOPIC_ID: fixture.topicId,
  };
}

export async function assertExerciseAuthoringSmokePersisted(scope, title, env = process.env) {
  assertIsolatedRuntime(env);
  const fixture = exerciseAuthoringFixtureFor(scope);
  const supabase = createSupabaseAdmin(env);
  const { data: exercise, error } = await supabase
    .from("exercises")
    .select(
      `
      id,
      title,
      topic_id,
      course_id,
      part_type,
      removed_at,
      question_groups (
        id,
        passage_text,
        removed_at,
        questions (
          id,
          content,
          removed_at,
          question_options ( id, content, is_correct, removed_at )
        )
      )
    `,
    )
    .eq("topic_id", fixture.topicId)
    .eq("title", title)
    .is("removed_at", null)
    .single();

  if (error || !exercise) {
    throw new Error(`Cannot find the exercise created by the local E2E smoke test: ${error?.message ?? title}`);
  }

  const activeGroups = (exercise.question_groups ?? []).filter(
    (group) => group.removed_at === null,
  );
  const activeQuestions = activeGroups.flatMap((group) =>
    (group.questions ?? []).filter((question) => question.removed_at === null),
  );
  const activeOptions = activeQuestions.flatMap((question) =>
    (question.question_options ?? []).filter((option) => option.removed_at === null),
  );

  if (
    exercise.course_id !== fixture.courseId ||
    exercise.topic_id !== fixture.topicId ||
    exercise.part_type !== "part7" ||
    activeGroups.length !== 1 ||
    activeQuestions.length !== 1 ||
    activeOptions.length < 2 ||
    !activeOptions.some((option) => option.is_correct)
  ) {
    throw new Error(`Exercise smoke persisted with an unexpected shape: ${JSON.stringify(exercise)}`);
  }

  return { exerciseId: exercise.id };
}

async function cleanupSmokeExercises(supabase, fixture) {
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id")
    .eq("topic_id", fixture.topicId)
    .like("title", `${fixture.titlePrefix}%`);

  if (error) throw new Error(`Cannot find old smoke exercises: ${error.message}`);

  const exerciseIds = exercises?.map((exercise) => exercise.id) ?? [];
  await deleteExerciseTreeByIds(supabase, exerciseIds, "old smoke exercises");
}
