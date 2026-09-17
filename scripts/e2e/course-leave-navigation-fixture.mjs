import { createBaseAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";
import { ensureAuthUser } from "./support/auth-users.mjs";
import { upsertRow } from "./support/db-write.mjs";

export const courseLeaveNavigationFixture = {
  adminId: "11111111-1111-4111-8111-111111111111",
  teacherId: "22222222-2222-4222-8222-222222222222",
  studentId: "33333333-3333-4333-8333-333333333333",
  teacherEmail: "teacher@gmail.com",
  studentEmail: "student@gmail.com",
  password: "123123",
  teacherPassword: "123123",
  courseId: "abababab-abab-4aba-8aba-abababababab",
  collaboratorId: "44444444-4444-4444-8444-444444444444",
};

export async function prepareCourseLeaveNavigationFixture(env = process.env) {
  const { supabase } = await createBaseAuthoringFixture({
    env,
    fixture: courseLeaveNavigationFixture,
    teacherProfile: {
      bio: "D1 course leave navigation browser smoke fixture.",
      experience_years: 1,
      certifications: "D1 bounded smoke",
    },
    course: {
      title: "D1 Course Leave Navigation Smoke Course",
      slug: "d1-course-leave-navigation-smoke-course",
      description: "Bounded D1 student collaborator leave navigation fixture.",
      price: 0,
      status: "draft",
      order_index: 0,
      removed_at: null,
    },
    collaborator: {
      id: courseLeaveNavigationFixture.collaboratorId,
    },
  });

  await ensureAuthUser(supabase, {
    id: courseLeaveNavigationFixture.studentId,
    email: courseLeaveNavigationFixture.studentEmail,
    password: courseLeaveNavigationFixture.password,
    fullName: "Local Student",
    username: "local_student",
  });
  await upsertRow(supabase, "profiles", {
    id: courseLeaveNavigationFixture.studentId,
    email: courseLeaveNavigationFixture.studentEmail,
    full_name: "Local Student",
    username: "local_student",
    role: "student",
    removed_at: null,
  });
  await upsertRow(supabase, "course_collaborators", {
    course_id: courseLeaveNavigationFixture.courseId,
    user_id: courseLeaveNavigationFixture.studentId,
    role: "editor",
    can_review_topics: false,
    added_by: courseLeaveNavigationFixture.teacherId,
  }, "course_id,user_id");

  return {
    E2E_STUDENT_EMAIL: courseLeaveNavigationFixture.studentEmail,
    E2E_STUDENT_PASSWORD: courseLeaveNavigationFixture.password,
    E2E_COURSE_ID: courseLeaveNavigationFixture.courseId,
  };
}
