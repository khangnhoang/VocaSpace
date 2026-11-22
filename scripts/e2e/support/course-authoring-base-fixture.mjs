import { ensureAuthUserOnce } from "./auth-users.mjs";
import { upsertRow } from "./db-write.mjs";
import { createSupabaseAdmin } from "./supabase-admin.mjs";
import { assertIsolatedRuntime } from "./worker-scope.mjs";

// Fixture chỉ tạo/ghi lại giáo viên của chính nó. Admin dùng chung (`admin@gmail.com`) chỉ được tham chiếu
// (added_by, created_by_user_id) và do `ensureSharedAccounts` dựng một lần trước khi test chạy (G3), nên không
// có lời gọi `updateUserById` nào của fixture đụng vào phiên của admin khi worker khác đang đăng nhập.
export async function createBaseAuthoringFixture({
  env = process.env,
  fixture,
  teacherProfile,
  course,
  collaborator,
}) {
  assertIsolatedRuntime(env);
  const supabase = createSupabaseAdmin(env);
  const teacherFullName = fixture.teacherFullName ?? "Local Teacher";
  const teacherUsername = fixture.teacherUsername ?? "local_teacher";

  await ensureAuthUserOnce(supabase, {
    id: fixture.teacherId,
    email: fixture.teacherEmail,
    password: fixture.teacherPassword,
    fullName: teacherFullName,
    username: teacherUsername,
  });

  await upsertRow(supabase, "profiles", {
    id: fixture.teacherId,
    email: fixture.teacherEmail,
    full_name: teacherFullName,
    username: teacherUsername,
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
