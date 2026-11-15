import { z } from "zod";
import { minUtf16Length, maxUtf16Length } from "./utf16-length";

const topicIdSchema = z.uuid("ID bài học không hợp lệ.");
const submissionIdSchema = z.uuid("ID yêu cầu duyệt không hợp lệ.");
const reviewReasonSchema = z
  .string()
  .trim()
  .check(minUtf16Length(10, "Lý do phải có ít nhất 10 ký tự."))
  .check(maxUtf16Length(2000, "Lý do không được vượt quá 2000 ký tự."));

export const requestTopicReviewSchema = z.object({ topicId: topicIdSchema });
export const topicReviewSubmissionSchema = z.object({
  submissionId: submissionIdSchema,
});
export const rejectTopicReviewSchema = topicReviewSubmissionSchema.extend({
  reason: reviewReasonSchema,
});
export const platformModerationSchema = z.object({
  targetType: z.enum(["course", "chapter", "topic"]),
  targetId: z.uuid("ID đối tượng moderation không hợp lệ."),
  action: z.enum(["demote", "takedown", "invalidate_review"]),
  reason: reviewReasonSchema,
});

export type RequestTopicReviewInput = z.infer<typeof requestTopicReviewSchema>;
export type TopicReviewSubmissionInput = z.infer<typeof topicReviewSubmissionSchema>;
export type RejectTopicReviewInput = z.infer<typeof rejectTopicReviewSchema>;
export type PlatformModerationInput = z.infer<typeof platformModerationSchema>;
