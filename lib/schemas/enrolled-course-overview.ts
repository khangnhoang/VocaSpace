import { z } from "zod";
import {
  learnCourseStatusSchema,
  learnDashboardTopicSchema,
} from "@/lib/schemas/learn-dashboard";
import { publicCourseSlugSchema } from "@/lib/schemas/public-course";

export const enrolledCourseOverviewTopicSchema = z.strictObject({
  id: z.string().min(1),
  slug: publicCourseSlugSchema,
  title: z.string().trim().min(1),
  isCompleted: z.boolean(),
});

export const enrolledCourseOverviewChapterSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  topics: z.array(enrolledCourseOverviewTopicSchema).min(1),
});

export const enrolledCourseOverviewDataSchema = z.strictObject({
  courseSlug: publicCourseSlugSchema,
  courseTitle: z.string().trim().min(1),
  courseThumbnailUrl: z.string().nullable(),
  totalTopicCount: z.number().int().nonnegative(),
  completedTopicCount: z.number().int().nonnegative(),
  progressPercentage: z.number().int().min(0).max(100).nullable(),
  status: learnCourseStatusSchema,
  nextTopic: learnDashboardTopicSchema.nullable(),
  lastTopic: learnDashboardTopicSchema.nullable(),
  chapters: z.array(enrolledCourseOverviewChapterSchema),
});

export const enrolledCourseOverviewResultSchema = z.discriminatedUnion(
  "status",
  [
    z.strictObject({ status: z.literal("auth_required") }),
    z.strictObject({ status: z.literal("not_found") }),
    z.strictObject({
      status: z.literal("unenrolled"),
      course: z.strictObject({
        slug: publicCourseSlugSchema,
        title: z.string().trim().min(1),
      }),
    }),
    z.strictObject({
      status: z.literal("success"),
      data: enrolledCourseOverviewDataSchema,
    }),
    z.strictObject({
      status: z.literal("error"),
      errorCode: z.enum(["QUERY_FAILED", "INVALID_DATA"]),
      error: z.string().min(1),
    }),
  ],
);

export type EnrolledCourseOverviewData = z.infer<
  typeof enrolledCourseOverviewDataSchema
>;
export type EnrolledCourseOverviewResult = z.infer<
  typeof enrolledCourseOverviewResultSchema
>;
