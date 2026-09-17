import { z } from "zod";
import { courseMemberRoleSchema, courseStatusSchema } from "@/lib/schemas/course";

const topicAuthorIdentitySchema = z.strictObject({
  userId: z.uuid(),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const topicContributorSchema = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const topicAuthorshipFeedbackSchema = z.strictObject({
  id: z.uuid(),
  actorUserId: z.uuid().nullable(),
  previousResponsibleUserId: z.uuid().nullable(),
  newResponsibleUserId: z.uuid().nullable(),
  feedbackType: z.literal("responsibility_transfer"),
  createdAt: z.string(),
});

export const topicWorkflowSchema = z.strictObject({
  topicId: z.uuid(),
  courseId: z.uuid(),
  chapterId: z.uuid(),
  title: z.string().min(1),
  status: courseStatusSchema,
  role: courseMemberRoleSchema,
  canEdit: z.boolean(),
  canReview: z.boolean(),
  canRequestReview: z.boolean(),
  activeFlashcardCount: z.number().int().nonnegative(),
  activeExerciseCount: z.number().int().nonnegative(),
  isReady: z.boolean(),
  pendingSubmissionId: z.uuid().nullable(),
  pendingSubmitterId: z.uuid().nullable(),
  pendingSubmissionIsRescue: z.boolean(),
  isCurrentUserSubmitter: z.boolean(),
  latestRejectionReason: z.string().nullable(),
  latestRejectionReviewer: topicAuthorIdentitySchema.nullable(),
  latestRejectionAt: z.string().nullable(),
  rejectionCount: z.number().int().nonnegative(),
  escalationUnresolved: z.boolean(),
  hasDistinctEligibleReviewer: z.boolean(),
  escalationId: z.uuid().nullable(),
  escalationSubmitterId: z.uuid().nullable(),
  canResolveEscalation: z.boolean(),
  originalCreator: topicAuthorIdentitySchema,
  responsibleAuthor: topicAuthorIdentitySchema,
  contributors: z.array(topicContributorSchema).max(2),
  canManageAuthorship: z.boolean(),
  isCurrentUserResponsible: z.boolean(),
  isCurrentUserContributor: z.boolean(),
  latestAuthorshipFeedback: topicAuthorshipFeedbackSchema.nullable(),
});
export type TopicWorkflow = z.infer<typeof topicWorkflowSchema>;

export const topicWorkflowReadInputSchema = z.object({
  courseId: z.uuid("ID khóa học không hợp lệ."),
  topicId: z.uuid("ID bài học không hợp lệ."),
});
