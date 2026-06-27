import { randomUUID } from "node:crypto";
import { deleteExerciseTreeByIds } from "./support/cleanup-learning-content.mjs";
import { createBaseTopicAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

export const exerciseAuthoringFixture = {
  adminId: "11111111-1111-4111-8111-111111111111",
  teacherId: "22222222-2222-4222-8222-222222222222",
  teacherEmail: "teacher@gmail.com",
  teacherPassword: "123123",
  courseId: "44444444-4444-4444-8444-444444444444",
  chapterId: "55555555-5555-4555-8555-555555555555",
  topicId: "66666666-6666-4666-8666-666666666666",
  titlePrefix: "E2E Smoke Exercise",
};

export async function prepareExerciseAuthoringFixture(env = process.env) {
  const { supabase } = await createBaseTopicAuthoringFixture({
    env,
    fixture: exerciseAuthoringFixture,
    teacherProfile: {
      bio: "Local teacher account for exercise smoke E2E.",
      experience_years: 1,
      certifications: "Local smoke fixture",
    },
    course: {
      title: "Local TOEIC Test Course",
      slug: "local-toeic-test-course",
      description: "Local seed course for exercise authoring smoke tests.",
      price: 0,
      status: "published",
      order_index: 1,
      removed_at: null,
    },
    collaborator: {
      id: "77777777-7777-4777-8777-777777777772",
    },
    chapter: {
      title: "Local Test Chapter",
      order_index: 1,
      removed_at: null,
    },
    topic: {
      title: "Local Test Topic",
      slug: "local-test-topic",
      status: "published",
      order_index: 1,
      removed_at: null,
    },
  });
  const title = `${exerciseAuthoringFixture.titlePrefix} ${new Date().toISOString()} ${randomUUID()}`;

  await cleanupSmokeExercises(supabase);

  return {
    E2E_EXERCISE_TITLE: title,
    E2E_TEACHER_EMAIL: exerciseAuthoringFixture.teacherEmail,
    E2E_TEACHER_PASSWORD: exerciseAuthoringFixture.teacherPassword,
    E2E_COURSE_ID: exerciseAuthoringFixture.courseId,
    E2E_TOPIC_ID: exerciseAuthoringFixture.topicId,
  };
}

export async function assertExerciseAuthoringSmokePersisted(title, env = process.env) {
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
    .eq("topic_id", exerciseAuthoringFixture.topicId)
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
    exercise.course_id !== exerciseAuthoringFixture.courseId ||
    exercise.topic_id !== exerciseAuthoringFixture.topicId ||
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

async function cleanupSmokeExercises(supabase) {
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id")
    .eq("topic_id", exerciseAuthoringFixture.topicId)
    .like("title", `${exerciseAuthoringFixture.titlePrefix}%`);

  if (error) throw new Error(`Cannot find old smoke exercises: ${error.message}`);

  const exerciseIds = exercises?.map((exercise) => exercise.id) ?? [];
  await deleteExerciseTreeByIds(supabase, exerciseIds, "old smoke exercises");
}
