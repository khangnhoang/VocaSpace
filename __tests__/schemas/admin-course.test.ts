import { describe, expect, it } from "vitest";
import {
  acceptCourseSchema,
  adminCourseFilterSchema,
  rejectCourseSchema,
  submitCourseReviewSchema,
} from "@/lib/schemas/admin-course";

// Test plan:
// - Mục tiêu: kiểm tra schema review khóa học cho admin, gồm ID, filter và lý do từ chối.
// - Loại test: schema.
// - Đối tượng: adminCourseFilterSchema, acceptCourseSchema, rejectCourseSchema, submitCourseReviewSchema.
// - Case thành công: UUID hợp lệ, filter được trim/coerce, rejection reason được trim.
// - Case thất bại: UUID sai, rejection reason quá ngắn, query vượt giới hạn.
// - Invariant cần giữ: UI chỉ gửi payload review đã validate theo schema SSOT.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__\schemas\admin-course.test.ts __tests__\components\admin-course-table.test.tsx`.
const validCourseId = "11111111-1111-4111-8111-111111111111";

describe("admin course validation", () => {
  it("accepts valid course review identifiers", () => {
    expect(acceptCourseSchema.parse({ courseId: validCourseId })).toEqual({
      courseId: validCourseId,
    });
    expect(submitCourseReviewSchema.parse({ courseId: validCourseId })).toEqual({
      courseId: validCourseId,
    });
  });

  it("rejects invalid course identifiers", () => {
    expect(() => acceptCourseSchema.parse({ courseId: "not-a-uuid" })).toThrow(
      "ID khóa học không hợp lệ.",
    );
    expect(() =>
      submitCourseReviewSchema.parse({ courseId: "not-a-uuid" }),
    ).toThrow("ID khóa học không hợp lệ.");
  });

  it("trims and accepts a clear rejection reason", () => {
    expect(
      rejectCourseSchema.parse({
        courseId: validCourseId,
        rejectMessage: "  Vui lòng bổ sung ảnh bìa rõ nét.  ",
      }),
    ).toEqual({
      courseId: validCourseId,
      rejectMessage: "Vui lòng bổ sung ảnh bìa rõ nét.",
    });
  });

  it("requires a meaningful rejection reason", () => {
    expect(() =>
      rejectCourseSchema.parse({
        courseId: validCourseId,
        rejectMessage: "  quá ngắn  ",
      }),
    ).toThrow("Lý do từ chối phải có ít nhất 10 ký tự.");
  });

  it("limits search query length and trims filter input", () => {
    expect(
      adminCourseFilterSchema.parse({
        status: "pending",
        q: "  toeic  ",
        page: "2",
        pageSize: "20",
      }),
    ).toMatchObject({
      status: "pending",
      q: "toeic",
      page: 2,
      pageSize: 20,
    });

    expect(() =>
      adminCourseFilterSchema.parse({ q: "a".repeat(101) }),
    ).toThrow("Từ khóa tìm kiếm không được vượt quá 100 ký tự.");
  });
});
