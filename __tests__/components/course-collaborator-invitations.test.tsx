// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CollaboratorInvitationPanel from "@/app/(teacher)/teacher/courses/_components/CollaboratorInvitationPanel";
import {
  acceptCourseCollaboratorInvitation,
  getMyPendingCourseCollaboratorInvitations,
  rejectCourseCollaboratorInvitation,
} from "@/app/actions/course-collaborator";

vi.mock("@/app/actions/course-collaborator", () => ({
  acceptCourseCollaboratorInvitation: vi.fn(),
  getMyPendingCourseCollaboratorInvitations: vi.fn(),
  rejectCourseCollaboratorInvitation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Test plan:
// - Mục tiêu: giữ course identity trong invitation UI và làm mới course list sau accept.
// - Loại test: component interaction trong jsdom.
// - Đối tượng: CollaboratorInvitationPanel và callback refresh do trang /teacher/courses truyền xuống.
// - Case thành công: tên khóa học, vai trò và quyền duyệt hiển thị thay slug kỹ thuật; accept gọi callback rồi tải lại invitation list.
// - Case thất bại: invitation action trả lỗi thì không gọi refresh callback.
// - Bảo mật/phân quyền: component chỉ dùng DTO/action đã được server boundary kiểm tra; không tự cấp membership.
// - Ổn định/resilience: trạng thái invitation được tải lại sau mutation thành công.
// - Invariant cần giữ: course vừa accept phải được parent refresh mà không cần manual reload.
// - Kết quả verify gần nhất: passed (74 test / 4 file) bằng `npm run test:run -- __tests__/components/course-collaborator-invitations.test.tsx __tests__/components/course-workspace-routes.test.tsx __tests__/components/teacher-course-portfolio.test.tsx __tests__/components/course-authoring-trust.test.tsx`.

const invitation = {
  id: "44444444-4444-4444-8444-444444444444",
  courseId: "22222222-2222-4222-8222-222222222222",
  courseTitle: "TOEIC Basics",
  courseSlug: "toeic-basics",
  inviteeUserId: "33333333-3333-4333-8333-333333333333",
  role: "editor" as const,
  canReviewTopics: true,
  status: "pending" as const,
  createdAt: "2026-09-16T00:00:00.000Z",
  actionedAt: null,
};

const mockedAccept = vi.mocked(acceptCourseCollaboratorInvitation);
const mockedGetPending = vi.mocked(getMyPendingCourseCollaboratorInvitations);
const mockedReject = vi.mocked(rejectCourseCollaboratorInvitation);

describe("CollaboratorInvitationPanel", () => {
  beforeEach(() => {
    mockedAccept.mockReset();
    mockedGetPending.mockReset();
    mockedReject.mockReset();
    mockedGetPending
      .mockResolvedValueOnce({ data: [invitation] })
      .mockResolvedValueOnce({ data: [] });
    mockedAccept.mockResolvedValue({ success: true, data: {} });
    mockedReject.mockResolvedValue({ success: true, data: {} });
  });

  it("shows course identity and refreshes the parent after accept", async () => {
    const onAccepted = vi.fn().mockResolvedValue(undefined);
    render(<CollaboratorInvitationPanel onAccepted={onAccepted} />);

    expect(await screen.findByText("TOEIC Basics")).toBeTruthy();
    expect(screen.getByText("Biên tập viên · Có quyền duyệt bài học")).toBeTruthy();
    expect(screen.queryByText(/Slug:|toeic-basics/)).toBeNull();
    expect(screen.queryByText(`Khóa học ${invitation.courseId}`)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Chấp nhận" }));

    await waitFor(() => {
      expect(mockedAccept).toHaveBeenCalledWith({ invitationId: invitation.id });
      expect(onAccepted).toHaveBeenCalledTimes(1);
      expect(mockedGetPending).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("TOEIC Basics")).toBeNull();
    });
  });

  it("does not refresh the parent when accept fails", async () => {
    const onAccepted = vi.fn().mockResolvedValue(undefined);
    mockedAccept.mockResolvedValueOnce({ error: "Lời mời không còn hiệu lực." });
    render(<CollaboratorInvitationPanel onAccepted={onAccepted} />);

    await screen.findByText("TOEIC Basics");
    fireEvent.click(screen.getByRole("button", { name: "Chấp nhận" }));

    await waitFor(() => expect(mockedAccept).toHaveBeenCalled());
    expect(onAccepted).not.toHaveBeenCalled();
    expect(mockedGetPending).toHaveBeenCalledTimes(1);
  });
});
