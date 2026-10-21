// File: lib/schemas/teacher-course-portfolio.ts
import { z } from "zod";
import { teacherCourseSchema } from "@/lib/schemas/course";

// Hợp đồng đọc của `get_teacher_course_portfolio()` (supabase/migrations/20261021120000_tport1_*).
// Mọi object là strict: database thêm/bớt field thì parse thất bại thay vì render dữ liệu nửa tin cậy.
// Tên field giữ snake_case như payload RPC; `courses[]` tương thích `TeacherCourse` nên các component
// cũ (CourseForm, DeleteCourseModal) nhận được trực tiếp.
const timestampSchema = z.iso.datetime({ offset: true });

export const teacherPortfolioCourseSchema = teacherCourseSchema
  .extend({ membership_created_at: timestampSchema })
  .strict();

// topic_review      -> bộ lọc `Chờ duyệt`
// topic_correction  -> bộ lọc `Cần sửa`
// course_rejection  -> bộ lọc `Cần sửa`
export const teacherAttentionKindSchema = z.enum([
  "topic_review",
  "topic_correction",
  "course_rejection",
]);

export const teacherAttentionItemSchema = z
  .strictObject({
    kind: teacherAttentionKindSchema,
    course_id: z.uuid(),
    course_title: z.string(),
    topic_id: z.uuid().nullable(),
    topic_title: z.string().nullable(),
    // Lý do từ chối của lần nộp/duyệt mới nhất; null với topic_review.
    reason: z.string().nullable(),
    // Mốc hành động: submitted_at với review, reviewed_at với correction.
    ordering_at: timestampSchema,
  })
  .superRefine((item, ctx) => {
    const isTopicItem = item.kind !== "course_rejection";
    if (isTopicItem !== (item.topic_id !== null && item.topic_title !== null)) {
      ctx.addIssue({
        code: "custom",
        message: "Topic attention items need topic identity; course items must not carry one.",
      });
    }
    if (item.kind === "topic_review" && item.reason !== null) {
      ctx.addIssue({ code: "custom", message: "Review items carry no rejection reason." });
    }
    if (item.kind !== "topic_review" && !item.reason?.trim()) {
      ctx.addIssue({ code: "custom", message: "Correction items need a rejection reason." });
    }
  });

export const teacherCoursePortfolioSchema = z.strictObject({
  // Quyền tạo khóa học toàn cục, độc lập với vai trò trong từng khóa học.
  can_create_course: z.boolean(),
  courses: z.array(teacherPortfolioCourseSchema),
  attention: z.array(teacherAttentionItemSchema),
});

// AUTH_REQUIRED: chưa đăng nhập; FORBIDDEN: hồ sơ không còn hoạt động; UNAVAILABLE: lỗi RPC/mạng/JSON lạ.
// `error` là câu hiển thị được, không chứa chi tiết SQL hay Zod.
export type TeacherCoursePortfolioResult =
  | { success: true; data: TeacherCoursePortfolio }
  | {
      success: false;
      errorCode: "AUTH_REQUIRED" | "FORBIDDEN" | "UNAVAILABLE";
      error: string;
    };

export type TeacherPortfolioCourse = z.infer<typeof teacherPortfolioCourseSchema>;
export type TeacherAttentionKind = z.infer<typeof teacherAttentionKindSchema>;
export type TeacherAttentionItem = z.infer<typeof teacherAttentionItemSchema>;
export type TeacherCoursePortfolio = z.infer<typeof teacherCoursePortfolioSchema>;
