import { describe, expect, it } from "vitest";
import { teacherCoursePortfolioSchema } from "@/lib/schemas/teacher-course-portfolio";

// Test plan:
// - Mục tiêu: kiểm tra hợp đồng payload `get_teacher_course_portfolio()` từ chối drift thay vì render dữ liệu nửa tin cậy.
// - Loại test: schema.
// - Đối tượng: teacherCoursePortfolioSchema (courses + attention items).
// - Case thành công: payload đầy đủ và payload rỗng hợp lệ; mỗi loại attention item hợp lệ.
// - Case thất bại: enum/UUID/timestamp sai, topic item thiếu topic, course item có topic, review item có reason, correction thiếu reason, field lạ ở mọi cấp.
// - Bảo mật/phân quyền: không áp dụng ở layer này; quyền được kiểm bằng integration test.
// - Ổn định/resilience: reason null hợp lệ cho review nhưng không cho correction.
// - Invariant cần giữ: payload sai shape không bao giờ parse thành công.
// - Kết quả verify gần nhất: passed bằng `npm run test:run -- __tests__/schemas/teacher-course-portfolio.test.ts` (TPORT1 CP1).

const courseId = "11111111-1111-4111-8111-111111111111";
const topicId = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-10-21T14:58:16.502567+00:00";

const course = {
  id: courseId,
  title: "TOEIC nền tảng",
  slug: "toeic-nen-tang",
  description: null,
  thumbnail_url: null,
  price: 0,
  status: "draft",
  order_index: 0,
  reject_message: null,
  reviewed_at: null,
  my_role: "owner",
  membership_created_at: timestamp,
};

const reviewItem = {
  kind: "topic_review",
  course_id: courseId,
  course_title: "TOEIC nền tảng",
  topic_id: topicId,
  topic_title: "Từ vựng chủ đề 1",
  reason: null,
  ordering_at: timestamp,
};

const correctionItem = { ...reviewItem, kind: "topic_correction", reason: "Thiếu ví dụ" };
const courseItem = {
  ...reviewItem,
  kind: "course_rejection",
  topic_id: null,
  topic_title: null,
  reason: "Ảnh bìa chưa phù hợp",
};

const portfolio = (overrides: Record<string, unknown> = {}) => ({
  can_create_course: true,
  courses: [course],
  attention: [reviewItem, correctionItem, courseItem],
  ...overrides,
});

describe("teacherCoursePortfolioSchema", () => {
  it("accepts a full payload and an empty payload", () => {
    expect(teacherCoursePortfolioSchema.safeParse(portfolio()).success).toBe(true);
    expect(
      teacherCoursePortfolioSchema.safeParse({ can_create_course: false, courses: [], attention: [] }).success,
    ).toBe(true);
  });

  it.each([
    ["an unknown course role", portfolio({ courses: [{ ...course, my_role: "admin" }] })],
    ["a malformed course id", portfolio({ courses: [{ ...course, id: "not-a-uuid" }] })],
    ["a non-ISO membership timestamp", portfolio({ courses: [{ ...course, membership_created_at: "yesterday" }] })],
    ["an unknown attention kind", portfolio({ attention: [{ ...reviewItem, kind: "topic_published" }] })],
    ["a malformed attention timestamp", portfolio({ attention: [{ ...reviewItem, ordering_at: "soon" }] })],
    ["an unexpected top-level field", portfolio({ viewer_id: courseId })],
    ["an unexpected course field", portfolio({ courses: [{ ...course, owner_email: "x@example.com" }] })],
    ["an unexpected attention field", portfolio({ attention: [{ ...reviewItem, submitter_email: "x@example.com" }] })],
  ])("rejects %s", (_name, payload) => {
    expect(teacherCoursePortfolioSchema.safeParse(payload).success).toBe(false);
  });

  it.each([
    ["a topic item without topic identity", { ...reviewItem, topic_id: null, topic_title: null }],
    ["a course rejection that carries a topic", { ...courseItem, topic_id: topicId, topic_title: "x" }],
    ["a topic item with only a topic id", { ...reviewItem, topic_title: null }],
    ["a topic item with only a topic title", { ...reviewItem, topic_id: null }],
    ["a course rejection with only a topic id", { ...courseItem, topic_id: topicId }],
    ["a course rejection with only a topic title", { ...courseItem, topic_title: "x" }],
    ["a review item with a rejection reason", { ...reviewItem, reason: "không được có" }],
    ["a correction item without a reason", { ...correctionItem, reason: null }],
    ["a course rejection with a blank reason", { ...courseItem, reason: "   " }],
  ])("rejects %s", (_name, item) => {
    expect(teacherCoursePortfolioSchema.safeParse(portfolio({ attention: [item] })).success).toBe(false);
  });
});
