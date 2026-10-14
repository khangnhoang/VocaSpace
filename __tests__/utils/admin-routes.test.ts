import { describe, expect, it } from "vitest";
import { ADMIN_COURSES_PATH, buildAdminCoursesHref } from "@/lib/admin/routes";
import { adminCourseFilterSchema } from "@/lib/schemas/admin-course";

// Test plan:
// - Mục tiêu: URL của /admin/courses cho một bộ lọc (AD3 AC3) luôn duy nhất và encode đúng cụm tìm kiếm.
// - Loại test: unit trên hàm thuần.
// - Đối tượng: buildAdminCoursesHref.
// - Case thành công: giá trị mặc định (tab pending, không q, trang 1) bị lược; tab khác, q và trang > 1 vào query; ký tự đặc biệt của q được encode.
// - Case thất bại: không áp dụng (hàm thuần không ném).
// - Invariant cần giữ: cùng một trạng thái lọc chỉ có một URL, và parse lại bằng adminCourseFilterSchema cho đúng bộ lọc ban đầu.
// - Kết quả verify gần nhất: xem milestone AD3 CP3 trong progress.md (`npx vitest run __tests__/utils/admin-routes.test.ts`).

describe("buildAdminCoursesHref", () => {
  it("drops default values so the default view is the bare path", () => {
    expect(buildAdminCoursesHref()).toBe(ADMIN_COURSES_PATH);
    expect(buildAdminCoursesHref({ status: "pending", q: "", page: 1 })).toBe(ADMIN_COURSES_PATH);
  });

  it("keeps a non-default tab, the search term and a page beyond the first", () => {
    expect(buildAdminCoursesHref({ status: "removed" })).toBe("/admin/courses?status=removed");
    expect(buildAdminCoursesHref({ q: "toeic", page: 2 })).toBe("/admin/courses?q=toeic&page=2");
    expect(buildAdminCoursesHref({ status: "all", q: "a b", page: 3 })).toBe("/admin/courses?status=all&q=a+b&page=3");
  });

  it("round-trips hostile search characters through the filter schema", () => {
    const q = '100% a_b, (c) "d" \e & f=g';
    const href = buildAdminCoursesHref({ status: "draft", q, page: 4 });

    const params = new URL(href, "http://localhost").searchParams;
    expect(
      adminCourseFilterSchema.parse({ status: params.get("status"), q: params.get("q"), page: params.get("page") }),
    ).toEqual({ status: "draft", q, page: 4 });
  });
});
