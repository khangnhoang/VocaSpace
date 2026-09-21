// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourseCollaborationLeaveDialog, { getCourseLeaveDestination } from "@/app/(teacher)/teacher/courses/[id]/_components/CourseCollaborationLeaveDialog";

const mocks = vi.hoisted(() => ({
  getCourseCollaboratorMembers: vi.fn(),
  leaveCourseCollaboration: vi.fn(),
  getCurrentUserGlobalRole: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/course-collaborator", () => ({
  getCourseCollaboratorMembers: mocks.getCourseCollaboratorMembers,
  leaveCourseCollaboration: mocks.leaveCourseCollaboration,
  getCurrentUserGlobalRole: mocks.getCurrentUserGlobalRole,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ isOpen, onConfirm, confirmText, description, title }: {
    isOpen: boolean;
    onConfirm: () => void;
    confirmText: string;
    description: string;
    title?: string;
  }) => isOpen ? (
    <div role="dialog">
      <h2>{title}</h2>
      <p>{description}</p>
      <button type="button" onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null,
}));

// Test plan:
// - Mục tiêu: kiểm tra dialog rời khóa học chỉ yêu cầu người nhận khi còn bài học chưa được duyệt cần bàn giao.
// - Loại test: component interaction trong jsdom.
// - Case thành công: không có trách nhiệm thì dialog đơn giản; có trách nhiệm thì hiển thị đúng bộ chọn và mặc định chọn owner phù hợp.
// - Case thất bại: không áp dụng; lỗi tải/mutation vẫn do component chuyển thành toast.
// - Bảo mật/phân quyền: recipient chỉ lấy từ membership data do action trả về, không tự đoán quyền ở client.
// - Ổn định/resilience: nhánh không-handoff không render control thừa.
// - Invariant cần giữ: leave transaction nhận recipient chỉ khi cần handoff.

const courseId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const ownerId = "33333333-3333-4333-8333-333333333333";

const members = [
  { id: "44444444-4444-4444-8444-444444444444", userId: actorId, role: "editor" as const, canReviewTopics: true, email: "editor@example.com", fullName: "Editor", avatarUrl: null },
  { id: "55555555-5555-4555-8555-555555555555", userId: ownerId, role: "owner" as const, canReviewTopics: false, email: "owner@example.com", fullName: "Owner", avatarUrl: null },
];

describe("CourseCollaborationLeaveDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserGlobalRole.mockResolvedValue({ data: { role: "student" } });
  });

  it("keeps the no-handoff dialog simple", async () => {
    mocks.getCourseCollaboratorMembers.mockResolvedValue({
      data: { currentUserId: actorId, members, responsibleTopicCount: 0 },
    });

    render(<CourseCollaborationLeaveDialog courseId={courseId} actorRole="editor" />);
    fireEvent.click(screen.getByRole("button", { name: "Rời khóa học" }));

    expect(await screen.findByRole("heading", { name: "Rời khóa học?" })).toBeTruthy();
    expect(screen.getByText("Sau khi rời khóa học, bạn sẽ mất các quyền cộng tác hiện tại.")).toBeTruthy();
    expect(screen.queryByText(/không có bài học chưa được duyệt cần chuyển trách nhiệm/)).toBeNull();
    expect(screen.queryByLabelText("Người nhận trách nhiệm")).toBeNull();
  });

  it("does not expose handoff mechanics while responsibility is still loading", () => {
    mocks.getCourseCollaboratorMembers.mockImplementationOnce(() => new Promise(() => {}));

    render(<CourseCollaborationLeaveDialog courseId={courseId} actorRole="editor" />);
    fireEvent.click(screen.getByRole("button", { name: "Rời khóa học" }));

    expect(screen.getByText("Đang kiểm tra trách nhiệm bài học...")).toBeTruthy();
    expect(screen.queryByText(/Hệ thống sẽ kiểm tra trách nhiệm/)).toBeNull();
    expect((screen.getByRole("button", { name: "Đang kiểm tra..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("requires a recipient only when unapproved responsibility exists", async () => {
    mocks.getCourseCollaboratorMembers.mockResolvedValue({
      data: { currentUserId: actorId, members, responsibleTopicCount: 1 },
    });

    render(<CourseCollaborationLeaveDialog courseId={courseId} actorRole="editor" />);
    fireEvent.click(screen.getByRole("button", { name: "Rời khóa học" }));

    expect(await screen.findByLabelText("Người nhận trách nhiệm")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Xác nhận rời khóa học" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("maps the global student to the public course catalog after leaving", () => {
    expect(getCourseLeaveDestination("student")).toBe("/courses");
    expect(getCourseLeaveDestination("teacher")).toBe("/teacher/courses");
    expect(getCourseLeaveDestination("admin")).toBe("/admin");
    expect(getCourseLeaveDestination(null)).toBe("/teacher/courses");
  });
});
