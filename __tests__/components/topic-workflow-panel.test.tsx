// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopicWorkflowPanel from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel";

vi.mock("@/app/actions/topic-review", () => ({
  approveTopicReview: vi.fn(),
  rejectTopicReview: vi.fn(),
  requestTopicReview: vi.fn(),
}));

vi.mock("@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicAuthorshipSection", () => ({
  default: () => null,
}));

vi.mock("@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes", () => ({
  default: () => null,
  TopicReviewNotesProvider: ({ children }: { children: React.ReactNode }) => children,
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
  isCurrentUserSubmitter: false,
  rejectionCount: 0,
  rejectionHistory: [] as Array<{
    index: number;
    reason: string;
    reviewer: { userId: string; fullName: string | null; email: string | null; avatarUrl: string | null } | null;
    reviewedAt: string;
  }>,
  hasDistinctEligibleReviewer: false,
  originalCreator: { userId: "44444444-4444-4444-8444-444444444444", fullName: "Owner", email: "owner@example.com", avatarUrl: null },
  responsibleAuthor: { userId: "44444444-4444-4444-8444-444444444444", fullName: "Owner", email: "owner@example.com", avatarUrl: null },
  contributors: [],
  canManageAuthorship: true,
  isCurrentUserResponsible: true,
  isCurrentUserContributor: false,
  latestAuthorshipFeedback: null,
};

function rejectionEntry(index: number, reason: string, reviewerFullName: string | null) {
  return {
    index,
    reason,
    reviewer: reviewerFullName === null
      ? null
      : {
          userId: "55555555-5555-4555-8555-555555555555",
          fullName: reviewerFullName,
          email: "reviewer@example.com",
          avatarUrl: null,
        },
    reviewedAt: `2026-09-${String(10 + index).padStart(2, "0")}T06:00:00.000Z`,
  };
}

// Test plan:
// - Mục tiêu: kiểm tra state projection của readiness, khối lịch sử từ chối topic-scoped và trạng thái chờ duyệt.
// - Loại test: component interaction trong jsdom.
// - Đối tượng: TopicWorkflowPanel.
// - Case thành công:
//   - readiness 0/0 dùng cảnh báo thông tin, không phải lỗi nghiêm trọng;
//   - khối lịch sử hiện mục gần nhất mặc định, mở đủ `Lần 1..N` khi bấm "Xem tất cả N lần";
//   - thời gian ra đúng dạng `HH:mm · dd/MM/yyyy` 24 giờ, không có hậu tố 12 giờ;
//   - `reviewer = null` hiện chuỗi thay thế thay vì khoảng trắng;
//   - trạng thái pending không còn action escalation nào.
// - Case thất bại:
//   - `rejectionHistory: []` (kể cả topic published) không render khối lịch sử.
// - Bảo mật/phân quyền: chỉ hiển thị action duyệt/từ chối khi workflow đã cấp quyền.
// - Ổn định/resilience: lý do dài 2000 ký tự vẫn wrap trong khối lịch sử.
// - Invariant cần giữ: không còn copy ngân sách `/3`; lịch sử cũ không dùng màu cảnh báo đỏ.
// - Kết quả verify gần nhất: passed (7 test) bằng `npx vitest run __tests__/components/topic-workflow-panel.test.tsx`.

describe("TopicWorkflowPanel", () => {
  it("renders missing content as an informational readiness state", () => {
    render(<TopicWorkflowPanel workflow={baseWorkflow} onRefresh={vi.fn()} />);

    const card = screen.getByText("Flashcard hoạt động").closest("div.rounded-xl");
    expect(card?.className).toContain("border-amber-200");
    expect(card?.className).not.toContain("border-rose-200");
    expect(screen.getByText("Bổ sung đủ ít nhất một flashcard và một bài tập để gửi duyệt.")).toBeTruthy();
  });

  it("renders the topic-scoped rejection history with the latest item open by default", () => {
    const workflow = {
      ...baseWorkflow,
      rejectionCount: 3,
      rejectionHistory: [
        rejectionEntry(1, "Cần bổ sung ví dụ.", "Reviewer cũ"),
        rejectionEntry(2, "Thiếu giải thích đáp án.", "Reviewer cũ"),
        rejectionEntry(3, "Sai phiên âm của flashcard.", "Reviewer"),
      ],
    };
    render(<TopicWorkflowPanel workflow={workflow} onRefresh={vi.fn()} />);

    expect(screen.getByText("Đã bị từ chối duyệt: 3 lần")).toBeTruthy();
    const list = screen.getByRole("list");
    expect(within(list).getByText("Lần 3")).toBeTruthy();
    expect(within(list).getByText("Sai phiên âm của flashcard.")).toBeTruthy();
    expect(within(list).queryByText("Lần 1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả 3 lần" }));
    const expanded = screen.getByRole("list");
    expect(within(expanded).getByText("Lần 1")).toBeTruthy();
    expect(within(expanded).getByText("Lần 2")).toBeTruthy();
    expect(within(expanded).getByText("Lần 3")).toBeTruthy();
    expect(within(expanded).getAllByText("Người đánh giá: Reviewer cũ")).toHaveLength(2);
  });

  it("formats the review moment as a 24-hour HH:mm · dd/MM/yyyy string", () => {
    const workflow = {
      ...baseWorkflow,
      rejectionCount: 1,
      rejectionHistory: [rejectionEntry(1, "Cần chỉnh lại tiêu đề.", "Reviewer")],
    };
    const { container } = render(<TopicWorkflowPanel workflow={workflow} onRefresh={vi.fn()} />);

    expect(container.textContent).toMatch(/\d{2}:\d{2} · \d{2}\/\d{2}\/\d{4}/);
    expect(container.textContent).not.toMatch(/CH|SA/);
    expect(container.textContent).not.toContain("/3");
    expect(container.textContent).not.toContain("lần phản hồi trong lượt gửi");
  });

  it("falls back to an explicit label when the reviewer profile is gone", () => {
    const workflow = {
      ...baseWorkflow,
      rejectionCount: 1,
      rejectionHistory: [rejectionEntry(1, "Cần bổ sung ví dụ.", null)],
    };
    render(<TopicWorkflowPanel workflow={workflow} onRefresh={vi.fn()} />);

    expect(screen.getByText("Người đánh giá: không còn trong hệ thống")).toBeTruthy();
  });

  it("wraps a 2000-character reason without dropping it and skips the block when history is empty", () => {
    const longReason = "x".repeat(2000);
    const { container, rerender } = render(
      <TopicWorkflowPanel
        workflow={{ ...baseWorkflow, rejectionCount: 1, rejectionHistory: [rejectionEntry(1, longReason, "Reviewer")] }}
        onRefresh={vi.fn()}
      />,
    );
    expect(container.textContent).toContain(longReason);

    rerender(<TopicWorkflowPanel workflow={{ ...baseWorkflow, rejectionCount: 0, rejectionHistory: [] }} onRefresh={vi.fn()} />);
    expect(screen.queryByText(/Đã bị từ chối duyệt/)).toBeNull();

    rerender(
      <TopicWorkflowPanel
        workflow={{
          ...baseWorkflow,
          status: "published" as const,
          rejectionCount: 0,
          rejectionHistory: [],
        }}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Đã bị từ chối duyệt/)).toBeNull();
  });

  it("keeps the pending state free of any escalation action", () => {
    const pending = {
      ...baseWorkflow,
      status: "pending" as const,
      activeFlashcardCount: 1,
      activeExerciseCount: 1,
      isReady: true,
      pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
      pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
      isCurrentUserSubmitter: true,
    };
    render(<TopicWorkflowPanel workflow={pending} onRefresh={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Gửi nhờ người duyệt khác" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ẩn bài học" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hủy yêu cầu và về bản nháp" })).toBeNull();
    expect(screen.getByText("Chờ một người duyệt khác xử lý yêu cầu này. Nội dung đang bị đóng băng.")).toBeTruthy();
  });

  it("only offers reviewer actions to a reviewer who is not the submitter", () => {
    const reviewerView = {
      ...baseWorkflow,
      status: "pending" as const,
      pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
      pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
    };
    const { rerender } = render(<TopicWorkflowPanel workflow={reviewerView} onRefresh={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Duyệt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeTruthy();

    rerender(
      <TopicWorkflowPanel
        workflow={{ ...reviewerView, canReview: false }}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Duyệt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Từ chối" })).toBeNull();
  });
});
