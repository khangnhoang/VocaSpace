import { describe, expect, it } from "vitest";
import { selectCourseAttention } from "@/lib/course-authoring/portfolio";
import type { TeacherAttentionItem } from "@/lib/schemas/teacher-course-portfolio";

// Test plan:
// - Mục tiêu: trang Tổng quan chỉ nhận bài chờ duyệt / bài cần sửa của đúng khóa học (G6), lọc trước khi tới client.
// - Loại test: unit cho hàm thuần selectCourseAttention.
// - Case thành công: giữ topic_review và topic_correction của khóa học, theo thứ tự sortAttention (cần sửa trước, duyệt sau).
// - Case thất bại: read portfolio lỗi trả { success: false } và không mang theo dữ liệu nào.
// - Bảo mật/phân quyền: mục của khóa học khác và course_rejection bị loại.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/utils/course-attention-select.test.ts`.

const courseId = "11111111-1111-4111-8111-111111111111";
const otherCourseId = "22222222-2222-4222-8222-222222222222";

function item(kind: TeacherAttentionItem["kind"], course: string, title: string, orderingAt: string): TeacherAttentionItem {
  return {
    kind,
    course_id: course,
    course_title: "Khóa học",
    topic_id: kind === "course_rejection" ? null : `5555555${title.length}-5555-4555-8555-555555555555`,
    topic_title: kind === "course_rejection" ? null : title,
    reason: kind === "topic_review" ? null : "Cần thêm ví dụ.",
    ordering_at: orderingAt,
  };
}

describe("selectCourseAttention", () => {
  it("keeps only this course's review and correction items, corrections first", () => {
    const result = selectCourseAttention({
      success: true,
      data: {
        can_create_course: true,
        courses: [],
        attention: [
          item("topic_review", courseId, "Gọi món", "2026-10-19T00:00:00.000Z"),
          item("topic_correction", courseId, "Hỏi đường", "2026-10-20T00:00:00.000Z"),
          item("course_rejection", courseId, "", "2026-10-18T00:00:00.000Z"),
          item("topic_review", otherCourseId, "Bài khóa khác", "2026-10-17T00:00:00.000Z"),
        ],
      },
    }, courseId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.items.map((entry) => [entry.kind, entry.topic_title])).toEqual([
      ["topic_correction", "Hỏi đường"],
      ["topic_review", "Gọi món"],
    ]);
  });

  it("returns a bare failure without portfolio data when the read fails", () => {
    expect(selectCourseAttention({ success: false, errorCode: "UNAVAILABLE", error: "Không thể tải." }, courseId)).toEqual({ success: false });
  });
});
