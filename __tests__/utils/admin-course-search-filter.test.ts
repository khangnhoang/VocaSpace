import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildCourseSearchFilter } from "@/lib/admin/course-list";

// Test plan:
// - Mục tiêu: cụm tìm kiếm của /admin/courses được escape trước khi vào chuỗi filter PostgREST (AD3 G3).
// - Loại test: unit trên hàm thuần; hành vi khớp thật trên database nằm ở integration ad3-admin-course-read.
// - Đối tượng: buildCourseSearchFilter.
// - Case thành công: văn bản thường thành hai điều kiện ilike bọc nháy kép; `%`, `_`, `\` được escape cho LIKE rồi escape lại cho giá trị bọc nháy.
// - Case thất bại/hostile: `,`, `(`, `)` và `"` luôn nằm trong giá trị bọc nháy nên không thêm hay đóng điều kiện `or`.
// - Invariant cần giữ: chuỗi filter luôn gồm đúng hai điều kiện title/slug, bất kể nội dung q.
// - Kết quả verify gần nhất: xem milestone AD3 CP2 trong progress.md (`npx vitest run __tests__/utils/admin-course-search-filter.test.ts`).

// String.raw để số dấu `\` trong kỳ vọng đọc đúng như chuỗi thật gửi cho PostgREST.
const raw = String.raw;

describe("buildCourseSearchFilter", () => {
  it("wraps a plain term in two quoted ilike conditions on title and slug", () => {
    expect(buildCourseSearchFilter("toeic")).toBe(raw`title.ilike."%toeic%",slug.ilike."%toeic%"`);
  });

  it("escapes LIKE wildcards and the backslash, then escapes the backslash again for the quoted PostgREST value", () => {
    expect(buildCourseSearchFilter("100%")).toBe(raw`title.ilike."%100\\%%",slug.ilike."%100\\%%"`);
    expect(buildCourseSearchFilter("a_b")).toBe(raw`title.ilike."%a\\_b%",slug.ilike."%a\\_b%"`);
    // Một `\` trong q -> `\\` cho LIKE -> `\\\\` trong giá trị bọc nháy.
    expect(buildCourseSearchFilter(raw`a\b`)).toBe(raw`title.ilike."%a\\\\b%",slug.ilike."%a\\\\b%"`);
  });

  it("keeps a hostile term inside the quoted value so it cannot add or close conditions", () => {
    expect(buildCourseSearchFilter('a",id.eq.x),(b')).toBe(
      raw`title.ilike."%a\",id.eq.x),(b%",slug.ilike."%a\",id.eq.x),(b%"`,
    );
  });

  it("maps the PostgREST star wildcard to a single-character LIKE wildcard", () => {
    expect(buildCourseSearchFilter("a*b")).toBe(raw`title.ilike."%a_b%",slug.ilike."%a_b%"`);
  });
});
