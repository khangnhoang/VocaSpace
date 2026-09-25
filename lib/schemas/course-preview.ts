import { z } from "zod";

const topicPreviewStatusSchema = z.enum(["draft", "pending", "published"]);

const previewTopicSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: topicPreviewStatusSchema,
  chapterId: z.uuid(),
  chapterTitle: z.string(),
  chapterOrderIndex: z.number().int(),
});

const previewModerationCauseSchema = z.object({
  action: z.enum(["demote", "takedown", "invalidate_review"]),
  reason: z.string(),
  targetType: z.enum(["course", "chapter", "topic"]),
  targetLabel: z.string(),
});

export const coursePreviewAllocationSchema = z.object({
  courseId: z.uuid(),
  activeTopicCount: z.number().int().nonnegative(),
  markedTopicCount: z.number().int().nonnegative(),
  cap: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  excess: z.number().int().nonnegative(),
  isSuspended: z.boolean(),
  causeVerified: z.boolean().nullable(),
  cause: previewModerationCauseSchema.nullable(),
  markedTopics: z.array(previewTopicSummarySchema),
}).superRefine((allocation, context) => {
  const expectedCap = Math.ceil(allocation.activeTopicCount / 5);
  if (allocation.cap !== expectedCap) {
    context.addIssue({ code: "custom", path: ["cap"], message: "Giới hạn bài học xem thử không khớp số liệu." });
  }
  if (allocation.remaining !== Math.max(allocation.cap - allocation.markedTopicCount, 0)) {
    context.addIssue({ code: "custom", path: ["remaining"], message: "Số lượt xem thử còn lại không khớp phân bổ." });
  }
  if (allocation.excess !== Math.max(allocation.markedTopicCount - allocation.cap, 0)) {
    context.addIssue({ code: "custom", path: ["excess"], message: "Số bài học vượt giới hạn không khớp phân bổ." });
  }
  if (allocation.isSuspended !== (allocation.markedTopicCount > allocation.cap)) {
    context.addIssue({ code: "custom", path: ["isSuspended"], message: "Trạng thái Preview không khớp phân bổ." });
  }
  if (allocation.isSuspended && allocation.causeVerified === false && allocation.cause !== null) {
    context.addIssue({ code: "custom", path: ["cause"], message: "Không được trả lý do kiểm duyệt chưa xác minh." });
  }
  if (allocation.isSuspended && allocation.causeVerified === true && allocation.cause === null) {
    context.addIssue({ code: "custom", path: ["cause"], message: "Thiếu lý do kiểm duyệt đã xác minh." });
  }
  if (!allocation.isSuspended && (allocation.causeVerified !== null || allocation.cause !== null)) {
    context.addIssue({ code: "custom", path: ["cause"], message: "Phân bổ hợp lệ không được có cảnh báo kiểm duyệt." });
  }
});

export const coursePreviewMarkerMutationSchema = z.object({
  courseId: z.uuid("ID khóa học không hợp lệ."),
  markTopicIds: z.array(z.uuid("ID bài học không hợp lệ.")).optional().default([]),
  unmarkTopicIds: z.array(z.uuid("ID bài học không hợp lệ.")).optional().default([]),
}).superRefine((value, context) => {
  for (const [field, ids] of [
    ["markTopicIds", value.markTopicIds],
    ["unmarkTopicIds", value.unmarkTopicIds],
  ] as const) {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "Danh sách bài học có ID trùng lặp.",
      });
    }
  }
  const unmarkSet = new Set(value.unmarkTopicIds);
  if (value.markTopicIds.some((id) => unmarkSet.has(id))) {
    context.addIssue({
      code: "custom",
      path: ["unmarkTopicIds"],
      message: "Một bài học không thể vừa bật vừa tắt xem thử.",
    });
  }
});

export const chapterHidePreviewProjectionSchema = z.object({
  courseId: z.uuid(),
  chapterId: z.uuid(),
  currentAllocation: coursePreviewAllocationSchema,
  projectedActiveTopicCount: z.number().int().nonnegative(),
  projectedMarkedTopicCount: z.number().int().nonnegative(),
  projectedCap: z.number().int().nonnegative(),
  requiredUnmarkCount: z.number().int().nonnegative(),
  internalActiveTopicCount: z.number().int().nonnegative(),
  internalMarkedTopicCount: z.number().int().nonnegative(),
  outsideMarkedTopics: z.array(previewTopicSummarySchema),
  canManageMarkers: z.boolean(),
});

export const topicDeletePreviewProjectionSchema = z.object({
  courseId: z.uuid(),
  topicId: z.uuid(),
  currentAllocation: coursePreviewAllocationSchema,
  projectedActiveTopicCount: z.number().int().nonnegative(),
  projectedMarkedTopicCount: z.number().int().nonnegative(),
  projectedCap: z.number().int().nonnegative(),
  requiredUnmarkCount: z.number().int().nonnegative(),
  targetIsPreview: z.boolean(),
  canManageMarkers: z.boolean(),
  outsideMarkedTopics: z.array(previewTopicSummarySchema),
});

export type CoursePreviewAllocation = z.infer<typeof coursePreviewAllocationSchema>;
export type CoursePreviewMarkerMutationInput = z.input<typeof coursePreviewMarkerMutationSchema>;
export type ChapterHidePreviewProjection = z.infer<typeof chapterHidePreviewProjectionSchema>;
export type TopicDeletePreviewProjection = z.infer<typeof topicDeletePreviewProjectionSchema>;
