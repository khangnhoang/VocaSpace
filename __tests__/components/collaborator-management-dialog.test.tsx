// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CollaboratorManagementDialog from "@/app/(teacher)/teacher/courses/[id]/_components/CollaboratorManagementDialog";

const mocks = vi.hoisted(() => ({
  getCourseCollaboratorOverview: vi.fn(),
  getCourseCollaboratorMembers: vi.fn(),
  getCourseCollaboratorInvitations: vi.fn(),
  getCourseCollaboratorResponsibilityCandidates: vi.fn(),
  setCourseCollaboratorReviewCapability: vi.fn(),
  updateCourseCollaboratorRoleWithResponsibility: vi.fn(),
  removeCourseCollaboratorWithResponsibility: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/course-collaborator", () => ({
  getCourseCollaboratorOverview: mocks.getCourseCollaboratorOverview,
  getCourseCollaboratorMembers: mocks.getCourseCollaboratorMembers,
  getCourseCollaboratorInvitations: mocks.getCourseCollaboratorInvitations,
  getCourseCollaboratorResponsibilityCandidates: mocks.getCourseCollaboratorResponsibilityCandidates,
  setCourseCollaboratorReviewCapability: mocks.setCourseCollaboratorReviewCapability,
  updateCourseCollaboratorRoleWithResponsibility: mocks.updateCourseCollaboratorRoleWithResponsibility,
  removeCourseCollaboratorWithResponsibility: mocks.removeCourseCollaboratorWithResponsibility,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

// Test plan:
// - Mục tiêu: recipient UI của role downgrade/removal phải khớp trusted responsibility boundary.
// - Loại test: component interaction trong jsdom.
// - Case thành công: candidate actor/contributor được chọn tường minh và chuyển nguyên vẹn tới action.
// - Case thất bại: không có recipient chung cho các topic bị ảnh hưởng thì mutation bị chặn.
// - Bảo mật/phân quyền: unrelated owner/co-owner không xuất hiện trong candidate set.
// - Ổn định/resilience: candidate set nhiều topic không tự chọn fallback ngẫu nhiên.

const courseId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const targetId = "33333333-3333-4333-8333-333333333333";
const contributorId = "44444444-4444-4444-8444-444444444444";
const unrelatedId = "55555555-5555-4555-8555-555555555555";
const targetCollaboratorId = "66666666-6666-4666-8666-666666666666";

const members = [
  { id: "77777777-7777-4777-8777-777777777777", userId: actorId, role: "owner" as const, canReviewTopics: false, email: "actor@example.com", fullName: "Actor owner", avatarUrl: null },
  { id: targetCollaboratorId, userId: targetId, role: "editor" as const, canReviewTopics: true, email: "target@example.com", fullName: "Responsible editor", avatarUrl: null },
  { id: "88888888-8888-4888-8888-888888888888", userId: contributorId, role: "editor" as const, canReviewTopics: true, email: "contributor@example.com", fullName: "Existing contributor", avatarUrl: null },
  { id: "99999999-9999-4999-8999-999999999999", userId: unrelatedId, role: "co_owner" as const, canReviewTopics: false, email: "unrelated@example.com", fullName: "Unrelated co-owner", avatarUrl: null },
];

async function openDialog() {
  render(<CollaboratorManagementDialog courseId={courseId} actorRole="owner" />);
  fireEvent.click(screen.getByRole("button", { name: /Quản lý cộng tác viên/ }));
  await screen.findByText("Responsible editor");
}

describe("CollaboratorManagementDialog responsibility recipient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.getCourseCollaboratorOverview.mockResolvedValue({ data: members });
    mocks.getCourseCollaboratorInvitations.mockResolvedValue({ data: [] });
    mocks.getCourseCollaboratorMembers.mockResolvedValue({ data: { currentUserId: actorId, members, responsibleTopicCount: 0 } });
    mocks.updateCourseCollaboratorRoleWithResponsibility.mockResolvedValue({ success: true });
    mocks.removeCourseCollaboratorWithResponsibility.mockResolvedValue({ success: true });
  });

  it("does not present loading role counts as confirmed zeroes", async () => {
    let resolveMembers: ((value: { data: { currentUserId: string; members: typeof members; responsibleTopicCount: number } }) => void) | undefined;
    mocks.getCourseCollaboratorMembers.mockImplementationOnce(() => new Promise((resolve) => {
      resolveMembers = resolve;
    }));

    render(<CollaboratorManagementDialog courseId={courseId} actorRole="owner" />);
    fireEvent.click(screen.getByRole("button", { name: /Quản lý cộng tác viên/ }));

    expect(screen.getByText("Chủ sở hữu: …")).toBeTruthy();
    expect(screen.getByText("Đồng sở hữu: …")).toBeTruthy();
    expect(screen.getByText("Biên tập viên: …")).toBeTruthy();
    expect(screen.getByText("Chỉ xem trước: …")).toBeTruthy();

    await act(async () => {
      resolveMembers?.({ data: { currentUserId: actorId, members, responsibleTopicCount: 0 } });
    });
  });

  it("offers actor and existing contributors, then submits the explicit selection", async () => {
    mocks.getCourseCollaboratorResponsibilityCandidates.mockResolvedValue({
      data: {
        collaboratorId: targetCollaboratorId,
        responsibleTopicCount: 1,
        recipientUserIds: [actorId, contributorId],
      },
    });

    await openDialog();
    fireEvent.click(screen.getByRole("combobox", { name: "Đổi vai trò của Responsible editor" }));
    const roleOption = await screen.findByRole("option", { name: "Chỉ xem trước" });
    await act(async () => {
      fireEvent.click(roleOption);
      fireEvent.click(await screen.findByRole("button", { name: "Đổi vai trò" }));
    });

    await vi.waitFor(() => expect(mocks.getCourseCollaboratorResponsibilityCandidates).toHaveBeenCalledWith({ collaboratorId: targetCollaboratorId }));

    expect(screen.getByText("Chọn người nhận trách nhiệm")).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: "Người nhận trách nhiệm" }));
    expect(await screen.findByRole("option", { name: /Actor owner/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Existing contributor/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Unrelated co-owner/ })).toBeNull();

    fireEvent.click(screen.getByRole("option", { name: /Actor owner/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận thay đổi" }));
      await vi.waitFor(() => expect(mocks.updateCourseCollaboratorRoleWithResponsibility).toHaveBeenCalledWith({
        collaboratorId: targetCollaboratorId,
        role: "previewer",
        recipientUserId: actorId,
      }));
    });
  });

  it("blocks a multi-topic mutation when no shared recipient is available", async () => {
    mocks.getCourseCollaboratorResponsibilityCandidates.mockResolvedValue({
      data: {
        collaboratorId: targetCollaboratorId,
        responsibleTopicCount: 2,
        recipientUserIds: [],
      },
    });

    await openDialog();
    fireEvent.click(screen.getAllByRole("button", { name: "Gỡ" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Gỡ thành viên" }));

    await vi.waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.stringContaining("toàn bộ 2 bài học chưa được duyệt"),
    ));
    expect(mocks.removeCourseCollaboratorWithResponsibility).not.toHaveBeenCalled();
  });

  it("does not offer self-removal and keeps the current co-owner role visible", async () => {
    const coOwner = {
      ...members[3],
      fullName: "Current co-owner",
      userId: targetId,
      role: "co_owner" as const,
    };
    const coOwnerMembers = [members[0], coOwner, members[2]];
    mocks.getCourseCollaboratorOverview.mockResolvedValue({ data: coOwnerMembers });
    mocks.getCourseCollaboratorMembers.mockResolvedValue({
      data: { currentUserId: targetId, members: coOwnerMembers, responsibleTopicCount: 0 },
    });

    render(<CollaboratorManagementDialog courseId={courseId} actorRole="owner" />);
    fireEvent.click(screen.getByRole("button", { name: /Quản lý cộng tác viên/ }));
    await screen.findByText("Current co-owner");

    expect(screen.getByText(/Dùng nút “Rời khóa học” để thoát/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Gỡ" })).toHaveLength(1);

    const roleTrigger = screen.getByRole("combobox", { name: "Đổi vai trò của Current co-owner" });
    expect(roleTrigger.textContent).toContain("Đồng sở hữu");
  });
});
