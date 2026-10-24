import { describe, expect, it } from "vitest";
import { teacherCourseInsightsSchema } from "@/lib/schemas/teacher-course-insights";

// Test plan:
// - Mục tiêu: kiểm tra hợp đồng payload `get_teacher_course_insights(p_course_id)` chỉ nhận số đếm tổng hợp nhất quán.
// - Loại test: schema.
// - Đối tượng: teacherCourseInsightsSchema.
// - Case thành công: payload có phân bố tiến độ; khóa học chưa có bài được tính (progress null); khóa học chưa có ghi danh; sáu tháng vắt qua năm.
// - Case thất bại: field lạ ở mọi cấp (kể cả id học viên), số âm/thập phân/chuỗi, số tháng khác 6, định dạng tháng sai, tháng không liên tiếp, tổng tháng vượt tổng ghi danh, phân bố không khớp tổng, progress có/không có sai với counted_topic_total.
// - Bảo mật/phân quyền: không áp dụng ở layer này; quyền được kiểm bằng integration test.
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: payload sai shape hoặc không nhất quán không bao giờ parse thành công.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/schemas/teacher-course-insights.test.ts` (TOV1 CP1).

const months = (counts: number[], first = "2026-05") => {
  const [year, month] = first.split("-").map(Number);
  return counts.map((count, offset) => {
    const index = year * 12 + (month - 1) + offset;
    return { month: `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`, count };
  });
};

const valid = {
  enrollment_total: 7,
  enrollments_by_month: months([0, 1, 0, 2, 1, 2]),
  counted_topic_total: 4,
  progress: { not_started: 3, in_progress: 3, completed: 1 },
};

const parse = (payload: unknown) => teacherCourseInsightsSchema.safeParse(payload);

describe("teacherCourseInsightsSchema", () => {
  it("accepts a populated course whose learners split into the three categories", () => {
    expect(parse(valid)).toEqual({ success: true, data: valid });
  });

  it("accepts a course without counted topics only with no progress distribution", () => {
    expect(parse({ ...valid, counted_topic_total: 0, progress: null }).success).toBe(true);
    expect(parse({ ...valid, counted_topic_total: 0 }).success).toBe(false);
    expect(parse({ ...valid, progress: null }).success).toBe(false);
  });

  it("accepts a course with no enrollments and six zero months", () => {
    expect(parse({
      enrollment_total: 0,
      enrollments_by_month: months([0, 0, 0, 0, 0, 0]),
      counted_topic_total: 2,
      progress: { not_started: 0, in_progress: 0, completed: 0 },
    }).success).toBe(true);
  });

  it("accepts six consecutive months that cross a year boundary", () => {
    const crossing = months([1, 0, 0, 0, 0, 0], "2026-09");
    expect(crossing.map((entry) => entry.month)).toEqual(["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(parse({ ...valid, enrollments_by_month: crossing }).success).toBe(true);
  });

  it.each([
    ["an unknown top-level field", { ...valid, learner_ids: ["11111111-1111-4111-8111-111111111111"] }],
    ["an unknown month field", { ...valid, enrollments_by_month: valid.enrollments_by_month.map((m) => ({ ...m, user_id: "x" })) }],
    ["an unknown progress field", { ...valid, progress: { ...valid.progress, learners: [] } }],
    ["a missing field", { enrollment_total: 7, enrollments_by_month: valid.enrollments_by_month, counted_topic_total: 4 }],
    ["a negative count", { ...valid, enrollment_total: -1 }],
    ["a fractional count", { ...valid, counted_topic_total: 1.5 }],
    ["a numeric string", { ...valid, enrollment_total: "7" }],
    ["five months", { ...valid, enrollments_by_month: months([0, 1, 0, 2, 1]) }],
    ["seven months", { ...valid, enrollments_by_month: months([0, 0, 1, 0, 2, 1, 2]) }],
    ["a malformed month", { ...valid, enrollments_by_month: [{ month: "2026-13", count: 0 }, ...valid.enrollments_by_month.slice(1)] }],
    ["months out of order", { ...valid, enrollments_by_month: [...valid.enrollments_by_month].reverse() }],
    ["a gap between months", { ...valid, enrollments_by_month: [...months([0, 1, 0, 2, 1]), { month: "2026-12", count: 2 }] }],
    ["monthly enrollments above the total", { ...valid, enrollment_total: 5, progress: { not_started: 1, in_progress: 3, completed: 1 } }],
    ["a distribution that does not sum to the total", { ...valid, progress: { not_started: 3, in_progress: 3, completed: 2 } }],
    ["a null payload", null],
  ])("rejects %s", (_name, payload) => {
    expect(parse(payload).success).toBe(false);
  });
});
