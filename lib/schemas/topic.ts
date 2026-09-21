// File: lib/schemas/topic.ts
import { z } from "zod";

const topicTitleSchema = z
  .string()
  .trim()
  .min(4, { message: "Tên bài học phải dài hơn 3 ký tự" })
  .max(120, { message: "Tên bài học không được quá 120 ký tự" });

export const topicStatusSchema = z.enum(["draft", "pending", "published"], {
  message: "Vui lòng chọn trạng thái",
});

export const topicSchema = z.object({
  title: topicTitleSchema,
});

export const topicCreateSchema = topicSchema.extend({
  courseId: z.uuid("ID khóa học không hợp lệ."),
  chapterId: z.uuid("ID chương không hợp lệ."),
});

export const topicUpdateSchema = topicSchema.extend({
  topicId: z.uuid("ID bài học không hợp lệ."),
  confirmPublished: z.boolean().optional().default(false),
});

export const topicDeleteSchema = z.object({
  topicId: z.uuid("ID bài học không hợp lệ."),
  confirmPublished: z.boolean().optional().default(false),
});

export const topicMoveDirectionSchema = z.enum(["up", "down"], {
  message: "Hướng di chuyển bài học không hợp lệ.",
});

export const topicMoveSchema = z.object({
  topicId: z.uuid("ID bài học không hợp lệ."),
  direction: topicMoveDirectionSchema,
});

// D34: withdrawing a pending review is its own action, not a side effect of
// delete. Same UUID rule as topicDeleteSchema.
export const topicWithdrawReviewSchema = z.object({
  topicId: z.uuid("ID bài học không hợp lệ."),
});

export const topicAuthoringContextSchema = z.object({
  courseId: z.uuid("ID khóa học không hợp lệ."),
  topicId: z.uuid("ID bài học không hợp lệ."),
});

export const createTopicSchema = () => topicSchema;

export type TopicFormValues = z.infer<typeof topicSchema>;
export type TopicCreateInput = z.infer<typeof topicCreateSchema>;
export type TopicUpdateInput = z.input<typeof topicUpdateSchema>;
export type TopicDeleteInput = z.input<typeof topicDeleteSchema>;
export type TopicMoveInput = z.infer<typeof topicMoveSchema>;
export type TopicWithdrawReviewInput = z.infer<typeof topicWithdrawReviewSchema>;
export type TopicAuthoringContextInput = z.infer<typeof topicAuthoringContextSchema>;
