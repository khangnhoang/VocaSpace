import type { TeacherAttentionItem, TeacherCoursePortfolio, TeacherCoursePortfolioResult } from "@/lib/schemas/teacher-course-portfolio";
import { getCourseOverviewPath, getTopicBuilderPath } from "./routes";

export function attentionIdentity(item: TeacherAttentionItem) {
  return `${item.kind}:${item.course_id}:${item.topic_id ?? item.course_id}`;
}

export function sortAttention(items: TeacherAttentionItem[]) {
  return [...items].sort((a, b) =>
    Number(a.kind === "topic_review") - Number(b.kind === "topic_review") ||
    Date.parse(a.ordering_at) - Date.parse(b.ordering_at) ||
    attentionIdentity(a).localeCompare(attentionIdentity(b), "en"),
  );
}

export function getContinuation(data: TeacherCoursePortfolio) {
  const attention = sortAttention(data.attention)[0];
  const course = data.courses.find((entry) => entry.id === attention?.course_id) ??
    [...data.courses].sort((a, b) =>
      Date.parse(b.membership_created_at) - Date.parse(a.membership_created_at) ||
      a.id.localeCompare(b.id, "en"),
    )[0];
  return { course, attention: course?.id === attention?.course_id ? attention : undefined };
}

export function attentionPath(item: TeacherAttentionItem) {
  return item.topic_id ? getTopicBuilderPath(item.course_id, item.topic_id) : getCourseOverviewPath(item.course_id);
}

export const courseRoleLabels = { owner: "Chủ sở hữu", co_owner: "Đồng sở hữu", editor: "Biên tập viên", previewer: "Chỉ xem trước" } as const;
export const courseStatusLabels = { draft: "Bản nháp", pending: "Chờ duyệt", published: "Đã xuất bản" } as const;

export type CourseAttentionResult = { success: true; items: TeacherAttentionItem[] } | { success: false };

// Trang Tổng quan chỉ được gửi xuống trình duyệt bài chờ duyệt / bài cần sửa của đúng khóa học này (G6);
// course_rejection đã có ở khối lý do từ chối nên không lặp lại.
export function selectCourseAttention(result: TeacherCoursePortfolioResult, courseId: string): CourseAttentionResult {
  if (!result.success) return { success: false };
  return {
    success: true,
    items: sortAttention(result.data.attention).filter(
      (item) => item.course_id === courseId && (item.kind === "topic_review" || item.kind === "topic_correction"),
    ),
  };
}
