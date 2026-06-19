import { z } from "zod";
import { courseMemberRoleSchema, courseStatusSchema } from "@/lib/schemas/course";
import { TOEIC_PART_TYPES } from "@/lib/schemas/exercise";

// File này chỉ mô tả cấu trúc dữ liệu cho readiness:
// - input route;
// - bản ghi đọc từ Supabase;
// - dữ liệu trả về cho dashboard.
// Đăng nhập, phân quyền, quan hệ cha-con và khóa học còn thiếu gì được xử lý ở
// Server Action hoặc hàm tính readiness.

// Các giá trị dùng lại này mô tả cột database có thể rỗng trong các truy vấn
// readiness.
const nullableTimestampSchema = z.string().nullable();
const nullableOrderIndexSchema = z.number().nullable();

// Route param phải là UUID trước khi chạm Supabase.
export const courseReadinessCourseIdSchema = z.uuid(
  "ID khóa học không hợp lệ.",
);

export const courseReadinessToeicPartSchema = z.enum(TOEIC_PART_TYPES);

// Các schema bản ghi bên dưới chỉ kiểm tra kiểu dữ liệu lấy từ Supabase.
// Dữ liệu có được tính vào counts hoặc lỗi hay không thuộc hàm tính readiness.
export const courseReadinessCourseSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  price: z.number().nullable(),
  status: courseStatusSchema.nullable(),
  order_index: nullableOrderIndexSchema,
  removed_at: nullableTimestampSchema,
});

export const courseReadinessChapterSchema = z.strictObject({
  id: z.uuid(),
  course_id: z.uuid(),
  title: z.string().min(1),
  order_index: nullableOrderIndexSchema,
  created_at: z.string(),
  removed_at: nullableTimestampSchema,
});

export const courseReadinessTopicSchema = z.strictObject({
  id: z.uuid(),
  course_id: z.uuid(),
  chapter_id: z.uuid().nullable(),
  title: z.string().min(1),
  slug: z.string().min(1),
  status: courseStatusSchema.nullable(),
  order_index: nullableOrderIndexSchema,
  created_at: z.string(),
  removed_at: nullableTimestampSchema,
});

export const courseReadinessFlashcardSchema = z.strictObject({
  id: z.uuid(),
  topic_id: z.uuid(),
  order_index: nullableOrderIndexSchema,
  removed_at: nullableTimestampSchema,
});

export const courseReadinessExerciseSchema = z.strictObject({
  id: z.uuid(),
  course_id: z.uuid(),
  topic_id: z.uuid(),
  title: z.string().min(1),
  part_type: courseReadinessToeicPartSchema,
  order_index: nullableOrderIndexSchema,
  created_at: z.string(),
  removed_at: nullableTimestampSchema,
});

// Cho phép ngữ liệu rỗng vì thiếu ngữ liệu là lỗi sửa được, không phải lỗi đọc dữ liệu.
export const courseReadinessQuestionGroupSchema = z.strictObject({
  id: z.uuid(),
  exercise_id: z.uuid(),
  passage_text: z.string().nullable(),
  audio_url: z.string().nullable(),
  image_url: z.string().nullable(),
  order_index: nullableOrderIndexSchema,
  created_at: z.string(),
  removed_at: nullableTimestampSchema,
});

// Cho phép content rỗng để hệ thống có thể báo lỗi sửa được cho câu hỏi đó.
export const courseReadinessQuestionSchema = z.strictObject({
  id: z.uuid(),
  course_id: z.uuid(),
  exercise_id: z.uuid(),
  group_id: z.uuid().nullable(),
  content: z.string(),
  order_index: nullableOrderIndexSchema,
  created_at: z.string(),
  removed_at: nullableTimestampSchema,
});

// Option rỗng vẫn qua schema; hàm tính readiness mới quyết định option nào có nội dung thực.
export const courseReadinessAnswerOptionSchema = z.strictObject({
  id: z.uuid(),
  question_id: z.uuid(),
  content: z.string(),
  label: z.string().nullable(),
  is_correct: z.boolean().nullable(),
  order_index: nullableOrderIndexSchema,
  removed_at: nullableTimestampSchema,
});

// Role đọc được từ join vẫn phải được Server Action so với danh sách role được duyệt.
export const courseReadinessAccessRowSchema = z.strictObject({
  role: courseMemberRoleSchema,
  courses: z.union([
    courseReadinessCourseSchema,
    z.array(courseReadinessCourseSchema),
  ]),
});

// Gói dữ liệu nội bộ trước khi tính readiness.
// Schema này không tự xử lý soft-delete, quan hệ mồ côi hoặc quyền truy cập.
export const courseReadinessGraphSchema = z.strictObject({
  role: courseMemberRoleSchema,
  course: courseReadinessCourseSchema,
  chapters: z.array(courseReadinessChapterSchema),
  topics: z.array(courseReadinessTopicSchema),
  flashcards: z.array(courseReadinessFlashcardSchema),
  exercises: z.array(courseReadinessExerciseSchema),
  questionGroups: z.array(courseReadinessQuestionGroupSchema),
  questions: z.array(courseReadinessQuestionSchema),
  answerOptions: z.array(courseReadinessAnswerOptionSchema),
});

// Destination chỉ chứa các authoring path ổn định hiện có; PR6 mới xử lý ngữ cảnh sửa sâu.
export const courseReadinessDestinationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("course_overview"),
    courseId: z.uuid(),
    href: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal("course_structure"),
    courseId: z.uuid(),
    href: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal("topic_builder"),
    courseId: z.uuid(),
    topicId: z.uuid(),
    href: z.string().min(1),
  }),
]);

