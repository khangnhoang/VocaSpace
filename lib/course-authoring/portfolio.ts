import type { TeacherAttentionItem, TeacherCoursePortfolio } from "@/lib/schemas/teacher-course-portfolio";
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
