import { describe, expect, it } from "vitest";
import { chapterDeleteSchema } from "@/lib/schemas/chapter";
import {
  coursePreviewAllocationSchema,
  coursePreviewMarkerMutationSchema,
} from "@/lib/schemas/course-preview";
import { topicDeleteSchema } from "@/lib/schemas/topic";

// Test plan:
// - Mục tiêu: giữ contract input cho chọn gỡ nhiều marker và DTO allocation mà C2 Server Actions công bố.
// - Loại test: unit/schema.
// - Thành công: các trường unmark tuỳ chọn mặc định rỗng; allocation hợp lệ gồm marked draft/pending và causal audit.
// - Thất bại: ID trùng, một topic vừa mark vừa unmark, quota/cause DTO sai kiểu.
// - Bảo mật/phân quyền: đây chỉ là validation shape; quyền thật do RPC PostgreSQL xác định.
// - Invariant: danh sách lựa chọn duy nhất, và suspension chỉ có thể đưa cause khi được xác minh.

const courseId = "11111111-1111-4111-8111-111111111111";
const topicId = "22222222-2222-4222-8222-222222222222";

describe("course Preview schemas", () => {
  it("defaults lifecycle selection lists without breaking existing callers", () => {
    expect(chapterDeleteSchema.parse({ chapterId: courseId })).toEqual({
      chapterId: courseId,
      unmarkTopicIds: [],
    });
    expect(topicDeleteSchema.parse({ topicId })).toEqual({
      topicId,
      confirmPublished: false,
      unmarkTopicIds: [],
    });
  });

  it("rejects duplicate destructive selections", () => {
    expect(chapterDeleteSchema.safeParse({
      chapterId: courseId,
      unmarkTopicIds: [topicId, topicId],
    }).success).toBe(false);
    expect(topicDeleteSchema.safeParse({
      topicId,
      unmarkTopicIds: [courseId, courseId],
    }).success).toBe(false);
  });

  it("rejects duplicate and overlapping marker mutations", () => {
    expect(coursePreviewMarkerMutationSchema.safeParse({
      courseId,
      markTopicIds: [topicId, topicId],
    }).success).toBe(false);
    expect(coursePreviewMarkerMutationSchema.safeParse({
      courseId,
      markTopicIds: [topicId],
      unmarkTopicIds: [topicId],
    }).success).toBe(false);
    expect(coursePreviewMarkerMutationSchema.parse({ courseId })).toMatchObject({
      markTopicIds: [],
      unmarkTopicIds: [],
    });
  });

  it("accepts an allocation bound to its exact moderation audit", () => {
    const allocation = {
      courseId,
      activeTopicCount: 5,
      markedTopicCount: 2,
      cap: 1,
      remaining: 0,
      excess: 1,
      isSuspended: true,
      causeVerified: true,
      cause: { action: "takedown", reason: "reason", targetType: "topic", targetLabel: "Lesson" },
      markedTopics: [{
        id: topicId,
        title: "Lesson",
        status: "pending",
        chapterId: courseId,
        chapterTitle: "Chapter",
        chapterOrderIndex: 1,
      }],
    };
    expect(coursePreviewAllocationSchema.parse(allocation)).toEqual(allocation);
    expect(coursePreviewAllocationSchema.safeParse({
      ...allocation,
      causeVerified: false,
      cause: allocation.cause,
    }).success).toBe(false);
  });
});
