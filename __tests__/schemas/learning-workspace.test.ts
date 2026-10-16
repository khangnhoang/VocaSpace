import { describe, expect, it } from "vitest";
import {
  learningWorkspaceResultSchema,
  learningWorkspaceDataSchema,
  learningWorkspaceTopicSlugSchema,
} from "@/lib/schemas/learning-workspace";

// Test plan:
// - Mục tiêu: bảo vệ strict result states và route-topic syntax của C2.
// - Loại test: schema.
// - Đối tượng: learningWorkspaceResultSchema và learningWorkspaceTopicSlugSchema.
// - Case thành công: privacy-safe result states chấp nhận đúng shape.
// - Case thất bại: malformed slug, unknown key và incomplete success DTO bị từ chối.
// - Bảo mật/phân quyền: output không cho caller chèn field ngoài contract.
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: schema là SSOT cho route/read result boundary.
// - Kết quả verify LF9 hiện hành: xem State trong docs/programs/student-user-flow-route/progress.md.

describe("learning workspace schemas", () => {
  it("accepts only null or UUID lists for the server-owned memory gate achievement", () => {
    const schema = learningWorkspaceDataSchema.shape.memoryGateClearedCardIds;
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse([]).success).toBe(true);
    expect(schema.safeParse(["44444444-4444-4444-8444-444444444444"]).success).toBe(true);
    for (const value of [undefined, true, ["not-a-card"], [3]]) {
      expect(schema.safeParse(value).success).toBe(false);
    }
  });
  it("normalizes a valid topic slug and rejects malformed route syntax", () => {
    expect(learningWorkspaceTopicSlugSchema.parse("  bai-hoc-1  ")).toBe(
      "bai-hoc-1",
    );
    expect(learningWorkspaceTopicSlugSchema.safeParse("Bài/học").success).toBe(
      false,
    );
  });

  it.each(["auth_required", "not_found"] as const)(
    "accepts the %s state without protected data",
    (status) => {
      expect(learningWorkspaceResultSchema.parse({ status })).toEqual({
        status,
      });
    },
  );

  it("rejects unknown output keys and incomplete success data", () => {
    expect(
      learningWorkspaceResultSchema.safeParse({
        status: "topic_unavailable",
        course: { slug: "toeic-nen-tang", title: "TOEIC", topicId: "secret" },
      }).success,
    ).toBe(false);
    expect(
      learningWorkspaceResultSchema.safeParse({
        status: "success",
        data: { courseSlug: "toeic-nen-tang" },
      }).success,
    ).toBe(false);
  });
});
