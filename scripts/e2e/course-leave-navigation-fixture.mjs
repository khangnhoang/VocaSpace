import { createBaseAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";
import { ensureAuthUserOnce } from "./support/auth-users.mjs";
import { upsertRow } from "./support/db-write.mjs";

// Giáo viên, học viên cộng tác và khóa học đều riêng của worker; không đụng student@gmail.com của seed.
export function courseLeaveNavigationFixtureFor(scope) {
  return {
    adminId: "11111111-1111-4111-8111-111111111111",
    teacherId: scope.teacher.id,
    teacherEmail: scope.teacher.email,
    teacherPassword: scope.teacher.password,
    teacherFullName: scope.teacher.fullName,
    teacherUsername: scope.teacher.username,
    student: scope.extraStudent("leave"),
    courseId: scope.id("leave-course"),
    collaboratorId: scope.id("leave-collaborator"),
    courseSlug: scope.slug("d1-course-leave-navigation-smoke-course"),
  };
}

export async function prepareCourseLeaveNavigationFixture(scope, env = process.env) {
  const courseLeaveNavigationFixture = courseLeaveNavigationFixtureFor(scope);
  const { supabase } = await createBaseAuthoringFixture({
    env,
    fixture: courseLeaveNavigationFixture,
    teacherProfile: {
      bio: "D1 course leave navigation browser smoke fixture.",
      experience_years: 1,
      certifications: "D1 bounded smoke",
    },
    course: {
      title: `D1 Course Leave Navigation Smoke Course ${scope.tag}`,
      slug: courseLeaveNavigationFixture.courseSlug,
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
  const { student } = courseLeaveNavigationFixture;

  await ensureAuthUserOnce(supabase, student);
  await upsertRow(supabase, "profiles", {
    id: student.id,
    email: student.email,
    full_name: student.fullName,
    username: student.username,
    role: "student",
    removed_at: null,
  });
  await upsertRow(supabase, "course_collaborators", {
    course_id: courseLeaveNavigationFixture.courseId,
    user_id: student.id,
    role: "editor",
    can_review_topics: false,
    added_by: courseLeaveNavigationFixture.teacherId,
  }, "course_id,user_id");

  return {
    E2E_STUDENT_EMAIL: student.email,
    E2E_STUDENT_PASSWORD: student.password,
    E2E_COURSE_ID: courseLeaveNavigationFixture.courseId,
  };
}
