import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const fixture = {
  adminId: "11111111-1111-4111-8111-111111111111",
  teacherId: "22222222-2222-4222-8222-222222222222",
  teacherEmail: "teacher@gmail.com",
  teacherPassword: "123123",
  courseId: "44444444-4444-4444-8444-444444444444",
  chapterId: "55555555-5555-4555-8555-555555555555",
  topicId: "66666666-6666-4666-8666-666666666666",
  titlePrefix: "E2E Smoke Exercise",
};

export function createSupabaseAdmin() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export function buildSmokeTitle() {
  return `${fixture.titlePrefix} ${new Date().toISOString()} ${randomUUID()}`;
}

export async function prepareExerciseSmokeFixture() {
  const supabase = createSupabaseAdmin();

  await ensureAuthUser(supabase, {
    id: fixture.adminId,
    email: "admin@gmail.com",
    password: fixture.teacherPassword,
    fullName: "Local Admin",
    username: "local_admin",
  });
  await ensureAuthUser(supabase, {
    id: fixture.teacherId,
    email: fixture.teacherEmail,
    password: fixture.teacherPassword,
    fullName: "Local Teacher",
    username: "local_teacher",
  });

  await upsertRow(supabase, "profiles", {
    id: fixture.adminId,
    email: "admin@gmail.com",
    full_name: "Local Admin",
    username: "local_admin",
    role: "admin",
    removed_at: null,
  });
  await upsertRow(supabase, "profiles", {
    id: fixture.teacherId,
    email: fixture.teacherEmail,
    full_name: "Local Teacher",
    username: "local_teacher",
    role: "teacher",
    removed_at: null,
  });
  await upsertRow(supabase, "teacher_profiles", {
    id: fixture.teacherId,
    bio: "Local teacher account for exercise smoke E2E.",
    experience_years: 1,
    certifications: "Local smoke fixture",
  });
  await upsertRow(supabase, "courses", {
    id: fixture.courseId,
    title: "Local TOEIC Test Course",
    slug: "local-toeic-test-course",
    description: "Local seed course for exercise authoring smoke tests.",
    price: 0,
    status: "published",
    order_index: 1,
    removed_at: null,
  });
  await upsertRow(
    supabase,
    "course_collaborators",
    {
      id: "77777777-7777-4777-8777-777777777772",
      course_id: fixture.courseId,
      user_id: fixture.teacherId,
      role: "owner",
      added_by: fixture.adminId,
    },
    "course_id,user_id",
  );
  await upsertRow(supabase, "chapters", {
    id: fixture.chapterId,
    course_id: fixture.courseId,
    title: "Local Test Chapter",
    order_index: 1,
    removed_at: null,
  });
  await upsertRow(supabase, "topics", {
    id: fixture.topicId,
    course_id: fixture.courseId,
    chapter_id: fixture.chapterId,
    title: "Local Test Topic",
    slug: "local-test-topic",
    status: "published",
    order_index: 1,
    removed_at: null,
  });

  await cleanupSmokeExercises(supabase);
}

export async function assertSmokeExercisePersisted(title) {
  const supabase = createSupabaseAdmin();
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
    throw new Error(`Không tìm thấy exercise vừa tạo trong local DB: ${error?.message ?? title}`);
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
    throw new Error(`Exercise smoke persisted sai cấu trúc: ${JSON.stringify(exercise)}`);
  }

  return { exerciseId: exercise.id };
}

async function ensureAuthUser(supabase, user) {
  const { data, error } = await supabase.auth.admin.getUserById(user.id);

  if (error || !data?.user) {
    const created = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
        username: user.username,
      },
    });

    if (created.error) {
      throw new Error(`Không thể tạo auth user ${user.email}: ${created.error.message}`);
    }
    return;
  }

  const updated = await supabase.auth.admin.updateUserById(user.id, {
    email: user.email,
    password: user.password,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: {
      full_name: user.fullName,
      username: user.username,
    },
  });

  if (updated.error) {
    throw new Error(`Không thể cập nhật auth user ${user.email}: ${updated.error.message}`);
  }
}

async function upsertRow(supabase, table, row, onConflict = "id") {
  const { error } = await supabase.from(table).upsert(row, { onConflict });

  if (error) {
    throw new Error(`Không thể chuẩn bị fixture ${table}: ${error.message}`);
  }
}

async function cleanupSmokeExercises(supabase) {
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id")
    .eq("topic_id", fixture.topicId)
    .like("title", `${fixture.titlePrefix}%`);

  if (error) throw new Error(`Không thể tìm smoke exercise cũ: ${error.message}`);

  const exerciseIds = exercises?.map((exercise) => exercise.id) ?? [];
  if (exerciseIds.length === 0) return;

  const { data: questions } = await supabase
    .from("questions")
    .select("id")
    .in("exercise_id", exerciseIds);
  const questionIds = questions?.map((question) => question.id) ?? [];

  if (questionIds.length > 0) {
    await supabase.from("question_options").delete().in("question_id", questionIds);
  }

  await supabase.from("questions").delete().in("exercise_id", exerciseIds);
  await supabase.from("question_groups").delete().in("exercise_id", exerciseIds);
  await supabase.from("exercises").delete().in("id", exerciseIds);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}
