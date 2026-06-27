import { ensureAuthUser } from "./auth-users.mjs";
import { upsertRow } from "./db-write.mjs";
import { createSupabaseAdmin } from "./supabase-admin.mjs";

export async function createBaseAuthoringFixture({
  env = process.env,
  fixture,
  teacherProfile,
  course,
  collaborator,
}) {
  const supabase = createSupabaseAdmin(env);

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
    ...teacherProfile,
  });
  await upsertRow(supabase, "courses", {
    id: fixture.courseId,
    ...course,
  });
  await upsertRow(
    supabase,
    "course_collaborators",
    {
      course_id: fixture.courseId,
      user_id: fixture.teacherId,
      role: "owner",
      added_by: fixture.adminId,
      ...collaborator,
    },
    "course_id,user_id",
  );

  return { supabase };
}

export async function createBaseTopicAuthoringFixture({
  env = process.env,
  fixture,
  teacherProfile,
  course,
  collaborator,
  chapter,
  topic,
}) {
  const { supabase } = await createBaseAuthoringFixture({
    env,
    fixture,
    teacherProfile,
    course,
    collaborator,
  });

  await upsertRow(supabase, "chapters", {
    id: fixture.chapterId,
    course_id: fixture.courseId,
    ...chapter,
  });
  await upsertRow(supabase, "topics", {
    id: fixture.topicId,
    course_id: fixture.courseId,
    chapter_id: fixture.chapterId,
    ...topic,
  });

  return { supabase };
}
