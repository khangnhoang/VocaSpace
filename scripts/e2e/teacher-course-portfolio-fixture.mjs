import { createBaseAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";

// Giáo viên riêng của nhóm portfolio (mỗi worker một tài khoản): trang `/teacher/courses` chỉ có đúng khóa học này,
// nên nút "Đưa vào thùng rác" và "Cài đặt thông tin" là duy nhất và danh sách không rơi vào chế độ dày (từ 5 khóa học).
export function portfolioFixtureFor(scope) {
  const teacher = scope.extraTeacher("portfolio");
  return {
    adminId: "11111111-1111-4111-8111-111111111111",
    teacherId: teacher.id,
    teacherEmail: teacher.email,
    teacherPassword: teacher.password,
    teacherFullName: teacher.fullName,
    teacherUsername: teacher.username,
    courseId: scope.id("portfolio-course"),
    collaboratorId: scope.id("portfolio-collaborator"),
    courseSlug: scope.slug("portfolio-qa-feedback"),
    title: "Portfolio QA — Phản hồi khóa học",
  };
}

export async function preparePortfolioFixture(scope, env = process.env) {
  const fixture = portfolioFixtureFor(scope);
  const { supabase } = await createBaseAuthoringFixture({
    env,
    fixture,
    teacherProfile: { bio: "Portfolio smoke", experience_years: 1, certifications: "Local QA" },
    course: {
      title: fixture.title,
      slug: fixture.courseSlug,
      description: "Khóa học cần bổ sung mô tả và lộ trình theo phản hồi duyệt.",
      status: "draft",
      price: 0,
      order_index: 80,
      removed_at: null,
      reject_message: "Bổ sung mục tiêu đầu ra cho khóa học.",
      reviewed_at: "2026-10-10T00:00:00Z",
    },
    collaborator: { id: fixture.collaboratorId },
  });
  return { supabase, fixture };
}
