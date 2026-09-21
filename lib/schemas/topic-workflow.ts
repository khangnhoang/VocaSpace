import { z } from "zod";
import { courseMemberRoleSchema, courseStatusSchema } from "@/lib/schemas/course";

// Xuất ra để `lib/schemas/review-notes.ts` tái dùng, tránh định nghĩa trùng DTO.
export const topicAuthorIdentitySchema = z.strictObject({
  userId: z.uuid(),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

// Một lần từ chối. `index` do server cấp (1-based, cũ -> mới) để UI render "Lần N"
// mà không phải tự đếm — tránh lệch nếu sau này có lần từ chối bị ẩn.
export const topicRejectionEntrySchema = z.strictObject({
  index: z.number().int().positive(),
  reason: z.string().min(1),
  reviewer: topicAuthorIdentitySchema.nullable(),
  reviewedAt: z.string(),
});
export type TopicRejectionEntry = z.infer<typeof topicRejectionEntrySchema>;

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
  canWithdrawReview: z.boolean(),
  canDeleteTopic: z.boolean(),
  activeFlashcardCount: z.number().int().nonnegative(),
  activeExerciseCount: z.number().int().nonnegative(),
  isReady: z.boolean(),
  pendingSubmissionId: z.uuid().nullable(),
  pendingSubmitterId: z.uuid().nullable(),
  isCurrentUserSubmitter: z.boolean(),
  rejectionCount: z.number().int().nonnegative(),
  rejectionHistory: z.array(topicRejectionEntrySchema),
  hasDistinctEligibleReviewer: z.boolean(),
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
