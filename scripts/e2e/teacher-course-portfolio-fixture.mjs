import { createBaseAuthoringFixture } from "./support/course-authoring-base-fixture.mjs";

export const portfolioFixture = {
  adminId: "11111111-1111-4111-8111-111111111111",
  teacherId: "22222222-2222-4222-8222-222222222222",
  teacherEmail: "teacher@gmail.com",
  teacherPassword: "123123",
  courseId: "f8100000-0000-4000-8000-000000000001",
  collaboratorId: "f8100000-0000-4000-8000-000000000002",
  title: "Portfolio QA — Phản hồi khóa học",
};

export async function preparePortfolioFixture(env = process.env) {
  const target = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (target.origin !== "http://127.0.0.1:45441") {
    throw new Error("Portfolio smoke fixture only runs on isolated E2E API 45441.");
  }
  const { supabase } = await createBaseAuthoringFixture({
    env,
    fixture: portfolioFixture,
    teacherProfile: { bio: "Portfolio smoke", experience_years: 1, certifications: "Local QA" },
    course: {
      title: portfolioFixture.title,
      slug: "portfolio-qa-feedback",
      description: "Khóa học cần bổ sung mô tả và lộ trình theo phản hồi duyệt.",
      status: "draft",
      price: 0,
      order_index: 80,
      removed_at: null,
      reject_message: "Bổ sung mục tiêu đầu ra cho khóa học.",
      reviewed_at: "2026-10-10T00:00:00Z",
    },
    collaborator: { id: portfolioFixture.collaboratorId },
  });
  return { supabase };
}