// Thứ tự này mô tả trình tự sửa lỗi theo quan hệ phụ thuộc nghiệp vụ, không phải
// mức độ nghiêm trọng để hiển thị.
export const COURSE_READINESS_REMEDIATION_ORDER = [
  "course_has_no_chapters",
  "chapter_has_no_topics",
  "topic_has_no_learning_content",
  "exercise_requires_group",
  "question_group_has_no_active_questions",
  "exercise_requires_standalone_question",
  "exercise_has_orphan_questions",
  "exercise_group_missing_context",
  "question_missing_content",
  "question_has_too_few_options",
  "question_has_no_correct_option",
] as const;

export const courseReadinessIssueCodeSchema = z.enum(
  COURSE_READINESS_REMEDIATION_ORDER,
);

export const courseReadinessIssueCategorySchema = z.enum([
  "structure",
  "content",
  "exercise",
]);

// Severity chỉ phục vụ hiển thị; thứ tự sửa lỗi dùng `COURSE_READINESS_REMEDIATION_ORDER`.
export const courseReadinessIssueSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

export const courseReadinessEntitySchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("course"),
    id: z.uuid(),
  }),
  z.strictObject({
    type: z.literal("chapter"),
    id: z.uuid(),
    courseId: z.uuid(),
  }),
  z.strictObject({
    type: z.literal("topic"),
    id: z.uuid(),
    courseId: z.uuid(),
    chapterId: z.uuid(),
  }),
  z.strictObject({
    type: z.literal("exercise"),
    id: z.uuid(),
    courseId: z.uuid(),
    topicId: z.uuid(),
  }),
  z.strictObject({
    type: z.literal("question_group"),
    id: z.uuid(),
    courseId: z.uuid(),
    topicId: z.uuid(),
    exerciseId: z.uuid(),
  }),
  z.strictObject({
    type: z.literal("question"),
    id: z.uuid(),
    courseId: z.uuid(),
    topicId: z.uuid(),
    exerciseId: z.uuid(),
    questionGroupId: z.uuid().nullable(),
  }),
]);

export const courseReadinessIssueSchema = z.strictObject({
  id: z.string().min(1),
  code: courseReadinessIssueCodeSchema,
  category: courseReadinessIssueCategorySchema,
  severity: courseReadinessIssueSeveritySchema,
  isBlocking: z.boolean(),
  context: z.string().min(1),
  actionLabel: z.string().min(1),
  destination: courseReadinessDestinationSchema,
  entity: courseReadinessEntitySchema,
});

export const courseReadinessCountsSchema = z.strictObject({
  chapters: z.number().int().nonnegative(),
  topics: z.number().int().nonnegative(),
  flashcards: z.number().int().nonnegative(),
  exercises: z.number().int().nonnegative(),
  questionGroups: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  answerOptions: z.number().int().nonnegative(),
});

// Nút hành động chính có thể trỏ về lỗi nguồn hoặc dùng phương án dự phòng khi course đã sẵn sàng.
export const courseReadinessPrimaryCtaSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  destination: courseReadinessDestinationSchema,
  sourceIssueId: z.string().nullable(),
  sourceIssueCode: courseReadinessIssueCodeSchema.nullable(),
});

export const courseDashboardReadinessSchema = z.strictObject({
  course: courseReadinessCourseSchema.omit({ removed_at: true }),
  role: courseMemberRoleSchema,
  counts: courseReadinessCountsSchema,
  issues: z.array(courseReadinessIssueSchema),
  primaryCta: courseReadinessPrimaryCtaSchema,
});

// Client chỉ nhận mã lỗi an toàn; chi tiết Supabase/Zod ở lại server log.
export const courseReadinessErrorCodeSchema = z.enum([
  "INVALID_COURSE_ID",
  "AUTH_REQUIRED",
  "COURSE_NOT_FOUND_OR_FORBIDDEN",
  "QUERY_FAILED",
  "INVALID_READINESS_DATA",
]);

export const courseReadinessResultSchema = z.discriminatedUnion("success", [
  z.strictObject({
    success: z.literal(true),
    data: courseDashboardReadinessSchema,
  }),
  z.strictObject({
    success: z.literal(false),
    error: z.strictObject({
      code: courseReadinessErrorCodeSchema,
      message: z.string().min(1),
    }),
  }),
]);

export type CourseReadinessAccessRow = z.infer<
  typeof courseReadinessAccessRowSchema
>;
export type CourseReadinessGraph = z.infer<typeof courseReadinessGraphSchema>;
export type CourseReadinessDestination = z.infer<
  typeof courseReadinessDestinationSchema
>;
export type CourseReadinessIssue = z.infer<typeof courseReadinessIssueSchema>;
export type CourseDashboardReadiness = z.infer<
  typeof courseDashboardReadinessSchema
>;
export type CourseReadinessResult = z.infer<typeof courseReadinessResultSchema>;
export type CourseReadinessIssueCode = z.infer<
  typeof courseReadinessIssueCodeSchema
>;
export type CourseReadinessIssueCategory = z.infer<
  typeof courseReadinessIssueCategorySchema
>;
export type CourseReadinessIssueSeverity = z.infer<
  typeof courseReadinessIssueSeveritySchema
>;
export type CourseReadinessErrorCode = z.infer<
  typeof courseReadinessErrorCodeSchema
>;
