// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsTab from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/SettingsTab";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";

const mocks = vi.hoisted(() => ({
  getTopicById: vi.fn(),
  updateTopic: vi.fn(),
  deleteTopic: vi.fn(),
  confirmPublishedTopicMutation: vi.fn(),
  replace: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/app/actions/topic", () => ({
  getTopicById: mocks.getTopicById,
  updateTopic: mocks.updateTopic,
  deleteTopic: mocks.deleteTopic,
}));

vi.mock("@/lib/course-authoring/topic-workflow", () => ({
  confirmPublishedTopicMutation: mocks.confirmPublishedTopicMutation,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ isOpen, onConfirm, confirmText, description }: {
    isOpen: boolean;
    onConfirm: () => void;
    confirmText: string;
    description: string;
  }) => isOpen ? (
    <div role="dialog">
      <p>{description}</p>
      <button type="button" onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null,
}));

// Test plan:
// - Mục tiêu: xác nhận xóa bài học điều hướng khỏi Builder trước khi effect đọc lại workflow của bài học đã ẩn.
// - Loại test: component interaction trong jsdom.
// - Case thành công: mutation xóa thành công gọi router.replace tới structure route và chỉ đọc topic một lần.
// - Case thất bại: không áp dụng; action error handling giữ nguyên toast và dialog để retry.
// - Bảo mật/phân quyền: component vẫn truyền confirmPublished theo quyền/trạng thái hiện tại, không tự bypass action boundary.
// - Ổn định/resilience: route transition không phụ thuộc vào một lần đọc lại topic đã bị xóa khỏi cấu trúc.
// - Invariant cần giữ: không còn stale workflow read sau khi delete thành công.

const courseId = "11111111-1111-4111-8111-111111111111";
const topicId = "22222222-2222-4222-8222-222222222222";

describe("SettingsTab topic deletion navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTopicById.mockResolvedValue({
      data: { title: "Bài học cần ẩn", status: "draft" },
    });
    mocks.deleteTopic.mockResolvedValue({ success: true, message: "Đã ẩn bài học." });
  });

  it("navigates away immediately after delete without rereading the deleted topic", async () => {
    render(<SettingsTab courseId={courseId} topicId={topicId} />);

    await screen.findByDisplayValue("Bài học cần ẩn");
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài học này" }));
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài học" }));

    await waitFor(() => expect(mocks.deleteTopic).toHaveBeenCalledWith({
      topicId,
      confirmPublished: false,
    }));
    expect(mocks.replace).toHaveBeenCalledWith(getCourseStructurePath(courseId));
    expect(mocks.getTopicById).toHaveBeenCalledTimes(1);
  });
});
