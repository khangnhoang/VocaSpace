import type { Chapter } from "@/app/(teacher)/courses/[id]/_components/types";
import type {
  CourseStructureIssueContext,
  TopicBuilderIssueContext,
} from "@/lib/course-authoring/issue-context";
import type {
  FullExercise,
  FullExerciseQuestion,
} from "@/lib/schemas/exercise";

export type DashboardIssueTone = "info" | "warning";

export type DashboardIssueGuidance = {
  tone: DashboardIssueTone;
  title: string;
  description: string;
  actionLabel?: string;
  targetChapterId?: string;
  targetExerciseId?: string;
  targetGroupId?: string;
  targetQuestionId?: string;
};

// File này chỉ chuyển vấn đề từ dashboard thành lời nhắc tại màn hình đích.
// Việc tạo URL, kiểm quyền và sửa dữ liệu nằm ở các lớp khác.
const invalidContextGuidance: DashboardIssueGuidance = {
  tone: "warning",
  title: "Đường dẫn từ dashboard không còn hợp lệ",
  description:
    "Nội dung được yêu cầu không còn khớp với màn hình hiện tại. Bạn vẫn có thể tiếp tục chỉnh sửa tại đây.",
};

export function getInvalidDashboardIssueGuidance() {
  return invalidContextGuidance;
}

export function resolveCourseStructureIssueGuidance({
  courseId,
  chapters,
  context,
}: {
  courseId: string;
  chapters: Chapter[];
  context: CourseStructureIssueContext;
}): DashboardIssueGuidance {
  if (context.issue === "course_has_no_chapters") {
    if (context.target !== courseId) {
      return invalidContextGuidance;
    }

    if (chapters.length > 0) {
      return {
        tone: "warning",
        title: "Khóa học đã có chương",
        description:
          "Đường dẫn này được tạo khi khóa học chưa có chương. Danh sách hiện tại đã có chương, nên bạn có thể tiếp tục chỉnh sửa cấu trúc bình thường.",
      };
    }

    return {
      tone: "info",
      title: "Khóa học chưa có chương",
      description:
        "Hãy thêm chương đầu tiên để bắt đầu xây dựng nội dung cho khóa học.",
      actionLabel: "Thêm chương",
    };
  }

  const chapter = chapters.find((item) => item.id === context.target);

  if (!chapter || chapter.removed_at) {
    return {
      tone: "warning",
      title: "Chương được yêu cầu không còn khả dụng",
      description:
        "Dashboard đã dẫn tới một chương không còn trong cấu trúc hoạt động. Bạn vẫn có thể chọn chương khác hoặc thêm chương mới.",
    };
  }

  return {
    tone: "info",
    title: "Chương chưa có bài học",
    description: `Chương "${chapter.title}" chưa có bài học. Hãy thêm bài học đầu tiên cho chương này.`,
    targetChapterId: chapter.id,
  };
}

export function resolveTopicBuilderTopIssueGuidance({
  topicId,
  context,
}: {
  topicId: string;
  context: TopicBuilderIssueContext;
}): DashboardIssueGuidance | null {
  if (context.issue !== "topic_has_no_learning_content") {
    return null;
  }

  if (context.target !== topicId) {
    return invalidContextGuidance;
  }

  return {
    tone: "info",
    title: "Bài học chưa có nội dung học tập",
    description:
      "Bài học này chưa có flashcard hoặc bài tập hoạt động. Bạn có thể thêm flashcard hoặc tạo bài tập để hoàn thiện nội dung.",
  };
}

