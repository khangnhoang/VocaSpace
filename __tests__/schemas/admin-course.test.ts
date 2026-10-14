import { describe, expect, it } from "vitest";
import {
  acceptCourseSchema,
  adminCourseFilterSchema,
  adminCourseSummarySchema,
  moderateCourseSchema,
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

  // Ranh giới độ dài tính theo đơn vị UTF-16 (emoji = 2); RPC reject_course_review phải khớp (integration test).
  it("counts astral characters as two UTF-16 units at the rejection reason bounds", () => {
    const parse = (rejectMessage: string) =>
      rejectCourseSchema.safeParse({ courseId: validCourseId, rejectMessage });

    expect(parse("😀".repeat(5)).success).toBe(true);
    expect(parse(`${"😀".repeat(4)}a`).success).toBe(false);
    expect(parse("😀".repeat(500)).success).toBe(true);
    expect(parse(`${"😀".repeat(500)}a`).success).toBe(false);
  });

  it("defaults the filter to the pending tab, page 1 and an empty search", () => {
    expect(adminCourseFilterSchema.parse({})).toEqual({ status: "pending", q: "", page: 1 });
  });

  it("accepts every tab, trims the search and coerces the page", () => {
    for (const status of ["pending", "published", "draft", "all", "removed"] as const) {
      expect(adminCourseFilterSchema.parse({ status }).status).toBe(status);
    }
    expect(adminCourseFilterSchema.parse({ status: "published", q: "  toeic  ", page: "2" })).toEqual({
      status: "published",
      q: "toeic",
      page: 2,
    });
    expect(adminCourseFilterSchema.parse({ q: "a".repeat(100) }).q).toHaveLength(100);
  });

  it("falls back to the defaults for invalid filter parameters instead of throwing", () => {
    expect(adminCourseFilterSchema.parse({ status: "archived" }).status).toBe("pending");
    expect(adminCourseFilterSchema.parse({ status: ["all", "draft"] }).status).toBe("pending");
    expect(adminCourseFilterSchema.parse({ q: "a".repeat(101) }).q).toBe("");
    for (const page of ["0", "-3", "abc", "1.5", "", ["2", "3"], "99999999999999999999"]) {
      expect(adminCourseFilterSchema.parse({ page }).page).toBe(1);
    }
    expect(adminCourseFilterSchema.parse({ status: "bad", q: "x".repeat(200), page: "0" })).toEqual({
      status: "pending",
      q: "",
      page: 1,
    });
  });

  it("does not take page size or ordering from the URL", () => {
    expect(adminCourseFilterSchema.parse({ pageSize: "100", sort: "oldest" })).toEqual({
      status: "pending",
      q: "",
      page: 1,
    });
  });

  it("requires a valid course id for the summary", () => {
    expect(adminCourseSummarySchema.parse({ courseId: validCourseId })).toEqual({ courseId: validCourseId });
    expect(adminCourseSummarySchema.safeParse({ courseId: "not-a-uuid" }).success).toBe(false);
    expect(adminCourseSummarySchema.safeParse({}).success).toBe(false);
  });

  describe("moderateCourseSchema", () => {
    const reason = "Nội dung vi phạm quy định cộng đồng.";

    it("accepts demote and takedown with a trimmed reason", () => {
      for (const action of ["demote", "takedown"] as const) {
        expect(moderateCourseSchema.parse({ courseId: validCourseId, action, reason: `  ${reason}  ` })).toEqual({
          courseId: validCourseId,
          action,
          reason,
        });
      }
    });

    it("rejects a bad uuid and any other action", () => {
      expect(moderateCourseSchema.safeParse({ courseId: "x", action: "demote", reason }).success).toBe(false);
      for (const action of ["invalidate_review", "restore", "", undefined]) {
        expect(moderateCourseSchema.safeParse({ courseId: validCourseId, action, reason }).success).toBe(false);
      }
    });

    it("bounds the reason at 10 and 2000 characters after trimming", () => {
      const parse = (value: string) =>
        moderateCourseSchema.safeParse({ courseId: validCourseId, action: "takedown", reason: value });

      expect(parse("a".repeat(9)).success).toBe(false);
      expect(parse(`   ${"a".repeat(9)}   `).success).toBe(false);
      expect(parse("a".repeat(10)).success).toBe(true);
      expect(parse("a".repeat(2000)).success).toBe(true);
      expect(parse(`  ${"a".repeat(2000)}  `).success).toBe(true);
      expect(parse("a".repeat(2001)).success).toBe(false);
    });

    it("ignores a client-sent target type instead of passing it through", () => {
      const parsed = moderateCourseSchema.parse({
        courseId: validCourseId,
        action: "demote",
        reason,
        targetType: "topic",
        targetId: "ignored",
      });

      expect(parsed).toEqual({ courseId: validCourseId, action: "demote", reason });
    });
  });
});
