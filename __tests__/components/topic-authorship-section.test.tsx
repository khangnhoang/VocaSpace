// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicAuthorshipSection from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicAuthorshipSection";

const mocks = vi.hoisted(() => ({
  getCourseCollaboratorMembers: vi.fn(),
  addTopicContributor: vi.fn(),
  removeTopicContributor: vi.fn(),
  transferTopicResponsibility: vi.fn(),
}));

vi.mock("@/app/actions/course-collaborator", () => ({
  getCourseCollaboratorMembers: mocks.getCourseCollaboratorMembers,
}));

vi.mock("@/app/actions/topic-authorship", () => ({
  addTopicContributor: mocks.addTopicContributor,
  removeTopicContributor: mocks.removeTopicContributor,
  transferTopicResponsibility: mocks.transferTopicResponsibility,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Test plan:
// - Mục tiêu: kiểm tra authorship group/read-only/feedback states ở Builder shell.
// - Loại test: component interaction trong jsdom.
// - Đối tượng: TopicAuthorshipSection.
// - Case thành công: một identity dùng chung chỉ hiển thị một thẻ; hai identity khác nhau hiển thị đủ hai thẻ; manager mở được quản lý nhóm.
// - Case thất bại: người ngoài group nhận read-only explanation; topic pending khóa CTA quản lý.
// - Bảo mật/phân quyền: UI chỉ hiển thị controls theo cờ server-derived và mutation vẫn gọi Server Action/RPC boundary.
// - Ổn định/resilience: feedback recipient-scoped vẫn discoverable sau khi workflow tải lại.
// - Invariant cần giữ: responsible author không bị đồng nhất với contributor và cap hiển thị là 2.

const baseWorkflow = {
  topicId: "11111111-1111-4111-8111-111111111111",
  courseId: "22222222-2222-4222-8222-222222222222",
  chapterId: "33333333-3333-4333-8333-333333333333",
  title: "Topic authorship",
  status: "draft" as const,
  role: "owner" as const,
  canEdit: true,
  canReview: true,
  canRequestReview: true,
  canWithdrawReview: false,
  canDeleteTopic: true,
  activeFlashcardCount: 1,
  activeExerciseCount: 1,
  isReady: true,
  pendingSubmissionId: null,
  pendingSubmitterId: null,
  isCurrentUserSubmitter: false,
  rejectionCount: 0,
  rejectionHistory: [],
  hasDistinctEligibleReviewer: true,
  originalCreator: {
    userId: "44444444-4444-4444-8444-444444444444",
    fullName: "Creator",
    email: "creator@example.com",
    avatarUrl: null,
  },
  responsibleAuthor: {
    userId: "44444444-4444-4444-8444-444444444444",
    fullName: "Responsible",
    email: "responsible@example.com",
    avatarUrl: null,
  },
  contributors: [{
    id: "55555555-5555-4555-8555-555555555555",
    userId: "66666666-6666-4666-8666-666666666666",
    fullName: "Contributor",
    email: "contributor@example.com",
    avatarUrl: null,
  }],
  canManageAuthorship: true,
  isCurrentUserResponsible: true,
  isCurrentUserContributor: false,
  latestAuthorshipFeedback: {
    id: "77777777-7777-4777-8777-777777777777",
    actorUserId: "88888888-8888-4888-8888-888888888888",
    previousResponsibleUserId: "88888888-8888-4888-8888-888888888888",
    newResponsibleUserId: "44444444-4444-4444-8444-444444444444",
    feedbackType: "responsibility_transfer" as const,
    createdAt: "2026-09-16T00:00:00.000Z",
  },
};

describe("TopicAuthorshipSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.getCourseCollaboratorMembers.mockResolvedValue({
      data: {
        currentUserId: baseWorkflow.responsibleAuthor.userId,
        members: [],
        responsibleTopicCount: 0,
      },
    });
  });

  it("renders the group, cap, feedback and opens management for an owner", async () => {
    render(<TopicAuthorshipSection workflow={baseWorkflow} onRefresh={vi.fn()} />);

    expect(screen.getByText("Người tạo và phụ trách hiện tại")).toBeTruthy();
    expect(screen.getByText("Responsible")).toBeTruthy();
    expect(screen.getByText("Contributor")).toBeTruthy();
    expect(screen.getByText("1/2 người đóng góp")).toBeTruthy();
    expect(screen.getByText(/cập nhật trách nhiệm cần xử lý/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Quản lý nhóm" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(mocks.getCourseCollaboratorMembers).toHaveBeenCalledWith({
      courseId: baseWorkflow.courseId,
    });
  });

  it("renders two identity cards when creator and responsible author differ", () => {
    const workflow = {
      ...baseWorkflow,
      responsibleAuthor: { ...baseWorkflow.responsibleAuthor, userId: "99999999-9999-4999-8999-999999999999" },
    };
    render(<TopicAuthorshipSection workflow={workflow} onRefresh={vi.fn()} />);

    expect(screen.getByText("Người phụ trách hiện tại")).toBeTruthy();
    expect(screen.getByText("Người tạo ban đầu")).toBeTruthy();
  });

  it("explains read-only access outside the topic group and freezes management while pending", () => {
    const outsideGroup = {
      ...baseWorkflow,
      role: "editor" as const,
      canEdit: false,
      canManageAuthorship: false,
      isCurrentUserResponsible: false,
      isCurrentUserContributor: false,
    };
    const { rerender } = render(<TopicAuthorshipSection workflow={outsideGroup} onRefresh={vi.fn()} />);
    expect(screen.getByText(/chưa thuộc nhóm tác giả bài học này/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quản lý nhóm" })).toBeNull();

    const pending = { ...baseWorkflow, status: "pending" as const };
    rerender(<TopicAuthorshipSection workflow={pending} onRefresh={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Quản lý nhóm" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/Nhóm tác giả đang bị khóa/)).toBeTruthy();
  });

  it("offers only the current actor or existing topic contributors for responsibility transfer", async () => {
    const actorId = "88888888-8888-4888-8888-888888888888";
    const responsibleId = "99999999-9999-4999-8999-999999999999";
    const contributorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const unrelatedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const workflow = {
      ...baseWorkflow,
      responsibleAuthor: { ...baseWorkflow.responsibleAuthor, userId: responsibleId, fullName: "Responsible editor" },
      contributors: [{ ...baseWorkflow.contributors[0], userId: contributorId, fullName: "Existing contributor" }],
      isCurrentUserResponsible: false,
    };
    mocks.getCourseCollaboratorMembers.mockResolvedValue({
      data: {
        currentUserId: actorId,
        responsibleTopicCount: 0,
        members: [
          { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", userId: actorId, role: "owner", canReviewTopics: false, email: "actor@example.com", fullName: "Actor", avatarUrl: null },
          { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", userId: responsibleId, role: "editor", canReviewTopics: true, email: "responsible@example.com", fullName: "Responsible editor", avatarUrl: null },
          { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", userId: contributorId, role: "editor", canReviewTopics: true, email: "contributor@example.com", fullName: "Existing contributor", avatarUrl: null },
          { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", userId: unrelatedId, role: "co_owner", canReviewTopics: false, email: "unrelated@example.com", fullName: "Unrelated co-owner", avatarUrl: null },
        ],
      },
    });

    render(<TopicAuthorshipSection workflow={workflow} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Quản lý nhóm" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("combobox", { name: "Người phụ trách mới" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(expect.arrayContaining([
      expect.stringMatching(/Actor/),
      expect.stringMatching(/Existing contributor/),
    ]));
    expect(screen.queryByRole("option", { name: /Unrelated co-owner/ })).toBeNull();
  });

  it("blocks direct transfer when the responsible actor has no valid recipient", async () => {
    mocks.getCourseCollaboratorMembers.mockResolvedValue({
      data: {
        currentUserId: baseWorkflow.responsibleAuthor.userId,
        responsibleTopicCount: 1,
        members: [{
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          userId: baseWorkflow.responsibleAuthor.userId,
          role: "owner",
          canReviewTopics: false,
          email: "responsible@example.com",
          fullName: "Responsible",
          avatarUrl: null,
        }],
      },
    });

    render(<TopicAuthorshipSection workflow={baseWorkflow} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Quản lý nhóm" }));
    await screen.findByRole("dialog");

    const recipientTrigger = screen.getByRole("combobox", { name: "Người phụ trách mới" });
    expect(recipientTrigger).toHaveProperty("disabled", true);
    expect(screen.getByText("Chưa có người nhận phù hợp")).toBeTruthy();
    expect(screen.getByText(/Hãy thêm người đóng góp hiện hữu/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chuyển trách nhiệm" })).toHaveProperty("disabled", true);
  });

  // U9: the amber warning must follow the real group membership, not a
  // re-derivation that forgets the creator.
  it("does not call a creator who transferred responsibility an outsider", () => {
    const transferredCreator = {
      ...baseWorkflow,
      role: "editor" as const,
      canEdit: true,
      isCurrentUserResponsible: false,
      isCurrentUserContributor: false,
    };
    render(<TopicAuthorshipSection workflow={transferredCreator} onRefresh={vi.fn()} />);

    expect(screen.queryByText(/chưa thuộc nhóm tác giả bài học này/)).toBeNull();
  });

  // U8: the creator is a group member, so they must not be offered as a
  // contributor candidate (and cannot be added — U20 enforces it in the DB).
  it("does not offer the creator as a contributor candidate", async () => {
    const actorId = "88888888-8888-4888-8888-888888888888";
    mocks.getCourseCollaboratorMembers.mockResolvedValue({
      data: {
        currentUserId: actorId,
        responsibleTopicCount: 0,
        members: [
          { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", userId: actorId, role: "owner", canReviewTopics: false, email: "actor@example.com", fullName: "Actor", avatarUrl: null },
          { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", userId: baseWorkflow.originalCreator.userId, role: "editor", canReviewTopics: false, email: "creator@example.com", fullName: "Creator", avatarUrl: null },
        ],
      },
    });

    render(<TopicAuthorshipSection workflow={baseWorkflow} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Quản lý nhóm" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("combobox", { name: "Người đóng góp mới" }));

    const options = await screen.findAllByRole("option");
    const labels = options.map((option) => option.textContent).join(" ");
    expect(labels).toMatch(/Actor/);
    expect(labels).not.toMatch(/Creator/);
  });
});
