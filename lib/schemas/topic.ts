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
  status: topicStatusSchema,
});

export const topicCreateSchema = topicSchema.extend({
  courseId: z.uuid("ID khóa học không hợp lệ."),
  chapterId: z.uuid("ID chương không hợp lệ."),
});

export const topicUpdateSchema = topicSchema.extend({
  topicId: z.uuid("ID bài học không hợp lệ."),
});

export const topicDeleteSchema = z.object({
  topicId: z.uuid("ID bài học không hợp lệ."),
});

export const topicAuthoringContextSchema = z.object({
  courseId: z.uuid("ID khóa học không hợp lệ."),
  topicId: z.uuid("ID bài học không hợp lệ."),
});

export const createTopicSchema = () => topicSchema;

export type TopicFormValues = z.infer<typeof topicSchema>;
export type TopicCreateInput = z.infer<typeof topicCreateSchema>;
export type TopicUpdateInput = z.infer<typeof topicUpdateSchema>;
export type TopicDeleteInput = z.infer<typeof topicDeleteSchema>;
export type TopicAuthoringContextInput = z.infer<typeof topicAuthoringContextSchema>;