export function resolveExerciseIssueGuidance({
  exercises,
  context,
}: {
  exercises: FullExercise[];
  context: TopicBuilderIssueContext;
}): DashboardIssueGuidance {
  // Các vấn đề ở bài tập cần so khớp lại với dữ liệu vừa tải.
  // Nếu target đã bị ẩn/xóa, màn hình sẽ báo nhẹ thay vì đánh dấu nhầm mục khác.
  switch (context.issue) {
    case "exercise_requires_group": {
      const exercise = findExerciseById(exercises, context.target);
      if (!exercise) return missingExerciseGuidance();

      return {
        tone: "info",
        title: "Bài tập cần nhóm câu hỏi",
        description: `Bài tập "${exercise.title}" cần có ít nhất một nhóm câu hỏi hợp lệ.`,
        targetExerciseId: exercise.id,
      };
    }

    case "exercise_requires_standalone_question": {
      const exercise = findExerciseById(exercises, context.target);
      if (!exercise) return missingExerciseGuidance();

      return {
        tone: "info",
        title: "Bài tập cần câu hỏi độc lập",
        description: `Bài tập "${exercise.title}" cần có ít nhất một câu hỏi độc lập.`,
        targetExerciseId: exercise.id,
      };
    }

    case "exercise_has_orphan_questions": {
      const exercise = findExerciseById(exercises, context.target);
      if (!exercise) return missingExerciseGuidance();

      return {
        tone: "info",
        title: "Bài tập có câu hỏi chưa nằm trong nhóm hợp lệ",
        description: `Bài tập "${exercise.title}" có câu hỏi chưa gắn với nhóm ngữ liệu hợp lệ. Hiện màn hình này chỉ giúp bạn nhận diện bài tập cần kiểm tra.`,
        targetExerciseId: exercise.id,
      };
    }

    case "question_group_has_no_active_questions": {
      const match = findQuestionGroupById(exercises, context.target);
      if (!match) return missingGroupGuidance();

      return {
        tone: "info",
        title: "Nhóm câu hỏi đang trống",
        description: `Nhóm trong bài tập "${match.exercise.title}" chưa có câu hỏi hoạt động.`,
        targetExerciseId: match.exercise.id,
        targetGroupId: match.group.id,
      };
    }

    case "exercise_group_missing_context": {
      const match = findQuestionGroupById(exercises, context.target);
      if (!match) return missingGroupGuidance();

      return {
        tone: "info",
        title: "Nhóm câu hỏi thiếu ngữ liệu",
        description: `Nhóm trong bài tập "${match.exercise.title}" thiếu đoạn văn, âm thanh hoặc hình ảnh bắt buộc cho loại bài này.`,
        targetExerciseId: match.exercise.id,
        targetGroupId: match.group.id,
      };
    }

    case "question_missing_content":
    case "question_has_too_few_options":
    case "question_has_no_correct_option": {
      const match = findQuestionById(exercises, context.target);
      if (!match) return missingQuestionGuidance();

      return {
        tone: "info",
        title: getQuestionIssueTitle(context.issue),
        description: `Câu hỏi trong bài tập "${match.exercise.title}" cần được chỉnh sửa trước khi khóa học sẵn sàng.`,
        targetExerciseId: match.exercise.id,
        targetGroupId: match.groupId,
        targetQuestionId: match.question.id,
      };
    }

    case "topic_has_no_learning_content":
      return {
        tone: "info",
        title: "Bài học chưa có nội dung học tập",
        description:
          "Bài học này chưa có flashcard hoặc bài tập hoạt động. Bạn có thể thêm flashcard hoặc tạo bài tập để hoàn thiện nội dung.",
      };
  }
}

function missingExerciseGuidance(): DashboardIssueGuidance {
  return {
    tone: "warning",
    title: "Bài tập được yêu cầu không còn khả dụng",
    description:
      "Bài tập trong đường dẫn từ dashboard không còn xuất hiện trong bài học này. Bạn vẫn có thể tiếp tục quản lý các bài tập hiện có.",
  };
}

function missingGroupGuidance(): DashboardIssueGuidance {
  return {
    tone: "warning",
    title: "Nhóm câu hỏi được yêu cầu không còn khả dụng",
    description:
      "Nhóm câu hỏi trong đường dẫn từ dashboard không còn xuất hiện trong bài học này.",
  };
}

function missingQuestionGuidance(): DashboardIssueGuidance {
  return {
    tone: "warning",
    title: "Câu hỏi được yêu cầu không còn khả dụng",
    description:
      "Câu hỏi trong đường dẫn từ dashboard không còn xuất hiện trong bài học này.",
  };
}

function getQuestionIssueTitle(issue: TopicBuilderIssueContext["issue"]) {
  if (issue === "question_missing_content") {
    return "Câu hỏi thiếu nội dung";
  }

  if (issue === "question_has_too_few_options") {
    return "Câu hỏi thiếu đáp án";
  }

  return "Câu hỏi chưa có đáp án đúng";
}

function findExerciseById(exercises: FullExercise[], exerciseId: string) {
  return exercises.find((exercise) => exercise.id === exerciseId);
}

function findQuestionGroupById(exercises: FullExercise[], groupId: string) {
  for (const exercise of exercises) {
    const group = exercise.groups?.find((item) => item.id === groupId);
    if (group) return { exercise, group };
  }

  return null;
}

function findQuestionById(exercises: FullExercise[], questionId: string) {
  for (const exercise of exercises) {
    for (const group of exercise.groups ?? []) {
      const question = group.questions?.find((item) => item.id === questionId);
      if (question) return { exercise, groupId: group.id, question };
    }

    const question = (
      (exercise.questions ?? []) as FullExerciseQuestion[]
    ).find((item) => item.id === questionId);
    if (question) return { exercise, groupId: undefined, question };
  }

  return null;
}
