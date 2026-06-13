import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminCourseTable,
  type AdminCourse,
} from "@/app/admin/courses/_components/admin-course-table";

// Test plan:
// - Mục tiêu: kiểm tra các affordance chính của bảng admin course khi lọc rỗng và review course pending.
// - Loại test: component render.
// - Đối tượng: AdminCourseTable.
// - Case thành công: empty state có reset action; pending course có nhãn truy cập cho Accept/Reject; zero enrollment hiển thị 0.
// - Case thất bại: không áp dụng ở static render; interaction/browser cần manual UI test.
// - Invariant cần giữ: admin luôn thấy hướng xử lý khi filter rỗng và icon-only actions có accessible name.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__\schemas\admin-course.test.ts __tests__\components\admin-course-table.test.tsx`.
const pendingCourse: AdminCourse = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Ngữ pháp tiếng Anh cơ bản",
  slug: "ngu-phap-tieng-anh-co-ban",
  description: "Nền tảng ngữ pháp vững chắc.",
  thumbnail_url: null,
  price: 0,
  status: "pending",
  order_index: 1,
  created_at: "2026-06-13T00:00:00.000Z",
  updated_at: "2026-06-13T00:00:00.000Z",
  removed_at: null,
  reject_message: null,
  submitted_at: "2026-06-12T00:00:00.000Z",
  reviewed_by: null,
  reviewed_at: null,
  enrollments_count: 0,
};

describe("AdminCourseTable UI", () => {
  it("renders a filtered empty state with a reset action", () => {
    const html = renderToStaticMarkup(
      <AdminCourseTable
        courses={[]}
        statusFilter="pending"
        searchQuery="toeic"
        onResetFilters={() => {}}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );

    expect(html).toContain("Không tìm thấy khóa học phù hợp.");
    expect(html).toContain("Xóa bộ lọc");
    expect(html).toContain("toeic");
  });

  it("labels pending course review actions with the course title", () => {
    const html = renderToStaticMarkup(
      <AdminCourseTable
        courses={[pendingCourse]}
        statusFilter="all"
        searchQuery=""
        onResetFilters={() => {}}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );

    expect(html).toContain("aria-label=\"Bảng quản lý khóa học\"");
    expect(html).toContain(
      `aria-label="Duyệt khóa học ${pendingCourse.title}"`,
    );
    expect(html).toContain(
      `aria-label="Từ chối khóa học ${pendingCourse.title}"`,
    );
  });

  it("renders a known zero enrollment count as 0", () => {
    const html = renderToStaticMarkup(
      <AdminCourseTable
        courses={[pendingCourse]}
        statusFilter="all"
        searchQuery=""
        onResetFilters={() => {}}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );

    expect(html).toContain("<td");
    expect(html).toContain(">0</td>");
  });
});
