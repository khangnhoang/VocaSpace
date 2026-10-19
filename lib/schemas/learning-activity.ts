import { z } from "zod";

// FEAT3: hình dạng JSON của RPC `public.feat3_learning_summary`, đổi sang camelCase cho giao diện.
// Một RPC, hai dạng trả về: không có `p_course_id` là tổng thể, có `p_course_id` là của riêng khóa học.
const streakSchema = z.number().int().min(0);

const overallRpcSchema = z.strictObject({
  streak: streakSchema,
  studied_today: z.boolean(),
  days: z
    .array(z.strictObject({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), studied: z.boolean() }))
    .length(7),
  week_study_minutes: z.number().int().min(0),
});

const courseRpcSchema = z.strictObject({
  streak: streakSchema,
  studied_today: z.boolean(),
  recent_topics: z
    .array(
      z.strictObject({
        topic_id: z.uuid(),
        slug: z.string().min(1),
        title: z.string().min(1),
        last_activity_at: z.string().min(1),
        days_ago: z.number().int().min(0),
      }),
    )
    .max(3),
});

export const overallLearningSummarySchema = overallRpcSchema.transform((raw) => ({
  streak: raw.streak,
  studiedToday: raw.studied_today,
  days: raw.days,
  weekStudyMinutes: raw.week_study_minutes,
}));

export const courseLearningSummarySchema = courseRpcSchema.transform((raw) => ({
  streak: raw.streak,
  studiedToday: raw.studied_today,
  recentTopics: raw.recent_topics.map((topic) => ({
    topicId: topic.topic_id,
    slug: topic.slug,
    title: topic.title,
    lastActivityAt: topic.last_activity_at,
    daysAgo: topic.days_ago,
  })),
}));

export type OverallLearningSummary = z.output<typeof overallLearningSummarySchema>;
export type CourseLearningSummary = z.output<typeof courseLearningSummarySchema>;

// Thất bại không mang mã chi tiết: giao diện chỉ cần biết "chưa tải được" và vẫn hiển thị phần còn lại của trang (AC10).
export type LearningSummaryResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type OverallLearningSummaryResult = LearningSummaryResult<OverallLearningSummary>;
export type CourseLearningSummaryResult = LearningSummaryResult<CourseLearningSummary>;
