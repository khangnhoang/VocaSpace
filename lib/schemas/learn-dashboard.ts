import { z } from "zod";

export const learnCourseStatusSchema = z.enum([
  "not-started",
  "in-progress",
  "completed",
  "no-content",
]);

export const learnDashboardTopicSchema = z.strictObject({
  slug: z.string().min(1),
  title: z.string().min(1),
  chapterTitle: z.string(),
});

export const learnDashboardCourseSchema = z.strictObject({
  enrollmentId: z.string().min(1),
  courseId: z.string().min(1),
  courseSlug: z.string().min(1),
  courseTitle: z.string().min(1),
  courseThumbnailUrl: z.string().nullable(),
  totalTopicCount: z.number().int().nonnegative(),
  completedTopicCount: z.number().int().nonnegative(),
  progressPercentage: z.number().int().min(0).max(100).nullable(),
  status: learnCourseStatusSchema,
  nextTopic: learnDashboardTopicSchema.nullable(),
  lastTopic: learnDashboardTopicSchema.nullable(),
});

export const reviewSummarySchema = z.strictObject({
  totalCardCount: z.number().int().nonnegative(),
  learningCardCount: z.number().int().nonnegative(),
  dueCardCount: z.number().int().nonnegative(),
});

export const pendingPaymentSummarySchema = z.strictObject({
  paymentId: z.string().min(1),
  courseId: z.string().min(1),
  courseSlug: z.string().min(1),
  courseTitle: z.string().min(1),
  status: z.enum(["creating", "pending"]),
  createdAt: z.string().min(1),
  expiresAt: z.string().nullable(),
});

export const learnDashboardDataSchema = z.strictObject({
  courses: z.array(learnDashboardCourseSchema),
  reviewSummary: reviewSummarySchema,
  pendingPayments: z.array(pendingPaymentSummarySchema),
  pendingPaymentCount: z.number().int().nonnegative(),
});

export const learnDashboardErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "QUERY_FAILED",
  "INVALID_DATA",
]);

export const learnDashboardResultSchema = z.discriminatedUnion("success", [
  z.strictObject({
    success: z.literal(true),
    data: learnDashboardDataSchema,
  }),
  z.strictObject({
    success: z.literal(false),
    errorCode: learnDashboardErrorCodeSchema,
    error: z.string().min(1),
  }),
]);

export type LearnCourseStatus = z.infer<typeof learnCourseStatusSchema>;
export type LearnDashboardCourse = z.infer<
  typeof learnDashboardCourseSchema
>;
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
export type PendingPaymentSummary = z.infer<
  typeof pendingPaymentSummarySchema
>;
export type LearnDashboardData = z.infer<typeof learnDashboardDataSchema>;
export type LearnDashboardResult = z.infer<typeof learnDashboardResultSchema>;
