import { z } from "zod";
import { courseMemberRoleSchema } from "@/lib/schemas/course";

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
