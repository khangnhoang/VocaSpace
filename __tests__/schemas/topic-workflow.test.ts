import { describe, expect, it } from "vitest";
import { topicWorkflowSchema } from "@/lib/schemas/topic-workflow";

// Test plan:
// - Mục tiêu: giữ DTO workflow topic là strict contract cho lifecycle/readiness và authorship-group UI.
// - Case thành công: trạng thái draft đã đủ card và exercise được chấp nhận.
// - Case thất bại: thiếu field, field thừa hoặc count âm bị từ chối.
// - Invariant cần giữ: count active, cờ readiness và authorship/feedback đều là dữ liệu server-derived.

const validWorkflow = {
  topicId: "11111111-1111-4111-8111-111111111111",
  courseId: "22222222-2222-4222-8222-222222222222",
  chapterId: "33333333-3333-4333-8333-333333333333",
  title: "Topic",
  status: "draft" as const,
  role: "owner" as const,
  canEdit: true,
  canReview: true,
  canRequestReview: true,
  activeFlashcardCount: 1,
  activeExerciseCount: 1,
  isReady: true,
  pendingSubmissionId: null,
  pendingSubmitterId: null,
  isCurrentUserSubmitter: false,
  latestRejectionReason: null,
  rejectionCount: 0,
  escalationUnresolved: false,
  hasDistinctEligibleReviewer: true,
  escalationId: null,
  escalationSubmitterId: null,
  canResolveEscalation: true,
  originalCreator: {
    userId: "44444444-4444-4444-8444-444444444444",
    fullName: "Owner",
    email: "owner@example.com",
    avatarUrl: null,
  },
  responsibleAuthor: {
    userId: "44444444-4444-4444-8444-444444444444",
    fullName: "Owner",
    email: "owner@example.com",
    avatarUrl: null,
  },
  contributors: [],
  canManageAuthorship: true,
  isCurrentUserResponsible: true,
  isCurrentUserContributor: false,
  latestAuthorshipFeedback: null,
};

describe("topicWorkflowSchema", () => {
  it("accepts the server-derived ready workflow DTO", () => {
    expect(topicWorkflowSchema.parse(validWorkflow)).toEqual(validWorkflow);
  });

  it.each([
    ["negative card count", { activeFlashcardCount: -1 }],
    ["missing readiness field", { isReady: undefined }],
    ["unexpected client field", { clientCanPublish: true }],
  ])("rejects %s", (_label, change) => {
    const candidate = { ...validWorkflow, ...change };
    expect(topicWorkflowSchema.safeParse(candidate).success).toBe(false);
  });
});
