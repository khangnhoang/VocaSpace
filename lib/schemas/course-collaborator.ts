import { z } from "zod";
import {
  courseIdSchema,
  courseMemberRoleSchema,
} from "@/lib/schemas/course";

export const courseCollaboratorIdSchema = z.object({
  collaboratorId: z.uuid("ID cộng tác viên không hợp lệ."),
});

export const setCourseCollaboratorCapabilitySchema = courseCollaboratorIdSchema.extend({
  canReviewTopics: z.boolean(),
});

export const updateCourseCollaboratorRoleSchema = courseCollaboratorIdSchema.extend({
  role: courseMemberRoleSchema,
});

export type SetCourseCollaboratorCapabilityInput = z.infer<
  typeof setCourseCollaboratorCapabilitySchema
>;
export type UpdateCourseCollaboratorRoleInput = z.infer<
  typeof updateCourseCollaboratorRoleSchema
>;

export const courseCollaboratorOverviewSchema = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  role: courseMemberRoleSchema,
  canReviewTopics: z.boolean(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const courseCollaboratorOverviewInputSchema = z.object({
  courseId: courseIdSchema,
});

export type CourseCollaboratorOverview = z.infer<
  typeof courseCollaboratorOverviewSchema
>;
