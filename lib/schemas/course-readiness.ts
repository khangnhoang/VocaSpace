import { z } from "zod";
import { courseMemberRoleSchema, courseStatusSchema } from "@/lib/schemas/course";
import { TOEIC_PART_TYPES } from "@/lib/schemas/exercise";

// Các giá trị dùng lại này mô tả cột database có thể rỗng trong các truy vấn
// readiness. Zod chỉ kiểm tra kiểu dữ liệu; việc một bản ghi có được tính vào
// kết quả hay không thuộc phần derivation.
const nullableTimestampSchema = z.string().nullable();
const nullableOrderIndexSchema = z.number().nullable();

// Boundary đầu tiên của Server Action: tham số route phải là UUID trước khi tạo
// Supabase client hoặc kiểm tra đăng nhập/quyền truy cập.
export const courseReadinessCourseIdSchema = z.uuid(
  "ID khóa học không hợp lệ.",
);

// Readiness chỉ nhận các TOEIC part mà authoring schema hiện hỗ trợ.
// Nếu authoring mở rộng part mới, danh sách đóng này phải đổi cùng rule SSOT.
export const courseReadinessToeicPartSchema = z.enum(TOEIC_PART_TYPES);

// Bản ghi course đến từ join authorization trong Server Action và là gốc của
// graph readiness. Schema này bảo đảm các trường course cần cho dashboard có
// đúng kiểu; quyền truy cập và việc course còn được phép dùng do action xử lý.
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

// Bản ghi chapter được đọc từ Supabase sau khi course access đã được xác nhận.
// Schema này chỉ bảo đảm chapter có khóa và thứ tự cần cho graph; việc chapter
// thuộc course hiện tại và chưa bị loại khỏi readiness do derivation kiểm tra.
export const courseReadinessChapterSchema = z.strictObject({
  id: z.uuid(),
  course_id: z.uuid(),
  title: z.string().min(1),
  order_index: nullableOrderIndexSchema,
  created_at: z.string(),
  removed_at: nullableTimestampSchema,
});

// Bản ghi topic nối chapter với nội dung học tập. Schema này giữ các khóa quan
// hệ và metadata cần cho dashboard; nó không tự chứng minh parent chapter còn
// hợp lệ hoặc topic nên được tính vào counts.
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

// Bản ghi flashcard là tín hiệu nội dung học tập nhẹ cho một topic. Schema này
// chỉ xác nhận id topic và thứ tự; derivation quyết định flashcard có thuộc cây
// course hợp lệ và còn được tính vào readiness hay không.
export const courseReadinessFlashcardSchema = z.strictObject({
  id: z.uuid(),
  topic_id: z.uuid(),
  order_index: nullableOrderIndexSchema,
  removed_at: nullableTimestampSchema,
});

// Bản ghi exercise cung cấp TOEIC part và vị trí trong topic. Schema này giới
// hạn `part_type` vào rule SSOT hiện có; các yêu cầu theo grouped/standalone
// mode vẫn được suy ra ở derivation.
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

// Bản ghi question group chứa ngữ liệu TOEIC như đoạn văn, audio hoặc hình ảnh.
// Schema này cho phép các trường ngữ liệu rỗng vì thiếu ngữ liệu là lỗi sửa được,
// không phải lỗi đọc graph; rule bắt buộc do derivation áp dụng theo TOEIC part.
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

// Bản ghi question đến từ exercise đã đọc trong graph. `content` được phép là
// chuỗi rỗng để graph không hỏng toàn bộ khi dữ liệu có thể sửa; derivation sẽ
// tạo readiness issue cho câu hỏi thiếu nội dung hoặc trỏ tới group không hợp lệ.
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

// Bản ghi answer option giữ lựa chọn trả lời của question. Nội dung rỗng và
// `is_correct: null` vẫn được chấp nhận ở biên đọc dữ liệu; derivation mới quyết
// định option nào có nội dung thực và có đáp án đúng hợp lệ.
export const courseReadinessAnswerOptionSchema = z.strictObject({
  id: z.uuid(),
  question_id: z.uuid(),
  content: z.string(),
  label: z.string().nullable(),
  is_correct: z.boolean().nullable(),
  order_index: nullableOrderIndexSchema,
  removed_at: nullableTimestampSchema,
});

