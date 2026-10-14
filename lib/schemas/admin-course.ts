import { z } from "zod";
import { platformModerationSchema } from "@/lib/schemas/topic-review";

export const ADMIN_COURSE_PAGE_SIZE = 20;
export const adminCourseStatusFilters = [
  "pending",
  "published",
  "draft",
  "all",
  "removed",
] as const;

// Query string của /admin/courses: mỗi tham số sai tự rơi về mặc định thay vì báo lỗi (AD3 AC3),
// nên parse() không bao giờ ném. Cỡ trang và thứ tự sắp xếp cố định ở server, không nhận từ URL.
export const adminCourseFilterSchema = z.object({
  status: z.enum(adminCourseStatusFilters).catch("pending"),
  q: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});

export const acceptCourseSchema = z.object({
  courseId: z.string().uuid("ID khóa học không hợp lệ."),
});

export const adminCourseSummarySchema = acceptCourseSchema;

export const rejectCourseSchema = z.object({
  courseId: z.string().uuid("ID khóa học không hợp lệ."),
  rejectMessage: z
    .string()
    .trim()
    .min(10, "Lý do từ chối phải có ít nhất 10 ký tự.")
    .max(1000, "Lý do từ chối không được vượt quá 1000 ký tự."),
});

export const submitCourseReviewSchema = z.object({
  courseId: z.string().uuid("ID khóa học không hợp lệ."),
});

// Chỉ course và hai action demote/takedown: target type do server cố định là 'course' (AD3 G2),
// lý do dùng chung giới hạn 10-2000 với platformModerationSchema.
export const moderateCourseSchema = z.object({
  courseId: z.string().uuid("ID khóa học không hợp lệ."),
  action: z.enum(["demote", "takedown"], { error: "Thao tác không hợp lệ." }),
  reason: platformModerationSchema.shape.reason,
});

export type AdminCourseFilter = z.infer<typeof adminCourseFilterSchema>;
export type AdminCourseStatusFilter = AdminCourseFilter["status"];
export type AcceptCourseInput = z.infer<typeof acceptCourseSchema>;
export type AdminCourseSummaryInput = z.infer<typeof adminCourseSummarySchema>;
export type RejectCourseInput = z.infer<typeof rejectCourseSchema>;
export type SubmitCourseReviewInput = z.infer<typeof submitCourseReviewSchema>;
export type ModerateCourseInput = z.infer<typeof moderateCourseSchema>;
export type ModerateCourseAction = ModerateCourseInput["action"];

export type AdminCourseItemStatus = "draft" | "pending" | "published";

// Dòng danh sách /admin/courses (chỉ dữ liệu có thật trong database; thiếu thì null để UI hiển thị "—").
export type AdminCourseListRow = {
  id: string;
  title: string;
  slug: string;
  status: AdminCourseItemStatus;
  price: number;
  ownerName: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  // Lý do từ chối đang hiển thị: chỉ có khi khóa học là draft và đã có reviewed_at (AD3 AC2).
  rejectMessage: string | null;
  removedAt: string | null;
};

export type AdminCourseTabCounts = Record<AdminCourseStatusFilter, number>;

export type AdminCourseListData = {
  rows: AdminCourseListRow[];
  counts: AdminCourseTabCounts;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminCourseOutlineTopic = {
  id: string;
  title: string;
  status: AdminCourseItemStatus;
};

export type AdminCourseOutlineChapter = {
  id: string;
  title: string;
  topics: AdminCourseOutlineTopic[];
};

export type AdminCourseSummary = {
  course: AdminCourseListRow & {
    description: string | null;
    thumbnailUrl: string | null;
  };
  chapters: AdminCourseOutlineChapter[];
  publishedTopicCount: number;
};
