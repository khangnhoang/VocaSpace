import type {
  CourseAuthoringIssueContext,
  ParsedCourseAuthoringIssueContext,
} from "@/lib/course-authoring/issue-context";

export type CourseAuthoringSuccessEvent =
  | { type: "chapter_created"; courseId: string; chapterId: string }
  | {
      type: "topic_created";
      courseId: string;
      chapterId: string;
      topicId: string;
    }
  | { type: "flashcard_created"; topicId: string }
  | { type: "exercise_created"; topicId: string }
  | { type: "question_group_updated"; questionGroupId: string }
  | { type: "question_updated"; questionId: string };

export type CourseAuthoringReturnFeedback = {
  title: string;
  description: string;
};

export type DashboardIssueSuccessContext =
  | CourseAuthoringIssueContext
  | ParsedCourseAuthoringIssueContext
  | null
  | undefined;

// Đây là nguồn duy nhất quyết định action thành công nào liên quan tới vấn đề từ dashboard.
// Những case chưa có thao tác sửa chắc chắn trong UI sẽ trả null thay vì tạo cảm giác đã sửa xong.
export function getDashboardIssueReturnFeedback(
  context: DashboardIssueSuccessContext,
  event: CourseAuthoringSuccessEvent,
): CourseAuthoringReturnFeedback | null {
  if (!context) return null;

  switch (context.issue) {
    case "course_has_no_chapters":
      return event.type === "chapter_created" && event.courseId === context.target
        ? {
            title: "Đã thêm chương đầu tiên.",
            description:
              "Thay đổi đã được lưu. Bạn có thể quay lại tổng quan để kiểm tra trạng thái mới.",
          }
        : null;

    case "chapter_has_no_topics":
      return event.type === "topic_created" && event.chapterId === context.target
        ? {
            title: "Đã thêm bài học cho chương này.",
            description:
              "Bài học đã được tạo trong chương được dashboard đánh dấu.",
          }
        : null;

    case "topic_has_no_learning_content":
      if (
        (event.type === "flashcard_created" || event.type === "exercise_created") &&
        event.topicId === context.target
      ) {
        return {
          title: "Đã thêm nội dung học tập cho bài học.",
          description:
            "Nội dung mới đã được lưu. Bạn có thể quay lại tổng quan để kiểm tra trạng thái mới.",
        };
      }

      return null;

    case "exercise_group_missing_context":
      return event.type === "question_group_updated" &&
        event.questionGroupId === context.target
        ? {
            title: "Đã cập nhật nhóm câu hỏi.",
            description:
              "Ngữ liệu của nhóm đã được lưu. Bạn có thể quay lại tổng quan để kiểm tra trạng thái mới.",
          }
        : null;

    case "question_missing_content":
    case "question_has_too_few_options":
    case "question_has_no_correct_option":
      return event.type === "question_updated" && event.questionId === context.target
        ? {
            title: "Đã cập nhật câu hỏi.",
            description:
              "Thay đổi đã được lưu thành công. Bạn có thể quay lại tổng quan để kiểm tra trạng thái mới.",
          }
        : null;

    case "exercise_requires_group":
    case "question_group_has_no_active_questions":
    case "exercise_requires_standalone_question":
    case "exercise_has_orphan_questions":
      return null;
  }
}
