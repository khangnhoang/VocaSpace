// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopicWorkflowPanel from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel";

vi.mock("@/app/actions/topic-review", () => ({
  approveTopicReview: vi.fn(),
  rejectTopicReview: vi.fn(),
  requestTopicReview: vi.fn(),
  resolveTopicReviewEscalation: vi.fn(),
}));

vi.mock("@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicAuthorshipSection", () => ({
  default: () => null,
}));

const baseWorkflow = {
  topicId: "11111111-1111-4111-8111-111111111111",
  courseId: "22222222-2222-4222-8222-222222222222",
  chapterId: "33333333-3333-4333-8333-333333333333",
  title: "Bài học kiểm thử",
  status: "draft" as const,
  role: "owner" as const,
  canEdit: true,
  canReview: true,
  canRequestReview: false,
  activeFlashcardCount: 0,
  activeExerciseCount: 0,
  isReady: false,
  pendingSubmissionId: null,
  pendingSubmitterId: null,
  pendingSubmissionIsRescue: false,
  isCurrentUserSubmitter: false,
  latestRejectionReason: null,
  latestRejectionReviewer: null,
  latestRejectionAt: null,
  rejectionCount: 0,
  escalationUnresolved: false,
  hasDistinctEligibleReviewer: false,
  escalationId: null,
  escalationSubmitterId: null,
  canResolveEscalation: false,
  originalCreator: { userId: "44444444-4444-4444-8444-444444444444", fullName: "Owner", email: "owner@example.com", avatarUrl: null },
  responsibleAuthor: { userId: "44444444-4444-4444-8444-444444444444", fullName: "Owner", email: "owner@example.com", avatarUrl: null },
  contributors: [],
  canManageAuthorship: true,
  isCurrentUserResponsible: true,
  isCurrentUserContributor: false,
  latestAuthorshipFeedback: null,
};

// Test plan:
// - Mục tiêu: kiểm tra state projection của readiness, feedback và luồng xử lý yêu cầu đặc biệt.
// - Loại test: component interaction trong jsdom.
// - Đối tượng: TopicWorkflowPanel.
// - Case thành công:
//   - readiness 0/0 dùng cảnh báo thông tin, không phải lỗi nghiêm trọng;
//   - feedback hiện người phản hồi khi còn trong lượt hiện tại;
//   - pending rescue ẩn action gửi trùng và mô tả đúng hậu quả khi hủy.
// - Case thất bại:
//   - feedback cũ không được hiển thị sau khi workflow đã kết thúc lượt xử lý.
// - Bảo mật/phân quyền: chỉ hiển thị action xử lý khi workflow đã cấp quyền.
// - Ổn định/resilience: state pending rescue không tạo thêm action gửi trùng.
// - Invariant cần giữ: UI không biến lịch sử đã kết thúc thành cảnh báo đang hoạt động.
// - Kết quả verify gần nhất: passed bằng focused D1 component suite.

describe("TopicWorkflowPanel", () => {
  it("renders missing content as an informational readiness state", () => {
    render(<TopicWorkflowPanel workflow={baseWorkflow} onRefresh={vi.fn()} />);

    const card = screen.getByText("Flashcard hoạt động").closest("div.rounded-xl");
    expect(card?.className).toContain("border-amber-200");
    expect(card?.className).not.toContain("border-rose-200");
    expect(screen.getByText("Bổ sung đủ ít nhất một flashcard và một bài tập để gửi duyệt.")).toBeTruthy();
  });

  it("shows current rejection provenance and hides resolved historical feedback", () => {
    const current = {
      ...baseWorkflow,
      activeFlashcardCount: 1,
      activeExerciseCount: 1,
      isReady: true,
      latestRejectionReason: "Cần bổ sung ví dụ.",
      latestRejectionReviewer: { userId: "55555555-5555-4555-8555-555555555555", fullName: "Reviewer", email: "reviewer@example.com", avatarUrl: null },
      latestRejectionAt: "2026-09-17T06:00:00.000Z",
      rejectionCount: 1,
    };
    const { rerender } = render(<TopicWorkflowPanel workflow={current} onRefresh={vi.fn()} />);
    expect(screen.getByText("Lý do cần chỉnh sửa gần nhất")).toBeTruthy();
    expect(screen.getByText(/Người phản hồi: Reviewer/)).toBeTruthy();
    expect(screen.getByText(/Bạn đã nhận 1\/3/)).toBeTruthy();

    rerender(<TopicWorkflowPanel workflow={{ ...current, status: "published" as const }} onRefresh={vi.fn()} />);
    expect(screen.queryByText("Lý do cần chỉnh sửa gần nhất")).toBeNull();

    rerender(<TopicWorkflowPanel workflow={{ ...current, latestRejectionReason: null, latestRejectionReviewer: null, latestRejectionAt: null, rejectionCount: 0 }} onRefresh={vi.fn()} />);
    expect(screen.queryByText("Lý do cần chỉnh sửa gần nhất")).toBeNull();
  });

  it("hides duplicate rescue action and explains close consequence while rescue is pending", () => {
    const rescuePending = {
      ...baseWorkflow,
      status: "pending" as const,
      activeFlashcardCount: 1,
      activeExerciseCount: 1,
      isReady: true,
      pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
      pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
      pendingSubmissionIsRescue: true,
      isCurrentUserSubmitter: true,
      escalationUnresolved: true,
      escalationId: "77777777-7777-4777-8777-777777777777",
      escalationSubmitterId: "88888888-8888-4888-8888-888888888888",
      canResolveEscalation: true,
    };
    render(<TopicWorkflowPanel workflow={rescuePending} onRefresh={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Gửi nhờ người duyệt khác" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ẩn bài học" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hủy yêu cầu và về bản nháp" }));
    expect(screen.getByText("Yêu cầu đang chờ sẽ bị hủy nếu có, bài học trở về bản nháp và lượt xử lý hiện tại được kết thúc.")).toBeTruthy();
  });
});