// Kết quả access đến từ truy vấn `course_collaborators` join sang `courses`.
// Schema này xác nhận role và course đi kèm có cấu trúc đọc được; việc role có
// nằm trong ma trận readiness được duyệt vẫn do Server Action kiểm tra.
export const courseReadinessAccessRowSchema = z.strictObject({
  role: courseMemberRoleSchema,
  courses: z.union([
    courseReadinessCourseSchema,
    z.array(courseReadinessCourseSchema),
  ]),
});

// Graph readiness là payload nội bộ sau các truy vấn Supabase đã được bound theo
// course. Schema này bảo đảm các mảng dữ liệu có cấu trúc đúng trước derivation;
// nó không tự xử lý soft-delete, quan hệ mồ côi, quyền truy cập hoặc business rule.
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

// Destination là contract điều hướng mà readiness trả cho dashboard/UI sau này.
// Schema này chỉ cho phép các authoring path ổn định hiện có; repair state,
// return feedback và deep remediation context của PR6 chưa thuộc contract này.
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
// mức độ nghiêm trọng để hiển thị. Derivation dùng làm SSOT nội bộ và không đưa
// `remediationPriority` vào issue trả về.
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

// Category nhóm issue theo khu vực reviewer/UI cần hiểu. Schema này chỉ giới hạn
// nhãn hợp lệ; quyết định issue thuộc category nào nằm trong derivation.
export const courseReadinessIssueCategorySchema = z.enum([
  "structure",
  "content",
  "exercise",
]);

// Severity là metadata hiển thị và không quyết định thứ tự sửa lỗi. Schema này
// chỉ giới hạn nhãn hợp lệ; thứ tự issue dùng remediation order trong derivation.
export const courseReadinessIssueSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

// Entity mô tả đối tượng mà một readiness issue trỏ tới. Schema này bảo đảm UI
// nhận đủ id để hiển thị ngữ cảnh hoặc điều hướng; nó không tự xác nhận entity
// đó còn thuộc cây course hợp lệ.
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

// Issue là đơn vị sửa lỗi trả về cho dashboard. Schema này bảo đảm issue có id,
// mã lỗi, nhãn hành động, destination và entity hợp lệ; việc phát hiện issue nào,
// sắp xếp ra sao và có chặn readiness hay không thuộc derivation.
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

// Counts là số lượng nội dung đã được derivation lọc theo cây course hợp lệ.
// Schema này chỉ bảo đảm các số không âm; cách loại soft-delete, orphan relation
// hoặc option không có nội dung thực nằm ngoài schema.
export const courseReadinessCountsSchema = z.strictObject({
  chapters: z.number().int().nonnegative(),
  topics: z.number().int().nonnegative(),
  flashcards: z.number().int().nonnegative(),
  exercises: z.number().int().nonnegative(),
  questionGroups: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  answerOptions: z.number().int().nonnegative(),
});

// Primary CTA là hành động chính mà dashboard nên hiển thị. Schema này bảo đảm
// CTA có destination ổn định và có thể truy ngược về issue nguồn; việc chọn CTA
// đầu tiên từ danh sách issue đã sắp xếp thuộc derivation.
export const courseReadinessPrimaryCtaSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  destination: courseReadinessDestinationSchema,
  sourceIssueId: z.string().nullable(),
  sourceIssueCode: courseReadinessIssueCodeSchema.nullable(),
});

// Payload dashboard readiness là dữ liệu thành công mà Server Action được phép
// trả cho owner/co_owner/editor. Schema này ghép course, role, counts, issues và
// CTA; nó không cấp quyền và không tự đọc dữ liệu từ Supabase.
export const courseDashboardReadinessSchema = z.strictObject({
  course: courseReadinessCourseSchema.omit({ removed_at: true }),
  role: courseMemberRoleSchema,
  counts: courseReadinessCountsSchema,
  issues: z.array(courseReadinessIssueSchema),
  primaryCta: courseReadinessPrimaryCtaSchema,
});

// Error code là tập lỗi an toàn được phép trả về client. Schema này giữ chi tiết
// Supabase/Zod nội bộ ở server log và chỉ cho caller nhận mã lỗi ổn định.
export const courseReadinessErrorCodeSchema = z.enum([
  "INVALID_COURSE_ID",
  "AUTH_REQUIRED",
  "COURSE_NOT_FOUND_OR_FORBIDDEN",
  "QUERY_FAILED",
  "INVALID_READINESS_DATA",
]);

// Result là contract cuối cùng của Server Action. Nhánh success chứa dashboard
// payload đã qua derivation; nhánh failure chứa lỗi an toàn, không chứa chi tiết
// Supabase, Zod hoặc dữ liệu nhạy cảm.
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
