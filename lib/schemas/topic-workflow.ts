import { z } from "zod";
import { courseMemberRoleSchema, courseStatusSchema } from "@/lib/schemas/course";

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
  isCurrentUserSubmitter: z.boolean(),
  latestRejectionReason: z.string().nullable(),
  rejectionCount: z.number().int().nonnegative(),
  escalationUnresolved: z.boolean(),
  hasDistinctEligibleReviewer: z.boolean(),
  escalationId: z.uuid().nullable(),
  escalationSubmitterId: z.uuid().nullable(),
  canResolveEscalation: z.boolean(),
});
export type TopicWorkflow = z.infer<typeof topicWorkflowSchema>;

export const topicWorkflowReadInputSchema = z.object({
  courseId: z.uuid("ID khóa học không hợp lệ."),
  topicId: z.uuid("ID bài học không hợp lệ."),
});
