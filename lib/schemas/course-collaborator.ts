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
  role: z.enum(["editor", "previewer"]),
});

export const updateCourseCollaboratorRoleWithResponsibilitySchema = updateCourseCollaboratorRoleSchema.extend({
  recipientUserId: z.uuid("ID người nhận trách nhiệm không hợp lệ.").optional(),
});

export const removeCourseCollaboratorWithResponsibilitySchema = courseCollaboratorIdSchema.extend({
  recipientUserId: z.uuid("ID người nhận trách nhiệm không hợp lệ.").optional(),
});

export const courseCollaboratorResponsibilityCandidatesInputSchema = courseCollaboratorIdSchema;

export const leaveCourseCollaborationSchema = z.object({
  courseId: courseIdSchema,
  recipientUserId: z.uuid("ID người nhận trách nhiệm không hợp lệ.").optional(),
});

export const courseCollaboratorInvitationIdSchema = z.object({
  invitationId: z.uuid("ID lời mời không hợp lệ."),
});

export const sendCourseCollaboratorInvitationSchema = z.object({
  courseId: courseIdSchema,
  email: z.string().trim().toLowerCase().pipe(z.email("Định dạng email không hợp lệ.")),
  role: z.enum(["previewer", "editor", "co_owner"]),
  canReviewTopics: z.boolean().default(false),
});

export type SetCourseCollaboratorCapabilityInput = z.infer<
  typeof setCourseCollaboratorCapabilitySchema
>;
export type UpdateCourseCollaboratorRoleInput = z.infer<
  typeof updateCourseCollaboratorRoleSchema
>;
export type UpdateCourseCollaboratorRoleWithResponsibilityInput = z.infer<
  typeof updateCourseCollaboratorRoleWithResponsibilitySchema
>;
export type RemoveCourseCollaboratorWithResponsibilityInput = z.infer<
  typeof removeCourseCollaboratorWithResponsibilitySchema
>;
export type LeaveCourseCollaborationInput = z.infer<
  typeof leaveCourseCollaborationSchema
>;
export type SendCourseCollaboratorInvitationInput = z.infer<
  typeof sendCourseCollaboratorInvitationSchema
>;

export const courseCollaboratorOverviewSchema = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  role: courseMemberRoleSchema,
  canReviewTopics: z.boolean(),
  email: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const courseCollaboratorOverviewInputSchema = z.object({
  courseId: courseIdSchema,
});

export type CourseCollaboratorOverview = z.infer<
  typeof courseCollaboratorOverviewSchema
>;

export const courseCollaboratorMembersResultSchema = z.strictObject({
  currentUserId: z.uuid(),
  members: z.array(courseCollaboratorOverviewSchema),
  responsibleTopicCount: z.number().int().nonnegative(),
});

export const courseCollaboratorResponsibilityCandidatesSchema = z.strictObject({
  collaboratorId: z.uuid(),
  responsibleTopicCount: z.number().int().nonnegative(),
  recipientUserIds: z.array(z.uuid()),
});

export type CourseCollaboratorMembersResult = z.infer<
  typeof courseCollaboratorMembersResultSchema
>;
export type CourseCollaboratorResponsibilityCandidates = z.infer<
  typeof courseCollaboratorResponsibilityCandidatesSchema
>;

export const courseCollaboratorInvitationSchema = z.strictObject({
  id: z.uuid(),
  courseId: z.uuid(),
  courseTitle: z.string().nullable().default(null),
  courseSlug: z.string().nullable().default(null),
  inviteeUserId: z.uuid(),
  role: z.enum(["previewer", "editor", "co_owner"]),
  canReviewTopics: z.boolean(),
  status: z.enum(["pending", "accepted", "rejected", "revoked"]),
  createdAt: z.string(),
  actionedAt: z.string().nullable(),
});

export type CourseCollaboratorInvitation = z.infer<
  typeof courseCollaboratorInvitationSchema
>;
